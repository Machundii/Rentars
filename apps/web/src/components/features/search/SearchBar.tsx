'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  onSearch: (location: string) => void;
  placeholder?: string;
  /** Optional controlled value — when provided the input is updated externally (e.g. from reverse geocoding). */
  value?: string;
}

export default function SearchBar({
  onSearch,
  placeholder = 'Search by location...',
  value: controlledValue,
}: SearchBarProps) {
  const [location, setLocation] = useState(controlledValue ?? '');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Sync external value changes (e.g. reverse-geocoded label) into local state.
  useEffect(() => {
    if (controlledValue !== undefined) {
      setLocation(controlledValue);
    }
  }, [controlledValue]);

  const handleChange = (value: string) => {
    setLocation(value);
    if (value.length > 0) {
      setSuggestions([
        `${value}, USA`,
        `${value}, Canada`,
        `${value}, UK`,
      ]);
    } else {
      setSuggestions([]);
    }
  };

  const handleSelect = (suggestion: string) => {
    setLocation(suggestion);
    setSuggestions([]);
    onSearch(suggestion);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-white border rounded-lg px-4 py-3">
        <Search size={20} className="text-gray-400" aria-hidden="true" />
        <input
          type="text"
          placeholder={placeholder}
          value={location}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch(location)}
          className="flex-1 outline-none"
          aria-label={placeholder}
        />
      </div>
      {suggestions.length > 0 && (
        <div
          role="listbox"
          aria-label="Location suggestions"
          className="absolute top-full left-0 right-0 bg-white border border-t-0 rounded-b-lg shadow-lg z-10"
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              role="option"
              aria-selected={location === suggestion}
              onClick={() => handleSelect(suggestion)}
              className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
