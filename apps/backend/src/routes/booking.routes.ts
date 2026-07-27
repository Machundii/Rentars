import { Router } from 'express';
import {
  cancelBooking,
  confirmBooking,
  createBooking,
  deleteBooking,
  getBooking,
  getBookingCalendar,
  listUserBookings,
  updateBooking,
} from '@/controllers/booking.controller.js';
import { authenticate } from '@/middleware/auth.middleware.js';
import { requireEmailVerified } from '@/middleware/emailVerified.middleware.js';
import { bookingRateLimiter } from '@/middleware/rateLimiter.js';
import {
  createBookingSchema,
  updateBookingSchema,
  validateBody,
} from '@/validators/booking.validator.js';

const router = Router();

// GET /api/v1/bookings — list current user's bookings (cursor pagination)
router.get('/', authenticate, listUserBookings);

// GET /api/v1/bookings/:id
router.get('/:id', authenticate, getBooking);

// GET /api/v1/bookings/:id/calendar.ics
router.get('/:id/calendar.ics', authenticate, getBookingCalendar);

// GET /api/v1/bookings/:id/receipt.pdf
router.get('/:id/receipt.pdf', authenticate, getBookingReceipt);

// POST /api/v1/bookings  (requires email verification)
router.post('/', authenticate, requireEmailVerified, bookingRateLimiter, validateBody(createBookingSchema), createBooking);

// POST /api/v1/bookings/:id/confirm
router.post('/:id/confirm', authenticate, confirmBooking);

// POST /api/v1/bookings/:id/cancel
router.post('/:id/cancel', authenticate, cancelBooking);

// PATCH /api/v1/bookings/:id
router.patch('/:id', authenticate, validateBody(updateBookingSchema), updateBooking);

// DELETE /api/v1/bookings/:id
router.delete('/:id', authenticate, deleteBooking);

export default router;
