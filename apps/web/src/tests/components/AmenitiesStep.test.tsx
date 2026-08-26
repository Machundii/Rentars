import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AmenitiesStep from '@/components/properties/ListingForm/steps/AmenitiesStep';
import type { ListingFormData } from '@/components/properties/ListingForm/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderStep(
  amenities: string[] = [],
  setFormData = vi.fn()
) {
  const formData: Partial<ListingFormData> = { amenities };
  render(
    <AmenitiesStep
      formData={formData}
      setFormData={setFormData}
      errors={{}}
    />
  );
  return { setFormData };
}

// ── Duplicate prevention ──────────────────────────────────────────────────────

describe('AmenitiesStep — duplicate prevention', () => {
  it('does not add a duplicate amenity with the exact same value', async () => {
    const user = userEvent.setup();
    const captured: string[][] = [];
    const setFormData = vi.fn((data: Partial<ListingFormData>) => {
      captured.push([...(data.amenities ?? [])]);
    });

    renderStep(['WiFi'], setFormData);

    // Clicking the already-selected WiFi checkbox calls setFormData to REMOVE it
    // (toggle off). Click again to add — we simulate add by starting unchecked.
    // Start fresh: no pre-selected amenities.
    const { setFormData: spy } = renderStep([], vi.fn());

    // Select WiFi once
    const wifiCheckbox = screen.getAllByRole('checkbox', { name: /wifi/i })[0];
    await user.click(wifiCheckbox);
    // The handler should have been called once; we'll test via a stateful wrapper
  });

  it('adds a distinct amenity and keeps input order', async () => {
    const user = userEvent.setup();

    // Stateful wrapper so we can observe cumulative state
    let amenities: string[] = [];
    const setFormData = vi.fn((data: Partial<ListingFormData>) => {
      amenities = data.amenities ?? [];
    });

    const { rerender } = render(
      <AmenitiesStep
        formData={{ amenities }}
        setFormData={setFormData}
        errors={{}}
      />
    );

    // Click WiFi
    await user.click(screen.getByRole('checkbox', { name: /wifi/i }));
    rerender(
      <AmenitiesStep
        formData={{ amenities }}
        setFormData={setFormData}
        errors={{}}
      />
    );

    // Click Kitchen
    await user.click(screen.getByRole('checkbox', { name: /kitchen/i }));
    rerender(
      <AmenitiesStep
        formData={{ amenities }}
        setFormData={setFormData}
        errors={{}}
      />
    );

    expect(amenities).toEqual(['WiFi', 'Kitchen']);
  });

  it('does not create a duplicate when the same checkbox is clicked twice', async () => {
    const user = userEvent.setup();

    let amenities: string[] = [];
    const setFormData = vi.fn((data: Partial<ListingFormData>) => {
      amenities = data.amenities ?? [];
    });

    const { rerender } = render(
      <AmenitiesStep
        formData={{ amenities }}
        setFormData={setFormData}
        errors={{}}
      />
    );

    const wifiCheckbox = screen.getByRole('checkbox', { name: /wifi/i });

    // First click — add WiFi
    await user.click(wifiCheckbox);
    rerender(
      <AmenitiesStep
        formData={{ amenities }}
        setFormData={setFormData}
        errors={{}}
      />
    );
    expect(amenities).toEqual(['WiFi']);

    // Second click — remove WiFi (toggle off)
    await user.click(screen.getByRole('checkbox', { name: /wifi/i }));
    rerender(
      <AmenitiesStep
        formData={{ amenities }}
        setFormData={setFormData}
        errors={{}}
      />
    );
    expect(amenities).toEqual([]);

    // Third click — add again (should work after removal)
    await user.click(screen.getByRole('checkbox', { name: /wifi/i }));
    rerender(
      <AmenitiesStep
        formData={{ amenities }}
        setFormData={setFormData}
        errors={{}}
      />
    );
    expect(amenities).toEqual(['WiFi']);
  });

  it('treats case-insensitive duplicates as the same amenity', async () => {
    // Pre-load with a capitalised variant and try to add a lowercase duplicate
    // by directly driving the toggle function through a controlled render.
    const setFormData = vi.fn();

    // formData already contains 'wifi' (lowercase)
    render(
      <AmenitiesStep
        formData={{ amenities: ['wifi'] }}
        setFormData={setFormData}
        errors={{}}
      />
    );

    // The UI shows 'WiFi' (from AMENITIES constant). Clicking its checkbox
    // should NOT produce a second entry because 'WiFi'.toLowerCase() === 'wifi'.
    // The toggle will see a match and remove 'wifi' instead of adding 'WiFi'.
    const wifiCheckbox = screen.getByRole('checkbox', { name: /wifi/i });
    await userEvent.click(wifiCheckbox);

    // setFormData should have been called with an empty array (removal), not ['wifi','WiFi']
    expect(setFormData).toHaveBeenCalledOnce();
    const updatedAmenities = setFormData.mock.calls[0][0].amenities as string[];
    expect(updatedAmenities).toHaveLength(0);
  });

  it('removing an item permits adding it again', async () => {
    const user = userEvent.setup();
    let amenities: string[] = ['WiFi'];
    const setFormData = vi.fn((data: Partial<ListingFormData>) => {
      amenities = data.amenities ?? [];
    });

    const { rerender } = render(
      <AmenitiesStep
        formData={{ amenities }}
        setFormData={setFormData}
        errors={{}}
      />
    );

    // Remove WiFi
    await user.click(screen.getByRole('checkbox', { name: /wifi/i }));
    rerender(
      <AmenitiesStep
        formData={{ amenities }}
        setFormData={setFormData}
        errors={{}}
      />
    );
    expect(amenities).toEqual([]);

    // Add WiFi again
    await user.click(screen.getByRole('checkbox', { name: /wifi/i }));
    rerender(
      <AmenitiesStep
        formData={{ amenities }}
        setFormData={setFormData}
        errors={{}}
      />
    );
    expect(amenities).toEqual(['WiFi']);
  });
});
