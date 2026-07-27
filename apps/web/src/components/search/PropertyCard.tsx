import { Heart } from 'lucide-react';
import { useWishlist } from '@/hooks/useWishlist';
import { formatUSDC } from '@/lib/format';
import type { Property } from '@/types/property';
import { useWishlist } from '@/hooks/useWishlist';

interface PropertyCardProps {
  property: Property;
}

export default function PropertyCard({ property }: PropertyCardProps) {
  const { isInWishlist, toggle } = useWishlist();
  const saved = isInWishlist(property.id);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow relative">
      <div className="h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
        {property.images?.[0] ? (
          <img src={property.images[0]} alt={property.title} className="w-full h-full object-cover" />
        ) : (
          'No image'
        )}
      </div>

        <div className="p-4">
          <h3 className="font-semibold text-card-foreground truncate">{property.title}</h3>
          <p className="text-sm text-muted-foreground mt-1 truncate">{property.location}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="font-bold text-primary">
              {property.price_per_night} USDC
              <span className="text-xs font-normal text-muted-foreground"> / night</span>
            </span>
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                property.available
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {property.available ? 'Available' : 'Booked'}
            </span>
          </div>
        </div>
      </Link>

      {/* Wishlist toggle — sits on top of the link, intercepting its own click/key events */}
      <button
        onClick={(e) => { e.preventDefault(); toggle(property.id); }}
        className="absolute top-3 right-3 p-1.5 bg-white dark:bg-gray-800 rounded-full shadow hover:scale-110 transition-transform"
        aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <Heart
          size={18}
          aria-hidden="true"
          className={saved ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}
        />
      </button>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white truncate">{property.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">{property.location}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-bold text-blue-600">
            {formatUSDC(property.price_per_night)}
            <span className="text-xs font-normal text-gray-400"> / night</span>
          </span>
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              property.available
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}
          >
            {property.available ? 'Available' : 'Booked'}
          </span>
        </div>
      </div>
    </div>
  );
}
