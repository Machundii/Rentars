import { vi } from 'vitest';

/**
 * Reusable mock object for API calls used across frontend tests.
 * Each method is a vi.fn() that can be configured per-test.
 */
export const mockApiService = {
  auth: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
  bookings: {
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
  },
  properties: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};
