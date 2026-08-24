-- Rentars Database Setup
-- Runs all migrations in order to initialize the database schema.
-- Run from the migrations/ directory:
--   psql "$DATABASE_URL" -f setup.sql

\i migrations/00001_initial_schema.sql
\i migrations/00002_add_booking_blockchain_fields.sql
\i migrations/00002_storage_and_rls.sql
\i migrations/00003_triggers.sql
\i migrations/00004_create_wallet_auth_tables.sql
\i migrations/00005_create_profile_table.sql
\i migrations/00006_add_atomic_functions.sql
\i migrations/00007_add_payment_constraints.sql
\i migrations/00008_create_blockchain_logs.sql
\i migrations/00009_create_reviews_table.sql
\i migrations/00010_create_wishlists_table.sql
\i migrations/00011_create_notifications_table.sql
\i migrations/00012_create_property_images_table.sql
\i migrations/00012_add_booking_dispute_status.sql
\i migrations/00013_add_property_search_vector.sql
\i migrations/00013_update_availability_ranges.sql
\i migrations/00014_add_dynamic_pricing.sql
\i migrations/00014_search_analytics_and_geolocation.sql
\i migrations/00015_add_review_moderation_and_responses.sql
\i migrations/00016_add_notification_preferences.sql
\i migrations/00017_add_guest_count_to_bookings.sql
\i migrations/00017_add_amenities_gin_index.sql
\i migrations/00017_add_email_verification.sql
\i migrations/00017_add_geospatial_gist_index.sql
\i migrations/00017_add_password_reset_tokens.sql
\i migrations/00018_add_house_rules_to_properties.sql
\i migrations/00019_add_rules_acknowledged_to_bookings.sql
\i migrations/00020_add_missing_indexes.sql
\i migrations/00021_add_rls_wishlists_notifications.sql
\i migrations/00033_weighted_search_vector.sql
\i migrations/00034_create_saved_searches_table.sql
