'use client';

import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';

const NOTIFICATION_LABELS: Record<string, string> = {
  booking_created: 'New booking created',
  booking_confirmed: 'Booking confirmed',
  booking_cancelled: 'Booking cancelled',
  payment_received: 'Payment received',
  booking_reminder: 'Booking reminders',
  review_requested: 'Review requests',
  system_alert: 'System alerts',
};

export default function NotificationPreferences() {
  const {
    preferences,
    isLoading,
    isPushSupported,
    pushSubscribed,
    updatePreferences,
    subscribeToPush,
    unsubscribeFromPush,
  } = useNotificationPreferences();

  if (isLoading) {
    return <div className="animate-pulse h-40 bg-gray-100 dark:bg-gray-800 rounded-xl" />;
  }

  const handleToggle = async (key: 'email_notifications' | 'push_notifications') => {
    await updatePreferences({ [key]: !preferences[key] });
  };

  const handleTypeToggle = async (type: string) => {
    const current = preferences.notification_types[type] !== false;
    await updatePreferences({
      notification_types: { ...preferences.notification_types, [type]: !current },
    });
  };

  const handlePushToggle = async () => {
    if (pushSubscribed) {
      await unsubscribeFromPush();
    } else {
      await subscribeToPush();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Notification Channels</h3>
        <div className="space-y-3">
          <Toggle
            label="Email notifications"
            description="Receive booking and payment updates via email"
            checked={preferences.email_notifications}
            onChange={() => handleToggle('email_notifications')}
          />
          {isPushSupported && (
            <Toggle
              label="Browser push notifications"
              description="Get instant alerts in your browser"
              checked={pushSubscribed}
              onChange={handlePushToggle}
            />
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Notification Types</h3>
        <div className="space-y-3">
          {Object.entries(NOTIFICATION_LABELS).map(([type, label]) => (
            <Toggle
              key={type}
              label={label}
              checked={preferences.notification_types[type] !== false}
              onChange={() => handleTypeToggle(type)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  const id = `toggle-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
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
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
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
