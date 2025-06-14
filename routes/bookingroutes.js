const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authmiddleware');
const bookingController = require('../controllers/bookingcontroller');

router.post('/book', verifyToken, bookingController.bookProperty);

module.exports = router;
