import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import {
  createSavedSearch,
  listSavedSearches,
  deleteSavedSearch,
} from '../services/savedSearch.service.js';

export async function create(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const { name, filters } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (!filters || typeof filters !== 'object') {
    res.status(400).json({ error: 'filters (object) is required' });
    return;
  }

  const result = await createSavedSearch(userId, name, filters);
  if (!result.success) { res.status(400).json({ error: result.error }); return; }
  res.status(201).json(result.data);
}

export async function list(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) { res.status(400).json({ error: 'Unauthorized' }); return; }

  const result = await listSavedSearches(userId);
  if (!result.success) { res.status(400).json({ error: result.error }); return; }
  res.json(result.data);
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const result = await deleteSavedSearch(userId, req.params.id);
  if (!result.success) { res.status(400).json({ error: result.error }); return; }
  res.status(204).send();
}
