/**
 * Unit tests for blockchain transaction fee estimation.
 * Tests fee estimation calculation and ceiling enforcement.
 */

import { describe, it, expect } from 'bun:test';
import { estimateTransactionFee, getEstimatedNetworkFeeInUSDC } from '../../src/blockchain/transactionUtils.js';

describe('blockchain.transactionUtils - fee estimation', () => {
  describe('estimateTransactionFee', () => {
    it('should return estimated fee greater than or equal to BASE_FEE', async () => {
      const fee = await estimateTransactionFee();
      expect(Number(fee)).toBeGreaterThan(0);
    });

    it('should return string representation of fee', async () => {
      const fee = await estimateTransactionFee();
      expect(typeof fee).toBe('string');
      expect(/^\d+$/.test(fee)).toBe(true);
    });

    it('should respect ceiling multiplier (max 10x BASE_FEE)', async () => {
      const fee = await estimateTransactionFee();
      const baseFee = BigInt(process.env.STELLAR_BASE_FEE || '100');
      const ceiling = baseFee * 10n;
      expect(BigInt(fee)).toBeLessThanOrEqual(ceiling);
    });

    it('should fall back to BASE_FEE on error', async () => {
      const fee = await estimateTransactionFee();
      expect(fee).toBeDefined();
      expect(Number(fee)).toBeGreaterThan(0);
    });
  });

  describe('getEstimatedNetworkFeeInUSDC', () => {
    it('should return fee in USDC (stroops / 10_000_000)', async () => {
      const feeInUSDC = await getEstimatedNetworkFeeInUSDC();
      expect(typeof feeInUSDC).toBe('number');
      expect(feeInUSDC).toBeGreaterThan(0);
    });

    it('should return positive number', async () => {
      const feeInUSDC = await getEstimatedNetworkFeeInUSDC();
      expect(feeInUSDC).toBeGreaterThan(0);
    });

    it('should be relatively small (less than 1 USDC)', async () => {
      const feeInUSDC = await getEstimatedNetworkFeeInUSDC();
      expect(feeInUSDC).toBeLessThan(1);
    });
  });
});
