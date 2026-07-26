import { describe, it, expect, beforeEach, mock } from 'bun:test';

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockListUsers = mock(async () => ({ data: { users: [] }, error: null }));
const mockUpdateUserById = mock(async () => ({ data: {}, error: null }));
const mockFromInsert = mock(async () => ({ data: {}, error: null }));
const mockFromSelect = mock(() => ({}));
const mockFromUpdate = mock(() => ({}));

const mockSupabase = {
  auth: {
    admin: {
      listUsers: mockListUsers,
      updateUserById: mockUpdateUserById,
    },
  },
  from: mock((_: string) => ({
    insert: mockFromInsert,
    select: mockFromSelect,
    update: mockFromUpdate,
  })),
};

const supabaseMod = await import('../../src/config/supabase.js');
(supabaseMod as any).supabase = mockSupabase;

// ── Email mock ────────────────────────────────────────────────────────────────

const mockSendPasswordResetEmail = mock(async () => {});
const emailMod = await import('../../src/services/email.service.js');
(emailMod as any).emailService = { sendPasswordResetEmail: mockSendPasswordResetEmail };

import { requestPasswordReset, confirmPasswordReset } from '../../src/services/auth.service.js';
import { AuthError } from '../../src/types/errors.js';

// ─────────────────────────────────────────────────────────────────────────────

const VALID_USER_ID = 'user-uuid-1';
const VALID_EMAIL = 'test@example.com';

describe('requestPasswordReset', () => {
  beforeEach(() => {
    mockListUsers.mockClear();
    mockSendPasswordResetEmail.mockClear();
    (mockSupabase.from as any).mockClear?.();
  });

  it('returns success regardless of whether the email exists (enumeration resistance)', async () => {
    mockListUsers.mockImplementation(async () => ({ data: { users: [] }, error: null }));

    const result = await requestPasswordReset('nonexistent@example.com');
    expect(result.success).toBe(true);
  });

  it('does not send an email when the account does not exist', async () => {
    mockListUsers.mockImplementation(async () => ({ data: { users: [] }, error: null }));

    await requestPasswordReset('ghost@example.com');
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('sends a reset email when the account exists', async () => {
    mockListUsers.mockImplementation(async () => ({
      data: { users: [{ id: VALID_USER_ID, email: VALID_EMAIL }] },
      error: null,
    }));

    mockSupabase.from = mock((_: string) => ({
      insert: mock(async () => ({ data: {}, error: null })),
      select: mockFromSelect,
      update: mockFromUpdate,
    })) as any;

    await requestPasswordReset(VALID_EMAIL);
    expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const call = (mockSendPasswordResetEmail as any).mock.calls[0][0];
    expect(call.to).toBe(VALID_EMAIL);
    expect(typeof call.token).toBe('string');
    expect(call.token.length).toBeGreaterThan(0);
  });

  it('throws AuthError when email is empty', async () => {
    let thrown = false;
    try {
      await requestPasswordReset('');
    } catch (err) {
      thrown = true;
      expect(err).toBeInstanceOf(AuthError);
    }
    expect(thrown).toBe(true);
  });
});

describe('confirmPasswordReset', () => {
  const futureExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const pastExpiry = new Date(Date.now() - 1000).toISOString();

  beforeEach(() => {
    mockUpdateUserById.mockClear();
  });

  it('throws on invalid / unknown token', async () => {
    mockSupabase.from = mock((_: string) => ({
      select: mock(() => ({
        eq: mock(() => ({
          single: mock(async () => ({ data: null, error: { message: 'no rows' } })),
        })),
      })),
      update: mock(() => ({ eq: mock(async () => ({})) })),
    })) as any;

    let thrown = false;
    try {
      await confirmPasswordReset('badtoken', 'NewPass1!');
    } catch (err) {
      thrown = true;
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).message).toMatch(/Invalid/);
    }
    expect(thrown).toBe(true);
  });

  it('throws on expired token', async () => {
    mockSupabase.from = mock((_: string) => ({
      select: mock(() => ({
        eq: mock(() => ({
          single: mock(async () => ({
            data: { id: 't1', user_id: VALID_USER_ID, expires_at: pastExpiry, consumed_at: null },
            error: null,
          })),
        })),
      })),
      update: mock(() => ({ eq: mock(async () => ({})) })),
    })) as any;

    let thrown = false;
    try {
      await confirmPasswordReset('sometoken', 'NewPass1!');
    } catch (err) {
      thrown = true;
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).message).toMatch(/expired/);
    }
    expect(thrown).toBe(true);
  });

  it('throws on already-consumed (single-use) token', async () => {
    mockSupabase.from = mock((_: string) => ({
      select: mock(() => ({
        eq: mock(() => ({
          single: mock(async () => ({
            data: {
              id: 't1',
              user_id: VALID_USER_ID,
              expires_at: futureExpiry,
              consumed_at: new Date().toISOString(),
            },
            error: null,
          })),
        })),
      })),
      update: mock(() => ({ eq: mock(async () => ({})) })),
    })) as any;

    let thrown = false;
    try {
      await confirmPasswordReset('usedtoken', 'NewPass1!');
    } catch (err) {
      thrown = true;
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).message).toMatch(/already been used/);
    }
    expect(thrown).toBe(true);
  });

  it('updates the password and marks token consumed on valid token', async () => {
    const mockUpdateEq = mock(async () => ({}));
    const mockUpdateChain = mock(() => ({ eq: mockUpdateEq }));

    mockSupabase.from = mock((_: string) => ({
      select: mock(() => ({
        eq: mock(() => ({
          single: mock(async () => ({
            data: { id: 't1', user_id: VALID_USER_ID, expires_at: futureExpiry, consumed_at: null },
            error: null,
          })),
        })),
      })),
      update: mockUpdateChain,
    })) as any;

    mockUpdateUserById.mockImplementation(async () => ({ data: {}, error: null }));

    const result = await confirmPasswordReset('validtoken', 'NewPass1!');
    expect(result.success).toBe(true);
    expect(mockUpdateUserById).toHaveBeenCalledWith(VALID_USER_ID, { password: 'NewPass1!' });
  });

  it('throws when both token and password are missing', async () => {
    let thrown = false;
    try {
      await confirmPasswordReset('', '');
    } catch (err) {
      thrown = true;
      expect(err).toBeInstanceOf(AuthError);
    }
    expect(thrown).toBe(true);
  });
});
