const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/propertycontroller');
const { verifyToken } = require('../middlewares/authmiddleware');
const { verifyHost, verifyPropertyOwner } = require('../middlewares/authmiddleware');
const upload = require('../middlewares/uploadCloudinary');

router.post('/add', verifyToken, upload.array('photos', 5), propertyController.createProperty);
router.get('/get-host', verifyToken, propertyController.getHostProperties);
router.put('/update/:id',verifyToken,verifyPropertyOwner,propertyController.updateProperty);
router.delete('/delete/:id',verifyToken,verifyHost,verifyPropertyOwner,propertyController.deleteHostProperty);

module.exports = router;