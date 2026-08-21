/**
 * Unit tests for escrow transaction reconciliation.
 * Tests status polling, state transitions, and logging.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { rpc } from '@stellar/stellar-sdk';
import { getTransactionStatus } from '../../src/blockchain/transactionUtils.js';

describe('blockchain.transactionUtils - transaction status', () => {
  describe('getTransactionStatus', () => {
    it('should return pending for NOT_FOUND status', async () => {
      const mockServer = {
        getTransaction: mock(async () => ({
          status: rpc.Api.GetTransactionStatus.NOT_FOUND,
        })),
      } as unknown as rpc.Server;

      const result = await getTransactionStatus(mockServer, 'test-hash');
      expect(result.status).toBe('pending');
      expect(result.response).toBeUndefined();
    });

    it('should return success for SUCCESS status with response', async () => {
      const mockResponse = {
        status: rpc.Api.GetTransactionStatus.SUCCESS,
        hash: 'test-hash',
        ledger: 100,
      };

      const mockServer = {
        getTransaction: mock(async () => mockResponse),
      } as unknown as rpc.Server;

      const result = await getTransactionStatus(mockServer, 'test-hash');
      expect(result.status).toBe('success');
      expect(result.response).toBe(mockResponse);
    });

    it('should return failed for FAILED status', async () => {
      const mockResponse = {
        status: rpc.Api.GetTransactionStatus.FAILED,
        hash: 'test-hash',
        resultXdr: 'error-xdr',
      };

      const mockServer = {
        getTransaction: mock(async () => mockResponse),
      } as unknown as rpc.Server;

      const result = await getTransactionStatus(mockServer, 'test-hash');
      expect(result.status).toBe('failed');
      expect(result.response).toBe(mockResponse);
    });

    it('should return failed on RPC error', async () => {
      const mockServer = {
        getTransaction: mock(async () => {
          throw new Error('RPC connection error');
        }),
      } as unknown as rpc.Server;

      const result = await getTransactionStatus(mockServer, 'test-hash');
      expect(result.status).toBe('failed');
    });

    it('should handle multiple status checks in sequence', async () => {
      let callCount = 0;
      const mockServer = {
        getTransaction: mock(async () => {
          callCount++;
          if (callCount === 1) {
            return { status: rpc.Api.GetTransactionStatus.NOT_FOUND };
          }
          return {
            status: rpc.Api.GetTransactionStatus.SUCCESS,
            hash: 'test-hash',
            ledger: 100,
          };
        }),
      } as unknown as rpc.Server;

      const result1 = await getTransactionStatus(mockServer, 'test-hash');
      expect(result1.status).toBe('pending');

      const result2 = await getTransactionStatus(mockServer, 'test-hash');
      expect(result2.status).toBe('success');
    });
  });
});
