'use client';

import { Search } from 'lucide-react';
import { useSearchAutocomplete } from '@/hooks/useSearchAutocomplete';

interface SearchAutocompleteProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export default function SearchAutocomplete({
  onSearch,
  placeholder = 'Search properties...',
}: SearchAutocompleteProps) {
  const {
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
  } = useSearchAutocomplete({ onSearch });

  return (
    <div className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        className="relative"
        role="search"
      >
        <Search
          size={20}
          className="absolute left-3 top-3 text-gray-400"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listId : undefined}
          aria-activedescendant={
            isOpen && activeIndex >= 0
              ? `${listId}-option-${activeIndex}`
              : undefined
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={openSuggestions}
          onBlur={closeSuggestions}
          onKeyDown={(e) => handleKeyDown(e.key, () => e.preventDefault())}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 border rounded-lg
            focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      </form>

      {isOpen && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900
            border border-border rounded-lg shadow-lg z-10 max-h-60 overflow-auto"
        >
          {suggestions.map((suggestion, idx) => (
            <li
              key={idx}
              id={`${listId}-option-${idx}`}
              role="option"
              aria-selected={idx === activeIndex}
            >
              <button
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className={[
                  'w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  idx === activeIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted',
                ].join(' ')}
              >
                <Search
                  size={14}
                  className="text-muted-foreground flex-shrink-0"
                  aria-hidden="true"
                />
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
