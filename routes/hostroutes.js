const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authmiddleware');
const hostController = require('../controllers/hostcontroller');

router.get('/bookings/pending', verifyToken, hostController.getPendingBookings);
router.patch('/bookings/:bookingId/accept', verifyToken, hostController.acceptBooking);
router.patch('/bookings/:bookingId/reject', verifyToken, hostController.rejectBooking);
router.patch('/bookings/:bookingId/complete', verifyToken, hostController.completeBooking);
router.get('/host/reviews', verifyToken, hostController.getHostPropertyReviews);
router.get('/host/bookings', verifyToken, hostController.getBookingsByStatus);

module.exports = router;