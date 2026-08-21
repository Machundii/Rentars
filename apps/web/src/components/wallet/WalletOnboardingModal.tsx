'use client';

import { useState, useEffect } from 'react';
import { WalletConnectButton } from './WalletConnectButton';
import { WalletErrorDisplay } from './WalletErrorDisplay';

interface WalletOnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConnected?: (address: string) => void;
    requiredNetwork?: 'testnet' | 'mainnet';
}

export function WalletOnboardingModal({
                                          isOpen,
                                          onClose,
                                          onConnected,
                                          requiredNetwork = 'testnet',
                                      }: WalletOnboardingModalProps) {
    const [step, setStep] = useState<'intro' | 'connect' | 'connected'>('intro');
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setStep('intro');
            setIsClosing(false);
        }
    }, [isOpen]);

    const handleConnect = (address: string) => {
        setStep('connected');
        if (onConnected) {
            onConnected(address);
        }
        // Auto close after 3 seconds
        setTimeout(() => {
            handleClose();
        }, 3000);
    };

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
        }, 300);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                {/* Background overlay */}
                <div
                    className={`fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                    aria-hidden="true"
                    onClick={handleClose}
                ></div>

                {/* Modal panel */}
                <div
                    className={`inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full ${
                        isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                    }`}
                >
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                {/* Step 1: Intro */}
                                {step === 'intro' && (
                                    <div>
                                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0">
                                            <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-lg leading-6 font-medium text-gray-900 mt-4" id="modal-title">
                                            Connect Your Stellar Wallet
                                        </h3>
                                        <div className="mt-2 space-y-4">
                                            <p className="text-sm text-gray-500">
                                                Rentars uses Stellar blockchain for secure, trustless payments and bookings.
                                            </p>
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                                <h4 className="text-sm font-medium text-blue-800 mb-2">Why connect your wallet?</h4>
                                                <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                                                    <li>Secure escrow payments for bookings</li>
                                                    <li>Instant property confirmations</li>
                                                    <li>Full ownership and transaction history</li>
                                                    <li>Direct peer-to-peer payments with minimal fees</li>
                                                </ul>
                                            </div>
                                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                                <p className="text-xs text-yellow-700">
                                                    ⚠️ Make sure you have Freighter wallet installed and set to <strong>{requiredNetwork}</strong>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                                            <button
                                                type="button"
                                                onClick={() => setStep('connect')}
                                                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                                            >
                                                Connect Wallet
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleClose}
                                                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                            >
                                                Skip for now
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Step 2: Connect */}
                                {step === 'connect' && (
                                    <div>
                                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0">
                                            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-lg leading-6 font-medium text-gray-900 mt-4">
                                            Connect Your Wallet
                                        </h3>
                                        <div className="mt-4">
                                            <WalletConnectButton
                                                onConnect={handleConnect}
                                                className="w-full justify-center"
                                            />
                                            <WalletErrorDisplay className="mt-4" />
                                        </div>
                                        <div className="mt-4">
                                            <button
                                                type="button"
                                                onClick={() => setStep('intro')}
                                                className="text-sm text-gray-500 hover:text-gray-700"
                                            >
                                                ← Back
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Step 3: Connected */}
                                {step === 'connected' && (
                                    <div>
                                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0">
                                            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <h3 className="text-lg leading-6 font-medium text-gray-900 mt-4">
                                            🎉 Wallet Connected!
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-2">
                                            Your Stellar wallet is now connected. You can start booking properties and managing escrow transactions.
                                        </p>
                                        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                                            <button
                                                type="button"
                                                onClick={handleClose}
                                                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                                            >
                                                Get Started
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}