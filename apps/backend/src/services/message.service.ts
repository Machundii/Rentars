/**
 * Message service — rate-limited, property-scoped inquiries between a
 * prospective tenant and a host. No private contact info is ever exposed;
 * participants only see each other's user id.
 */

import { supabase } from '../config/supabase.js';
import { sanitizeResponse } from '../utils/sanitize.js';
import { createNotification, shouldSendInApp } from './notification.service.js';
import type { ServiceResponse } from './index.js';

export interface Message {
  id: string;
  property_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

/**
 * Send a message about a property. If `recipientId` is omitted, the message
 * is addressed to the property's host (owner) — this is how a tenant starts
 * an inquiry without ever needing to know the host's user id up front.
 */
export async function sendMessage(
  senderId: string,
  propertyId: string,
  body: string,
  recipientId?: string,
): Promise<ServiceResponse<Message>> {
  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id, owner_id')
    .eq('id', propertyId)
    .single();

  if (propertyError || !property) {
    return { success: false, error: 'Property not found' };
  }

  const resolvedRecipientId = recipientId || (property as { owner_id: string }).owner_id;

  if (resolvedRecipientId === senderId) {
    return { success: false, error: 'You cannot message yourself' };
  }

  const cleanBody = sanitizeResponse(body);
  if (!cleanBody) {
    return { success: false, error: 'Message body is required' };
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      property_id: propertyId,
      sender_id: senderId,
      recipient_id: resolvedRecipientId,
      body: cleanBody,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  const message = data as Message;

  try {
    const send = await shouldSendInApp(resolvedRecipientId, 'message_received');
    if (send) {
      await createNotification(resolvedRecipientId, 'message_received', {
        messageId: message.id,
        propertyId,
        senderId,
      });
    }
  } catch (err) {
    console.error(`[sendMessage] Failed to notify recipient ${resolvedRecipientId}:`, err);
  }

  return { success: true, data: message };
}

/**
 * List the conversation between the caller and another user, scoped to a
 * single property. Both participants may call this for their own thread.
 */
export async function getConversation(
  userId: string,
  otherUserId: string,
  propertyId: string,
): Promise<ServiceResponse<Message[]>> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('property_id', propertyId)
    .or(
      `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`,
    )
    .order('created_at', { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as Message[] };
}

/**
 * Mark a message read. Only the recipient may mark their own inbound message.
 */
export async function markMessageRead(
  messageId: string,
  userId: string,
): Promise<ServiceResponse<Message>> {
  const { data, error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('recipient_id', userId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Message not found' };

  return { success: true, data: data as Message };
}
