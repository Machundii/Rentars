import type { Property } from '@/types/property';
import PropertyCard from './PropertyCard';
import { PropertyListSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorDisplay } from '@/components/ui/error-display';
import { Button } from '@/components/ui/button';

interface PropertyGridProps {
  properties: Property[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function PropertyGrid({
  properties,
  loading = false,
  error = null,
  onRetry
}: PropertyGridProps) {
  if (loading) {
    return <PropertyListSkeleton count={6} />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorDisplay
          title="Search Error"
          message={error}
        />
        {onRetry && (
          <div className="flex justify-center">
            <Button onClick={onRetry} variant="default">
              Try Again
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-gray-400 mb-4">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.21A4.003 4.003 0 003 15z" />
          </svg>
          <p className="text-lg font-medium">No properties found</p>
          <p className="text-sm mt-2">Try adjusting your search filters or check back later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {properties.map((p) => (
        <PropertyCard key={p.id} property={p} />
      ))}
    </div>
  );
}
