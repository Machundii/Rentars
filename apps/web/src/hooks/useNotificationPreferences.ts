'use client';

import { useCallback, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const PREFS_URL = `${API_URL}/api/v1/notifications/preferences`;
const PUSH_URL = `${API_URL}/api/v1/notifications/push`;

export interface NotificationPreferences {
  email_notifications: boolean;
  push_notifications: boolean;
  notification_types: Record<string, boolean>;
}

const DEFAULT_PREFS: NotificationPreferences = {
  email_notifications: true,
  push_notifications: true,
  notification_types: {},
};

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
}

function authHeaders(extra: Record<string, string> = {}) {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, ...extra } : extra;
}

export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [isLoading, setIsLoading] = useState(true);
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);

  useEffect(() => {
    setIsPushSupported('serviceWorker' in navigator && 'PushManager' in window);
  }, []);

  const fetchPreferences = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(PREFS_URL, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPreferences(data);
      }
    } catch {}
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreferences = useCallback(
    async (updates: Partial<NotificationPreferences>): Promise<boolean> => {
      try {
        const res = await fetch(PREFS_URL, {
          method: 'PATCH',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          const updated = await res.json();
          setPreferences(updated);
          return true;
        }
      } catch {}
      return false;
    },
    []
  );

  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported) return false;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.warn('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not configured');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const sub = subscription.toJSON();
      const res = await fetch(`${PUSH_URL}/subscribe`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: sub.keys,
        }),
      });

      if (res.ok) {
        setPushSubscribed(true);
        await updatePreferences({ push_notifications: true });
        return true;
      }
    } catch (err) {
      console.error('[Push] Subscription failed:', err);
    }
    return false;
  }, [isPushSupported, updatePreferences]);

  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return true;

      await fetch(`${PUSH_URL}/unsubscribe`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      await subscription.unsubscribe();
      setPushSubscribed(false);
      await updatePreferences({ push_notifications: false });
      return true;
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err);
    }
    return false;
  }, [isPushSupported, updatePreferences]);

  return {
    preferences,
    isLoading,
    isPushSupported,
    pushSubscribed,
    updatePreferences,
    subscribeToPush,
    unsubscribeFromPush,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
