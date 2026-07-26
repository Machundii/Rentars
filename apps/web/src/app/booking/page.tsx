'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import BookingForm from '@/components/booking/BookingForm';
import WalletConnectionModal from '@/components/booking/WalletConnectionModal';
import HouseRulesAcknowledgement, {
  type HouseRules,
} from '@/components/booking/HouseRulesAcknowledgement';
import { isValidStellarAddress } from '@/lib/freighter-utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function BookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('propertyId') || 'property-id';

  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // House rules state
  const [houseRules, setHouseRules] = useState<HouseRules | null>(null);
  const [rulesAcknowledgedAt, setRulesAcknowledgedAt] = useState('');

  // Check for existing wallet connection on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem('walletAddress');
    if (savedAddress && isValidStellarAddress(savedAddress)) {
      setWalletAddress(savedAddress);
      setWalletConnected(true);
    }
  }, []);

  // Fetch property rules
  useEffect(() => {
    if (!propertyId || propertyId === 'property-id') return;
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/api/v1/properties/${propertyId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setHouseRules({
            pets_allowed: data.pets_allowed,
            smoking_allowed: data.smoking_allowed,
            events_allowed: data.events_allowed,
            quiet_hours_start: data.quiet_hours_start,
            quiet_hours_end: data.quiet_hours_end,
            additional_rules: data.additional_rules,
          });
        }
      })
      .catch(() => {});
  }, [propertyId]);

  const hasRulesToAcknowledge =
    houseRules !== null &&
    (houseRules.pets_allowed !== undefined ||
      houseRules.smoking_allowed !== undefined ||
      houseRules.events_allowed !== undefined ||
      houseRules.quiet_hours_start ||
      houseRules.additional_rules);

  const rulesGatePassed = !hasRulesToAcknowledge || !!rulesAcknowledgedAt;

  const handleBookingSubmit = async (data: {
    checkIn: Date;
    checkOut: Date;
    guestCount: number;
    totalPrice: number;
  }) => {
    if (!walletConnected || !walletAddress) {
      setShowWalletModal(true);
      return;
    }

    if (!rulesGatePassed) {
      return; // button will be disabled, but guard anyway
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          property_id: propertyId,
          check_in: data.checkIn.toISOString(),
          check_out: data.checkOut.toISOString(),
          guest_count: data.guestCount,
          total_price: data.totalPrice,
          wallet_address: walletAddress,
          rules_acknowledged_at: rulesAcknowledgedAt || new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const booking = await response.json();
        router.push(`/booking/confirmation/${booking.id}`);
      } else {
        alert(t('failed'));
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert(t('error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleWalletConnect = (address: string) => {
    setWalletAddress(address);
    setWalletConnected(true);
  };

  const handleWalletDisconnect = () => {
    localStorage.removeItem('walletAddress');
    setWalletAddress(null);
    setWalletConnected(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('title')}</h1>
        <p className="text-gray-600 mb-8">{t('subtitle')}</p>

        {/* Wallet Status Card */}
        <div className="mb-6">
          {walletConnected && walletAddress ? (
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-green-900">{t('walletConnected')}</p>
                <p className="text-xs text-green-700 mt-1 font-mono break-all">{walletAddress}</p>
                <button
                  onClick={handleWalletDisconnect}
                  className="text-xs text-green-600 hover:text-green-700 mt-2 underline"
                >
                  {t('disconnect')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-900">{t('walletNotConnected')}</p>
                <p className="text-xs text-amber-700 mt-1">{t('walletNote')}</p>
              </div>
            </div>
          )}
        </div>

        {/* House Rules — must be acknowledged before booking */}
        {houseRules && (
          <div className="mb-6">
            <HouseRulesAcknowledgement
              rules={houseRules}
              acknowledged={!!rulesAcknowledgedAt}
              onAcknowledge={(ts) => setRulesAcknowledgedAt(ts)}
            />
          </div>
        )}

        {/* Booking form — disabled when rules not yet acknowledged */}
        <div className={hasRulesToAcknowledge && !rulesGatePassed ? 'opacity-50 pointer-events-none' : ''}>
          {hasRulesToAcknowledge && !rulesGatePassed && (
            <p className="text-sm text-amber-700 mb-3 flex items-center gap-2">
              <AlertCircle size={15} aria-hidden="true" />
              Please acknowledge the house rules above to continue.
            </p>
          )}
          <BookingForm
            propertyId={propertyId}
            pricePerNight={100}
            onSubmit={handleBookingSubmit}
            isLoading={isLoading}
          />
        </div>
      </div>

      <WalletConnectionModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onConnect={handleWalletConnect}
      />
    </main>
  );
}
