const jwt = require('jsonwebtoken');
const pool = require('../database');

exports.verifyToken = async (req, res, next) => {
    try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Token tidak ditemukan' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userResult = await pool.query(
        'SELECT id_user, name, email, phone_number, created_at FROM users WHERE id_user = $1',
        [decoded.id]
    );

    if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User tidak valid' });
    }

    req.user = {
        id_user: decoded.id,
        ...userResult.rows[0],
        roles: decoded.roles || [], 
    };

    next();
    } catch (err) {
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token kedaluwarsa' });
    }
    res.status(403).json({ error: 'Token tidak valid' });
    }
};

// exports.verifyHost = async (req, res, next) => {
//     const userId = req.user.id_user;
//     try {
//         const result = await pool.query(
//             `SELECT r.role_name
//                 FROM user_roles ur
//                 JOIN roles r ON ur.role_id = r.id_role
//                 WHERE ur.user_id = $1 AND ur.active = true`,
//             [userId]
//         );

//         if (result.rows.length === 0 || result.rows[0].role_name !== 'host') {
//             return res.status(403).json({ error: 'Hanya host yang dapat mengakses fitur ini' });
//         }

//         next();
//     } catch (err) {
//         console.error('verifyHost error:', err);
//         res.status(500).json({ error: err.message });
//     }
// };

exports.verifyHost = async (req, res, next) => {
    const userId = req.user.id_user;
    
    try {
        const result = await pool.query(
            `SELECT r.role_name
                FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id_role
                WHERE ur.user_id = $1 
                AND ur.active = true
                AND r.role_name ILIKE 'host'`, // ILIKE untuk case-insensitive
            [userId]
        );

        // Cek apakah ada minimal satu peran 'host' aktif
        const isHost = result.rows.some(row => 
            row.role_name.toLowerCase() === 'host'
        );

        if (!isHost) {
            return res.status(403).json({ 
                error: 'Hanya host yang dapat mengakses fitur ini' 
            });
        }

        next();
    } catch (err) {
        console.error('verifyHost error:', err);
        res.status(500).json({ error: 'Internal server error' }); // Pesan ambigu untuk client
    }
};


exports.verifyPropertyOwner = async (req, res, next) => {
    const propertyId = req.params.id;
    const userId = req.user.id_user; 

    try {
    const result = await pool.query(
        `SELECT user_id FROM properties WHERE id_property = $1`,
        [propertyId]
    );
    
    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Properti tidak ditemukan' });
    }
    
    const ownerId = result.rows[0].user_id;
    if (ownerId !== userId && !req.user.roles.includes('host')) {
        return res.status(403).json({ error: 'Akses ditolak' });
    }
    
    next();
    } catch (err) {
    res.status(500).json({ error: err.message });
    }
};