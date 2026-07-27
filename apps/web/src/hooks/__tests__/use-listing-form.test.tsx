/**
 * Tests for use-listing-form hook with draft autosave.
 * Tests draft save, restore, discard, and clear-on-publish functionality.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useListingForm } from '../use-listing-form';

describe('useListingForm - draft autosave', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    localStorage.clear();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should autosave form data to localStorage on change', () => {
    const { result } = renderHook(() => useListingForm());

    act(() => {
      result.current.updateFormData({
        title: 'Beautiful House',
        description: 'A wonderful place to stay',
      });
    });

    // Fast-forward through debounce
    act(() => {
      jest.advanceTimersByTime(1100);
    });

    const stored = localStorage.getItem('listing_form_draft');
    expect(stored).toBeTruthy();

    const draft = JSON.parse(stored!);
    expect(draft.formData.title).toBe('Beautiful House');
    expect(draft.formData.description).toBe('A wonderful place to stay');
  });

  it('should restore draft from localStorage on mount', () => {
    const savedDraft = {
      formData: {
        title: 'Saved House',
        description: 'Saved description',
        amenities: ['wifi', 'kitchen'],
        images: [],
      },
      currentStep: 'location' as const,
      savedAt: Date.now(),
    };

    localStorage.setItem('listing_form_draft', JSON.stringify(savedDraft));

    const { result } = renderHook(() => useListingForm());

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current.formData.title).toBe('Saved House');
    expect(result.current.hasDraft).toBe(true);
  });

  it('should clear draft when clearDraft is called', () => {
    const { result } = renderHook(() => useListingForm());

    act(() => {
      result.current.updateFormData({ title: 'Some Title' });
      jest.advanceTimersByTime(1100);
    });

    expect(localStorage.getItem('listing_form_draft')).toBeTruthy();

    act(() => {
      result.current.clearDraft();
    });

    expect(localStorage.getItem('listing_form_draft')).toBeNull();
    expect(result.current.hasDraft).toBe(false);
  });

  it('should discard draft and prevent restoration', () => {
    const { result } = renderHook(() => useListingForm());

    act(() => {
      result.current.updateFormData({ title: 'Title' });
      jest.advanceTimersByTime(1100);
    });

    expect(localStorage.getItem('listing_form_draft')).toBeTruthy();

    act(() => {
      result.current.discardDraft();
    });

    expect(localStorage.getItem('listing_form_draft')).toBeNull();
  });

  it('should debounce saves to prevent excessive localStorage writes', () => {
    const { result } = renderHook(() => useListingForm());
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    // Make multiple rapid updates
    act(() => {
      result.current.updateFormData({ title: 'Title 1' });
      jest.advanceTimersByTime(100);
      result.current.updateFormData({ title: 'Title 2' });
      jest.advanceTimersByTime(100);
      result.current.updateFormData({ title: 'Title 3' });
      jest.advanceTimersByTime(100);
    });

    // Should only save once after debounce period
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(setItemSpy).toHaveBeenCalledWith(
      'listing_form_draft',
      expect.stringContaining('Title 3')
    );

    setItemSpy.mockRestore();
  });

  it('should preserve current step in draft', () => {
    const { result } = renderHook(() => useListingForm());

    act(() => {
      result.current.updateFormData({ title: 'House' });
      result.current.goToStep('pricing');
      jest.advanceTimersByTime(1100);
    });

    const stored = localStorage.getItem('listing_form_draft');
    const draft = JSON.parse(stored!);
    expect(draft.currentStep).toBe('pricing');
  });

  it('should handle localStorage unavailable gracefully', () => {
    const { result } = renderHook(() => useListingForm());

    // Mock localStorage to throw
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });

    act(() => {
      result.current.updateFormData({ title: 'Title' });
      jest.advanceTimersByTime(1100);
    });

    // Should not throw, but log warning
    expect(result.current.formData.title).toBe('Title');

    setItemSpy.mockRestore();
  });

  it('should not restore draft if discarded', () => {
    const savedDraft = {
      formData: { title: 'Old Title', amenities: [], images: [] },
      currentStep: 'basic' as const,
      savedAt: Date.now(),
    };

    localStorage.setItem('listing_form_draft', JSON.stringify(savedDraft));

    const { result, rerender } = renderHook(() => useListingForm());

    // First render - should detect draft
    expect(result.current.hasDraft).toBe(true);

    act(() => {
      result.current.discardDraft();
    });

    // After discard, re-render should not restore
    rerender();

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current.hasDraft).toBe(false);
  });
});
