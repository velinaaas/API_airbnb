const pool = require('../database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    const { name, email, password, phone_number } = req.body;

    try {
        const checkEmail = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
        if (checkEmail.rows.length > 0) {
            return res.status(400).json({ error: 'Email sudah terdaftar' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const userResult = await pool.query(
            `INSERT INTO users (name, email, password_hash, phone_number, created_at, updated_at)
                VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id_user, name, email`,
            [name, email, hashedPassword, phone_number]
        );

        const userId = userResult.rows[0].id_user;

        const roleRes = await pool.query(
            `SELECT id_role, role_name FROM roles WHERE role_name IN ('guest', 'host')`
        );

        if (roleRes.rows.length < 2) {
            return res.status(500).json({ error: 'Role "guest" dan/atau "host" belum tersedia di database' });
        }

        const insertRolePromises = roleRes.rows.map(role => {
        const isGuest = role.role_name === 'guest';
            return pool.query(
            `INSERT INTO user_roles (user_id, role_id, active) VALUES ($1, $2, $3)`,
            [userId, role.id_role, isGuest]
        ); 
        });


        await Promise.all(insertRolePromises);

        res.status(201).json({
            message: 'User berhasil terdaftar dengan role guest dan host',
            user: userResult.rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// exports.register = async (req, res) => {
//     const { name, email, password, phone_number } = req.body;
//     try {
//     const checkEmail = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
//     if (checkEmail.rows.length > 0) {
//         return res.status(400).json({ error: 'Email sudah terdaftar' });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     // Insert user ke database
//     const userResult = await pool.query(
//         `INSERT INTO users (name, email, password_hash, phone_number, created_at, updated_at)
//         VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id_user, name, email`,
//         [name, email, hashedPassword, phone_number]
//     );

//     const userId = userResult.rows[0].id_user;

//     const roleRes = await pool.query(`SELECT id_role FROM roles WHERE role_name = 'guest'`);
//     if (roleRes.rows.length === 0) {
//         return res.status(500).json({ error: 'Role "guest" belum tersedia di database' });
//     }

//     const roleId = roleRes.rows[0].id_role;

//     await pool.query(
//         `INSERT INTO user_roles (user_id, role_id, active) VALUES ($1, $2, TRUE)`,
//         [userId, roleId]
//     );

//     res.status(201).json({ message: 'User berhasil terdaftar', user: userResult.rows[0] });
//     } catch (err) {
//     res.status(500).json({ error: err.message });
//     }
// };

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Email tidak ditemukan' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
        return res.status(401).json({ error: 'Password salah' });
    }

    const roleResult = await pool.query(`
        SELECT r.role_name FROM roles r
        JOIN user_roles ur ON ur.role_id = r.id_role
        WHERE ur.user_id = $1 AND ur.active = TRUE`, [user.id_user]);

    const roles = roleResult.rows.map(r => r.role_name);

    const token = jwt.sign(
        {
        id: user.id_user,
        email: user.email,
        roles
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );

    res.json({ message: 'Login berhasil', token, roles });
    } catch (err) {
    res.status(500).json({ error: err.message });
    }
};
