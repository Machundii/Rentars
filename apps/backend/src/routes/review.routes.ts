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
  listPendingReviews,
  approveReviewHandler,
  rejectReviewHandler,
} from '../controllers/review.controller.js';

const router = Router();

// POST /api/reviews
router.post('/', authenticate, createReview);

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

// GET /api/reviews/moderation/pending — list pending reviews for moderation (admin)
router.get('/moderation/pending', authenticate, listPendingReviews);

// PATCH /api/reviews/:id/moderate — approve or reject a flagged review (admin)
router.patch('/:id/moderate', authenticate, moderateReviewHandler);

// POST /api/reviews/:id/approve — approve a review (admin)
router.post('/:id/approve', authenticate, approveReviewHandler);

// POST /api/reviews/:id/reject — reject a review with reason (admin)
router.post('/:id/reject', authenticate, rejectReviewHandler);

export default router;
