const express = require('express');
const router = express.Router();
const { createBooking, getBookings } = require('../controllers/bookingController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router
  .route('/')
  .post(authorize('tenant'), createBooking)
  .get(authorize('admin', 'tenant'), getBookings);

module.exports = router;
