const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'properties',
        allowed_formats: ['jpg', 'jpeg', 'png'],
        transformation: [{ width: 1024, height: 768, crop: 'limit' }]
    }
});

const upload = multer({ storage: storage, limits: { fileSize: 1024 * 1024 * 5 } });

module.exports = upload;
