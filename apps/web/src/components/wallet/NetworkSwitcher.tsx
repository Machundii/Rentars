'use client';

import { useState } from 'react';
import { useWalletContext } from '@/context/WalletContext';

interface NetworkSwitcherProps {
    className?: string;
    onNetworkChange?: (network: 'testnet' | 'mainnet') => void;
}

export function NetworkSwitcher({ className = '', onNetworkChange }: NetworkSwitcherProps) {
    const { state } = useWalletContext();
    const [isOpen, setIsOpen] = useState(false);

    const handleNetworkSwitch = (network: 'testnet' | 'mainnet') => {
        // Store the selected network
        localStorage.setItem('stellar_network', network);

        // Dispatch event for other components to react
        window.dispatchEvent(new CustomEvent('stellar-network-change', { detail: { network } }));

        if (onNetworkChange) {
            onNetworkChange(network);
        }

        setIsOpen(false);
    };

    if (!state.isConnected) {
        return null;
    }

    return (
        <div className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
            >
                <span className="capitalize">{state.network}</span>
                <svg
                    className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-2">
                        <button
                            onClick={() => handleNetworkSwitch('testnet')}
                            className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                                state.network === 'testnet'
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'hover:bg-gray-50'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span>Testnet</span>
                                {state.network === 'testnet' && (
                                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                        </button>
                        <button
                            onClick={() => handleNetworkSwitch('mainnet')}
                            className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                                state.network === 'mainnet'
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'hover:bg-gray-50'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span>Mainnet</span>
                                {state.network === 'mainnet' && (
                                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                        </button>
                    </div>
                    <div className="px-3 py-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500">
                            {state.networkMismatch ? (
                                <span className="text-yellow-600">⚠️ Switch to match app network</span>
                            ) : (
                                <span>✓ Network matches</span>
                            )}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}