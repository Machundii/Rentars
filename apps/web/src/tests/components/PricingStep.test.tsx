import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PricingStep from '@/components/properties/ListingForm/steps/PricingStep';
import type { ListingFormData } from '@/components/properties/ListingForm/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderStep(
  formData: Partial<ListingFormData> = {},
  setFormData = vi.fn()
) {
  render(
    <PricingStep
      formData={{ bedrooms: 0, bathrooms: 0, maxGuests: 1, ...formData }}
      setFormData={setFormData}
      errors={{}}
    />
  );
  return { setFormData };
}

// ── Bedrooms — parseInt guard ─────────────────────────────────────────────────

describe('PricingStep — bedrooms parser', () => {
  it('stores zero when the user types "0"', async () => {
    const user = userEvent.setup();
    const setFormData = vi.fn();
    renderStep({ bedrooms: undefined }, setFormData);

    const input = screen.getByLabelText(/bedrooms/i);
    await user.clear(input);
    await user.type(input, '0');

    // Last call should contain bedrooms: 0
    const lastCall = setFormData.mock.calls.at(-1)?.[0] as Partial<ListingFormData>;
    expect(lastCall.bedrooms).toBe(0);
  });

  it('stores a positive integer correctly', async () => {
    const user = userEvent.setup();
    const setFormData = vi.fn();
    renderStep({ bedrooms: 0 }, setFormData);

    const input = screen.getByLabelText(/bedrooms/i);
    await user.clear(input);
    await user.type(input, '3');

    const lastCall = setFormData.mock.calls.at(-1)?.[0] as Partial<ListingFormData>;
    expect(lastCall.bedrooms).toBe(3);
  });

  it('stores undefined (not 0) when the field is cleared', async () => {
    const user = userEvent.setup();
    const setFormData = vi.fn();
    renderStep({ bedrooms: 2 }, setFormData);

    const input = screen.getByLabelText(/bedrooms/i);
    await user.clear(input);

    const lastCall = setFormData.mock.calls.at(-1)?.[0] as Partial<ListingFormData>;
    // undefined signals "no value entered" — distinct from the deliberate 0
    expect(lastCall.bedrooms).toBeUndefined();
  });

  it('does not update state for non-numeric input', async () => {
    const user = userEvent.setup();
    const setFormData = vi.fn();
    renderStep({ bedrooms: 1 }, setFormData);

    const input = screen.getByLabelText(/bedrooms/i);
    // Type characters that parseInt would return NaN for
    // (number inputs reject most chars natively; we fire a synthetic change event)
    await user.clear(input);
    // Simulate a programmatic invalid value by directly firing input event
    // (browser number inputs don't pass "abc" through, so we use a zero-width trick)
    input.setAttribute('type', 'text'); // temporarily allow non-numeric
    await user.type(input, 'abc');
    input.setAttribute('type', 'number');

    // setFormData must NOT have been called with bedrooms: 0
    const invalidCalls = setFormData.mock.calls.filter(
      (c) => (c[0] as Partial<ListingFormData>).bedrooms === 0
    );
    expect(invalidCalls).toHaveLength(0);
  });
});

// ── Bathrooms — parseInt guard ────────────────────────────────────────────────

describe('PricingStep — bathrooms parser', () => {
  it('stores zero when the user types "0"', async () => {
    const user = userEvent.setup();
    const setFormData = vi.fn();
    renderStep({ bathrooms: undefined }, setFormData);

    const input = screen.getByLabelText(/bathrooms/i);
    await user.clear(input);
    await user.type(input, '0');

    const lastCall = setFormData.mock.calls.at(-1)?.[0] as Partial<ListingFormData>;
    expect(lastCall.bathrooms).toBe(0);
  });

  it('stores a positive integer correctly', async () => {
    const user = userEvent.setup();
    const setFormData = vi.fn();
    renderStep({ bathrooms: 0 }, setFormData);

    const input = screen.getByLabelText(/bathrooms/i);
    await user.clear(input);
    await user.type(input, '2');

    const lastCall = setFormData.mock.calls.at(-1)?.[0] as Partial<ListingFormData>;
    expect(lastCall.bathrooms).toBe(2);
  });

  it('stores undefined (not 0) when the field is cleared', async () => {
    const user = userEvent.setup();
    const setFormData = vi.fn();
    renderStep({ bathrooms: 3 }, setFormData);

    const input = screen.getByLabelText(/bathrooms/i);
    await user.clear(input);

    const lastCall = setFormData.mock.calls.at(-1)?.[0] as Partial<ListingFormData>;
    expect(lastCall.bathrooms).toBeUndefined();
  });

  it('does not update state for non-numeric input', async () => {
    const user = userEvent.setup();
    const setFormData = vi.fn();
    renderStep({ bathrooms: 1 }, setFormData);

    const input = screen.getByLabelText(/bathrooms/i);
    input.setAttribute('type', 'text');
    await user.clear(input);
    await user.type(input, 'abc');
    input.setAttribute('type', 'number');

    const invalidCalls = setFormData.mock.calls.filter(
      (c) => (c[0] as Partial<ListingFormData>).bathrooms === 0
    );
    expect(invalidCalls).toHaveLength(0);
  });
});
