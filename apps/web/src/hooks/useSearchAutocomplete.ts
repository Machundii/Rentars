'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { usePropertySearch } from '@/hooks/usePropertySearch';

export interface UseSearchAutocompleteOptions {
  onSearch: (query: string) => void;
}

export function useSearchAutocomplete({ onSearch }: UseSearchAutocompleteOptions) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { suggestions, getSuggestions, getTrending } = usePropertySearch();

  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (input.length >= 2) {
      getSuggestions(input);
      setShowSuggestions(true);
    } else if (input.length === 0) {
      getTrending();
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
    setActiveIndex(-1);
  }, [input, getSuggestions, getTrending]);

  const handleSelectSuggestion = (query: string) => {
    setInput(query);
    setShowSuggestions(false);
    setActiveIndex(-1);
    onSearch(query);
    inputRef.current?.focus();
  };

  const handleSearch = () => {
    if (input.trim()) {
      setShowSuggestions(false);
      setActiveIndex(-1);
      onSearch(input);
    }
  };

  const handleKeyDown = (key: string, preventDefault: () => void) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (key === 'ArrowDown') {
      preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (key === 'ArrowUp') {
      preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (key === 'Enter' && activeIndex >= 0) {
      preventDefault();
      handleSelectSuggestion(suggestions[activeIndex]);
    } else if (key === 'Escape' || key === 'Tab') {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  const openSuggestions = () => setShowSuggestions(true);

  const closeSuggestions = () =>
    setTimeout(() => {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }, 200);

  const isOpen = showSuggestions && suggestions.length > 0;

  return {
    input,
    setInput,
    suggestions,
    isOpen,
    activeIndex,
    listId,
    inputRef,
    listRef,
    handleSelectSuggestion,
    handleSearch,
    handleKeyDown,
    openSuggestions,
    closeSuggestions,
  };
}
