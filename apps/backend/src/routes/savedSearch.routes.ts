import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { create, list, remove } from '../controllers/savedSearch.controller.js';

const router = Router();

// POST /api/v1/saved-searches
router.post('/', authenticate, create);

// GET /api/v1/saved-searches
router.get('/', authenticate, list);

// DELETE /api/v1/saved-searches/:id
router.delete('/:id', authenticate, remove);

export default router;
