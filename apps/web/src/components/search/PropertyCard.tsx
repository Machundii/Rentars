'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import type { Property } from '@/types/property';
import { useWishlist } from '@/hooks/useWishlist';

interface PropertyCardProps {
  property: Property;
}

export default function PropertyCard({ property }: PropertyCardProps) {
  const { isInWishlist, toggle } = useWishlist();
  const saved = isInWishlist(property.id);

  return (
    <article className="relative group">
      {/* Main card — entire surface is a keyboard-reachable link */}
      <Link
        href={`/property/${property.id}`}
        className="block bg-card rounded-xl shadow-sm border border-border overflow-hidden
          hover:shadow-md transition-shadow
          focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`${property.title}, ${property.location}, ${property.price_per_night} USDC per night, ${property.available ? 'available' : 'booked'}`}
      >
        <div className="h-48 bg-muted flex items-center justify-center text-muted-foreground text-sm">
          {property.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={property.images[0]}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover"
            />
          ) : (
            <span>No image</span>
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
        type="button"
        onClick={(e) => {
          e.preventDefault();
          toggle(property.id);
        }}
        onKeyDown={(e) => {
          // Prevent Space/Enter from bubbling to the Link
          if (e.key === ' ' || e.key === 'Enter') {
            e.stopPropagation();
          }
        }}
        className="absolute top-3 right-3 p-1.5 bg-white dark:bg-gray-800 rounded-full shadow
          hover:scale-110 transition-transform
          focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={saved ? `Remove ${property.title} from wishlist` : `Add ${property.title} to wishlist`}
        aria-pressed={saved}
      >
        <Heart
          size={18}
          aria-hidden="true"
          className={saved ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}
        />
      </button>
    </article>
  );
}
