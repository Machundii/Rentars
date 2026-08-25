'use client';

import { useAuth } from './use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function useAuthGuard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait for the initial authentication check to complete before
    // redirecting — prevents a logged-in user from flashing the login page.
    if (isLoading) return;

    if (!user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  return { isAuthenticated: !!user, isLoading };
}
