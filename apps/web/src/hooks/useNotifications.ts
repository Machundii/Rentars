'use client';

import { createClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const API_BASE = `${API_URL}/api/v1/notifications`;

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(API_BASE, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setNotifications(await res.json());
    } catch {}
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time subscription via Supabase Realtime (WebSocket)
  useEffect(() => {
    if (!userId) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;

    const client = createClient(supabaseUrl, supabaseKey);
    const channel = client
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as AppNotification, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === (payload.new as AppNotification).id ? (payload.new as AppNotification) : n
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) =>
            prev.filter((n) => n.id !== (payload.old as AppNotification).id)
          );
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [userId]);

  const markRead = useCallback(async (id: string) => {
    const token = getToken();
    if (!token) return;

    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await fetch(`${API_BASE}/${id}/read`, {
      method: 'PATCH',
      headers: authHeaders(),
    }).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch(`${API_BASE}/read-all`, {
      method: 'PATCH',
      headers: authHeaders(),
    }).catch(() => {});
  }, []);

  const removeNotification = useCallback(async (id: string) => {
    const token = getToken();
    if (!token) return;

    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }).catch(() => {});
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    isLoading,
    unreadCount,
    markRead,
    markAllRead,
    removeNotification,
    refetch: fetchNotifications,
  };
}
