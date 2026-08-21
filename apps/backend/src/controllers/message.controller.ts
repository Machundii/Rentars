import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { sendMessage, getConversation, markMessageRead } from '../services/message.service.js';

export async function sendMessageHandler(req: AuthRequest, res: Response): Promise<void> {
  const senderId = req.userId;
  if (!senderId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { propertyId, body, recipientId } = req.body;
  const result = await sendMessage(senderId, propertyId, body, recipientId);

  if (!result.success) {
    res.status(result.error === 'Property not found' ? 404 : 400).json({ error: result.error });
    return;
  }

  res.status(201).json(result.data);
}

export async function getConversationHandler(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { otherUserId } = req.params;
  const propertyId = req.query.propertyId as string | undefined;
  if (!propertyId) {
    res.status(400).json({ error: 'propertyId query parameter is required' });
    return;
  }

  const result = await getConversation(userId, otherUserId, propertyId);

  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  res.json(result.data);
}

export async function markReadHandler(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const result = await markMessageRead(req.params.id, userId);

  if (!result.success) {
    res.status(result.error === 'Message not found' ? 404 : 400).json({ error: result.error });
    return;
  }

  res.json(result.data);
}
