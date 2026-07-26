import { Router } from 'express';
import {
  createBooking,
  deleteBooking,
  getBooking,
  getBookingCalendar,
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

// GET /api/v1/bookings/:id
router.get('/:id', authenticate, getBooking);

// POST /api/v1/bookings  (requires email verification)
router.post('/', authenticate, requireEmailVerified, bookingRateLimiter, validateBody(createBookingSchema), createBooking);

// PATCH /api/v1/bookings/:id
router.patch('/:id', authenticate, validateBody(updateBookingSchema), updateBooking);

// DELETE /api/v1/bookings/:id
router.delete('/:id', authenticate, deleteBooking);

export default router;
