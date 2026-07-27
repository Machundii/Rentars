#!/usr/bin/env bun
/**
 * Rentars local development seed script
 *
 * Populates the local Supabase database with a deterministic, realistic dataset:
 *   - 3 users (one host / two tenants)
 *   - 4 properties with varied price / location / amenities
 *   - Availability ranges for each property
 *   - 3 confirmed bookings (tenants → properties)
 *   - 2 approved reviews
 *   - Wishlist entries
 *   - Notifications
 *
 * Idempotent: uses upsert with stable UUIDs so it can be re-run safely without
 * creating duplicate rows.
 *
 * Usage:
 *   bun run apps/backend/database/seed.ts
 *   # or from the backend directory:
 *   cd apps/backend && bun run database/seed.ts
 *
 * Prerequisites:
 *   - Local Supabase stack running: `supabase start` or `docker-compose up`
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set (e.g. via .env.test)
 *
 * Environment:
 *   The script reads from .env.test by default in NODE_ENV=test, or .env otherwise.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

// ─── Load env ────────────────────────────────────────────────────────────────

const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : process.env.NODE_ENV === 'test'
      ? '.env.test'
      : '.env';

dotenv.config({
  path: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', envFile),
});

// Fall back to .env if specialised file was empty / missing
dotenv.config({
  path: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '.env'),
});

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '❌  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n' +
      `    Loaded env file: ${envFile}`,
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Stable seed IDs ─────────────────────────────────────────────────────────
// These IDs are fixed so the script is idempotent (re-run = upsert, not duplicate).

const IDS = {
  users: {
    host: '00000000-seed-0001-0000-000000000001',
    tenantA: '00000000-seed-0002-0000-000000000002',
    tenantB: '00000000-seed-0003-0000-000000000003',
  },
  properties: {
    beach: '00000000-seed-0010-0000-000000000010',
    mountain: '00000000-seed-0011-0000-000000000011',
    city: '00000000-seed-0012-0000-000000000012',
    countryside: '00000000-seed-0013-0000-000000000013',
  },
  bookings: {
    b1: '00000000-seed-0020-0000-000000000020',
    b2: '00000000-seed-0021-0000-000000000021',
    b3: '00000000-seed-0022-0000-000000000022',
  },
  reviews: {
    r1: '00000000-seed-0030-0000-000000000030',
    r2: '00000000-seed-0031-0000-000000000031',
  },
  wishlists: {
    w1: '00000000-seed-0040-0000-000000000040',
    w2: '00000000-seed-0041-0000-000000000041',
  },
  notifications: {
    n1: '00000000-seed-0050-0000-000000000050',
    n2: '00000000-seed-0051-0000-000000000051',
    n3: '00000000-seed-0052-0000-000000000052',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok(label: string) {
  console.log(`  ✅  ${label}`);
}

function fail(label: string, error: unknown) {
  console.error(`  ❌  ${label}:`, error);
}

async function upsert(
  table: string,
  rows: Record<string, unknown>[],
  label: string,
  conflictColumn = 'id',
) {
  const { error } = await db.from(table).upsert(rows, { onConflict: conflictColumn });
  if (error) {
    fail(label, error.message);
  } else {
    ok(label);
  }
}

// ─── Seed functions ───────────────────────────────────────────────────────────

async function seedAuthUsers() {
  console.log('\n👤  Seeding auth users…');

  const users = [
    { id: IDS.users.host, email: 'seed-host@rentars-dev.local', password: 'SeedHost@Dev2024!' },
    { id: IDS.users.tenantA, email: 'seed-tenant-a@rentars-dev.local', password: 'SeedTenantA@Dev2024!' },
    { id: IDS.users.tenantB, email: 'seed-tenant-b@rentars-dev.local', password: 'SeedTenantB@Dev2024!' },
  ];

  for (const u of users) {
    // Check if user already exists
    const { data: existing } = await db.auth.admin.getUserById(u.id);
    if (existing?.user) {
      ok(`Auth user already exists: ${u.email}`);
      continue;
    }

    const { error } = await db.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { id: u.id },
    });

    if (error) {
      fail(`Create auth user ${u.email}`, error.message);
    } else {
      ok(`Created auth user: ${u.email}`);
    }
  }
}

async function seedUsers() {
  console.log('\n📋  Seeding public.users…');
  await upsert(
    'users',
    [
      { id: IDS.users.host, email: 'seed-host@rentars-dev.local' },
      { id: IDS.users.tenantA, email: 'seed-tenant-a@rentars-dev.local' },
      { id: IDS.users.tenantB, email: 'seed-tenant-b@rentars-dev.local' },
    ],
    'users (3 rows)',
  );
}

async function seedProfiles() {
  console.log('\n🪪  Seeding profiles…');
  await upsert(
    'profiles',
    [
      {
        id: IDS.users.host,
        user_id: IDS.users.host,
        display_name: 'Alex Host',
        bio: 'Experienced host with 3 properties. Quick responder.',
        verified: true,
      },
      {
        id: IDS.users.tenantA,
        user_id: IDS.users.tenantA,
        display_name: 'Jordan Tenant',
        bio: 'Frequent traveler.',
        verified: false,
      },
      {
        id: IDS.users.tenantB,
        user_id: IDS.users.tenantB,
        display_name: 'Sam Traveler',
        bio: 'Digital nomad exploring the world.',
        verified: false,
      },
    ],
    'profiles (3 rows)',
  );
}

async function seedProperties() {
  console.log('\n🏠  Seeding properties…');
  await upsert(
    'properties',
    [
      {
        id: IDS.properties.beach,
        owner_id: IDS.users.host,
        title: 'Oceanfront Beach Bungalow',
        description:
          'Stunning oceanfront bungalow with private beach access. Perfect for couples and small families. Fully equipped kitchen, outdoor shower, and stunning sunset views.',
        price_per_night: 180,
        status: 'available',
        city: 'Miami',
        country: 'US',
        address: '101 Ocean Drive, Miami Beach, FL 33139',
        latitude: 25.7617,
        longitude: -80.1918,
        bedrooms: 2,
        bathrooms: 1,
        max_guests: 4,
        amenities: ['wifi', 'air_conditioning', 'kitchen', 'parking', 'pool'],
        images: [
          'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800',
          'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        ],
        pets_allowed: false,
        smoking_allowed: false,
        events_allowed: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00',
        additional_rules: 'No shoes inside. Rinse off at outdoor shower before entering.',
      },
      {
        id: IDS.properties.mountain,
        owner_id: IDS.users.host,
        title: 'Mountain Cabin Retreat',
        description:
          'Secluded log cabin nestled in the Rockies. Wood-burning fireplace, hot tub, and stunning mountain views. Ideal for hiking enthusiasts and those seeking peace.',
        price_per_night: 220,
        status: 'available',
        city: 'Aspen',
        country: 'US',
        address: '42 Pine Ridge Rd, Aspen, CO 81611',
        latitude: 39.1911,
        longitude: -106.8175,
        bedrooms: 3,
        bathrooms: 2,
        max_guests: 6,
        amenities: ['wifi', 'fireplace', 'hot_tub', 'kitchen', 'parking', 'washer_dryer'],
        images: [
          'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=800',
          'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800',
        ],
        pets_allowed: true,
        smoking_allowed: false,
        events_allowed: false,
        quiet_hours_start: '21:00',
        quiet_hours_end: '08:00',
        additional_rules: 'Pet fee: $50/stay. Please clean up after pets.',
      },
      {
        id: IDS.properties.city,
        owner_id: IDS.users.host,
        title: 'Modern Downtown Loft',
        description:
          'Sleek, modern loft in the heart of downtown. Walking distance to restaurants, galleries, and nightlife. High-speed WiFi, smart TV, and a fully stocked kitchen.',
        price_per_night: 130,
        status: 'available',
        city: 'New York',
        country: 'US',
        address: '500 W 25th St, New York, NY 10001',
        latitude: 40.7484,
        longitude: -74.0045,
        bedrooms: 1,
        bathrooms: 1,
        max_guests: 2,
        amenities: ['wifi', 'air_conditioning', 'kitchen', 'gym', 'elevator'],
        images: [
          'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
          'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
        ],
        pets_allowed: false,
        smoking_allowed: false,
        events_allowed: false,
        quiet_hours_start: '23:00',
        quiet_hours_end: '07:00',
        additional_rules: 'No parties. Guests only — no unregistered visitors overnight.',
      },
      {
        id: IDS.properties.countryside,
        owner_id: IDS.users.host,
        title: 'Charming Countryside Farmhouse',
        description:
          'Lovingly restored 19th-century farmhouse on 10 acres. Farm animals, vegetable garden, and open fire. The perfect rural escape with all modern comforts.',
        price_per_night: 95,
        status: 'available',
        city: 'Charlottesville',
        country: 'US',
        address: '888 Blue Ridge Farm Lane, Charlottesville, VA 22901',
        latitude: 38.0293,
        longitude: -78.4767,
        bedrooms: 4,
        bathrooms: 2,
        max_guests: 8,
        amenities: ['wifi', 'fireplace', 'kitchen', 'parking', 'garden', 'washer_dryer', 'bbq'],
        images: [
          'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800',
          'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        ],
        pets_allowed: true,
        smoking_allowed: true,
        events_allowed: true,
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00',
        additional_rules: 'Ideal for family gatherings. Max event size: 20 people. No amplified music after 22:00.',
      },
    ],
    'properties (4 rows)',
  );
}

async function seedAvailability() {
  console.log('\n📅  Seeding availability_ranges…');

  // Build availability windows: each property is available for the next 6 months
  const today = new Date();
  const sixMonths = new Date(today);
  sixMonths.setMonth(sixMonths.getMonth() + 6);

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  const ranges = Object.values(IDS.properties).map((propertyId, i) => ({
    id: `00000000-seed-006${i}-0000-000000000060`,
    property_id: propertyId,
    start_date: fmt(today),
    end_date: fmt(sixMonths),
    is_available: true,
    reason: null,
  }));

  await upsert('availability_ranges', ranges, `availability_ranges (${ranges.length} rows)`);
}

async function seedBookings() {
  console.log('\n🛎  Seeding bookings…');
  await upsert(
    'bookings',
    [
      {
        id: IDS.bookings.b1,
        property_id: IDS.properties.beach,
        tenant_id: IDS.users.tenantA,
        check_in: '2025-09-01',
        check_out: '2025-09-07',
        total_price: 1080,
        guest_count: 2,
        status: 'Confirmed',
        rules_acknowledged_at: '2025-08-15T10:00:00Z',
      },
      {
        id: IDS.bookings.b2,
        property_id: IDS.properties.mountain,
        tenant_id: IDS.users.tenantB,
        check_in: '2025-12-20',
        check_out: '2025-12-27',
        total_price: 1540,
        guest_count: 4,
        status: 'Confirmed',
        rules_acknowledged_at: '2025-11-01T09:30:00Z',
      },
      {
        id: IDS.bookings.b3,
        property_id: IDS.properties.city,
        tenant_id: IDS.users.tenantA,
        check_in: '2025-11-10',
        check_out: '2025-11-13',
        total_price: 390,
        guest_count: 1,
        status: 'Pending',
        rules_acknowledged_at: '2025-10-20T14:00:00Z',
      },
    ],
    'bookings (3 rows)',
  );
}

async function seedReviews() {
  console.log('\n⭐  Seeding reviews…');
  await upsert(
    'reviews',
    [
      {
        id: IDS.reviews.r1,
        booking_id: IDS.bookings.b1,
        reviewer_id: IDS.users.tenantA,
        target_id: IDS.users.host,
        property_id: IDS.properties.beach,
        rating: 5,
        comment:
          'Absolutely stunning property! The beach access was incredible and Alex was a fantastic host. Would 100% stay again.',
        is_approved: true,
        is_flagged: false,
      },
      {
        id: IDS.reviews.r2,
        booking_id: IDS.bookings.b2,
        reviewer_id: IDS.users.tenantB,
        target_id: IDS.users.host,
        property_id: IDS.properties.mountain,
        rating: 4,
        comment:
          'Cozy cabin with amazing views. The hot tub was a highlight after a long hike. Minor issue with the WiFi speed, but otherwise perfect.',
        host_response:
          "Thanks so much for staying! We've since upgraded the WiFi — looking forward to your next visit.",
        host_response_at: '2025-12-30T12:00:00Z',
        is_approved: true,
        is_flagged: false,
      },
    ],
    'reviews (2 rows)',
  );
}

async function seedWishlists() {
  console.log('\n❤️   Seeding wishlists…');
  await upsert(
    'wishlists',
    [
      {
        id: IDS.wishlists.w1,
        user_id: IDS.users.tenantA,
        property_id: IDS.properties.mountain,
      },
      {
        id: IDS.wishlists.w2,
        user_id: IDS.users.tenantB,
        property_id: IDS.properties.countryside,
      },
    ],
    'wishlists (2 rows)',
  );
}

async function seedNotifications() {
  console.log('\n🔔  Seeding notifications…');
  await upsert(
    'notifications',
    [
      {
        id: IDS.notifications.n1,
        user_id: IDS.users.tenantA,
        type: 'booking_confirmed',
        data: { booking_id: IDS.bookings.b1, property_title: 'Oceanfront Beach Bungalow' },
        read: true,
      },
      {
        id: IDS.notifications.n2,
        user_id: IDS.users.tenantB,
        type: 'booking_confirmed',
        data: { booking_id: IDS.bookings.b2, property_title: 'Mountain Cabin Retreat' },
        read: false,
      },
      {
        id: IDS.notifications.n3,
        user_id: IDS.users.tenantA,
        type: 'booking_created',
        data: { booking_id: IDS.bookings.b3, property_title: 'Modern Downtown Loft' },
        read: false,
      },
    ],
    'notifications (3 rows)',
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱  Rentars — local seed script');
  console.log(`    Supabase URL: ${SUPABASE_URL}`);
  console.log('    Running upserts (idempotent — safe to re-run)…');

  await seedAuthUsers();
  await seedUsers();
  await seedProfiles();
  await seedProperties();
  await seedAvailability();
  await seedBookings();
  await seedReviews();
  await seedWishlists();
  await seedNotifications();

  console.log('\n🎉  Seed complete!\n');
  console.log('    Local credentials:');
  console.log('      Host:      seed-host@rentars-dev.local     / SeedHost@Dev2024!');
  console.log('      Tenant A:  seed-tenant-a@rentars-dev.local / SeedTenantA@Dev2024!');
  console.log('      Tenant B:  seed-tenant-b@rentars-dev.local / SeedTenantB@Dev2024!');
  console.log('');
}

main().catch((err) => {
  console.error('\nSeed script failed:', err);
  process.exit(1);
});
