'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { House, Search, ArrowLeft } from 'lucide-react';

/**
 * Branded 404 page.
 *
 * - Works in both light and dark themes via Tailwind dark: variants.
 * - Provides a search box, a "Go home" link, and a "Go back" action.
 * - Fully keyboard-navigable and screen-reader accessible.
 * - i18n: reads from in-scope translations (server-safe static strings for
 *   the not-found page; the I18nProvider may not be active in error routes).
 */
export function NotFoundContent() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      inputRef.current?.focus();
      return;
    }
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <main
      className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-6 py-16"
      aria-labelledby="not-found-heading"
    >
      {/* Branded logo mark */}
      <div className="flex items-center gap-2 mb-12" aria-hidden="true">
        <House size={32} className="text-blue-600" />
        <span className="text-2xl font-bold text-gray-900 dark:text-white">Rentars</span>
      </div>

      {/* 404 numeral */}
      <p
        className="text-8xl font-black text-blue-600 leading-none select-none"
        aria-hidden="true"
      >
        404
      </p>

      <h1
        id="not-found-heading"
        className="mt-4 text-3xl font-bold text-gray-900 dark:text-white text-center"
      >
        Page not found
      </h1>
      <p className="mt-3 text-base text-gray-500 dark:text-gray-400 text-center max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
        Looking for a rental? Try searching below.
      </p>

      {/* Search box */}
      <form
        onSubmit={handleSearch}
        className="mt-8 w-full max-w-sm flex gap-2"
        role="search"
        aria-label="Search for a property"
      >
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a property…"
            aria-label="Search for a property"
            className="
              w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700
              bg-white dark:bg-gray-800 text-gray-900 dark:text-white
              placeholder:text-gray-400 dark:placeholder:text-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500
              text-sm
            "
          />
        </div>
        <button
          type="submit"
          className="
            px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800
            text-white text-sm font-medium rounded-lg transition
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          "
        >
          Search
        </button>
      </form>

      {/* Recovery links */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="
            inline-flex items-center gap-2 px-4 py-2 rounded-lg
            bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
            text-sm font-medium text-gray-700 dark:text-gray-200
            hover:bg-gray-50 dark:hover:bg-gray-700 transition
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          "
        >
          <House size={16} aria-hidden="true" />
          Go home
        </Link>

        <button
          onClick={() => router.back()}
          className="
            inline-flex items-center gap-2 px-4 py-2 rounded-lg
            text-sm font-medium text-gray-500 dark:text-gray-400
            hover:text-gray-700 dark:hover:text-gray-200 transition
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          "
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Go back
        </button>
      </div>
    </main>
  );
}
