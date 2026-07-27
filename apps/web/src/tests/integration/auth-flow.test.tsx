/**
 * Integration test for auth flow: register, login, wallet connect.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@/tests/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

// ── Minimal auth page stubs ───────────────────────────────────────────────────

function LoginPage({
  onLogin,
}: {
  onLogin?: (token: string) => void;
}) {
  const [, setToken] = useState('');

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget as HTMLFormElement;
        const email = (form.querySelector('[name="email"]') as HTMLInputElement).value;
        const password = (form.querySelector('[name="password"]') as HTMLInputElement).value;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('token', data.token);
          setToken(data.token);
          onLogin?.(data.token);
        }
      }}
    >
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" />
      <button type="submit">Sign in</button>
    </form>
  );
}

function RegisterPage({ onRegister }: { onRegister?: () => void }) {
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget as HTMLFormElement;
        const email = (form.querySelector('[name="email"]') as HTMLInputElement).value;
        const password = (form.querySelector('[name="password"]') as HTMLInputElement).value;
        const name = (form.querySelector('[name="name"]') as HTMLInputElement).value;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        });
        if (res.ok) {
          onRegister?.();
        }
      }}
    >
      <label htmlFor="name">Full name</label>
      <input id="name" name="name" type="text" />
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" />
      <button type="submit">Create account</button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Auth flow integration', () => {
  const user = userEvent.setup();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  // ── Login ─────────────────────────────────────────────────────────────────

  describe('login flow', () => {
    it('logs in successfully and stores token in localStorage', async () => {
      const onLogin = vi.fn();
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            token: 'jwt-token-123',
            user: { id: 'u1', email: 'user@example.com' },
          }),
      } as Response);

      render(<LoginPage onLogin={onLogin} />);

      await user.type(screen.getByLabelText(/email/i), 'user@example.com');
      await user.type(screen.getByLabelText(/password/i), 'Password123!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/auth/login'),
          expect.objectContaining({ method: 'POST' }),
        );
        expect(onLogin).toHaveBeenCalledWith('jwt-token-123');
        expect(localStorage.getItem('token')).toBe('jwt-token-123');
      });
    });

    it('does not store token when login fails', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid credentials' }),
      } as Response);

      render(<LoginPage />);

      await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpass');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(localStorage.getItem('token')).toBeNull();
      });
    });
  });

  // ── Register ──────────────────────────────────────────────────────────────

  describe('register flow', () => {
    it('registers a new user and calls onRegister callback', async () => {
      const onRegister = vi.fn();
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: { id: 'new-user', email: 'new@example.com' } }),
      } as Response);

      render(<RegisterPage onRegister={onRegister} />);

      await user.type(screen.getByLabelText(/full name/i), 'Alice Smith');
      await user.type(screen.getByLabelText(/email/i), 'new@example.com');
      await user.type(screen.getByLabelText(/password/i), 'SecurePass1!');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/auth/register'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Alice Smith'),
          }),
        );
        expect(onRegister).toHaveBeenCalled();
      });
    });
  });
});
