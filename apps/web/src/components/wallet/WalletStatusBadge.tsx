'use client';

import { useWalletContext } from '@/context/WalletContext';

interface WalletStatusBadgeProps {
    showAddress?: boolean;
    className?: string;
}

export function WalletStatusBadge({ showAddress = true, className = '' }: WalletStatusBadgeProps) {
    const { state } = useWalletContext();

    if (state.isLoading) {
        return (
            <div className={`flex items-center gap-2 text-sm text-gray-500 ${className}`}>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
                <span>Loading wallet...</span>
            </div>
        );
    }

    if (!state.isConnected) {
        return null;
    }

    const formatAddress = (address: string) => {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-6)}`;
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full">
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${state.networkMismatch ? 'bg-yellow-400' : 'bg-green-400'} opacity-75`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${state.networkMismatch ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
        </span>
                <span className="text-xs font-medium text-green-700 capitalize">{state.network}</span>
                {showAddress && state.address && (
                    <>
                        <span className="text-gray-300">|</span>
                        <span className="text-xs font-mono text-green-700">{formatAddress(state.address)}</span>
                    </>
                )}
                {state.networkMismatch && (
                    <span className="text-xs text-yellow-600 font-medium ml-1">⚠️ Mismatch</span>
                )}
            </div>
        </div>
    );
}