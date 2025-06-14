const express = require('express');
const router = express.Router();
const authController = require('../controllers/authcontroller');
const { verifyToken } = require('../middlewares/authmiddleware');


router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;
