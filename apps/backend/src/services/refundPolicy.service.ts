/**
 * Refund policy — determines how much of a booking's total price is refunded to
 * the tenant when they cancel, based on how close the cancellation is to the
 * scheduled check-in.
 *
 * Tiers (configurable via environment variables):
 *   • FULL    — cancellation is far enough out → 100% refund.
 *   • PARTIAL — cancellation is inside the full-refund window but outside the
 *               no-refund window → a configurable percentage refund.
 *   • NONE    — cancellation is inside the no-refund window (e.g. within 48h)
 *               → no refund.
 *
 * The policy is intentionally a pure, side-effect-free calculation so it can be
 * unit-tested exhaustively and reused by the booking service, admin tooling,
 * and analytics without touching the database or escrow.
 */

export type RefundTierId = 'full' | 'partial' | 'none';

export interface RefundPolicyConfig {
  /** Cancellations at or beyond this many hours before check-in get a full refund. */
  fullRefundHours: number;
  /** Cancellations inside this many hours before check-in get NO refund. */
  noRefundHours: number;
  /** Refund fraction (0..1) applied in the partial window. */
  partialRefundPct: number;
}

export interface RefundComputation {
  /** Which tier the cancellation fell into. */
  tier: RefundTierId;
  /** Refund fraction applied (0..1). */
  refundPct: number;
  /** Absolute refund amount in the same currency units as `totalPrice`. */
  refundAmount: number;
  /** The booking's total price that the refund was computed against. */
  totalPrice: number;
  /** Hours between the cancellation time and the check-in time (can be negative). */
  hoursUntilCheckIn: number;
  /** The policy configuration that produced this result. */
  policy: RefundPolicyConfig;
}

const DEFAULT_REFUND_POLICY: RefundPolicyConfig = {
  fullRefundHours: 7 * 24, // 168h — "7+ days out"
  noRefundHours: 48, // "within 48 hours"
  partialRefundPct: 0.5, // 50% in the in-between window
};

function parseHours(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parsePct(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return fallback;
  return parsed;
}

/**
 * Resolve the active refund policy from environment variables, falling back to
 * sensible defaults. All knobs are optional so the service works out of the box.
 *
 *   REFUND_FULL_REFUND_HOURS  — full-refund threshold in hours (default 168)
 *   REFUND_NO_REFUND_HOURS    — no-refund threshold in hours  (default 48)
 *   REFUND_PARTIAL_PCT        — partial refund fraction 0..1  (default 0.5)
 */
export function getRefundPolicyConfig(): RefundPolicyConfig {
  return {
    fullRefundHours: parseHours(process.env.REFUND_FULL_REFUND_HOURS, DEFAULT_REFUND_POLICY.fullRefundHours),
    noRefundHours: parseHours(process.env.REFUND_NO_REFUND_HOURS, DEFAULT_REFUND_POLICY.noRefundHours),
    partialRefundPct: parsePct(process.env.REFUND_PARTIAL_PCT, DEFAULT_REFUND_POLICY.partialRefundPct),
  };
}

/**
 * Determine which refund tier a cancellation belongs to, given the gap (in hours)
 * between cancellation time and check-in time.
 *
 * @throws Error if `hoursUntilCheckIn` is not a finite number.
 */
export function resolveRefundTier(hoursUntilCheckIn: number, config: RefundPolicyConfig): RefundTierId {
  if (!Number.isFinite(hoursUntilCheckIn)) {
    throw new Error('hoursUntilCheckIn must be a finite number');
  }

  if (hoursUntilCheckIn >= config.fullRefundHours) return 'full';
  if (hoursUntilCheckIn >= config.noRefundHours) return 'partial';
  return 'none';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Compute the refund for a cancellation.
 *
 * @param params.totalPrice   - Booking total price (currency units).
 * @param params.checkIn      - Scheduled check-in (ISO string or Date).
 * @param params.cancelledAt  - When the cancellation happened (default: now).
 * @param params.config       - Override the active policy (mostly for tests).
 *
 * @returns RefundComputation with the tier, percentage, and absolute amount.
 * @throws Error if `checkIn` is missing/invalid or `totalPrice` is not finite.
 */
export function computeRefund(params: {
  totalPrice: number;
  checkIn: string | Date;
  cancelledAt?: Date | string;
  config?: RefundPolicyConfig;
}): RefundComputation {
  const { totalPrice, checkIn, cancelledAt, config } = params;

  if (!Number.isFinite(totalPrice)) {
    throw new Error('totalPrice must be a finite number');
  }

  const checkInDate = checkIn instanceof Date ? checkIn : new Date(checkIn);
  if (isNaN(checkInDate.getTime())) {
    throw new Error('checkIn must be a valid date');
  }

  const cancelDate = cancelledAt instanceof Date ? cancelledAt : new Date(cancelledAt ?? new Date());
  if (isNaN(cancelDate.getTime())) {
    throw new Error('cancelledAt must be a valid date');
  }

  const policy = config ?? getRefundPolicyConfig();
  const hoursUntilCheckIn = (checkInDate.getTime() - cancelDate.getTime()) / (1000 * 60 * 60);
  const tier = resolveRefundTier(hoursUntilCheckIn, policy);

  const refundPct = tier === 'full' ? 1 : tier === 'partial' ? policy.partialRefundPct : 0;
  const refundAmount = round2(totalPrice * refundPct);

  return {
    tier,
    refundPct,
    refundAmount,
    totalPrice,
    hoursUntilCheckIn,
    policy,
  };
}
