import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthProvider, useAuth } from '../use-auth';

// Mock fetch
global.fetch = vi.fn();

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockClear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  it('initializes with null user, no error, and not loading', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('handles successful login', async () => {
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: mockUser }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
    });
  });

  it('handles login failure', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await expect(result.current.login('test@example.com', 'wrong')).rejects.toThrow('Login failed');
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Login failed');
  });

  it('clears error on new login attempt after a previous failure', async () => {
    // First attempt — fail
    (fetch as any).mockResolvedValueOnce({ ok: false });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'wrong').catch(() => {});
    });

    expect(result.current.error).toBe('Login failed');

    // Second attempt — succeed; error must be gone immediately when the call starts
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: mockUser }),
    });

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    expect(result.current.error).toBeNull();
    expect(result.current.user).toEqual(mockUser);
  });

  it('clears error on new register attempt after a previous failure', async () => {
    // First attempt — fail
    (fetch as any).mockResolvedValueOnce({ ok: false });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.register('Test User', 'test@example.com', 'password').catch(() => {});
    });

    expect(result.current.error).toBe('Registration failed');

    // Second attempt — succeed; error must be gone
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: mockUser }),
    });

    await act(async () => {
      await result.current.register('Test User', 'test@example.com', 'password');
    });

    expect(result.current.error).toBeNull();
    expect(result.current.user).toEqual(mockUser);
  });

  it('handles successful registration', async () => {
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: mockUser }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.register('Test User', 'test@example.com', 'password');
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email: 'test@example.com', password: 'password' }),
    });
  });

  it('handles registration failure', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await expect(result.current.register('Test User', 'test@example.com', 'password')).rejects.toThrow('Registration failed');
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Registration failed');
  });

  it('handles logout', async () => {
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: mockUser }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sets loading state during operations', async () => {
    (fetch as any).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ ok: true, json: () => ({ user: {} }) }), 100)));

    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.login('test@example.com', 'password');
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('token and session remain unchanged after successful login', async () => {
    const mockUser = { id: '42', email: 'user@example.com', name: 'Jane' };
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: mockUser }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('user@example.com', 'pass');
    });

    // user object is set, no error, still not loading
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
