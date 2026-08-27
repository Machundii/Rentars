import { supabase } from '../config/supabase.js';
import type { ServiceResponse } from './index.js';

export async function addToWishlist(userId: string, propertyId: string): Promise<ServiceResponse<void>> {
  // Trim first, then reject blank IDs so an invalid request never reaches the DB.
  const cleanUserId = userId?.trim();
  const cleanPropertyId = propertyId?.trim();
  if (!cleanUserId || !cleanPropertyId) {
    return { success: false, error: 'User ID and property ID are required' };
  }

  const { error } = await supabase
    .from('wishlists')
    .insert({ user_id: cleanUserId, property_id: cleanPropertyId });

  if (error) {
    // Unique constraint violation = already in wishlist
    if (error.code === '23505') return { success: true };
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function removeFromWishlist(userId: string, propertyId: string): Promise<ServiceResponse<void>> {
  const { error, count } = await supabase
    .from('wishlists')
    .delete()
    .eq('user_id', userId)
    .eq('property_id', propertyId);

  if (error) return { success: false, error: error.message };
  // count is null when the PostgREST response omits the header; treat that
  // as a successful deletion (older Supabase versions don't return count).
  if (count !== null && count === 0) {
    return { success: false, error: 'Item not found in wishlist' };
  }
  return { success: true };
}

export async function getWishlist(userId: string): Promise<ServiceResponse<unknown[]>> {
  const { data, error } = await supabase
    .from('wishlists')
    .select('property_id, created_at, properties(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as unknown[] };
}
