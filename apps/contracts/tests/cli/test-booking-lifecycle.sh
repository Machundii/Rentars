#!/usr/bin/env bash
# =============================================================================
# test-booking-lifecycle.sh
# End-to-end CLI test for the full booking lifecycle on Stellar testnet.
#
# Happy-path flow:
#   1. Create a property listing  (PropertyListing contract)
#   2. Create a booking           (Booking contract)
#   3. Confirm the booking        (Booking: Pending → Confirmed)
#   4. Complete / release escrow  (Booking: Confirmed → Completed)
#   5. Submit a review            (Review contract)
#
# State is asserted after every step. Any mismatch exits with code 1 and a
# descriptive message.
#
# Prerequisites
# ─────────────
# • Stellar CLI ≥ 21 installed and on $PATH (or STELLAR_CLI env var)
# • Four funded testnet identities created by setup.sh:
#     rentars-admin, rentars-owner, rentars-tenant, rentars-reviewer
# • All three contracts deployed; contract IDs in .test-state.env
#   (run setup.sh first, or export them manually)
#
# Usage:
#   ./test-booking-lifecycle.sh            # standalone run after setup.sh
#   ./run-all-tests.sh                     # called automatically by the suite
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=utils/network-config.sh
source "${SCRIPT_DIR}/utils/network-config.sh"
# shellcheck source=utils/test-helpers.sh
source "${SCRIPT_DIR}/utils/test-helpers.sh"

load_state

require_env "PROPERTY_LISTING_CONTRACT_ID"
require_env "BOOKING_CONTRACT_ID"
require_env "REVIEW_CONTRACT_ID"
require_env "ADMIN_ADDRESS"
require_env "OWNER_ADDRESS"
require_env "TENANT_ADDRESS"
require_env "REVIEWER_ADDRESS"

LISTING_CONTRACT="${PROPERTY_LISTING_CONTRACT_ID}"
BOOKING_CONTRACT="${BOOKING_CONTRACT_ID}"
REVIEW_CONTRACT="${REVIEW_CONTRACT_ID}"

log_section "Full Booking Lifecycle Test"
log_info "PropertyListing : ${LISTING_CONTRACT}"
log_info "Booking         : ${BOOKING_CONTRACT}"
log_info "Review          : ${REVIEW_CONTRACT}"
log_info "Owner           : ${OWNER_ADDRESS}"
log_info "Tenant          : ${TENANT_ADDRESS}"
log_info "Reviewer        : ${REVIEWER_ADDRESS}"

# ── Timestamp constants (year 2031, well clear of existing test bookings) ─────
TS_CHECKIN=1924387200    # 2031-01-01 00:00:00 UTC
TS_CHECKOUT=1924992000   # 2031-01-08 00:00:00 UTC  (+7 days)
PRICE_PER_NIGHT=50000000 # 0.5 USDC per night in stroops
TOTAL_PRICE=$((PRICE_PER_NIGHT * 7))

# ── Step 1: Create a property listing ─────────────────────────────────────────
log_section "Step 1 — Create property listing"

LISTING_ID=$(invoke_as "${OWNER_IDENTITY}" \
  --id "${LISTING_CONTRACT}" -- \
  create_listing \
  --owner "${OWNER_ADDRESS}" \
  --title "Lifecycle Test Property" \
  --description "Created by test-booking-lifecycle.sh" \
  --price_per_night "${PRICE_PER_NIGHT}" \
  2>&1 | tail -1)

log_info "Created listing ID: ${LISTING_ID}"

assert_output_contains \
  "Step 1a: listing exists with Active status" \
  "Active" \
  invoke_as "${OWNER_IDENTITY}" --id "${LISTING_CONTRACT}" -- \
    get_listing --id "${LISTING_ID}"

assert_output_contains \
  "Step 1b: listing title matches" \
  "Lifecycle Test Property" \
  invoke_as "${OWNER_IDENTITY}" --id "${LISTING_CONTRACT}" -- \
    get_listing --id "${LISTING_ID}"

assert_output_contains \
  "Step 1c: listing price matches" \
  "${PRICE_PER_NIGHT}" \
  invoke_as "${OWNER_IDENTITY}" --id "${LISTING_CONTRACT}" -- \
    get_listing --id "${LISTING_ID}"

# ── Step 2: Create a booking ───────────────────────────────────────────────────
log_section "Step 2 — Create booking"

BOOKING_ID=$(invoke_as "${TENANT_IDENTITY}" \
  --id "${BOOKING_CONTRACT}" -- \
  create_booking \
  --tenant "${TENANT_ADDRESS}" \
  --property_id "${LISTING_ID}" \
  --check_in "${TS_CHECKIN}" \
  --check_out "${TS_CHECKOUT}" \
  --total_price "${TOTAL_PRICE}" \
  2>&1 | tail -1)

log_info "Created booking ID: ${BOOKING_ID}"

assert_output_contains \
  "Step 2a: booking has Pending status" \
  "Pending" \
  invoke_as "${TENANT_IDENTITY}" --id "${BOOKING_CONTRACT}" -- \
    get_booking --id "${BOOKING_ID}"

assert_output_contains \
  "Step 2b: booking references correct property" \
  "${LISTING_ID}" \
  invoke_as "${TENANT_IDENTITY}" --id "${BOOKING_CONTRACT}" -- \
    get_booking --id "${BOOKING_ID}"

assert_output_contains \
  "Step 2c: booking reflects correct total price" \
  "${TOTAL_PRICE}" \
  invoke_as "${TENANT_IDENTITY}" --id "${BOOKING_CONTRACT}" -- \
    get_booking --id "${BOOKING_ID}"

assert_output_contains \
  "Step 2d: property bookings index contains the new booking" \
  "${BOOKING_ID}" \
  invoke_as "${TENANT_IDENTITY}" --id "${BOOKING_CONTRACT}" -- \
    get_property_bookings --property_id "${LISTING_ID}"

assert_output_contains \
  "Step 2e: dates are blocked — check_availability returns false" \
  "false" \
  invoke_as "${TENANT_IDENTITY}" --id "${BOOKING_CONTRACT}" -- \
    check_availability \
    --property_id "${LISTING_ID}" \
    --check_in "${TS_CHECKIN}" \
    --check_out "${TS_CHECKOUT}"

# ── Step 3: Confirm the booking (Pending → Confirmed) ─────────────────────────
log_section "Step 3 — Confirm booking (Pending → Confirmed)"

assert_success \
  "Step 3a: admin transitions booking to Confirmed" \
  invoke_as "${ADMIN_IDENTITY}" --id "${BOOKING_CONTRACT}" -- \
    update_status \
    --caller "${ADMIN_ADDRESS}" \
    --booking_id "${BOOKING_ID}" \
    --new_status '{"Confirmed":{}}'

assert_output_contains \
  "Step 3b: booking status is Confirmed" \
  "Confirmed" \
  invoke_as "${TENANT_IDENTITY}" --id "${BOOKING_CONTRACT}" -- \
    get_booking --id "${BOOKING_ID}"

# ── Step 4: Complete booking / release escrow (Confirmed → Completed) ─────────
log_section "Step 4 — Complete booking / release escrow (Confirmed → Completed)"

assert_success \
  "Step 4a: admin transitions booking to Completed" \
  invoke_as "${ADMIN_IDENTITY}" --id "${BOOKING_CONTRACT}" -- \
    update_status \
    --caller "${ADMIN_ADDRESS}" \
    --booking_id "${BOOKING_ID}" \
    --new_status '{"Completed":{}}'

assert_output_contains \
  "Step 4b: booking status is Completed" \
  "Completed" \
  invoke_as "${TENANT_IDENTITY}" --id "${BOOKING_CONTRACT}" -- \
    get_booking --id "${BOOKING_ID}"

# ── Step 5: Submit a review ────────────────────────────────────────────────────
log_section "Step 5 — Submit review"

REVIEW_ID=$(invoke_as "${REVIEWER_IDENTITY}" \
  --id "${REVIEW_CONTRACT}" -- \
  submit_review \
  --reviewer "${REVIEWER_ADDRESS}" \
  --reviewee "${OWNER_ADDRESS}" \
  --rating 5 \
  --comment "Smooth lifecycle — great host" \
  2>&1 | tail -1)

log_info "Created review ID: ${REVIEW_ID}"

assert_output_contains \
  "Step 5a: review stored with rating 5" \
  "5" \
  invoke_as "${REVIEWER_IDENTITY}" --id "${REVIEW_CONTRACT}" -- \
    get_review --id "${REVIEW_ID}"

assert_output_contains \
  "Step 5b: review indexed under owner" \
  "${REVIEW_ID}" \
  invoke_as "${REVIEWER_IDENTITY}" --id "${REVIEW_CONTRACT}" -- \
    get_reviews_for_user --reviewee "${OWNER_ADDRESS}"

assert_output_contains \
  "Step 5c: owner reputation non-zero after review" \
  "500" \
  invoke_as "${REVIEWER_IDENTITY}" --id "${REVIEW_CONTRACT}" -- \
    get_reputation --reviewee "${OWNER_ADDRESS}"

# ── Final state assertions ─────────────────────────────────────────────────────
log_section "Final state verification"

assert_output_contains \
  "Listing is still Active after lifecycle" \
  "Active" \
  invoke_as "${OWNER_IDENTITY}" --id "${LISTING_CONTRACT}" -- \
    get_listing --id "${LISTING_ID}"

assert_output_contains \
  "Booking is Completed in final state" \
  "Completed" \
  invoke_as "${TENANT_IDENTITY}" --id "${BOOKING_CONTRACT}" -- \
    get_booking --id "${BOOKING_ID}"

# ── Summary ───────────────────────────────────────────────────────────────────
print_summary "Full Booking Lifecycle Tests"
