const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authmiddleware');
const userController = require('../controllers/usercontroller');

router.get('/profile', verifyToken, userController.getProfile);
router.put('/update-profile', verifyToken, userController.updateProfile);

router.post('/switch-role', verifyToken, userController.switchRole);

module.exports = router;