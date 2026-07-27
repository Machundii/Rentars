import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  createReview,
  getPropertyReviews,
  getUserReviews,
  getUserAverageRating,
  respondToReview,
  reportReview,
  moderateReviewHandler,
  listFlaggedReviews,
} from '../controllers/review.controller.js';
import { validateBody } from '../validators/booking.validator.js';
import { createReviewSchema } from '../validators/review.validator.js';

const router = Router();

// POST /api/reviews
router.post('/', authenticate, validateBody(createReviewSchema), createReview);

// GET /api/reviews/property/:id
router.get('/property/:id', getPropertyReviews);

// GET /api/reviews/user/:id
router.get('/user/:id', getUserReviews);

// GET /api/reviews/user/:id/average
router.get('/user/:id/average', getUserAverageRating);

// POST /api/reviews/:id/response — host replies to a review
router.post('/:id/response', authenticate, respondToReview);

// POST /api/reviews/:id/flag — report a review for moderation
router.post('/:id/flag', authenticate, reportReview);

// GET /api/reviews/moderation/flagged — list flagged reviews (admin)
router.get('/moderation/flagged', authenticate, listFlaggedReviews);

// PATCH /api/reviews/:id/moderate — approve or reject a flagged review (admin)
router.patch('/:id/moderate', authenticate, moderateReviewHandler);

export default router;
