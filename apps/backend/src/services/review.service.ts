import { supabase } from '../config/supabase.js';
import type { ServiceResponse } from './index.js';

export type ModerationStatus = 'pending' | 'approved' | 'rejected';

export interface Review {
  id: string;
  booking_id: string;
  reviewer_id: string;
  target_id: string;
  property_id?: string;
  rating: number;
  comment?: string;
  on_chain_id?: number;
  host_response?: string;
  host_response_at?: string;
  is_flagged?: boolean;
  is_approved?: boolean;
  moderation_status?: ModerationStatus;
  moderation_reason?: string;
  created_at?: string;
}

export async function submitReview(
  bookingId: string,
  reviewerId: string,
  targetId: string,
  rating: number,
  comment: string,
  propertyId?: string,
): Promise<ServiceResponse<Review>> {
  if (rating < 1 || rating > 5) {
    return { success: false, error: 'Rating must be between 1 and 5' };
  }

  // Verify booking belongs to reviewer
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .eq('tenant_id', reviewerId)
    .single();

  if (bookingError || !booking) {
    return { success: false, error: 'Booking not found or not owned by reviewer' };
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert({ booking_id: bookingId, reviewer_id: reviewerId, target_id: targetId, property_id: propertyId, rating, comment, moderation_status: 'pending' })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: data as Review };
}

export async function getReviewsForProperty(propertyId: string): Promise<ServiceResponse<Review[]>> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('property_id', propertyId)
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as Review[] };
}

export async function getReviewsForUser(userId: string): Promise<ServiceResponse<Review[]>> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('target_id', userId)
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as Review[] };
}

export async function getAverageRating(userId: string): Promise<ServiceResponse<number>> {
  const { data, error } = await supabase
    .from('reviews')
    .select('rating')
    .eq('target_id', userId)
    .eq('is_approved', true);

  if (error) return { success: false, error: error.message };
  if (!data || data.length === 0) return { success: true, data: 0 };

  const avg = (data as { rating: number }[]).reduce((sum, r) => sum + r.rating, 0) / data.length;
  return { success: true, data: Math.round(avg * 10) / 10 };
}

export async function addHostResponse(
  reviewId: string,
  hostId: string,
  response: string,
): Promise<ServiceResponse<Review>> {
  // Verify host owns the property that was reviewed
  const { data: review, error: reviewError } = await supabase
    .from('reviews')
    .select('id, target_id, host_response')
    .eq('id', reviewId)
    .single();

  if (reviewError || !review) {
    return { success: false, error: 'Review not found' };
  }
  if (review.target_id !== hostId) {
    return { success: false, error: 'Only the reviewed host can respond' };
  }
  if (review.host_response) {
    return { success: false, error: 'Response already submitted' };
  }

  const { data, error } = await supabase
    .from('reviews')
    .update({ host_response: response, host_response_at: new Date().toISOString() })
    .eq('id', reviewId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as Review };
}

export async function flagReview(
  reviewId: string,
  reporterId: string,
): Promise<ServiceResponse<void>> {
  const { error } = await supabase
    .from('reviews')
    .update({ is_flagged: true })
    .eq('id', reviewId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function approveReview(reviewId: string): Promise<ServiceResponse<Review>> {
  const { data, error } = await supabase
    .from('reviews')
    .update({ moderation_status: 'approved', is_approved: true, is_flagged: false })
    .eq('id', reviewId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as Review };
}

export async function rejectReview(
  reviewId: string,
  reason: string,
): Promise<ServiceResponse<Review>> {
  if (!reason || reason.trim().length === 0) {
    return { success: false, error: 'Rejection reason is required' };
  }

  const { data, error } = await supabase
    .from('reviews')
    .update({ moderation_status: 'rejected', is_approved: false, moderation_reason: reason, is_flagged: false })
    .eq('id', reviewId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as Review };
}

export async function getPendingReviews(): Promise<ServiceResponse<Review[]>> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('moderation_status', 'pending')
    .order('created_at', { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as Review[] };
}

export async function moderateReview(
  reviewId: string,
  approve: boolean,
): Promise<ServiceResponse<Review>> {
  return approve ? approveReview(reviewId) : rejectReview(reviewId, 'Rejected by moderator');
}

export async function getFlaggedReviews(): Promise<ServiceResponse<Review[]>> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('is_flagged', true)
    .order('created_at', { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as Review[] };
}
