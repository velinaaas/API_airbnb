const jwt = require('jsonwebtoken');
const pool = require('../database');

exports.switchRole = async (req, res) => {
    const userId = req.user.id_user;
    const { role_id } = req.body;

    try {
    const roleCheck = await pool.query(
      `SELECT * FROM user_roles WHERE user_id = $1 AND role_id = $2`,
        [userId, role_id]
    );

    if (roleCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Anda tidak memiliki role ini' });
    }

    await pool.query(
        `UPDATE user_roles SET active = FALSE WHERE user_id = $1`,
        [userId]
    );

    await pool.query(
        `UPDATE user_roles SET active = TRUE WHERE user_id = $1 AND role_id = $2`,
        [userId, role_id]
    );

    const newRoleRes = await pool.query(`
        SELECT r.role_name FROM roles r
        JOIN user_roles ur ON ur.role_id = r.id_role
        WHERE ur.user_id = $1 AND ur.active = TRUE
    `, [userId]);

    const newRoles = newRoleRes.rows.map(r => r.role_name);

    const token = jwt.sign(
        {
        id: userId,
        email: req.user.email,
        roles: newRoles
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );

    res.json({
        message: 'Berhasil mengganti role',
        active_role: newRoles[0],
        token
    });
    } catch (error) {
    console.error('Switch Role Error:', error);
    res.status(500).json({ error: 'Gagal mengganti role' });
    }
};
