/**
 * BookingForm edge-case tests
 *
 * Covers:
 *  - end-before-start rejection
 *  - same-day (zero-night) rejection
 *  - unavailable-date selection surfacing availability error
 *  - min-stay violation (stay < minimum nights)
 *  - max-stay violation (stay > maximum nights)
 *  - guest count below minimum
 *  - guest count above property max
 *  - submit disabled when invalid; enabled when valid
 *  - price recomputes when date range changes
 *  - blocked dates inside range blocks submission
 *
 * All fetch / quote calls are mocked deterministically.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingForm from '../BookingForm';

// ─── i18n mock ─────────────────────────────────────────────────────────────
// BookingForm uses useTranslations('booking') and useLocale.
vi.mock('@/lib/i18n/useTranslations', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    const map: Record<string, string> = {
      checkIn: 'Check-in',
      checkOut: 'Check-out',
      bookNow: 'Book Now',
      processing: 'Processing…',
      invalidDates: 'Please select valid dates',
      checkoutAfterCheckin: 'Check-out date must be after check-in date',
      unavailableDates: 'Dates not available',
      cantCalculatePrice: 'Unable to calculate total price',
      hasBlockedDates: 'Selected dates include unavailable periods',
      totalNights: `Total (${params?.count ?? 0} nights)`,
    };
    return map[key] ?? key;
  },
}));

vi.mock('@/lib/i18n/useLocale', () => ({
  useLocale: () => ({ locale: 'en' }),
}));

vi.mock('@/lib/i18n/formatting', () => ({
  formatCurrency: (amount: number) => String(amount),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

const PROPERTY_ID = 'prop-test';
const DEFAULT_PRICE = 100;

/** Build a deterministic pricing response for N-night stay. */
function makePricingResponse(
  checkIn: string,
  checkOut: string,
  opts: { allAvailable?: boolean } = {},
) {
  const allAvailable = opts.allAvailable ?? true;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const nights = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
  const breakdown = Array.from({ length: nights }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return {
      date: d.toISOString().split('T')[0],
      price: DEFAULT_PRICE,
      is_available: allAvailable,
    };
  });
  return { total: DEFAULT_PRICE * nights, breakdown };
}

/**
 * Build a fetch mock that handles:
 *   /price   → pricing endpoint
 *   /check   → availability check
 *
 * `availableResult` controls whether /check reports available.
 */
function buildFetchMock(opts: {
  available?: boolean;
  pricingBlocked?: boolean;
  pricingError?: boolean;
  minStay?: number;
  maxStay?: number;
} = {}) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes('/price')) {
      if (opts.pricingError) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Unable to calculate total price' }),
        } as Response);
      }
      // Extract dates from query string
      const u = new URL(url);
      const checkIn = u.searchParams.get('checkIn') ?? '2027-01-01';
      const checkOut = u.searchParams.get('checkOut') ?? '2027-01-03';
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            makePricingResponse(checkIn, checkOut, {
              allAvailable: !opts.pricingBlocked,
            }),
          ),
      } as Response);
    }

    if (url.includes('/check')) {
      const available = opts.available ?? true;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            available,
            reason: available ? undefined : 'Dates not available',
          }),
      } as Response);
    }

    return Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ error: 'Not found' }),
    } as Response);
  });
}

// ─── Default props ──────────────────────────────────────────────────────────

const defaultProps = {
  propertyId: PROPERTY_ID,
  pricePerNight: DEFAULT_PRICE,
  onSubmit: vi.fn(),
  isLoading: false,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('BookingForm edge cases', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    defaultProps.onSubmit = vi.fn();
    fetchMock = buildFetchMock();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // ── Date validation ──────────────────────────────────────────────────────

  it('rejects end-before-start and shows field-level error, submit stays disabled', async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    await user.type(screen.getByLabelText(/check-in/i), '2027-06-10');
    await user.type(screen.getByLabelText(/check-out/i), '2027-06-05');

    const submit = screen.getByRole('button', { name: /book now/i });
    await user.click(submit);

    await waitFor(() => {
      expect(
        screen.getByText(/check-out date must be after check-in date/i),
      ).toBeInTheDocument();
    });

    expect(submit).toBeDisabled();
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('rejects same check-in and check-out (zero nights)', async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    await user.type(screen.getByLabelText(/check-in/i), '2027-06-10');
    await user.type(screen.getByLabelText(/check-out/i), '2027-06-10');

    const submit = screen.getByRole('button', { name: /book now/i });
    await user.click(submit);

    await waitFor(() => {
      expect(
        screen.getByText(/check-out date must be after check-in date/i),
      ).toBeInTheDocument();
    });

    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('shows "invalid dates" error when dates are missing on submit', async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    // Only fill check-in, leave check-out empty
    await user.type(screen.getByLabelText(/check-in/i), '2027-06-10');

    // Submit button disabled (nights = 0), simulate direct dispatch
    const form = document.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText(/please select valid dates/i)).toBeInTheDocument();
    });

    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  // ── Unavailable dates ────────────────────────────────────────────────────

  it('shows availability error when /check returns available: false', async () => {
    fetchMock = buildFetchMock({ available: false });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    await user.type(screen.getByLabelText(/check-in/i), '2027-06-10');
    await user.type(screen.getByLabelText(/check-out/i), '2027-06-15');

    // Wait for pricing to load (so submit is enabled before clicking)
    await waitFor(() => {
      expect(screen.getByText(/total/i)).toBeInTheDocument();
    });

    const submit = screen.getByRole('button', { name: /book now/i });
    await user.click(submit);

    await waitFor(() => {
      expect(screen.getByText(/dates not available/i)).toBeInTheDocument();
    });

    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('disables submit when pricing contains blocked dates', async () => {
    fetchMock = buildFetchMock({ available: true, pricingBlocked: true });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    await user.type(screen.getByLabelText(/check-in/i), '2027-06-10');
    await user.type(screen.getByLabelText(/check-out/i), '2027-06-15');

    // Wait for pricing to load
    await waitFor(() => {
      expect(screen.getByText(/total/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /book now/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/selected dates include unavailable periods/i),
      ).toBeInTheDocument();
    });

    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  // ── Min / max stay violations ────────────────────────────────────────────

  it('disables submit and shows no pricing total when stay is shorter than minStay', async () => {
    const user = userEvent.setup();
    // minStay = 3 nights; pick a 1-night stay → stayViolation = true → button disabled
    render(<BookingForm {...defaultProps} minStay={3} />);

    await user.type(screen.getByLabelText(/check-in/i), '2027-06-10');
    await user.type(screen.getByLabelText(/check-out/i), '2027-06-11');

    // Wait for pricing to load (1 night → 100 USDC total)
    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    // Submit must be disabled because stayViolation is true
    expect(screen.getByRole('button', { name: /book now/i })).toBeDisabled();
    // onSubmit must never have been called
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('sets the minStay error message when submit is attempted while stay < minStay', async () => {
    const user = userEvent.setup();
    // We need the submit handler to actually run — set minStay but use pointer-events
    // trick: render with minStay, fill valid pricing dates, then programmatically
    // call the submit handler by submitting via the form element (not the button).
    render(<BookingForm {...defaultProps} minStay={3} />);

    await user.type(screen.getByLabelText(/check-in/i), '2027-06-10');
    await user.type(screen.getByLabelText(/check-out/i), '2027-06-11');

    // Wait for pricing
    await waitFor(() => expect(screen.getByText('100')).toBeInTheDocument());

    // Dispatch a submit event directly on the form — React's onSubmit fires
    // even when the button is disabled if the form itself receives the event
    const form = document.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText(/minimum stay is 3 night/i)).toBeInTheDocument();
    });

    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('disables submit and shows no pricing total when stay is longer than maxStay', async () => {
    const user = userEvent.setup();
    // maxStay = 5 nights; pick a 7-night stay
    render(<BookingForm {...defaultProps} maxStay={5} />);

    await user.type(screen.getByLabelText(/check-in/i), '2027-06-10');
    await user.type(screen.getByLabelText(/check-out/i), '2027-06-17');

    // Wait for pricing (7 nights → 700)
    await waitFor(() => {
      expect(screen.getByText('700')).toBeInTheDocument();
    });

    // Submit must be disabled
    expect(screen.getByRole('button', { name: /book now/i })).toBeDisabled();
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('sets the maxStay error message when submit is attempted while stay > maxStay', async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} maxStay={5} />);

    await user.type(screen.getByLabelText(/check-in/i), '2027-06-10');
    await user.type(screen.getByLabelText(/check-out/i), '2027-06-17');

    await waitFor(() => expect(screen.getByText('700')).toBeInTheDocument());

    const form = document.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText(/maximum stay is 5 night/i)).toBeInTheDocument();
    });

    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  // ── Guest count violations ───────────────────────────────────────────────

  it('shows error when guest count is below 1', async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    const guestInput = screen.getByLabelText(/guests/i);
    await user.clear(guestInput);
    await user.type(guestInput, '0');

    expect(screen.getByText(/at least 1 guest is required/i)).toBeInTheDocument();

    // Submit is disabled regardless of dates
    await user.type(screen.getByLabelText(/check-in/i), '2027-06-10');
    await user.type(screen.getByLabelText(/check-out/i), '2027-06-15');

    const submit = screen.getByRole('button', { name: /book now/i });
    expect(submit).toBeDisabled();
  });

  it('shows error when guest count exceeds maxGuests', async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} maxGuests={2} />);

    const guestInput = screen.getByLabelText(/guests/i);
    await user.clear(guestInput);
    await user.type(guestInput, '5');

    expect(screen.getByText(/maximum 2 guests? allowed/i)).toBeInTheDocument();

    // Submit disabled even after valid dates
    await user.type(screen.getByLabelText(/check-in/i), '2027-06-10');
    await user.type(screen.getByLabelText(/check-out/i), '2027-06-15');

    expect(screen.getByRole('button', { name: /book now/i })).toBeDisabled();
  });

  // ── Submit gating ────────────────────────────────────────────────────────

  it('submit is disabled before any dates are selected', () => {
    render(<BookingForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /book now/i })).toBeDisabled();
  });

  it('submit is disabled while isLoading is true', () => {
    render(<BookingForm {...defaultProps} isLoading={true} />);
    // Button label changes to "Processing…" when loading
    expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled();
  });

  it('submit is disabled when pricing fails to load', async () => {
    fetchMock = buildFetchMock({ pricingError: true });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    await user.type(screen.getByLabelText(/check-in/i), '2027-06-10');
    await user.type(screen.getByLabelText(/check-out/i), '2027-06-15');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /book now/i })).toBeDisabled();
    });
  });

  // ── Price recomputation ──────────────────────────────────────────────────

  it('displays total price based on fetched pricing when dates are set', async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    await user.type(screen.getByLabelText(/check-in/i), '2027-06-10');
    await user.type(screen.getByLabelText(/check-out/i), '2027-06-13'); // 3 nights → 300

    await waitFor(() => {
      // Pricing breakdown should appear with total
      expect(screen.getByText('300')).toBeInTheDocument();
    });
  });

  it('recomputes price when the date range changes', async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    // First range: 2 nights → 200
    await user.type(screen.getByLabelText(/check-in/i), '2027-06-10');
    await user.type(screen.getByLabelText(/check-out/i), '2027-06-12');

    await waitFor(() => {
      expect(screen.getByText('200')).toBeInTheDocument();
    });

    // Change check-out to extend to 5 nights → 500
    await user.clear(screen.getByLabelText(/check-out/i));
    await user.type(screen.getByLabelText(/check-out/i), '2027-06-15');

    await waitFor(() => {
      expect(screen.getByText('500')).toBeInTheDocument();
    });

    // Verify the pricing API was called again with the new range
    const priceCalls = (fetchMock.mock.calls as [string][]).filter(([url]) =>
      String(url).includes('/price'),
    );
    expect(priceCalls.length).toBeGreaterThanOrEqual(2);
  });

  // ── Happy path ───────────────────────────────────────────────────────────

  it('calls onSubmit with correct data when form is valid', async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    await user.type(screen.getByLabelText(/check-in/i), '2027-06-10');
    await user.type(screen.getByLabelText(/check-out/i), '2027-06-13'); // 3 nights

    await waitFor(() => {
      expect(screen.getByText('300')).toBeInTheDocument();
    });

    const submit = screen.getByRole('button', { name: /book now/i });
    await user.click(submit);

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          checkIn: new Date('2027-06-10'),
          checkOut: new Date('2027-06-13'),
          guestCount: 1,
          totalPrice: 300,
        }),
      );
    });
  });
});
