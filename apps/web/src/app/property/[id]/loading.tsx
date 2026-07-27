import { PropertyDetailSkeleton } from '@/components/ui/loading-skeleton';

/**
 * Next.js route-level loading UI for /property/[id].
 * Rendered instantly while the async server component resolves its fetch,
 * eliminating blank-page flash and preventing cumulative layout shift.
 */
export default function PropertyLoading() {
  return <PropertyDetailSkeleton />;
}
