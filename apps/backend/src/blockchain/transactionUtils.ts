import {
  Keypair,
  Transaction,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import {
  BASE_FEE,
  NETWORK_PASSPHRASE,
  STELLAR_ADMIN_SECRET,
  STELLAR_SOURCE_ACCOUNT,
} from './config.js';
import { getSorobanServer } from './soroban.js';
import { BlockchainError } from './errors.js';

const FEE_ESTIMATION_PERCENTILE = 90;
const MAX_FEE_CEILING_MULTIPLIER = 10;

/**
 * Estimate the recommended transaction fee from live network statistics.
 *
 * Queries the Stellar RPC fee-stats endpoint, selects the fee at the
 * specified percentile, and caps it to prevent excessive charges.
 *
 * @returns Recommended fee in stroops
 */
export async function estimateTransactionFee(server: rpc.Server): Promise<string> {
  try {
    const feeStats = await server.feeStats();

    const fees = [
      feeStats.fee_charged?.p10,
      feeStats.fee_charged?.p20,
      feeStats.fee_charged?.p30,
      feeStats.fee_charged?.p40,
      feeStats.fee_charged?.p50,
      feeStats.fee_charged?.p60,
      feeStats.fee_charged?.p70,
      feeStats.fee_charged?.p80,
      feeStats.fee_charged?.p90,
      feeStats.fee_charged?.p99,
    ].filter((f): f is string => !!f);

    if (fees.length === 0) {
      return BASE_FEE;
    }

    const sortedFees = fees.map((f) => BigInt(f)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const percentileIndex = Math.floor(
      (FEE_ESTIMATION_PERCENTILE / 100) * (sortedFees.length - 1)
    );
    const estimatedFee = sortedFees[percentileIndex];

    const baseFeeNum = BigInt(BASE_FEE);
    const ceiling = baseFeeNum * BigInt(MAX_FEE_CEILING_MULTIPLIER);

    const finalFee = estimatedFee > ceiling ? ceiling : estimatedFee;
    return finalFee.toString();
  } catch (err) {
    console.warn(`[fee-estimation] Failed to estimate fee, using BASE_FEE: ${(err as Error).message}`);
    return BASE_FEE;
  }
}

/**
 * Build an unsigned transaction from a list of operations.
 * Uses dynamically estimated fee when available.
 */
export async function buildTransaction(
  operations: xdr.Operation[],
  sourceAddress: string = STELLAR_SOURCE_ACCOUNT,
  estimateFee: boolean = true,
): Promise<Transaction> {
  const server = getSorobanServer();
  const account = await server.getAccount(sourceAddress);

  let fee = BASE_FEE;
  if (estimateFee) {
    fee = await estimateTransactionFee(server);
  }

  let builder = new TransactionBuilder(account, {
    fee,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  for (const op of operations) {
    builder = builder.addOperation(op);
  }

  return builder.setTimeout(30).build();
}

/**
 * Sign a transaction with the given keypair (mutates and returns the transaction).
 */
export function signTransaction(tx: Transaction, keypair: Keypair): Transaction {
  tx.sign(keypair);
  return tx;
}

/**
 * Build, prepare (simulate + fill auth entries), and sign using the server admin keypair.
 */
export async function buildPrepareAndSign(
  server: rpc.Server,
  operations: xdr.Operation[],
): Promise<Transaction> {
  if (!STELLAR_ADMIN_SECRET) {
    throw new BlockchainError(
      'STELLAR_ADMIN_SECRET is not configured',
      'CONFIG_ERROR',
    );
  }

  const adminKeypair = Keypair.fromSecret(STELLAR_ADMIN_SECRET);
  const tx = await buildTransaction(operations, adminKeypair.publicKey());
  const prepared = await server.prepareTransaction(tx);
  (prepared as Transaction).sign(adminKeypair);
  return prepared as Transaction;
}

/**
 * Extract the native return value from a confirmed transaction response.
 */
export function extractReturnValue(
  response: rpc.Api.GetTransactionResponse,
): unknown {
  if (
    response.status !== rpc.Api.GetTransactionStatus.SUCCESS ||
    !response.returnValue
  ) {
    return undefined;
  }
  return scValToNative(response.returnValue);
}

/**
 * Get the estimated network fee in USDC (converted from stroops).
 * Useful for displaying in booking quote UI.
 *
 * @returns Fee in USDC (stroops / 10_000_000)
 */
export async function getEstimatedNetworkFeeInUSDC(): Promise<number> {
  try {
    const server = getSorobanServer();
    const feeStroops = await estimateTransactionFee(server);
    return Number(feeStroops) / 10_000_000;
  } catch (err) {
    console.warn(`[fee-conversion] Failed to convert fee to USDC: ${(err as Error).message}`);
    return Number(BASE_FEE) / 10_000_000;
  }
}
