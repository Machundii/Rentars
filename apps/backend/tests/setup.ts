/**
 * Global test setup — runs before all tests.
 * Initializes mock environment variables and mock clients.
 *
 * Uses only standard Node.js globals — compatible with bun:test, Jest, and Vitest.
 */

// Mock environment variables
process.env.SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
process.env.JWT_SECRET = 'mock-jwt-secret-min-32-characters-long';
process.env.STELLAR_RPC_URL = 'https://soroban-testnet.stellar.org';
process.env.STELLAR_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
process.env.STELLAR_NETWORK = 'testnet';
process.env.CORS_ORIGIN = 'http://localhost:3001';
process.env.PORT = '3000';
process.env.REDIS_URL = '';
process.env.PROPERTY_LISTING_CONTRACT_ID = 'CDZVXPNK4JGPJD3DYLZX5JBIHGRV5P4SUX7G7MZ7CZTGM7BJS2CZ4P3';
process.env.BOOKING_CONTRACT_ID = 'CDZVXPNK4JGPJD3DYLZX5JBIHGRV5P4SUX7G7MZ7TEST4BJS2CZ4P33';
process.env.TRUSTLESS_WORK_API_URL = 'https://sandbox.trustlesswork.com';
process.env.TRUSTLESS_WORK_API_KEY = 'test-api-key';

// Suppress console output during tests to keep output clean
const noop = () => {};
global.console = {
  ...console,
  log: noop,
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
};
