import * as React from "react"
import { cn } from "@/lib/utils"

const Skeleton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("animate-pulse rounded-md bg-muted", className)}
    {...props}
  />
))
Skeleton.displayName = "Skeleton"

interface PropertyCardSkeletonProps {
  className?: string
}

export function PropertyCardSkeleton({ className }: PropertyCardSkeletonProps) {
  return (
    <div className={cn("rounded-lg border border-border overflow-hidden", className)}>
      <Skeleton className="h-48 w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
    </div>
  )
}

interface PropertyListSkeletonProps {
  count?: number
  className?: string
}

export function PropertyListSkeleton({ count = 6, className }: PropertyListSkeletonProps) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  )
}

interface BookingSkeletonProps {
  className?: string
}

export function BookingSkeleton({ className }: BookingSkeletonProps) {
  return (
    <div className={cn("rounded-lg border border-border p-4 space-y-3", className)}>
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  )
}

// ── Property Detail Skeleton ─────────────────────────────────────────────────

interface PropertyDetailSkeletonProps {
  className?: string;
}

/**
 * Layout-matching skeleton for the property detail page.
 * Mirrors the exact grid / spacing / sizing of PropertyDetail so there is
 * no cumulative layout shift when real content swaps in.
 * All colours use CSS custom properties so they automatically follow the
 * active light / dark theme (bg-muted = --muted in shadcn/ui tokens).
 */
export function PropertyDetailSkeleton({ className }: PropertyDetailSkeletonProps) {
  return (
    <div className={cn("max-w-6xl mx-auto px-6 py-8", className)} aria-busy="true" aria-label="Loading property details">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start mb-6">
        <div className="space-y-2 flex-1 mr-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* ── Main column (col-span-2) ──────────────────────────────────────── */}
        <div className="col-span-2 space-y-8">
          {/* Hero image gallery — fixed h-96 matches PropertyImageGallery */}
          <div className="space-y-2">
            <Skeleton className="w-full h-96 rounded-lg" />
            {/* Thumbnail strip */}
            <div className="flex gap-2 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="flex-shrink-0 w-16 h-12 rounded" />
              ))}
            </div>
          </div>

          {/* Description card */}
          <div className="rounded-lg border border-border p-6 space-y-3">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>

          {/* Amenities card */}
          <div className="rounded-lg border border-border p-6 space-y-4">
            <Skeleton className="h-7 w-36" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-36" />
              ))}
            </div>
          </div>

          {/* Map section */}
          <div className="space-y-4">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="w-full h-64 rounded-lg" />
          </div>

          {/* Availability calendar section */}
          <div className="space-y-4">
            <Skeleton className="h-7 w-40" />
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-8" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-8" />
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 rounded" />
                ))}
              </div>
            </div>
          </div>

          {/* Reviews section */}
          <div className="space-y-4">
            <Skeleton className="h-7 w-24" />
            <div className="rounded-lg border border-border p-6 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Host card */}
          <div className="rounded-lg border border-border p-6">
            <Skeleton className="h-7 w-40 mb-4" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full flex-shrink-0" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Sidebar (col-span-1) ──────────────────────────────────────────── */}
        <div className="col-span-1">
          <div className="rounded-lg border border-border p-6 space-y-4 sticky top-8">
            {/* Price */}
            <div className="flex items-baseline gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
            {/* Book Now button */}
            <Skeleton className="h-12 w-full rounded-lg" />
            {/* Fee breakdown */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-14" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-14" />
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            {/* Blockchain note */}
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export { Skeleton }
