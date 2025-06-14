const pool = require('../database');

// exports.bookProperty = async (req, res) => {
//     const { property_id, check_in, check_out, guests } = req.body;
//     const user_id = req.user.id_user;

//     try {
//         const inDate = new Date(check_in);
//         const outDate = new Date(check_out);

//         if (outDate <= inDate) {
//             return res.status(400).json({ error: 'Tanggal check-out harus setelah check-in' });
//         }

//         // Cek apakah user punya role 'guest' yang aktif
//         const roleCheck = await pool.query(`
//             SELECT * FROM user_roles ur
//             JOIN roles r ON ur.role_id = r.id_role
//             WHERE ur.user_id = $1 AND r.role_name = 'guest' AND ur.active = TRUE
//         `, [user_id]);

//         if (roleCheck.rows.length === 0) {
//             return res.status(403).json({ error: 'Hanya pengguna dengan role guest yang bisa melakukan booking' });
//         }

//         // Cek apakah properti tersedia (is_active = TRUE)
//         const propRes = await pool.query(`
//             SELECT price_per_night, is_active FROM properties WHERE id_property = $1
//         `, [property_id]);

//         if (propRes.rows.length === 0) {
//             return res.status(404).json({ error: 'Properti tidak ditemukan' });
//         }

//         if (!propRes.rows[0].is_active) {
//             return res.status(400).json({ error: 'Properti tidak tersedia untuk dibooking' });
//         }

//         // Cek konflik tanggal booking
//         const conflict = await pool.query(`
//             SELECT * FROM bookings
//             WHERE property_id = $1
//             AND NOT ($3 <= start_date OR $2 >= end_date)
//         `, [property_id, check_in, check_out]);

//         if (conflict.rows.length > 0) {
//             return res.status(409).json({ error: 'Properti sudah dibooking di tanggal tersebut' });
//         }

//         const pricePerNight = propRes.rows[0].price_per_night;
//         const totalDays = Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24));
//         const total_price = totalDays * pricePerNight;

//         const insert = await pool.query(`
//             INSERT INTO bookings (user_id, property_id, start_date, end_date, total_price, status)
//             VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *
//         `, [user_id, property_id, check_in, check_out, total_price]);

//         res.status(201).json({ message: 'Booking berhasil', booking: insert.rows[0] });

//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// };


exports.bookProperty = async (req, res) => {
    const { property_id, check_in, check_out, guests } = req.body;
    const user_id = req.user.id_user;

    try {
        const inDate = new Date(check_in);
        const outDate = new Date(check_out);

        if (outDate <= inDate) {
            return res.status(400).json({ error: 'Tanggal check-out harus setelah check-in' });
        }

        // Cek role guest aktif
        const roleCheck = await pool.query(`
            SELECT * FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id_role
            WHERE ur.user_id = $1 AND r.role_name = 'guest' AND ur.active = TRUE
        `, [user_id]);

        if (roleCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Hanya pengguna dengan role guest yang bisa melakukan booking' });
        }

        // Cek ketersediaan properti
        const propRes = await pool.query(`
            SELECT price_per_night, is_active FROM properties WHERE id_property = $1
        `, [property_id]);

        if (propRes.rows.length === 0) {
            return res.status(404).json({ error: 'Properti tidak ditemukan' });
        }

        if (!propRes.rows[0].is_active) {
            return res.status(400).json({ error: 'Properti tidak tersedia untuk dibooking' });
        }

        // Cek konflik tanggal (hanya hitung status aktif)
        const conflict = await pool.query(`
            SELECT * FROM bookings
            WHERE property_id = $1
            AND NOT ($3 <= start_date OR $2 >= end_date)
            AND status NOT IN ('canceled', 'rejected')
        `, [property_id, check_in, check_out]);

        if (conflict.rows.length > 0) {
            return res.status(409).json({ error: 'Properti sudah dibooking di tanggal tersebut' });
        }

        const pricePerNight = propRes.rows[0].price_per_night;
        const totalDays = Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24));
        const total_price = totalDays * pricePerNight;

        const insert = await pool.query(`
            INSERT INTO bookings (user_id, property_id, start_date, end_date, total_price, status)
            VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *
        `, [user_id, property_id, check_in, check_out, total_price]);

        res.status(201).json({ message: 'Booking berhasil', booking: insert.rows[0] });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
