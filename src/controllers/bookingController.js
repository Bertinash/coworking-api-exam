const Booking = require('../models/Booking');
const ErrorResponse = require('../utils/errorResponse');

exports.createBooking = async (req, res, next) => {
  try {
    const { room, startsAt, endsAt, notes } = req.body;

    if (!room || !startsAt || !endsAt) {
      return next(new ErrorResponse('Room, start and end times are required', 400));
    }

    const start = new Date(startsAt);
    const end = new Date(endsAt);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return next(new ErrorResponse('Start and end times must be valid dates', 400));
    }

    if (start >= end) {
      return next(new ErrorResponse('End time must be after the start time', 400));
    }

    // Two bookings overlap when each one starts before the other ends.
    const clash = await Booking.findOne({
      room,
      status: 'scheduled',
      startsAt: { $lt: end },
      endsAt: { $gt: start }
    });

    if (clash) {
      return next(new ErrorResponse('Room is already booked for that time', 409));
    }

    const booking = await Booking.create({
      tenant: req.user.id,
      room,
      startsAt: start,
      endsAt: end,
      notes,
      createdBy: req.user.id
    });

    res.status(201).json({ success: true, booking });
  } catch (error) {
    next(error);
  }
};

exports.getBookings = async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { tenant: req.user.id };

    const bookings = await Booking.find(filter)
      .sort({ startsAt: 1 })
      .populate('tenant', 'name email');

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    next(error);
  }
};
