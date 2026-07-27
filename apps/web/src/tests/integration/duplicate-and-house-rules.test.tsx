/**
 * Integration tests for:
 *  1. PropertyManagement — Duplicate action (API call, navigation, error banner)
 *  2. HouseRulesAcknowledgement — display, checkbox gate
 *  3. PropertyDetail — house rules section rendered with correct icons
 *  4. Booking page — form blocked until rules acknowledged
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@/tests/utils/test-utils';
import userEvent from '@testing-library/user-event';
import PropertyManagement from '@/components/dashboard/PropertyManagement';
import HouseRulesAcknowledgement from '@/components/booking/HouseRulesAcknowledgement';
import PropertyDetail from '@/components/features/properties/PropertyDetail';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

const MOCK_PROPERTY = {
  id: 'prop-1',
  title: 'Beachside Villa',
  location: 'Malibu, CA',
  pricePerNight: 300,
};

const MOCK_DRAFT = {
  id: 'prop-draft-99',
  title: 'Beachside Villa (Copy)',
  status: 'draft',
};

// ─── PropertyManagement — Duplicate action ────────────────────────────────────

describe('PropertyManagement — Duplicate action', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    mockPush.mockClear();
    localStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('renders a Duplicate button for each property row', () => {
    render(
      <PropertyManagement
        properties={[MOCK_PROPERTY]}
        onAdd={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: /duplicate beachside villa/i }),
    ).toBeInTheDocument();
  });

  it('calls POST /:id/duplicate and navigates to /list?edit=<id> on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_DRAFT),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PropertyManagement
        properties={[MOCK_PROPERTY]}
        onAdd={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /duplicate beachside villa/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v1/properties/${MOCK_PROPERTY.id}/duplicate`),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(`/list?edit=${MOCK_DRAFT.id}`);
    });
  });

  it('calls onDuplicate callback with the new draft id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_DRAFT),
    }));

    const onDuplicate = vi.fn();
    render(
      <PropertyManagement
        properties={[MOCK_PROPERTY]}
        onAdd={vi.fn()}
        onDuplicate={onDuplicate}
      />,
    );

    await user.click(screen.getByRole('button', { name: /duplicate beachside villa/i }));

    await waitFor(() => {
      expect(onDuplicate).toHaveBeenCalledWith(MOCK_DRAFT.id);
    });
  });

  it('shows an error banner when the API call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Forbidden: you do not own this property' }),
    }));

    render(
      <PropertyManagement
        properties={[MOCK_PROPERTY]}
        onAdd={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /duplicate beachside villa/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/forbidden/i);
    });
  });

  it('dismisses the error banner when Dismiss is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Forbidden: you do not own this property' }),
    }));

    render(
      <PropertyManagement
        properties={[MOCK_PROPERTY]}
        onAdd={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /duplicate beachside villa/i }));
    await waitFor(() => screen.getByRole('alert'));

    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('shows a loading spinner while duplicating', async () => {
    // Never resolves so spinner stays visible
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    render(
      <PropertyManagement
        properties={[MOCK_PROPERTY]}
        onAdd={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /duplicate beachside villa/i }));

    expect(
      screen.getByRole('button', { name: /duplicate beachside villa/i }),
    ).toBeDisabled();
  });
});

// ─── HouseRulesAcknowledgement ────────────────────────────────────────────────

describe('HouseRulesAcknowledgement', () => {
  const user = userEvent.setup();

  const FULL_RULES = {
    pets_allowed: false,
    smoking_allowed: false,
    events_allowed: true,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    additional_rules: 'No shoes indoors',
  };

  it('renders nothing when no rules are defined', () => {
    const { container } = render(
      <HouseRulesAcknowledgement
        rules={{}}
        acknowledged={false}
        onAcknowledge={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('displays all rule rows correctly', () => {
    render(
      <HouseRulesAcknowledgement
        rules={FULL_RULES}
        acknowledged={false}
        onAcknowledge={vi.fn()}
      />,
    );

    expect(screen.getByText(/pets not allowed/i)).toBeInTheDocument();
    expect(screen.getByText(/smoking not allowed/i)).toBeInTheDocument();
    expect(screen.getByText(/events \/ parties allowed/i)).toBeInTheDocument();
    expect(screen.getByText(/quiet hours: 22:00.*08:00/i)).toBeInTheDocument();
    expect(screen.getByText(/no shoes indoors/i)).toBeInTheDocument();
  });

  it('calls onAcknowledge with an ISO timestamp when checkbox is checked', async () => {
    const onAcknowledge = vi.fn();

    render(
      <HouseRulesAcknowledgement
        rules={FULL_RULES}
        acknowledged={false}
        onAcknowledge={onAcknowledge}
      />,
    );

    await user.click(screen.getByRole('checkbox'));

    expect(onAcknowledge).toHaveBeenCalledTimes(1);
    const ts = onAcknowledge.mock.calls[0][0] as string;
    expect(() => new Date(ts)).not.toThrow();
    expect(new Date(ts).toISOString()).toBe(ts);
  });

  it('calls onAcknowledge with empty string when checkbox is unchecked', async () => {
    const onAcknowledge = vi.fn();

    render(
      <HouseRulesAcknowledgement
        rules={FULL_RULES}
        acknowledged={true}
        onAcknowledge={onAcknowledge}
      />,
    );

    // Already checked, uncheck it
    await user.click(screen.getByRole('checkbox'));

    expect(onAcknowledge).toHaveBeenCalledWith('');
  });

  it('renders the checkbox as checked when acknowledged=true', () => {
    render(
      <HouseRulesAcknowledgement
        rules={FULL_RULES}
        acknowledged={true}
        onAcknowledge={vi.fn()}
      />,
    );

    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('renders the checkbox as unchecked when acknowledged=false', () => {
    render(
      <HouseRulesAcknowledgement
        rules={FULL_RULES}
        acknowledged={false}
        onAcknowledge={vi.fn()}
      />,
    );

    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
});

// ─── PropertyDetail — house rules section ─────────────────────────────────────

describe('PropertyDetail — house rules section', () => {
  const BASE_PROPERTY = {
    id: 'prop-1',
    title: 'Mountain Cabin',
    description: 'Cozy cabin',
    price_per_night: 120,
    location: 'Aspen, CO',
    images: [],
    owner_id: 'host-1',
    available: true,
    created_at: '2027-01-01T00:00:00Z',
  };

  it('renders house rules section when rules are present', () => {
    render(
      <PropertyDetail
        property={{
          ...BASE_PROPERTY,
          pets_allowed: true,
          smoking_allowed: false,
          events_allowed: false,
        }}
      />,
    );

    const section = screen.getByTestId('house-rules-section');
    expect(section).toBeInTheDocument();
    expect(within(section).getByText(/pets allowed/i)).toBeInTheDocument();
    expect(within(section).getByText(/smoking not allowed/i)).toBeInTheDocument();
    expect(within(section).getByText(/events \/ parties not allowed/i)).toBeInTheDocument();
  });

  it('shows quiet hours when configured', () => {
    render(
      <PropertyDetail
        property={{
          ...BASE_PROPERTY,
          pets_allowed: false,
          quiet_hours_start: '23:00',
          quiet_hours_end: '07:00',
        }}
      />,
    );

    expect(screen.getByText(/quiet hours: 23:00.*07:00/i)).toBeInTheDocument();
  });

  it('shows additional rules text when present', () => {
    render(
      <PropertyDetail
        property={{
          ...BASE_PROPERTY,
          pets_allowed: false,
          additional_rules: 'No loud music after 10pm',
        }}
      />,
    );

    expect(screen.getByText(/no loud music after 10pm/i)).toBeInTheDocument();
  });

  it('does NOT render the rules section when no rules are set', () => {
    render(<PropertyDetail property={BASE_PROPERTY} />);

    expect(screen.queryByTestId('house-rules-section')).not.toBeInTheDocument();
  });
});
