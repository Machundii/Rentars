'use client';

import { ErrorContent } from '@/components/error/ErrorContent';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return <ErrorContent error={error} reset={reset} context="global-error-boundary" />;
}
