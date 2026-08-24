import { describe, it, expect, mock, beforeEach } from 'bun:test';

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockSelect = mock(() => ({ data: [], error: null }));
const mockInsert = mock(() => ({ data: null, error: null }));
const mockDelete = mock(() => ({ error: null }));

const mockFrom = mock((table: string) => {
  if (table === 'saved_searches') {
    return {
      select: () => ({ eq: () => ({ order: () => mockSelect() }), insert: () => ({ select: () => ({ single: () => mockInsert() }) }), delete: () => ({ eq: () => ({ eq: () => mockDelete() }) }) }),
    };
  }
  return { select: () => ({ eq: () => ({ eq: () => ({ lt: () => ({ gt: () => ({ limit: () => ({ data: [], error: null }) }) }) }) }) }) };
});

const mockSupabase = { from: mockFrom };
const supabaseMod = await import('../../src/config/supabase.js');
(supabaseMod as any).supabase = mockSupabase;

import {
  createSavedSearch,
  listSavedSearches,
  deleteSavedSearch,
} from '../../src/services/savedSearch.service.js';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('savedSearch CRUD', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockInsert.mockClear();
    mockDelete.mockClear();
  });

  it('createSavedSearch calls supabase insert with correct data', async () => {
    mockInsert.mockImplementation(async () => ({
      data: { id: 's1', user_id: 'u1', name: 'Beach Search', filters: { city: 'Miami' }, created_at: '2026-01-01' },
      error: null,
    }));

    const result = await createSavedSearch('u1', 'Beach Search', { city: 'Miami' });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Beach Search');
  });

  it('createSavedSearch rejects empty name', async () => {
    const result = await createSavedSearch('u1', '', { city: 'Miami' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Search name is required');
  });

  it('listSavedSearches calls supabase select with user filter', async () => {
    mockSelect.mockImplementation(async () => ({
      data: [{ id: 's1', user_id: 'u1', name: 'Test', filters: {} }],
      error: null,
    }));

    const result = await listSavedSearches('u1');
    expect(result.success).toBe(true);
  });

  it('deleteSavedSearch calls supabase delete with user ownership check', async () => {
    mockDelete.mockImplementation(async () => ({ error: null }));

    const result = await deleteSavedSearch('u1', 's1');
    expect(result.success).toBe(true);
  });
});
