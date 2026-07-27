/**
 * Unit tests for:
 *  1. duplicateProperty — copied fields, excluded data, draft status, ownership, independence
 *  2. house-rules acknowledgement gate in BookingService.createBooking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { duplicateProperty } from '../services/property.service.js';
import { BookingService } from '../services/booking.service.js';

// ─── Supabase mock ────────────────────────────────────────────────────────────

const mockSingle = vi.fn();
const mockInsertSingle = vi.fn();

// We need separate call tracking for the two operations (select vs insert)
let supabaseCallCount = 0;

const makeMockFrom = () => ({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ single: mockSingle }),
  }),
  insert: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ single: mockInsertSingle }),
  }),
  update: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ single: mockSingle }),
  }),
  delete: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ single: mockSingle }),
  }),
});

vi.mock('../config/supabase.js', () => ({
  supabase: { from: vi.fn(() => makeMockFrom()) },
}));

vi.mock('../services/cache.service.js', () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/logging.service.js', () => ({
  loggingService: { logBlockchainOperation: vi.fn() },
}));

vi.mock('../services/notification.service.js', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../blockchain/trustlessWork.js', () => ({
  trustlessWorkClient: {
    createBookingEscrow: vi.fn().mockResolvedValue({ escrowId: 'escrow-xyz' }),
    cancelEscrow: vi.fn().mockResolvedValue(undefined),
    releaseEscrow: vi.fn().mockResolvedValue(undefined),
  },
}));

// ─── Source property fixture ──────────────────────────────────────────────────

const SOURCE_PROPERTY = {
  id: 'prop-source',
  owner_id: 'host-1',
  title: 'Seaview Suite',
  description: 'Lovely suite with ocean views',
  price_per_night: 200,
  city: 'Miami',
  country: 'US',
  address: '123 Beach Rd',
  bedrooms: 2,
  bathrooms: 1,
  max_guests: 4,
  amenities: ['wifi', 'parking'],
  images: ['https://cdn.example.com/img1.jpg'],
  on_chain_id: 99,
  status: 'available',
  pets_allowed: true,
  smoking_allowed: false,
  events_allowed: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  additional_rules: 'No shoes indoors',
  created_at: '2027-01-01T00:00:00Z',
  updated_at: '2027-01-01T00:00:00Z',
};

// ─── duplicateProperty tests ──────────────────────────────────────────────────

describe('duplicateProperty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseCallCount = 0;
  });

  it('returns a draft with status="draft"', async () => {
    mockSingle.mockResolvedValueOnce({ data: SOURCE_PROPERTY, error: null });
    mockInsertSingle.mockResolvedValueOnce({
      data: { ...SOURCE_PROPERTY, id: 'prop-clone', status: 'draft', title: 'Seaview Suite (Copy)', on_chain_id: null, images: [] },
      error: null,
    });

    const result = await duplicateProperty('prop-source', 'host-1');

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('draft');
  });

  it('appends " (Copy)" to the title', async () => {
    mockSingle.mockResolvedValueOnce({ data: SOURCE_PROPERTY, error: null });
    mockInsertSingle.mockResolvedValueOnce({
      data: { ...SOURCE_PROPERTY, id: 'prop-clone', title: 'Seaview Suite (Copy)', status: 'draft', on_chain_id: null, images: [] },
      error: null,
    });

    const result = await duplicateProperty('prop-source', 'host-1');

    expect(result.data?.title).toBe('Seaview Suite (Copy)');
  });

  it('copies core fields: description, price, city, country, capacity, amenities', async () => {
    const cloned = {
      ...SOURCE_PROPERTY,
      id: 'prop-clone',
      title: 'Seaview Suite (Copy)',
      status: 'draft',
      on_chain_id: null,
      images: [],
    };
    mockSingle.mockResolvedValueOnce({ data: SOURCE_PROPERTY, error: null });
    mockInsertSingle.mockResolvedValueOnce({ data: cloned, error: null });

    const result = await duplicateProperty('prop-source', 'host-1');

    expect(result.data?.description).toBe(SOURCE_PROPERTY.description);
    expect(result.data?.price_per_night).toBe(SOURCE_PROPERTY.price_per_night);
    expect(result.data?.city).toBe(SOURCE_PROPERTY.city);
    expect(result.data?.country).toBe(SOURCE_PROPERTY.country);
    expect(result.data?.max_guests).toBe(SOURCE_PROPERTY.max_guests);
    expect(result.data?.bedrooms).toBe(SOURCE_PROPERTY.bedrooms);
    expect(result.data?.bathrooms).toBe(SOURCE_PROPERTY.bathrooms);
    expect(result.data?.amenities).toEqual(SOURCE_PROPERTY.amenities);
  });

  it('copies house rules fields', async () => {
    const cloned = {
      ...SOURCE_PROPERTY,
      id: 'prop-clone',
      title: 'Seaview Suite (Copy)',
      status: 'draft',
      on_chain_id: null,
      images: [],
    };
    mockSingle.mockResolvedValueOnce({ data: SOURCE_PROPERTY, error: null });
    mockInsertSingle.mockResolvedValueOnce({ data: cloned, error: null });

    const result = await duplicateProperty('prop-source', 'host-1');

    expect(result.data?.pets_allowed).toBe(SOURCE_PROPERTY.pets_allowed);
    expect(result.data?.smoking_allowed).toBe(SOURCE_PROPERTY.smoking_allowed);
    expect(result.data?.events_allowed).toBe(SOURCE_PROPERTY.events_allowed);
    expect(result.data?.quiet_hours_start).toBe(SOURCE_PROPERTY.quiet_hours_start);
    expect(result.data?.quiet_hours_end).toBe(SOURCE_PROPERTY.quiet_hours_end);
    expect(result.data?.additional_rules).toBe(SOURCE_PROPERTY.additional_rules);
  });

  it('does NOT copy on_chain_id — draft is off-chain', async () => {
    const cloned = {
      ...SOURCE_PROPERTY,
      id: 'prop-clone',
      title: 'Seaview Suite (Copy)',
      status: 'draft',
      on_chain_id: null,
      images: [],
    };
    mockSingle.mockResolvedValueOnce({ data: SOURCE_PROPERTY, error: null });
    mockInsertSingle.mockResolvedValueOnce({ data: cloned, error: null });

    const result = await duplicateProperty('prop-source', 'host-1');

    expect(result.data?.on_chain_id).toBeNull();
  });

  it('does NOT copy images by default', async () => {
    // Inspect what was actually inserted
    const { supabase } = await import('../config/supabase.js');
    const insertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { ...SOURCE_PROPERTY, id: 'prop-clone', status: 'draft', on_chain_id: null, images: [] },
          error: null,
        }),
      }),
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: SOURCE_PROPERTY, error: null }),
        }),
      }),
      insert: insertSpy,
      update: vi.fn(),
      delete: vi.fn(),
    } as any);

    await duplicateProperty('prop-source', 'host-1');

    const insertPayload = insertSpy.mock.calls[0]?.[0];
    expect(insertPayload?.images).toEqual([]);
  });

  it('copies images when copyImages=true', async () => {
    const { supabase } = await import('../config/supabase.js');
    const insertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { ...SOURCE_PROPERTY, id: 'prop-clone', status: 'draft', on_chain_id: null },
          error: null,
        }),
      }),
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: SOURCE_PROPERTY, error: null }),
        }),
      }),
      insert: insertSpy,
      update: vi.fn(),
      delete: vi.fn(),
    } as any);

    await duplicateProperty('prop-source', 'host-1', { copyImages: true });

    const insertPayload = insertSpy.mock.calls[0]?.[0];
    expect(insertPayload?.images).toEqual(SOURCE_PROPERTY.images);
  });

  it('returns 403 error when requester is not the owner', async () => {
    mockSingle.mockResolvedValueOnce({ data: SOURCE_PROPERTY, error: null });

    const result = await duplicateProperty('prop-source', 'other-user');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/forbidden/i);
  });

  it('returns error when source property is not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    const result = await duplicateProperty('nonexistent', 'host-1');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('produces an independent record with a new id', async () => {
    const cloned = {
      ...SOURCE_PROPERTY,
      id: 'prop-clone-new',
      title: 'Seaview Suite (Copy)',
      status: 'draft',
      on_chain_id: null,
      images: [],
    };
    mockSingle.mockResolvedValueOnce({ data: SOURCE_PROPERTY, error: null });
    mockInsertSingle.mockResolvedValueOnce({ data: cloned, error: null });

    const result = await duplicateProperty('prop-source', 'host-1');

    expect(result.data?.id).not.toBe(SOURCE_PROPERTY.id);
    expect(result.data?.id).toBe('prop-clone-new');
  });
});

// ─── House rules acknowledgement gate in BookingService ───────────────────────

describe('BookingService — rules_acknowledged_at gate', () => {
  const mockBlockchain = {
    checkAvailability: vi.fn().mockResolvedValue(true),
    createBookingOnChain: vi.fn().mockResolvedValue(BigInt(1)),
    cancelBookingOnChain: vi.fn().mockResolvedValue(undefined),
    updateBookingStatusOnChain: vi.fn().mockResolvedValue(undefined),
  };

  let service: BookingService;

  const BASE_INPUT = {
    property_id: 'prop-1',
    tenant_id: 'tenant-1',
    check_in: '2027-09-01',
    check_out: '2027-09-05',
    guest_count: 2,
    total_price: 400,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BookingService(mockBlockchain);
  });

  it('rejects a booking when rules_acknowledged_at is missing', async () => {
    const result = await service.createBooking({
      ...BASE_INPUT,
      rules_acknowledged_at: undefined,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/acknowledge.*house rules/i);
  });

  it('rejects a booking when rules_acknowledged_at is an empty string', async () => {
    const result = await service.createBooking({
      ...BASE_INPUT,
      rules_acknowledged_at: '',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/acknowledge.*house rules/i);
  });

  it('proceeds past the acknowledgement gate when rules_acknowledged_at is provided', async () => {
    // It will fail later (property not found) but NOT on the ack gate
    const { supabase } = await import('../config/supabase.js');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        }),
      }),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as any);

    const result = await service.createBooking({
      ...BASE_INPUT,
      rules_acknowledged_at: new Date().toISOString(),
    });

    expect(result.success).toBe(false);
    // Error is about property, not acknowledgement
    expect(result.error).not.toMatch(/acknowledge.*house rules/i);
    expect(result.error).toMatch(/property not found/i);
  });
});
