/**
 * Tests for the 404 and error-boundary UI components.
 *
 * Covers:
 * 1. NotFoundContent — renders heading, search form, home link, back button.
 *    Submitting the search navigates to /search?q=…
 * 2. ErrorContent — renders heading, digest code, retry button, home/search links.
 *    Clicking retry calls the reset callback.
 *    logClientError is called on mount.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── Mock next/navigation before importing components ──────────────────────────
const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// ── Mock next/link (renders as a plain anchor in tests) ───────────────────────
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// ── Mock errorLogger — we verify it's called, not its side effects ────────────
const mockLogClientError = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/errorLogger', () => ({
  logClientError: (...args: unknown[]) => mockLogClientError(...args),
}));

// ── Import components after mocks ─────────────────────────────────────────────
import { NotFoundContent } from '@/components/error/NotFoundContent';
import { ErrorContent } from '@/components/error/ErrorContent';

// ─────────────────────────────────────────────────────────────────────────────
// NotFoundContent
// ─────────────────────────────────────────────────────────────────────────────

describe('NotFoundContent', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
  });

  it('renders the 404 heading', () => {
    render(<NotFoundContent />);
    expect(
      screen.getByRole('heading', { name: /page not found/i })
    ).toBeInTheDocument();
  });

  it('renders the Rentars brand name', () => {
    render(<NotFoundContent />);
    expect(screen.getByText('Rentars')).toBeInTheDocument();
  });

  it('renders the search form with an accessible label', () => {
    render(<NotFoundContent />);
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search for a property/i)).toBeInTheDocument();
  });

  it('renders a Go home link pointing to /', () => {
    render(<NotFoundContent />);
    const homeLink = screen.getByRole('link', { name: /go home/i });
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('renders a Go back button', () => {
    render(<NotFoundContent />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('clicking Go back calls router.back()', async () => {
    render(<NotFoundContent />);
    await user.click(screen.getByRole('button', { name: /go back/i }));
    expect(mockBack).toHaveBeenCalledOnce();
  });

  it('submitting search with a query navigates to /search?q=…', async () => {
    render(<NotFoundContent />);
    const input = screen.getByPlaceholderText(/search for a property/i);
    await user.type(input, 'beachfront villa');
    await user.click(screen.getByRole('button', { name: /^search$/i }));
    expect(mockPush).toHaveBeenCalledWith(
      '/search?q=beachfront%20villa',
    );
  });

  it('submitting with an empty query does NOT navigate', async () => {
    render(<NotFoundContent />);
    await user.click(screen.getByRole('button', { name: /^search$/i }));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('submitting via Enter key navigates', async () => {
    render(<NotFoundContent />);
    const input = screen.getByPlaceholderText(/search for a property/i);
    await user.type(input, 'Paris apartment{Enter}');
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('/search?q=Paris'),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ErrorContent
// ─────────────────────────────────────────────────────────────────────────────

describe('ErrorContent', () => {
  const user = userEvent.setup();
  const mockReset = vi.fn();

  beforeEach(() => {
    mockReset.mockClear();
    mockLogClientError.mockClear();
  });

  function makeError(message = 'Test error', digest?: string) {
    const err = new Error(message) as Error & { digest?: string };
    if (digest) err.digest = digest;
    return err;
  }

  it('renders the error heading', () => {
    render(<ErrorContent error={makeError()} reset={mockReset} />);
    expect(
      screen.getByRole('heading', { name: /something went wrong/i })
    ).toBeInTheDocument();
  });

  it('renders the Rentars brand name', () => {
    render(<ErrorContent error={makeError()} reset={mockReset} />);
    expect(screen.getByText('Rentars')).toBeInTheDocument();
  });

  it('renders retry, go home, and browse buttons/links', () => {
    render(<ErrorContent error={makeError()} reset={mockReset} />);
    expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    expect(screen.getByTestId('go-home-link')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('browse-link')).toHaveAttribute('href', '/search');
  });

  it('calls reset() when retry button is clicked', async () => {
    render(<ErrorContent error={makeError()} reset={mockReset} />);
    await user.click(screen.getByTestId('retry-button'));
    expect(mockReset).toHaveBeenCalledOnce();
  });

  it('shows the error digest code when provided', () => {
    render(<ErrorContent error={makeError('boom', 'xyz987')} reset={mockReset} />);
    expect(screen.getByTestId('error-digest')).toHaveTextContent('xyz987');
  });

  it('does NOT render digest element when digest is absent', () => {
    render(<ErrorContent error={makeError()} reset={mockReset} />);
    expect(screen.queryByTestId('error-digest')).not.toBeInTheDocument();
  });

  it('calls logClientError on mount', async () => {
    const error = makeError('oops', 'digest-abc');
    render(<ErrorContent error={error} reset={mockReset} context="test-boundary" />);
    await waitFor(() => {
      expect(mockLogClientError).toHaveBeenCalledOnce();
    });
    expect(mockLogClientError).toHaveBeenCalledWith(error, 'test-boundary', 'digest-abc');
  });

  it('does NOT expose the raw error message in visible text', () => {
    const secretPath = '/internal/very/secret/path';
    render(<ErrorContent error={makeError(secretPath)} reset={mockReset} />);
    // The raw message should not be visible anywhere in the rendered output
    expect(screen.queryByText(secretPath)).not.toBeInTheDocument();
  });

  it('has role="alert" for immediate screen-reader announcement', () => {
    const { container } = render(<ErrorContent error={makeError()} reset={mockReset} />);
    expect(container.querySelector('[role="alert"]')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// errorLogger sanitisation
// ─────────────────────────────────────────────────────────────────────────────

describe('errorLogger.sanitiseMessage (via module import)', async () => {
  // Re-import without the mock to test the real implementation
  const { logClientError } = await vi.importActual<typeof import('@/lib/errorLogger')>(
    '@/lib/errorLogger',
  );

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fires a POST to the client-errors endpoint', async () => {
    await logClientError(new Error('simple error'), 'test');
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/client-errors'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('does not throw when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(logClientError(new Error('boom'), 'ctx')).resolves.toBeUndefined();
  });
});
