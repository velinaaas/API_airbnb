const jwt = require('jsonwebtoken');
const pool = require('../database');

exports.getProfile = async (req, res) => {
    try {
    const userProfile = {
        id: req.user.id_user,
        name: req.user.name,
        email: req.user.email,
        phone_number: req.user.phone_number
    };
    res.json(userProfile);
    } catch (err) {
    res.status(500).json({ error: err.message });
    }
};

exports.updateProfile = async (req, res) => {
  const userId = req.user.id_user; // Diambil dari middleware
    const { name, email, phone_number } = req.body;
    try {
    // Validasi minimal satu field diupdate
    if (!name && !email && !phone_number) {
        return res.status(400).json({ error: 'Minimal satu field harus diisi' });
    }

    // Cek jika email sudah digunakan oleh user lain
    if (email) {
        const emailCheck = await pool.query(
        'SELECT id_user FROM users WHERE email = $1 AND id_user != $2',
        [email, userId]
        );
        if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email sudah digunakan' });
        }
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name) {
        updates.push(`name = $${paramIndex}`);
        values.push(name);
        paramIndex++;
    }
    if (email) {
        updates.push(`email = $${paramIndex}`);
        values.push(email);
        paramIndex++;
    }
    if (phone_number) {
        updates.push(`phone_number = $${paramIndex}`);
        values.push(phone_number);
        paramIndex++;
    }

    updates.push(`updated_at = NOW()`);
    
    const setClause = updates.join(', ');

    const queryText = `
        UPDATE users 
        SET ${setClause}
        WHERE id_user = $${paramIndex}
        RETURNING id_user, name, email, phone_number
    `;
    values.push(userId);

    const result = await pool.query(queryText, values);

    if (result.rowCount === 0) {
        return res.status(404).json({ error: 'User tidak ditemukan' });
    }

    res.json({
        message: 'Profil berhasil diperbarui',
        user: result.rows[0]
    });
    } catch (err) {
    res.status(500).json({ error: err.message });
    } 
};

// exports.switchRole = async (req, res) => {
//     const userId = req.user.id_user;
//     const { role_id } = req.body;

//     try {
//     const roleCheck = await pool.query(
//       `SELECT * FROM user_roles WHERE user_id = $1 AND role_id = $2`,
//         [userId, role_id]
//     );

//     if (roleCheck.rows.length === 0) {
//         return res.status(403).json({ error: 'Anda tidak memiliki role ini' });
//     }

//     await pool.query(
//         `UPDATE user_roles SET active = FALSE WHERE user_id = $1`,
//         [userId]
//     );

//     await pool.query(
//         `UPDATE user_roles SET active = TRUE WHERE user_id = $1 AND role_id = $2`,
//         [userId, role_id]
//     );

//     const newRoleRes = await pool.query(`
//         SELECT r.role_name FROM roles r
//         JOIN user_roles ur ON ur.role_id = r.id_role
//         WHERE ur.user_id = $1 AND ur.active = TRUE
//     `, [userId]);

//     const newRoles = newRoleRes.rows.map(r => r.role_name);

//     const token = jwt.sign(
//         {
//         id: userId,
//         email: req.user.email,
//         roles: newRoles
//         },
//         process.env.JWT_SECRET,
//         { expiresIn: '1h' }
//     );

//     res.json({
//         message: 'Berhasil mengganti role',
//         active_role: newRoles[0],
//         token
//     });
//     } catch (error) {
//     console.error('Switch Role Error:', error);
//     res.status(500).json({ error: 'Gagal mengganti role' });
//     }
// };
exports.switchRole = async (req, res) => {
    const userId = req.user.id_user;
    const { role_id } = req.body;
    const client = await pool.connect();

    try {
    await client.query('BEGIN');

    // 1. Verifikasi role valid di tabel roles
    const roleExists = await client.query(
        `SELECT id_role FROM roles WHERE id_role = $1`,
        [role_id]
    );

    if (roleExists.rows.length === 0) {
        return res.status(404).json({ error: 'Role tidak valid' });
    }

    // 2. Cek apakah user memiliki role ini
    const userRoleCheck = await client.query(
      `SELECT * FROM user_roles 
        WHERE user_id = $1 AND role_id = $2`,
        [userId, role_id]
    );

    if (userRoleCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Anda tidak memiliki role ini' });
    }

    // 3. Nonaktifkan semua role user
    await client.query(
        `UPDATE user_roles SET active = false 
        WHERE user_id = $1`,
        [userId]
    );

    // 4. Aktifkan role yang dipilih
    const activateRes = await client.query(
        `UPDATE user_roles SET active = true 
        WHERE user_id = $1 AND role_id = $2
       RETURNING *`,  // Kembalikan hasil update
        [userId, role_id]
    );

    // 5. Verifikasi update berhasil
    if (activateRes.rows.length === 0) {
        throw new Error('Gagal mengaktifkan role');
    }

    // 6. Dapatkan nama role baru
    const newRoleRes = await client.query(
        `SELECT role_name FROM roles WHERE id_role = $1`,
        [role_id]
    );

    if (newRoleRes.rows.length === 0) {
        throw new Error('Role tidak ditemukan');
    }

    const newRoleName = newRoleRes.rows[0].role_name;

    // 7. Commit transaksi
    await client.query('COMMIT');

    // Generate token baru
    const token = jwt.sign(
        {
        id: userId,
        email: req.user.email,
        roles: [newRoleName]  // Hanya role aktif
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );

    res.json({
        message: 'Berhasil mengganti role',
        active_role: newRoleName,
        token
    });

    } catch (error) {
    await client.query('ROLLBACK');
    console.error('Switch Role Error:', error);
    
    // Pesan error spesifik
    const errorMessage = error.message.includes('tidak ditemukan') 
        ? 'Role tidak valid' 
        : 'Gagal mengganti role';
    
    res.status(500).json({ error: errorMessage });
    } finally {
    client.release();
    }
};

// exports.switchRole = async (req, res) => {
//     const { new_role } = req.body;
//     const userId = req.user.id;

//     try {
//     const roleRes = await pool.query(`SELECT id_role FROM roles WHERE role_name = $1`, [new_role]);
//     if (roleRes.rows.length === 0) {
//         return res.status(404).json({ error: 'Role tidak ditemukan' });
//     }
//     const roleId = roleRes.rows[0].id_role;

//     // Cek apakah user memang punya role ini
//     const userRole = await pool.query(
//       `SELECT * FROM user_roles WHERE user_id = $1 AND role_id = $2`,
//         [userId, roleId]
//     );

//     if (userRole.rows.length === 0) {
//         return res.status(403).json({ error: 'User tidak memiliki role ini' });
//     }

//     // Nonaktifkan semua role user
//     await pool.query(`UPDATE user_roles SET active = FALSE WHERE user_id = $1`, [userId]);

//     // Aktifkan role baru
//     await pool.query(
//         `UPDATE user_roles SET active = TRUE WHERE user_id = $1 AND role_id = $2`,
//         [userId, roleId]
//     );

//     res.json({ message: `Berhasil switch ke role ${new_role}` });

//     } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Gagal switch role' });
//     }
// };
