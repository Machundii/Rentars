import type { Request, Response } from 'express';
import { BookingService } from '@/services/booking.service.js';
import { getPropertyById } from '@/services/property.service.js';
import { generateIcs } from '@/utils/ics.js';

const bookingService = new BookingService();

export async function getBooking(req: Request, res: Response): Promise<void> {
  const result = await bookingService.getBookingById(req.params.id);

  if (!result.success) {
    res.status(404).json({ error: result.error });
    return;
  }

  res.json(result.data);
}

export async function createBooking(req: Request, res: Response): Promise<void> {
  const result = await bookingService.createBooking(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(201).json(result.data);
}

export async function cancelBooking(req: Request, res: Response): Promise<void> {
  const userId = (req as Request & { user?: { id: string } }).user?.id ?? '';
  const result = await bookingService.cancelBooking(req.params.id, userId);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json(result.data);
}

export async function confirmBooking(req: Request, res: Response): Promise<void> {
  const userId = (req as Request & { user?: { id: string } }).user?.id ?? '';
  const result = await bookingService.confirmBooking(req.params.id, userId);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json(result.data);
}

export async function updateBooking(req: Request, res: Response): Promise<void> {
  const result = await bookingService.updateBooking(req.params.id, req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json(result.data);
}

export async function deleteBooking(req: Request, res: Response): Promise<void> {
  const result = await bookingService.deleteBooking(req.params.id);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(204).send();
}

/**
 * GET /api/v1/bookings/:id/calendar.ics
 *
 * Returns a downloadable .ics file for the booking.
 * Only the booking's tenant is allowed to fetch it.
 */
export async function getBookingCalendar(req: Request, res: Response): Promise<void> {
  const authUser = (req as Request & { user?: { id: string } }).user;

  const bookingResult = await bookingService.getBookingById(req.params.id);
  if (!bookingResult.success || !bookingResult.data) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  const booking = bookingResult.data;

  // Authorization: only the tenant may download their own calendar event
  if (!authUser || authUser.id !== booking.tenant_id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  if (!booking.check_in || !booking.check_out) {
    res.status(422).json({ error: 'Booking is missing date information' });
    return;
  }

  // Fetch property details for location and title
  let propertyTitle = 'Rental Stay';
  let propertyLocation = '';
  if (booking.property_id) {
    const propResult = await getPropertyById(booking.property_id);
    if (propResult.success && propResult.data) {
      const p = propResult.data;
      propertyTitle = p.title ?? propertyTitle;
      const parts = [p.address, p.city, p.country].filter(Boolean);
      propertyLocation = parts.join(', ');
    }
  }

  const description = [
    `Booking ID: ${booking.id}`,
    `Guests: ${booking.guest_count ?? 1}`,
    `Total: ${booking.total_price ?? ''} USDC`,
    `Status: ${booking.status ?? ''}`,
  ]
    .filter(Boolean)
    .join('\\n');

  const ics = generateIcs({
    uid: `booking-${booking.id}@rentars.app`,
    summary: `Stay at ${propertyTitle}`,
    description,
    location: propertyLocation,
    dtStart: booking.check_in,
    dtEnd: booking.check_out,
    created: booking.created_at,
  });

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="booking-${booking.id}.ics"`);
  res.send(ics);
}
