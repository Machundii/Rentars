'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ListingFormData, ListingStep } from '@/components/properties/ListingForm/types';

const STEPS: ListingStep[] = ['basic', 'location', 'amenities', 'photos', 'pricing', 'review'];
const DRAFT_STORAGE_KEY = 'listing_form_draft';
const DRAFT_SAVE_DEBOUNCE_MS = 1000;

interface DraftState {
  formData: Partial<ListingFormData>;
  currentStep: ListingStep;
  savedAt: number;
}

export function useListingForm() {
  const [currentStep, setCurrentStep] = useState<ListingStep>('basic');
  const [formData, setFormData] = useState<Partial<ListingFormData>>({
    amenities: [],
    images: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasDraft, setHasDraft] = useState(false);
  const [draftDiscarded, setDraftDiscarded] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  const currentStepIndex = STEPS.indexOf(currentStep);

  // Initialize draft on mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined' || draftDiscarded) return;

      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored) {
        const draft = JSON.parse(stored) as DraftState;
        setFormData(draft.formData);
        setCurrentStep(draft.currentStep);
        setHasDraft(true);
      }
    } catch (err) {
      console.warn('Failed to restore draft:', err);
    }
  }, [draftDiscarded]);

  // Save draft to localStorage (debounced)
  const saveDraft = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        const draft: DraftState = {
          formData,
          currentStep,
          savedAt: Date.now(),
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch (err) {
        console.warn('Failed to save draft:', err);
      }
    }, DRAFT_SAVE_DEBOUNCE_MS);
  }, [formData, currentStep]);

  // Auto-save when form data or step changes
  useEffect(() => {
    saveDraft();
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, currentStep, saveDraft]);

  const clearDraft = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch (err) {
      console.warn('Failed to clear draft:', err);
    }
    setHasDraft(false);
  }, []);

  const discardDraft = useCallback(() => {
    clearDraft();
    setDraftDiscarded(true);
  }, [clearDraft]);

  const goToStep = (step: ListingStep) => {
    setCurrentStep(step);
  };

  const nextStep = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentStepIndex + 1]);
    }
  };

  const previousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(STEPS[currentStepIndex - 1]);
    }
  };

  const updateFormData = (data: Partial<ListingFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const setError = (field: string, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  };

  const clearError = (field: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  return {
    currentStep,
    currentStepIndex,
    formData,
    errors,
    hasDraft,
    goToStep,
    nextStep,
    previousStep,
    updateFormData,
    setError,
    clearError,
    clearDraft,
    discardDraft,
  };
}
