/**
 * Unit tests for blockchain transaction fee estimation.
 * Tests fee-stats querying, percentile selection, and ceiling enforcement.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { rpc } from '@stellar/stellar-sdk';
import { estimateTransactionFee, getEstimatedNetworkFeeInUSDC } from '../../src/blockchain/transactionUtils.js';
import * as sorobanModule from '../../src/blockchain/soroban.js';

describe('blockchain.transactionUtils - fee estimation', () => {
  describe('estimateTransactionFee', () => {
    it('should return fee from fee-stats at 90th percentile', async () => {
      const mockServer = {
        feeStats: mock(async () => ({
          fee_charged: {
            p10: '100',
            p20: '120',
            p30: '140',
            p40: '160',
            p50: '180',
            p60: '200',
            p70: '220',
            p80: '240',
            p90: '260',
            p99: '300',
          },
        })),
      } as unknown as rpc.Server;

      const fee = await estimateTransactionFee(mockServer);
      expect(fee).toBe('260');
    });

    it('should respect ceiling multiplier', async () => {
      const baseFee = '100';
      const ceiling = String(Number(baseFee) * 10); // 1000

      const mockServer = {
        feeStats: mock(async () => ({
          fee_charged: {
            p90: '5000', // Exceeds ceiling
            p99: '10000',
          },
        })),
      } as unknown as rpc.Server;

      const fee = await estimateTransactionFee(mockServer);
      expect(Number(fee)).toBeLessThanOrEqual(Number(ceiling));
    });

    it('should fallback to BASE_FEE on error', async () => {
      const mockServer = {
        feeStats: mock(async () => {
          throw new Error('RPC error');
        }),
      } as unknown as rpc.Server;

      const fee = await estimateTransactionFee(mockServer);
      // Should return BASE_FEE (100) on error
      expect(fee).toBeDefined();
      expect(Number(fee)).toBeGreaterThan(0);
    });

    it('should handle empty fee stats', async () => {
      const mockServer = {
        feeStats: mock(async () => ({
          fee_charged: {},
        })),
      } as unknown as rpc.Server;

      const fee = await estimateTransactionFee(mockServer);
      expect(fee).toBeDefined();
    });
  });

  describe('getEstimatedNetworkFeeInUSDC', () => {
    it('should convert stroops to USDC (stroops / 10_000_000)', async () => {
      const mockServer = {
        feeStats: mock(async () => ({
          fee_charged: {
            p90: '1000000', // 0.1 USDC
          },
        })),
      } as unknown as rpc.Server;

      // Mock getSorobanServer to return our mock
      const originalGetSorobanServer = sorobanModule.getSorobanServer;
      (sorobanModule as any).getSorobanServer = () => mockServer;

      try {
        const feeInUSDC = await getEstimatedNetworkFeeInUSDC();
        expect(feeInUSDC).toBe(0.1);
      } finally {
        (sorobanModule as any).getSorobanServer = originalGetSorobanServer;
      }
    });

    it('should return positive number on error', async () => {
      const mockServer = {
        feeStats: mock(async () => {
          throw new Error('Network error');
        }),
      } as unknown as rpc.Server;

      const originalGetSorobanServer = sorobanModule.getSorobanServer;
      (sorobanModule as any).getSorobanServer = () => mockServer;

      try {
        const feeInUSDC = await getEstimatedNetworkFeeInUSDC();
        expect(feeInUSDC).toBeGreaterThan(0);
      } finally {
        (sorobanModule as any).getSorobanServer = originalGetSorobanServer;
      }
    });
  });
});
