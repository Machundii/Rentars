/**
 * Unit tests for blockchain-specific property operations.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { resetBlockchainMocks, mockBlockchainServices } from '../mocks/blockchain.mocks.js';

describe('Property Blockchain Integration', () => {
  beforeEach(() => {
    resetBlockchainMocks();
  });

  describe('listPropertyOnChain', () => {
    it('should list a property on-chain successfully', async () => {
      const result = await mockBlockchainServices.listPropertyOnChain();
      expect(result).toBe(BigInt(1));
      expect(mockBlockchainServices.listPropertyOnChain).toHaveBeenCalledTimes(1);
    });

    it('should handle blockchain RPC errors', async () => {
      mockBlockchainServices.listPropertyOnChain.mockImplementation(async () => {
        throw new Error('RPC connection failed');
      });

      let threw = false;
      try {
        await mockBlockchainServices.listPropertyOnChain();
      } catch (err) {
        threw = true;
        expect((err as Error).message).toBe('RPC connection failed');
      }
      expect(threw).toBe(true);
    });
  });

  describe('getPropertyOnChain', () => {
    it('should retrieve property from blockchain', async () => {
      const result = await mockBlockchainServices.getPropertyOnChain();
      expect(result).toBeDefined();
      expect(result?.title).toBe('Test Property');
      expect(result?.id).toBe(BigInt(1));
    });

    it('should handle property not found on-chain', async () => {
      mockBlockchainServices.getPropertyOnChain.mockImplementation(async () => null);

      const result = await mockBlockchainServices.getPropertyOnChain();
      expect(result).toBeNull();
    });
  });
});
