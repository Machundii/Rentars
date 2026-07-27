'use client';

/**
 * Public preference management page — /preferences/manage?token=<signed-token>
 *
 * Lets email recipients manage their notification settings (or unsubscribe)
 * without needing to log in. The signed token in the URL encodes the user ID
 * and is verified server-side.
 *
 * Reuses the same toggle UI as the authenticated NotificationPreferences
 * component via a local hook that calls the token-based API endpoints.
 */

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Bell, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationPreferences {
  email_notifications: boolean;
  push_notifications: boolean;
  notification_types: Record<string, boolean>;
}

const DEFAULT_PREFS: NotificationPreferences = {
  email_notifications: true,
  push_notifications: true,
  notification_types: {},
};

const NOTIFICATION_LABELS: Record<string, { label: string; essential: boolean }> = {
  booking_created: { label: 'New booking received', essential: false },
  booking_confirmed: { label: 'Booking confirmed by host', essential: false },
  booking_cancelled: { label: 'Booking cancellations', essential: false },
  payment_received: { label: 'Payment received', essential: false },
  booking_reminder: { label: 'Upcoming stay reminders', essential: false },
  review_requested: { label: 'Review requests after a stay', essential: false },
  system_alert: { label: 'System alerts', essential: false },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagePreferencesPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const unsubscribeAll = searchParams.get('unsubscribe') === '1';

  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'unsubscribed'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  // Build the base URL for token-authenticated requests
  const apiBase = `${API_URL}/api/v1/notifications/manage-preferences?token=${encodeURIComponent(token)}`;

  // ── Fetch current preferences ──────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('No token provided. Please use the link from your email.');
      return;
    }

    fetch(apiBase)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return res.json() as Promise<NotificationPreferences>;
      })
      .then((data) => {
        setPrefs(data);
        setStatus('ready');

        // Honour one-click unsubscribe immediately if ?unsubscribe=1
        if (unsubscribeAll) {
          handleUnsubscribeAll(data);
        }
      })
      .catch((err: Error) => {
        setStatus('error');
        setErrorMsg(err.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Patch helper ───────────────────────────────────────────────────────────
  const patch = useCallback(
    async (updates: Partial<NotificationPreferences> & { unsubscribe_all?: boolean }) => {
      setSaving(true);
      setSavedMsg('');
      try {
        const res = await fetch(apiBase, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Save failed (${res.status})`);
        }
        const updated = (await res.json()) as NotificationPreferences;
        setPrefs(updated);
        setSavedMsg('Preferences saved.');
        setTimeout(() => setSavedMsg(''), 3000);
        return updated;
      } catch (err) {
        setSavedMsg((err as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [apiBase],
  );

  // ── One-click unsubscribe ──────────────────────────────────────────────────
  const handleUnsubscribeAll = useCallback(
    async (_currentPrefs?: NotificationPreferences) => {
      const result = await patch({ unsubscribe_all: true });
      if (result) setStatus('unsubscribed');
    },
    [patch],
  );

  // ── Toggle handlers ────────────────────────────────────────────────────────
  const toggleChannel = async (key: 'email_notifications' | 'push_notifications') => {
    await patch({ [key]: !prefs[key] });
  };

  const toggleType = async (type: string) => {
    const current = prefs.notification_types[type] !== false;
    await patch({
      notification_types: { ...prefs.notification_types, [type]: !current },
    });
  };

  // ─── Render states ─────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="animate-spin mr-2" size={20} />
          Loading your preferences…
        </div>
      </PageShell>
    );
  }

  if (status === 'error') {
    return (
      <PageShell>
        <div
          className="flex items-start gap-3 p-5 bg-red-50 border border-red-200 rounded-xl"
          role="alert"
        >
          <AlertCircle size={20} className="text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-red-900">Unable to load preferences</p>
            <p className="text-sm text-red-700 mt-1">{errorMsg}</p>
            <p className="text-sm text-red-600 mt-2">
              The link may have expired. Please{' '}
              <a href="/login" className="underline font-medium">
                log in
              </a>{' '}
              to manage your preferences.
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  if (status === 'unsubscribed') {
    return (
      <PageShell>
        <div
          className="flex items-start gap-3 p-5 bg-green-50 border border-green-200 rounded-xl"
          data-testid="unsubscribed-confirmation"
        >
          <CheckCircle2 size={20} className="text-green-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-green-900">You've been unsubscribed</p>
            <p className="text-sm text-green-700 mt-1">
              You will no longer receive optional notification emails from Rentars.
            </p>
            <p className="text-sm text-green-600 mt-3">
              Essential account and security emails (password reset, email verification) will
              continue to be sent as required.
            </p>
            <button
              onClick={() => setStatus('ready')}
              className="mt-4 text-sm text-green-700 underline font-medium"
            >
              Review my preferences anyway
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── Main preferences UI ────────────────────────────────────────────────────
  return (
    <PageShell>
      {savedMsg && (
        <div
          className="mb-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-center gap-2"
          role="status"
          aria-live="polite"
          data-testid="save-status"
        >
          <CheckCircle2 size={14} />
          {savedMsg}
        </div>
      )}

      {/* Channels */}
      <section
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5"
        data-testid="channels-section"
      >
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Notification channels</h2>
        <div className="space-y-3">
          <Toggle
            id="pref-email"
            label="Email notifications"
            description="Receive booking and payment updates via email"
            checked={prefs.email_notifications}
            onChange={() => toggleChannel('email_notifications')}
            disabled={saving}
          />
        </div>
      </section>

      {/* Per-type toggles */}
      <section
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5"
        data-testid="types-section"
      >
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Notification types</h2>
        <p className="text-sm text-gray-500 mb-4">
          Fine-tune which optional emails you'd like to receive. Essential security emails cannot
          be disabled.
        </p>
        <div className="space-y-3">
          {Object.entries(NOTIFICATION_LABELS).map(([type, { label }]) => (
            <Toggle
              key={type}
              id={`pref-type-${type}`}
              label={label}
              checked={prefs.notification_types[type] !== false}
              onChange={() => toggleType(type)}
              disabled={saving}
            />
          ))}
        </div>
      </section>

      {/* Unsubscribe all */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          onClick={() => handleUnsubscribeAll()}
          disabled={saving || !prefs.email_notifications}
          className="text-sm text-gray-500 hover:text-red-600 underline disabled:opacity-40 disabled:cursor-not-allowed transition"
          data-testid="unsubscribe-all-btn"
        >
          Unsubscribe from all optional emails
        </button>

        <a
          href="/login"
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition"
        >
          Log in for full settings
          <ExternalLink size={13} />
        </a>
      </div>
    </PageShell>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Bell size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Notification Preferences
            </h1>
            <p className="text-sm text-gray-500">Rentars</p>
          </div>
        </div>

        {children}
      </div>
    </main>
  );
}

// ─── Toggle component ─────────────────────────────────────────────────────────

interface ToggleProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

function Toggle({ id, label, description, checked, onChange, disabled }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <label
          htmlFor={id}
          className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
        >
          {label}
        </label>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        disabled={disabled}
        data-testid={`toggle-${id}`}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
        }`}
      >
        <span className="sr-only">{label}</span>
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
