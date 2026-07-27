import { supabase } from '@/config/supabase.js';
import type { ServiceResponse } from './index.js';

export interface AvailabilityRange {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  is_available: boolean;
  reason?: string;
  created_at?: string;
}

export interface BlockRangeInput {
  start_date: string;
  end_date: string;
  reason?: string;
}

/**
 * Get all availability (blocked) ranges for a property.
 *
 * @param propertyId - UUID of the property
 */
export async function getAvailabilityRanges(
  propertyId: string,
): Promise<ServiceResponse<AvailabilityRange[]>> {
  const { data, error } = await supabase
    .from('availability_ranges')
    .select('*')
    .eq('property_id', propertyId)
    .order('start_date', { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as AvailabilityRange[] };
}

/**
 * Block a date range for a property (prevents bookings during this period).
 *
 * @param propertyId - UUID of the property
 * @param ownerId - UUID of the requesting user (must be owner)
 * @param input - Date range and optional reason
 */
export async function blockAvailabilityRange(
  propertyId: string,
  ownerId: string,
  input: BlockRangeInput,
): Promise<ServiceResponse<AvailabilityRange>> {
  // Verify ownership
  const { data: property } = await supabase
    .from('properties')
    .select('owner_id')
    .eq('id', propertyId)
    .single();

  if (!property) return { success: false, error: 'Property not found' };
  if ((property as { owner_id: string }).owner_id !== ownerId) {
    return { success: false, error: 'Forbidden: you do not own this property' };
  }

  const startDate = new Date(input.start_date);
  const endDate = new Date(input.end_date);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { success: false, error: 'Invalid date format' };
  }

  if (startDate >= endDate) {
    return { success: false, error: 'start_date must be before end_date' };
  }

  // Reject if a confirmed booking already covers any part of this range.
  const { data: conflictingBookings, error: conflictError } = await supabase
    .from('bookings')
    .select('id')
    .eq('property_id', propertyId)
    .in('status', ['Confirmed', 'Pending'])
    .lt('check_in', input.end_date)
    .gt('check_out', input.start_date)
    .limit(1);

  if (conflictError) return { success: false, error: conflictError.message };

  if (conflictingBookings && conflictingBookings.length > 0) {
    return {
      success: false,
      error: 'Cannot block this range: an existing booking overlaps these dates',
    };
  }

  const { data, error } = await supabase
    .from('availability_ranges')
    .insert({
      property_id: propertyId,
      start_date: input.start_date,
      end_date: input.end_date,
      is_available: false,
      reason: input.reason,
      blocked_by: ownerId,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as AvailabilityRange };
}

/**
 * Remove a blocked date range.
 *
 * @param propertyId - UUID of the property
 * @param rangeId - UUID of the range to delete
 * @param ownerId - UUID of the requesting user
 */
export async function deleteAvailabilityRange(
  propertyId: string,
  rangeId: string,
  ownerId: string,
): Promise<ServiceResponse<void>> {
  const { data: property } = await supabase
    .from('properties')
    .select('owner_id')
    .eq('id', propertyId)
    .single();

  if (!property || (property as { owner_id: string }).owner_id !== ownerId) {
    return { success: false, error: 'Forbidden: you do not own this property' };
  }

  const { error } = await supabase
    .from('availability_ranges')
    .delete()
    .eq('id', rangeId)
    .eq('property_id', propertyId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Check whether a date range is blocked for a property.
 *
 * @param propertyId - UUID of the property
 * @param checkIn - ISO date string
 * @param checkOut - ISO date string
 * @returns true if available, false if any blocked range overlaps
 */
export async function isDateRangeAvailable(
  propertyId: string,
  checkIn: string,
  checkOut: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('availability_ranges')
    .select('id')
    .eq('property_id', propertyId)
    .eq('is_available', false)
    .lt('start_date', checkOut)
    .gt('end_date', checkIn)
    .limit(1);

  return !data || data.length === 0;
}
