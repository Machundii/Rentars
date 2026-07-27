/**
 * Unit tests for auth service.
 * Tests registration, login, and wallet auth flows.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockAuthSignUp = mock(async () => ({ data: null, error: null }));
const mockAuthSignIn = mock(async () => ({ data: null, error: null }));
const mockFrom = mock((_: string) => ({}));

const mockSupabase = {
  from: mockFrom,
  auth: {
    signUp: mockAuthSignUp,
    signInWithPassword: mockAuthSignIn,
  },
};

const supabaseMod = await import('../../src/config/supabase.js');
(supabaseMod as any).supabase = mockSupabase;

import { registerUser, loginUser, generateWalletChallenge } from '../../src/services/auth.service.js';
import { AuthError } from '../../src/types/errors.js';

// ─────────────────────────────────────────────────────────────────────────────

describe('auth.service', () => {
  beforeEach(() => {
    mockAuthSignUp.mockClear();
    mockAuthSignIn.mockClear();
    mockFrom.mockClear();
  });

  // ── registerUser ────────────────────────────────────────────────────────────

  describe('registerUser', () => {
    it('should register a user successfully', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com', created_at: '2026-01-01T00:00:00Z' };
      mockAuthSignUp.mockImplementation(async () => ({ data: { user: mockUser }, error: null }));

      const result = await registerUser('test@example.com', 'Password123!');
      expect(result.success).toBe(true);
      expect(result.data?.user.email).toBe('test@example.com');
    });

    it('should throw AuthError when email is missing', async () => {
      let thrown = false;
      try {
        await registerUser('', 'Password123!');
      } catch (err) {
        thrown = true;
        expect(err).toBeInstanceOf(AuthError);
      }
      expect(thrown).toBe(true);
    });

    it('should throw AuthError when password is missing', async () => {
      let thrown = false;
      try {
        await registerUser('test@example.com', '');
      } catch (err) {
        thrown = true;
        expect(err).toBeInstanceOf(AuthError);
      }
      expect(thrown).toBe(true);
    });

    it('should throw AuthError when Supabase returns error', async () => {
      mockAuthSignUp.mockImplementation(async () => ({
        data: { user: null },
        error: { message: 'Email already in use' },
      }));

      let thrown = false;
      try {
        await registerUser('existing@example.com', 'Password123!');
      } catch (err) {
        thrown = true;
        expect(err).toBeInstanceOf(AuthError);
        expect((err as AuthError).message).toContain('Email already in use');
      }
      expect(thrown).toBe(true);
    });

    it('should throw AuthError when no user is returned', async () => {
      mockAuthSignUp.mockImplementation(async () => ({
        data: { user: null },
        error: null,
      }));

      let thrown = false;
      try {
        await registerUser('test@example.com', 'Password123!');
      } catch (err) {
        thrown = true;
        expect(err).toBeInstanceOf(AuthError);
      }
      expect(thrown).toBe(true);
    });
  });

  // ── loginUser ───────────────────────────────────────────────────────────────

  describe('loginUser', () => {
    it('should login user and return a JWT token', async () => {
      const mockUser = { id: 'user-1', email: 'user@example.com', created_at: '2026-01-01T00:00:00Z' };
      mockAuthSignIn.mockImplementation(async () => ({ data: { user: mockUser }, error: null }));

      const result = await loginUser('user@example.com', 'Password123!');
      expect(result.success).toBe(true);
      expect(result.data?.token).toBeDefined();
      expect(typeof result.data?.token).toBe('string');
      expect(result.data?.user.id).toBe('user-1');
    });

    it('should throw AuthError with invalid credentials', async () => {
      mockAuthSignIn.mockImplementation(async () => ({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      }));

      let thrown = false;
      try {
        await loginUser('wrong@example.com', 'wrongpass');
      } catch (err) {
        thrown = true;
        expect(err).toBeInstanceOf(AuthError);
      }
      expect(thrown).toBe(true);
    });

    it('should throw AuthError when email is missing', async () => {
      let thrown = false;
      try {
        await loginUser('', 'password');
      } catch (err) {
        thrown = true;
        expect(err).toBeInstanceOf(AuthError);
      }
      expect(thrown).toBe(true);
    });

    it('should throw AuthError when password is missing', async () => {
      let thrown = false;
      try {
        await loginUser('test@example.com', '');
      } catch (err) {
        thrown = true;
        expect(err).toBeInstanceOf(AuthError);
      }
      expect(thrown).toBe(true);
    });
  });

  // ── generateWalletChallenge ─────────────────────────────────────────────────

  describe('generateWalletChallenge', () => {
    const validAddress = 'GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFSNHERX3LRJCX5FWCL46664F3';

    it('should generate a challenge for a valid Stellar address', async () => {
      mockFrom.mockImplementation(() => ({
        insert: mock(async () => ({ data: {}, error: null })),
      }));

      const result = await generateWalletChallenge(validAddress);
      expect(result.success).toBe(true);
      expect(result.data?.challenge).toBeDefined();
      expect(result.data?.expiresAt).toBeDefined();
      // expiresAt should be ~10 minutes in the future
      const expiry = new Date(result.data!.expiresAt);
      expect(expiry.getTime()).toBeGreaterThan(Date.now());
    });

    it('should throw AuthError when stellar address is missing', async () => {
      let thrown = false;
      try {
        await generateWalletChallenge('');
      } catch (err) {
        thrown = true;
        expect(err).toBeInstanceOf(AuthError);
      }
      expect(thrown).toBe(true);
    });

    it('should throw AuthError when challenge insert fails', async () => {
      mockFrom.mockImplementation(() => ({
        insert: mock(async () => ({ data: null, error: { message: 'Insert failed' } })),
      }));

      let thrown = false;
      try {
        await generateWalletChallenge(validAddress);
      } catch (err) {
        thrown = true;
        expect(err).toBeInstanceOf(AuthError);
      }
      expect(thrown).toBe(true);
    });
  });
});
