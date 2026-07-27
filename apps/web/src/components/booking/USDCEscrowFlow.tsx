'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useEscrowTransaction } from '@/hooks/useEscrowTransaction';

type Phase = 'fund' | 'release';

export interface USDCEscrowFlowProps {
  phase: Phase;
  escrowId: string;
  tenantPublicKey: string;
  ownerPublicKey: string;
  amount: number;
}

export default function USDCEscrowFlow({
  phase,
  escrowId,
  tenantPublicKey,
  ownerPublicKey,
  amount,
}: USDCEscrowFlowProps) {
  const { connect, isConnected, publicKey } = useWallet('testnet');
  const { submit, isSubmitting, error } = useEscrowTransaction('testnet');
  const [txHash, setTxHash] = useState<string | null>(null);

  const isTenant = useMemo(() => {
    return publicKey === tenantPublicKey;
  }, [publicKey, tenantPublicKey]);

  const isOwner = useMemo(() => {
    return publicKey === ownerPublicKey;
  }, [publicKey, ownerPublicKey]);

  const canContinue = phase === 'fund' ? isTenant : isOwner;

  const label = phase === 'fund' ? 'Sign & Fund Escrow' : 'Sign & Release Payment';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 space-y-4 border border-gray-100 dark:border-gray-700">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {phase === 'fund' ? 'USDC escrow funding' : 'USDC escrow release'}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Amount: <span className="font-semibold text-gray-900 dark:text-white">{amount} USDC</span>
        </p>
      </div>

      {!isConnected && (
        <button
          onClick={() => connect()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition"
          type="button"
        >
          Connect Freighter Wallet
        </button>
      )}

      {isConnected && !canContinue && (
        <div className="text-sm text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          Please connect the correct wallet ({phase === 'fund' ? 'tenant' : 'owner'}) to continue.
        </div>
      )}

      {isConnected && canContinue && !txHash && (
        <button
          onClick={async () => {
            const res = await submit({
              type: phase === 'fund' ? 'fund' : 'release',
              escrowId,
              amount,
              tenantPublicKey,
              ownerPublicKey,
            });
            setTxHash(res.txHash);
          }}
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
          type="button"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Processing...
            </>
          ) : (
            label
          )}
        </button>
      )}

      {error && (
        <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
          {error}
        </div>
      )}

      {txHash && (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <div className="font-semibold mb-1">Transaction submitted</div>
          <div className="font-mono break-all">{txHash}</div>
          <a
            className="text-blue-600 dark:text-blue-400 hover:underline"
            href={`https://stellar.expert/testnet/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            View on Stellar Explorer
          </a>
        </div>
      )}

      <div className="text-xs text-gray-500 dark:text-gray-400">
        Retry is handled automatically on the client.
      </div>
    </div>
  );
}

