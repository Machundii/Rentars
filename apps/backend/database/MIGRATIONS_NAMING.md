# Migration Naming Convention

## Current situation — existing duplicatesThe following numeric prefixes are shared by multiple migration files. These files
have already been applied to deployed environments and **must not be renamed** (renaming
an applied migration confuses any migration-state tracker and is hard to reverse in
production).

| Prefix | Files |
|--------|-------|
| `00002` | `00002_storage_and_rls.sql`, `00002_add_booking_blockchain_fields.sql` |
| `00012` | `00012_add_booking_dispute_status.sql`, `00012_create_property_images_table.sql` |
| `00013` | `00013_add_property_search_vector.sql`, `00013_update_availability_ranges.sql` |
| `00014` | `00014_add_dynamic_pricing.sql`, `00014_search_analytics_and_geolocation.sql` |
| `00017` | `00017_add_amenities_gin_index.sql`, `00017_add_email_verification.sql`, `00017_add_geospatial_gist_index.sql`, `00017_add_guest_count_to_bookings.sql`, `00017_add_password_reset_tokens.sql` |

### Canonical application order for shared prefixes

When running `setup.sql` or a migration runner, apply files with shared prefixes in
the order listed below (alphabetical within each prefix group was the original intent).
Document this in your migration runner configuration.

```
00002_add_booking_blockchain_fields.sql   ← apply first (schema additions)
00002_storage_and_rls.sql                 ← apply second (RLS on existing tables)

00012_create_property_images_table.sql    ← apply first (new table)
00012_add_booking_dispute_status.sql      ← apply second (column addition)

00013_add_property_search_vector.sql      ← apply first (new column + index)
00013_update_availability_ranges.sql      ← apply second (column additions)

00014_add_dynamic_pricing.sql             ← apply first (new tables + columns)
00014_search_analytics_and_geolocation.sql ← apply second (new table + geospatial)

00017_add_guest_count_to_bookings.sql     ← apply first  (schema column)
00017_add_amenities_gin_index.sql         ← apply second (index only)
00017_add_email_verification.sql          ← apply third  (schema columns)
00017_add_geospatial_gist_index.sql       ← apply fourth (index only)
00017_add_password_reset_tokens.sql       ← apply fifth  (new table)
```

---

## Forward-looking convention (all new migrations)

### Rule 1 — Strictly incrementing 5-digit prefix

Every new migration file **must** use the next available prefix after the highest
existing one. As of the writing of this document that is `00022` (00020 and 00021
were added as part of the index and RLS-policy work).

Format:
```
NNNNN_short_description_of_change.sql
```

- `NNNNN` — zero-padded 5-digit integer, e.g. `00020`, `00021`
- `short_description` — snake_case, no spaces, no special characters, ≤ 50 chars

Examples:
```
00020_add_missing_indexes.sql
00021_add_dispute_resolution_table.sql
00022_add_profile_verification_timestamps.sql
```

### Rule 2 — One logical change per migration

Each migration file should represent **one** atomic schema change. If two changes are
logically independent (different tables, unrelated features), use two separate files
with consecutive numbers.

### Rule 3 — CI enforcement

The script `apps/backend/scripts/validate-migrations.ts` is run in CI on every pull
request. It will fail (exit code 1) if any new migration has a duplicate or out-of-order
prefix. The CI step is defined in `.github/workflows/ci.yml` under the `validate-migrations` job.

Run it locally before pushing:
```bash
bun run apps/backend/scripts/validate-migrations.ts
```

### Rule 4 — No renaming applied migrations

Never rename a migration file that has been applied to any shared environment
(staging, production). If the file needs to be corrected, create a **new** migration
that makes the correction.

### Rule 5 — Down-migrations (rollback)

No automated rollback files are required, but if you create one, name it:
```
NNNNN_short_description_of_change.down.sql
```
and never apply it automatically in CI.

---

## Running migrations locally

```bash
# Apply the full schema from scratch (uses setup.sql)
cd apps/backend/database
psql "$DATABASE_URL" -f setup.sql

# Apply a single migration
psql "$DATABASE_URL" -f migrations/00020_add_missing_indexes.sql

# Or use the Supabase CLI against your local stack
supabase db reset          # resets and re-applies all migrations
supabase migration up       # applies pending migrations
```
