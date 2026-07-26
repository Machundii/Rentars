import Link from 'next/link';
import { House, Search, ArrowLeft } from 'lucide-react';
import { NotFoundContent } from '@/components/error/NotFoundContent';

/**
 * App Router not-found.tsx — rendered when notFound() is called or a route
 * doesn't match.  This is a Server Component wrapper; the interactive search
 * box lives in the client component below.
 */
export default function NotFoundPage() {
  return <NotFoundContent />;
}
