const pool = require('../database');

exports.getGuestProperties = async (req, res) => {
    try {
    const result = await pool.query(`
        SELECT 
        p.id_property,
        p.title,
        p.price_per_night,
        pp.image_url AS cover_photo,
        COALESCE(ROUND(AVG(r.rating), 1), 0) AS average_rating
        FROM properties p
        LEFT JOIN property_photos pp 
        ON pp.property_id = p.id_property AND pp.is_cover = TRUE
        LEFT JOIN reviews r 
        ON r.property_id = p.id_property
        WHERE p.is_active = TRUE
        GROUP BY p.id_property, pp.image_url
        ORDER BY p.created_at DESC
    `);

    res.json({
        message: 'Berhasil mengambil daftar properti',
        data: result.rows
    });
    } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    } 
};

// Detail properti untuk guest
exports.getPropertyDetail = async (req, res) => {
    const propertyId = req.params.id;

    try {
    // Ambil data properti utama
    const propertyResult = await pool.query(`
        SELECT 
        p.id_property,
        p.title,
        p.description,
        p.price_per_night,
        p.bedrooms,
        p.bathrooms,
        p.max_guests,
        p.address,
        p.latitude,
        p.longitude,
        COALESCE(AVG(r.rating), 0) AS average_rating,
        u.name AS host_name,
        u.email AS host_email
        FROM properties p
        LEFT JOIN reviews r ON r.property_id = p.id_property
        JOIN users u ON u.id_user = p.user_id
        WHERE p.id_property = $1
        GROUP BY p.id_property, u.name, u.email`, [propertyId]);

    if (propertyResult.rows.length === 0) {
        return res.status(404).json({ error: 'Properti tidak ditemukan' });
    }

    const property = propertyResult.rows[0];

    // Ambil foto-foto properti
    const photosResult = await pool.query(`
        SELECT image_url, is_cover FROM property_photos WHERE property_id = $1
    `, [propertyId]);

    // Ambil ulasan
    const reviewsResult = await pool.query(`
        SELECT 
        r.rating,
        r.comment,
        r.created_at,
        u.name AS reviewer_name
        FROM reviews r
        JOIN users u ON r.user_id = u.id_user
        WHERE r.property_id = $1
        ORDER BY r.created_at DESC
    `, [propertyId]);

    res.json({
        ...property,
        photos: photosResult.rows,
        reviews: reviewsResult.rows
    });

    } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal mengambil detail properti' });
    }
};

exports.getPropertiesByCategoryName = async (req, res) => {
    const { categoryName } = req.params;

    try {
    const result = await pool.query(`
        SELECT
        p.id_property,
        p.title,
        p.price_per_night,
        COALESCE(AVG(r.rating), 0) AS avg_rating,
        pp.image_url AS cover_image
        FROM properties p
        LEFT JOIN reviews r ON p.id_property = r.property_id
        LEFT JOIN property_photos pp ON p.id_property = pp.property_id AND pp.is_cover = true
        JOIN categories c ON p.category_id = c.id_category
        WHERE LOWER(c.name) = LOWER($1)
        GROUP BY p.id_property, pp.image_url`, [categoryName]);

    res.json(result.rows);
    } catch (err) {
    res.status(500).json({ error: err.message });
    } 
};

// exports.filterProperties = async (req, res) => {
//     const { location, check_in, check_out, guests } = req.query;

//     try {
//     const query = `
//         SELECT 
//         p.id_property, p.title, p.price_per_night, p.latitude, p.longitude,
//         (SELECT AVG(r.rating) FROM reviews r WHERE r.property_id = p.id_property) AS average_rating,
//         (SELECT image_url FROM property_photos WHERE property_id = p.id_property AND is_cover = true LIMIT 1) AS cover_photo
//         FROM properties p
//         WHERE 
//         p.address ILIKE $1 AND
//         p.max_guests >= $2 AND
//         p.is_active = true
//     `;

//     const result = await pool.query(query, [`%${location}%`, guests]);
//     res.json(result.rows);
//     } catch (err) {
//     res.status(500).json({ error: err.message });
//     }
// };

exports.filterProperties = async (req, res) => {
    const { location, check_in, check_out, guests } = req.query;

    // Validasi parameter wajib
    if (!location) {
        return res.status(400).json({ error: "Parameter lokasi wajib diisi" });
    }

    // Validasi tipe data
    const numGuests = parseInt(guests);
    if (isNaN(numGuests)) {
        return res.status(400).json({ error: "Jumlah tamu harus angka" });
    }

    // Validasi tanggal
    if (check_in && check_out) {
        const checkInDate = new Date(check_in);
        const checkOutDate = new Date(check_out);
        
        if (checkInDate >= checkOutDate) {
            return res.status(400).json({ 
                error: "Tanggal check-out harus setelah check-in" 
            });
        }
    }

    try {
        // Escape karakter khusus untuk ILIKE
        const escapedLocation = location.replace(/%/g, "\\%").replace(/_/g, "\\_");
        
        // Base query
        let query = `
            SELECT 
                p.id_property, 
                p.title, 
                p.price_per_night, 
                p.latitude, 
                p.longitude,
                p.address,
                p.max_guests,
                COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.property_id = p.id_property), 0) AS average_rating,
                (SELECT image_url FROM property_photos WHERE property_id = p.id_property AND is_cover = true LIMIT 1) AS cover_photo
            FROM properties p
            WHERE 
                p.address ILIKE $1
                AND p.max_guests >= $2
                AND p.is_active = true
        `;

        const params = [`%${escapedLocation}%`, numGuests];

        // Filter ketersediaan tanggal jika ada
        if (check_in && check_out) {
            query += `
                AND p.id_property NOT IN (
                    SELECT b.property_id
                    FROM bookings b
                    WHERE 
                        b.status NOT IN ('cancelled', 'rejected')
                        AND b.start_date <= $4
                        AND b.end_date >= $3
                )
            `;
            params.push(check_in, check_out);
        }

        const result = await pool.query(query, params);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Tidak ada properti yang tersedia untuk kriteria pencarian Anda"
            });
        }

        res.json(result.rows);
    } catch (err) {
        console.error("filterProperties error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

exports.getBookingHistory = async (req, res) => {
    try {
        const userId = req.user.id_user;

        const result = await pool.query(`
            SELECT
                b.id_booking,
                b.start_date,
                b.end_date,
                b.total_price,
                b.status,
                b.payment_code,
                b.payment_expiry,
                p.id_property,
                p.title,
                p.address,
                pp.image_url AS cover_image,
                -- Tambahkan status kadaluarsa virtual
                CASE
                    WHEN b.status = 'confirmed' 
                        AND b.payment_expiry < NOW() 
                    THEN true
                    ELSE false
                END AS is_expired
            FROM bookings b
            JOIN properties p ON b.property_id = p.id_property
            LEFT JOIN property_photos pp ON p.id_property = pp.property_id AND pp.is_cover = true
            WHERE b.user_id = $1
            ORDER BY b.created_at DESC
        `, [userId]);

        // Format respons untuk tambahkan info kadaluarsa
        const bookings = result.rows.map(booking => {
            const bookingData = {
                id: booking.id_booking,
                start_date: booking.start_date,
                end_date: booking.end_date,
                total_price: booking.total_price,
                status: booking.status,
                property: {
                    id: booking.id_property,
                    title: booking.title,
                    address: booking.address,
                    cover_image: booking.cover_image
                },
                payment: null
            };

            // Tambahkan info pembayaran jika ada kode
            if (booking.payment_code) {
                bookingData.payment = {
                    code: booking.payment_code,
                    expiry: booking.payment_expiry,
                    is_expired: booking.is_expired,
                    instructions: booking.is_expired 
                        ? "Kode pembayaran telah kadaluarsa" 
                        : "Tunjukkan kode ini untuk pembayaran offline"
                };
                
                // Update status booking jika kadaluarsa
                if (booking.is_expired && booking.status === 'confirmed') {
                    bookingData.status = 'expired';
                }
            }

            return bookingData;
        });

        res.json({ bookings });
    } catch (err) {
        console.error('Error getBookingHistory:', err);
        res.status(500).json({ error: 'Gagal mengambil riwayat booking' });
    }
};

// exports.getBookingHistory = async (req, res) => {
//     try {
//         const userId = req.user.id_user;

//         const result = await pool.query(`
//             SELECT
//                 b.id_booking,
//                 b.start_date,
//                 b.end_date,
//                 b.total_price,
//                 b.status,
//                 b.payment_code,  -- Tambahkan kolom payment_code
//                 b.payment_expiry, -- Tambahkan kolom payment_expiry
//                 (NOW() > b.payment_expiry) AS payment_expired, -- Hitung status kadaluarsa
//                 p.id_property,
//                 p.title,
//                 p.address,
//                 pp.image_url AS cover_image
//             FROM bookings b
//             JOIN properties p ON b.property_id = p.id_property
//             LEFT JOIN property_photos pp ON p.id_property = pp.property_id AND pp.is_cover = true
//             WHERE b.user_id = $1
//             ORDER BY b.created_at DESC
//         `, [userId]);

//         // Format respons untuk tambahkan info pembayaran
//         const bookings = result.rows.map(booking => {
//             const bookingData = {
//                 id: booking.id_booking,
//                 start_date: booking.start_date,
//                 end_date: booking.end_date,
//                 total_price: booking.total_price,
//                 status: booking.status,
//                 property: {
//                     id: booking.id_property,
//                     title: booking.title,
//                     address: booking.address,
//                     cover_image: booking.cover_image
//                 }
//             };

//             // Tambahkan info pembayaran jika status confirmed dan ada kode
//             if (booking.status === 'confirmed' && booking.payment_code) {
//                 bookingData.payment = {
//                     code: booking.payment_code,
//                     expiry: booking.payment_expiry,
//                     expired: booking.payment_expired,
//                     instructions: "Tunjukkan kode ini untuk pembayaran offline"
//                 };
//             }

//             return bookingData;
//         });

//         res.json({ bookings });
//     } catch (err) {
//         console.error('Error getBookingHistory:', err);
//         res.status(500).json({ error: 'Gagal mengambil riwayat booking' });
//     }
// };

exports.cancelBooking = async (req, res) => {
    const bookingId = req.params.bookingId;
    const userId = req.user.id_user;

    try {
    const booking = await pool.query(`
      SELECT * FROM bookings
        WHERE id_booking = $1 AND user_id = $2 AND status != 'canceled'`, [bookingId, userId]);

    if (booking.rows.length === 0) {
        return res.status(404).json({ error: 'Booking tidak ditemukan atau sudah dibatalkan' });
    }

    await pool.query(`
        UPDATE bookings
        SET status = 'canceled'
        WHERE id_booking = $1
    `, [bookingId]);

    res.json({ message: 'Booking berhasil dibatalkan' });
    } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal membatalkan booking' });
    }
};

exports.addReview = async (req, res) => {
    const { property_id, rating, comment } = req.body;
    const userId = req.user.id_user;

    // Debug: log ID pengguna dan properti
    console.log("DEBUG - User ID:", userId);
    console.log("DEBUG - Property ID:", property_id);

    try {
        // Cek booking yang status-nya 'completed' dan belum direview
        const bookingCheck = await pool.query(`
            SELECT b.id_booking 
            FROM bookings b
            LEFT JOIN reviews r ON b.id_booking = r.booking_id
            WHERE 
                b.user_id = $1 
                AND b.property_id = $2 
                AND b.status = 'completed' 
                AND r.booking_id IS NULL
            LIMIT 1
        `, [userId, property_id]);

        // Debug: tampilkan hasil query
        console.log("DEBUG - Booking check result:", bookingCheck.rows);

        if (bookingCheck.rows.length === 0) {
            return res.status(403).json({ 
                error: 'Review gagal: Anda belum menyelesaikan booking atau sudah memberikan review' 
            });
        }

        const bookingId = bookingCheck.rows[0].id_booking;

        // Tambahkan review
        await pool.query(`
            INSERT INTO reviews (property_id, user_id, booking_id, rating, comment)
            VALUES ($1, $2, $3, $4, $5)
        `, [property_id, userId, bookingId, rating, comment]);

        res.status(201).json({ message: 'Review berhasil ditambahkan' });
    } catch (err) {
        console.error("DEBUG - Error saat tambah review:", err);
        
        if (err.code === '23505') { 
            return res.status(409).json({ error: 'Anda sudah memberikan review untuk booking ini' });
        }

        res.status(500).json({ error: err.message });
    }
};


// exports.addReview = async (req, res) => {
//     const { property_id, rating, comment } = req.body;
//     const userId = req.user.id;

//     try {
//     const bookingCheck = await pool.query(`
//         SELECT id_booking FROM bookings 
//         WHERE user_id = $1 AND property_id = $2 AND status = 'confirmed'`, [userId, property_id]);

//     if (bookingCheck.rows.length === 0) {
//         return res.status(403).json({ error: 'Anda belum booking properti ini atau belum dikonfirmasi' });
//     }

//     const bookingId = bookingCheck.rows[0].id_booking;

//     await pool.query(`
//         INSERT INTO reviews (property_id, user_id, booking_id, rating, comment)
//         VALUES ($1, $2, $3, $4, $5)`, [property_id, userId, bookingId, rating, comment]);

//     res.status(201).json({ message: 'Review berhasil ditambahkan' });
//     } catch (err) {
//     res.status(500).json({ error: err.message });
//     }
// };

exports.getPropertyReviews = async (req, res) => {
    const propertyId = req.params.id;

    try {
    const result = await pool.query(`
        SELECT r.rating, r.comment, r.created_at, u.name AS user_name
        FROM reviews r
        JOIN users u ON r.user_id = u.id_user
        WHERE r.property_id = $1
        ORDER BY r.created_at DESC`, [propertyId]);

    res.json({ reviews: result.rows });
    } catch (err) {
    res.status(500).json({ error: err.message });
    }
};

