const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guestcontroller');
const { verifyToken } = require('../middlewares/authmiddleware');


// Properti dan search
router.get('/properties/filter', guestController.filterProperties);
router.get('/all-properties', guestController.getGuestProperties);
router.get ('/properties/:id', guestController.getPropertyDetail);
router.get('/properties/category/:categoryName', guestController.getPropertiesByCategoryName);


//Booking
router.get('/bookings', verifyToken, guestController.getBookingHistory);
router.patch('/bookings/:bookingId/cancel', verifyToken, guestController.cancelBooking);

//Review
router.post('/add-reviews', verifyToken, guestController.addReview);
router.get('/properties/:id/reviews', guestController.getPropertyReviews);

module.exports = router;
