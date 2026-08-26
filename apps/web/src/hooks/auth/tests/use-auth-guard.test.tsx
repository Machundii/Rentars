import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock next/navigation before importing the hook
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock use-auth so we can control its returned state
vi.mock('../use-auth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../use-auth';
import { useAuthGuard } from '../use-auth-guard';

const mockUseAuth = vi.mocked(useAuth);

describe('useAuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not redirect while authentication is still initializing (loading state)', () => {
    // Simulate the auth state being in flight
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    });

    const { result } = renderHook(() => useAuthGuard());

    // Guard must not redirect during loading
    expect(mockPush).not.toHaveBeenCalled();

    // Hook correctly surfaces the loading flag so callers can render a
    // skeleton / spinner instead of protected content
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('renders protected content and does not redirect when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'user@example.com', name: 'Alice' },
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    });

    const { result } = renderHook(() => useAuthGuard());

    expect(mockPush).not.toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('redirects to /login once initialization completes and user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    });

    const { result } = renderHook(() => useAuthGuard());

    expect(mockPush).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('does not redirect when auth transitions from loading to authenticated', () => {
    // Start in loading state
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    });

    const { result, rerender } = renderHook(() => useAuthGuard());

    expect(mockPush).not.toHaveBeenCalled();

    // Auth resolves — user is present
    mockUseAuth.mockReturnValue({
      user: { id: '2', email: 'bob@example.com', name: 'Bob' },
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    });

    rerender();

    expect(mockPush).not.toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('redirects when auth transitions from loading to unauthenticated', () => {
    // Start in loading state
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    });

    const { rerender } = renderHook(() => useAuthGuard());

    expect(mockPush).not.toHaveBeenCalled();

    // Auth resolves — no user
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    });

    rerender();

    expect(mockPush).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith('/login');
  });
});
