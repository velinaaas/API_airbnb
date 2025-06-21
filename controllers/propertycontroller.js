const pool = require('../database');

// 

exports.createProperty = async (req, res) => {
  // PERUBAHAN PENTING: ganti user_id menjadi id_user
  const userId = req.user.id_user; // << PERUBAHAN DI SINI
    if (!req.user.roles.includes('host')) {
    return res.status(403).json({ error: 'Hanya host yang dapat menambahkan properti' });
    }

    try {
    const {
        title, description, price_per_night, address,
        latitude, longitude, bedrooms, bathrooms, max_guests, category_id
    } = req.body;

    const result = await pool.query(`
        INSERT INTO properties (
        user_id, title, description, price_per_night, address, latitude,
        longitude, bedrooms, bathrooms, max_guests, is_active, created_at, updated_at, category_id
        ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, NOW(), NOW(), $11
        ) RETURNING id_property`, [
        userId, title, description, price_per_night, address,
        latitude, longitude, bedrooms, bathrooms, max_guests, category_id
        ]);

    const propertyId = result.rows[0].id_property;

    if (req.files && req.files.length > 0) {
        await Promise.all(req.files.map((file, index) => {
        const imageUrl = file.path; 
        const isCover = index === 0;
        return pool.query(`
            INSERT INTO property_photos (property_id, image_url, is_cover, created_at)
            VALUES ($1, $2, $3, NOW())
        `, [propertyId, imageUrl, isCover]);
        }));
    }

    res.status(201).json({ message: 'Properti berhasil ditambahkan', id: propertyId });
    } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menambahkan properti' });
    }
};

exports.getHostProperties = async (req, res) => {
    const userId = req.user.id_user;
  console.log('User ID dari token:', userId); // 👈 log ini!

    try {
    const result = await pool.query(

        `SELECT 
            p.id_property,
            p.title,
        p.description,
        p.price_per_night,
        p.address,
        p.latitude,
        p.longitude,
        p.bedrooms,
        p.bathrooms,
        p.max_guests,
        p.is_active,
        p.created_at,
        p.updated_at,
        c.name AS category_name,
        (
            SELECT url 
            FROM property_photos 
            WHERE property_photos.property_id = p.id_property
            ORDER BY id_photo ASC 
            LIMIT 1
            ) AS cover_photo
        FROM properties p
        LEFT JOIN categories c ON p.category_id = c.id_category
        WHERE p.user_id = $1
        ORDER BY p.created_at DESC`,
        [userId]
    );

    console.log('Jumlah properti:', result.rows.length); // 👈 log ini juga

    res.status(200).json({
        properties: result.rows
    });
    } catch (err) {
    console.error('Error mengambil properti host:', err);
    res.status(500).json({ error: 'Gagal mengambil properti' });
    }
};


// exports.getHostProperties = async (req, res) => {
//     try {
//     const userId = req.user.user_id;

//     // Pastikan user adalah host
//     if (!req.user.roles.includes('host')) {
//         return res.status(403).json({ error: 'Hanya host yang dapat mengakses properti ini' });
//     }

//     // Ambil daftar properti milik host
//     const properties = await pool.query(`
//         SELECT 
//         p.id_property, p.title, p.description, p.price_per_night, p.address,
//         p.latitude, p.longitude, p.bedrooms, p.bathrooms, p.max_guests,
//         p.is_active, p.created_at, p.updated_at,
//         c.category_id,
//         COALESCE(json_agg(
//             json_build_object(
//             'image_url', pp.image_url,
//             'is_cover', pp.is_cover
//             )
//         ) FILTER (WHERE pp.image_url IS NOT NULL), '[]') AS photos
//         FROM properties p
//         LEFT JOIN categories c ON p.category_id = c.id_category
//         LEFT JOIN property_photos pp ON p.id_property = pp.property_id
//         WHERE p.user_id = $1
//         GROUP BY p.id_property, c.id_category
//         ORDER BY p.created_at DESC
//     `, [userId]);

//     res.status(200).json({ properties: properties.rows });
//     } catch (err) {
//     console.error('Error getHostProperties:', err);
//     res.status(500).json({ error: 'Gagal mengambil properti host' });
//     }
// };

exports.updateProperty = async (req, res) => {
const propertyId = req.params.id;
const updates = req.body;
try {
    const allowedFields = [
        'title', 'description', 'price_per_night', 'address',
        'latitude', 'longitude', 'bedrooms', 'bathrooms',
        'max_guests', 'is_active', 'category_id'
    ];
    
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${paramIndex}`);
        values.push(updates[field]);
        paramIndex++;
        }
    }

    if (setClauses.length === 0) {
        return res.status(400).json({ error: 'Tidak ada data untuk diupdate' });
    }

    setClauses.push('updated_at = NOW()');

    values.push(propertyId);
    const whereClause = `WHERE id_property = $${paramIndex}`;
    
    const query = `
        UPDATE properties
        SET ${setClauses.join(', ')}
        ${whereClause}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    
    if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Gagal mengupdate properti' });
    }

    res.json({
        message: 'Properti berhasil diupdate',
        property: result.rows[0]
    });
    
    } catch (err) {
    if (err.code === '23505') { 
        return res.status(400).json({ error: 'Judul sudah digunakan' });
    }
    
    if (err.code === '23503') { 
        return res.status(400).json({ error: 'Kategori tidak valid' });
    }
    
    res.status(500).json({ error: 'Server error', details: err.message });
    }
};

// exports.deleteHostProperty = async (req, res) => {
//     const propertyId = req.params.id;
//     const userId = req.user.user_id;

//     try {
//     // 1. Soft delete properti
//     const result = await pool.query(
//         `UPDATE properties 
//         SET is_active = false
//         WHERE id_property = $1
//         AND user_id = $2
//         RETURNING id_property, title`,
//         [propertyId, userId]
//     );

//     if (result.rowCount === 0) {
//         return res.status(404).json({ error: 'Properti tidak ditemukan atau gagal dihapus' });
//     }

//     // 2. Kirim response
//     res.json({
//         message: 'Properti berhasil dihapus',
//         deleted_property: result.rows[0]
//     });
    
//     } catch (err) {
//     res.status(500).json({ error: err.message });
//     } 
// };

exports.deleteHostProperty = async (req, res) => {
    const propertyId = parseInt(req.params.id); // pastikan integer
    const userId = req.user.id_user; // ← FIXED

    try {
        // 1. Soft delete properti
        const result = await pool.query(
            `UPDATE properties 
                SET is_active = false
                WHERE id_property = $1 AND user_id = $2
                RETURNING id_property, title`,
            [propertyId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Properti tidak ditemukan atau gagal dihapus' });
        }

        // 2. Kirim response
        res.json({
            message: 'Properti berhasil dihapus',
            deleted_property: result.rows[0]
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
