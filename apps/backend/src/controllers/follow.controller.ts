/**
 * Follow controller — thin HTTP adapter over follow.service.ts.
 *
 * All routes are auth-guarded (see follow.routes.ts).
 */

import type { Response } from 'express';
import type { AuthRequest } from '@/middleware/auth.middleware.js';
import {
  followHost,
  unfollowHost,
  getFollowedHosts,
  getHostFollowers,
  isFollowing,
} from '@/services/follow.service.js';

// ─── Follow / Unfollow ────────────────────────────────────────────────────────

/**
 * POST /api/v1/follows/hosts/:hostId
 *
 * Follow a host.  Idempotent — safe to call multiple times.
 *
 * Response 201 on first follow, 200 on duplicate (already following).
 */
export async function followHostHandler(req: AuthRequest, res: Response): Promise<void> {
  const followerId = req.userId;
  if (!followerId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { hostId } = req.params;
  const result = await followHost(followerId, hostId);

  if (!result.success) {
    const status = result.error === 'Host not found' ? 404
      : result.error === 'You cannot follow yourself' ? 422
      : 400;
    res.status(status).json({ error: result.error });
    return;
  }

  res.status(201).json({ data: result.data });
}

/**
 * DELETE /api/v1/follows/hosts/:hostId
 *
 * Unfollow a host.  Idempotent — safe to call even if not currently following.
 *
 * Response 204 always on success.
 */
export async function unfollowHostHandler(req: AuthRequest, res: Response): Promise<void> {
  const followerId = req.userId;
  if (!followerId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { hostId } = req.params;
  const result = await unfollowHost(followerId, hostId);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(204).send();
}

// ─── Status check ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/follows/hosts/:hostId/status
 *
 * Returns whether the authenticated user is currently following the given host.
 *
 * Response: { following: boolean }
 */
export async function followStatusHandler(req: AuthRequest, res: Response): Promise<void> {
  const followerId = req.userId;
  if (!followerId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { hostId } = req.params;
  const result = await isFollowing(followerId, hostId);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ following: result.data });
}

// ─── Listings ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/follows/hosts
 *
 * List all hosts that the authenticated user is currently following.
 *
 * Response: { data: HostSummary[] }
 */
export async function listFollowedHostsHandler(req: AuthRequest, res: Response): Promise<void> {
  const followerId = req.userId;
  if (!followerId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const result = await getFollowedHosts(followerId);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ data: result.data });
}

/**
 * GET /api/v1/follows/followers
 *
 * List all users who follow the authenticated user (as a host).
 *
 * Response: { data: FollowerSummary[] }
 */
export async function listFollowersHandler(req: AuthRequest, res: Response): Promise<void> {
  const hostId = req.userId;
  if (!hostId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const result = await getHostFollowers(hostId);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ data: result.data });
}
