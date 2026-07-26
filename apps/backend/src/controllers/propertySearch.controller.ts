import type { Request, Response } from 'express';
import { searchPropertiesByQuery, searchPropertiesNearby } from '@/services/propertySearch.service.js';
import type { NearbySearchParams } from '@/services/propertySearch.service.js';

export async function searchPropertiesEndpoint(req: Request, res: Response): Promise<void> {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    res.status(422).json({ error: 'q is required' });
    return;
  }

  const result = await searchPropertiesByQuery(q);
  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  res.json(result.data);
}

export async function searchNearbyEndpoint(req: Request, res: Response): Promise<void> {
  const params = (req as Request & { parsedQuery?: NearbySearchParams }).parsedQuery;
  if (!params) {
    res.status(422).json({ error: 'lat, lng, and radiusKm query params are required' });
    return;
  }

  const result = await searchPropertiesNearby(params);
  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  res.json(result.data);
}

