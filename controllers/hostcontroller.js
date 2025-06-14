const pool = require('../database');
const moment = require('moment');

exports.getPendingBookings = async (req, res) => {
    const hostId = req.user.id_user; // ← pastikan ini ambil dari JWT yang benar

    try {
        const result = await pool.query(`
            SELECT b.id_booking, b.user_id, b.property_id, b.start_date, b.end_date, b.status,
                    p.title, u.name AS guest_name
            FROM bookings b
            JOIN properties p ON b.property_id = p.id_property
            JOIN users u ON b.user_id = u.id_user
            WHERE p.user_id = $1 AND b.status = 'pending'
            ORDER BY b.start_date ASC
        `, [hostId]);

        res.json({ bookings: result.rows });
    } catch (err) {
        console.error("getPendingBookings error:", err);
        res.status(500).json({ error: err.message });
    }
};

// exports.acceptBooking = async (req, res) => {
//     const hostId = req.user.id_user;
//     const bookingId = req.params.bookingId;

//     // Validasi booking ID
//     if (!bookingId || isNaN(bookingId)) {
//         return res.status(400).json({ error: 'ID booking tidak valid' });
//     }

//     try {
//         // 1. Dapatkan detail booking beserta relasinya
//         const bookingQuery = `
//             SELECT 
//                 b.id_booking,
//                 b.status,
//                 p.id_property,
//                 p.user_id AS host_id,
//                 u.name AS guest_name
//             FROM bookings b
//             JOIN properties p ON b.property_id = p.id_property
//             JOIN users u ON b.user_id = u.id_user
//             WHERE b.id_booking = $1
//         `;

//         const bookingResult = await pool.query(bookingQuery, [bookingId]);
        
//         // 2. Handle jika booking tidak ditemukan
//         if (bookingResult.rows.length === 0) {
//             return res.status(404).json({ error: 'Booking tidak ditemukan' });
//         }

//         const booking = bookingResult.rows[0];
        
//         // 3. Cek kepemilikan
//         if (booking.host_id !== hostId) {
//             return res.status(403).json({
//                 error: 'Akses ditolak',
//                 message: 'Anda bukan pemilik properti ini'
//             });
//         }

//         // 4. Cek status booking
//         if (booking.status !== 'pending') {
//             return res.status(400).json({
//                 error: 'Aksi tidak valid',
//                 message: `Booking sudah dalam status: ${booking.status}`
//             });
//         }

//         // 5. Update status booking
//         await pool.query(
//             `UPDATE bookings SET status = 'confirmed' WHERE id_booking = $1`,
//             [bookingId]
//         );

//         // 6. Kirim notifikasi (opsional)
//         // await sendNotification(booking.guest_name, 'Booking Anda telah dikonfirmasi!');

//         res.json({ 
//             success: true,
//             message: 'Booking berhasil dikonfirmasi',
//             booking_id: bookingId
//         });
        
//     } catch (err) {
//         console.error('acceptBooking error:', {
//             hostId,
//             bookingId,
//             error: err.stack
//         });
        
//         res.status(500).json({ 
//             error: 'Gagal memproses konfirmasi',
//             detail: process.env.NODE_ENV === 'development' ? err.message : null
//         });
//     }
// };

exports.acceptBooking = async (req, res) => {
    const hostId = req.user.id_user;
    const bookingId = req.params.bookingId;

    if (!bookingId || isNaN(bookingId)) {
        return res.status(400).json({ error: 'ID booking tidak valid' });
    }

    try {
        // ... [bagian awal kode tetap sama] ...

        // 4. Generate kode pembayaran unik (6 karakter)
        const paymentCode = generatePaymentCode();
        
        // Kadaluarsa 3 hari (72 jam)
        const paymentExpiry = new Date();
        paymentExpiry.setDate(paymentExpiry.getDate() + 3);  // Tambah 3 hari

        // 5. Update status booking + tambahkan kode pembayaran
        await pool.query(`
            UPDATE bookings 
            SET 
                status = 'confirmed',
                payment_code = $1,
                payment_expiry = $2
            WHERE id_booking = $3
        `, [paymentCode, paymentExpiry, bookingId]);

        res.json({ 
            success: true,
            message: 'Booking berhasil dikonfirmasi',
            booking_id: bookingId,
            payment_code: paymentCode,
            payment_expiry: paymentExpiry,
            note: "Berikan kode ini ke guest untuk pembayaran offline (berlaku 3 hari)"
        });
        
    } catch (err) {
        console.error('acceptBooking error:', err);
        res.status(500).json({ 
            error: 'Gagal memproses konfirmasi',
            detail: process.env.NODE_ENV === 'development' ? err.message : null
        });
    }
};

function generatePaymentCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

exports.rejectBooking = async (req, res) => {
    const hostId = req.user.id_user;
    const bookingId = req.params.bookingId;

    // Validasi booking ID
    if (!bookingId || isNaN(bookingId)) {
        return res.status(400).json({ error: 'ID booking tidak valid' });
    }

    try {
        // 1. Dapatkan detail booking
        const bookingQuery = `
            SELECT 
                b.id_booking,
                b.status,
                p.user_id AS host_id
            FROM bookings b
            JOIN properties p ON b.property_id = p.id_property
            WHERE b.id_booking = $1
        `;

        const bookingResult = await pool.query(bookingQuery, [bookingId]);
        
        // 2. Handle jika booking tidak ditemukan
        if (bookingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Booking tidak ditemukan' });
        }

        const booking = bookingResult.rows[0];
        
        // 3. Cek kepemilikan host
        if (booking.host_id !== hostId) {
            return res.status(403).json({
                error: 'Akses ditolak',
                message: 'Anda bukan pemilik properti ini'
            });
        }

        // 4. Cek status booking
        if (booking.status !== 'pending') {
            return res.status(400).json({
                error: 'Aksi tidak valid',
                message: `Hanya bisa menolak booking dengan status pending. Status saat ini: ${booking.status}`
            });
        }

        // 5. Update status booking
        await pool.query(
            `UPDATE bookings SET status = 'rejected' WHERE id_booking = $1`,
            [bookingId]
        );

        res.json({ 
            success: true,
            message: 'Booking berhasil ditolak',
            booking_id: bookingId
        });
        
    } catch (err) {
        console.error('rejectBooking error:', {
            hostId,
            bookingId,
            error: err.stack
        });
        
        res.status(500).json({ 
            error: 'Gagal menolak booking',
            detail: process.env.NODE_ENV === 'development' ? err.message : null
        });
    }
};

exports.getHostPropertyReviews = async (req, res) => {
    const hostId = req.user.id_user; // ID host dari token

    try {
    const result = await pool.query(`
        SELECT r.rating, r.comment, r.created_at, u.name AS user_name, p.title AS property_title
        FROM reviews r
        JOIN users u ON r.user_id = u.id_user
        JOIN properties p ON r.property_id = p.id_property
        WHERE p.user_id = $1
        ORDER BY r.created_at DESC`, [hostId]);

    res.json({ reviews: result.rows });
    } catch (err) {
    res.status(500).json({ error: err.message });
    }
};

exports.completeBooking = async (req, res) => {
    const bookingId = req.params.bookingId;
    const hostId = req.user.id_user; // ID host dari token

    try {
        // 1. Dapatkan detail booking beserta kepemilikan properti
        const bookingResult = await pool.query(`
            SELECT 
                b.id_booking,
                b.status,
                b.end_date,
                p.user_id AS host_id
            FROM bookings b
            JOIN properties p ON b.property_id = p.id_property
            WHERE b.id_booking = $1
        `, [bookingId]);

        if (bookingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Booking tidak ditemukan' });
        }

        const booking = bookingResult.rows[0];
        const today = new Date();
        const endDate = new Date(booking.end_date);

        // 2. Cek otorisasi (hanya host pemilik properti)
        if (booking.host_id !== hostId) {
            return res.status(403).json({ 
                error: 'Akses ditolak',
                message: 'Hanya pemilik properti yang dapat menandai booking selesai' 
            });
        }

        // 3. Validasi status booking
        const validStatuses = ['confirmed', 'paid'];
        if (!validStatuses.includes(booking.status)) {
            return res.status(400).json({
                error: 'Status tidak valid',
                message: `Booking harus dalam status ${validStatuses.join(' atau ')}. Status saat ini: ${booking.status}`
            });
        }

        // 4. Validasi tanggal (opsional, bisa dihapus jika fleksibel)
        if (endDate > today) {
            return res.status(400).json({
                error: 'Masa booking belum selesai',
                message: `Check-out date: ${booking.end_date.toISOString().split('T')[0]}`,
                note: 'Anda bisa tetap menyelesaikan booking lebih awal jika perlu'
            });
        }

        // 5. Update status menjadi completed
        await pool.query(`
            UPDATE bookings
            SET status = 'completed'
            WHERE id_booking = $1
        `, [bookingId]);

        res.json({ 
            success: true,
            message: 'Booking berhasil ditandai sebagai selesai',
            booking_id: bookingId,
            completed_at: new Date()
        });

    } catch (err) {
        console.error('completeBooking error:', err);
        res.status(500).json({ 
            error: 'Gagal menandai booking selesai',
            detail: process.env.NODE_ENV === 'development' ? err.message : null
        });
    }
};

exports.getBookingsByStatus = async (req, res) => {
    const hostId = req.user.id_user; // host login
    const status = req.query.status; // status booking yang ingin ditampilkan

    try {
    const result = await pool.query(`
        SELECT b.*, u.name AS guest_name, p.title AS property_title
        FROM bookings b
        JOIN properties p ON b.property_id = p.id_property
        JOIN users u ON b.user_id = u.id_user
        WHERE p.user_id = $1
        AND b.status = $2
    `, [hostId, status]);

    res.json({ bookings: result.rows });
    } catch (err) {
    res.status(500).json({ error: err.message });
    }
};

