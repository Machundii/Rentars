import {
  fundEscrowOnChain,
  disputeBookingOnChain,
  resolveDisputeOnChain,
  getBookingWithEscrow,
} from './bookingContract.js';
import { EscrowError } from './errors.js';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface BookingEscrowParams {
  propertyId: string;
  bookingId: string;
  buyerAddress: string;
  sellerAddress: string;
  amountUsdc: string;
  checkIn: string;
  checkOut: string;
}

export interface CreateEscrowRequest {
  buyer: string;
  seller: string;
  amount: string;
  token: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface CreateEscrowResponse {
  escrowId: string;
  contractId: string;
  status: string;
}

export interface FundEscrowRequest {
  escrowId: string;
  amount: string;
  txHash: string;
}

export interface ReleaseEscrowRequest {
  escrowId: string;
  reason: string;
}

export interface EscrowStatus {
  escrowId: string;
  status: 'created' | 'funded' | 'released' | 'cancelled' | 'disputed';
  amount: string;
  token: string;
  buyer: string;
  seller: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Identity of the provider/account that is expected to have emitted a
 * callback event. Used by the callback service to reject events that were
 * produced by an unexpected provider or account before any state changes.
 */
export interface ProviderIdentity {
  /** Expected provider identifier (e.g. TrustlessWork tenant/application id). */
  providerId: string;
  /** Expected provider account address (Stellar account / contract address). */
  accountAddress: string;
}

/**
 * Result of verifying a callback's provider identity against the expected
 * identity. `ok` is true only when both the provider id and the account
 * address match exactly.
 */
export interface ProviderIdentityVerification {
  ok: boolean;
  /** Machine-readable reason when `ok` is false. */
  reason?: 'missing_provider_id' | 'missing_account_address' | 'provider_mismatch' | 'account_mismatch';
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class TrustlessWorkClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly providerId: string;
  private readonly accountAddress: string;

  constructor(
    baseUrl: string,
    apiKey: string,
    providerId: string = process.env.TRUSTLESS_WORK_PROVIDER_ID ?? '',
    accountAddress: string = process.env.TRUSTLESS_WORK_ACCOUNT_ADDRESS ?? '',
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.providerId = providerId;
    this.accountAddress = accountAddress;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let message = `TrustlessWork API error: ${response.status} ${response.statusText}`;
      try {
        const errorBody = (await response.json()) as { message?: string };
        if (errorBody.message) {
          message = errorBody.message;
        }
      } catch {
        // ignore JSON parse errors on error responses
      }
      throw new EscrowError(message, response.status);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Create a new USDC escrow for a booking.
   *
   * @param params - Escrow creation parameters
   * @returns CreateEscrowResponse containing escrowId, contractId, and status
   * @throws EscrowError on non-2xx API responses
   */
  async createEscrow(params: CreateEscrowRequest): Promise<CreateEscrowResponse> {
    return this.request<CreateEscrowResponse>('POST', '/escrows', params);
  }

  /**
   * Fund an existing escrow after the buyer has sent USDC on-chain.
   *
   * @param escrowId - ID of the escrow to fund
   * @param amount - USDC amount string
   * @param txHash - On-chain transaction hash of the funding transfer
   * @throws EscrowError on non-2xx API responses
   */
  async fundEscrow(escrowId: string, amount: string, txHash: string): Promise<void> {
    const body: FundEscrowRequest = { escrowId, amount, txHash };
    await this.request<void>('POST', `/escrows/${escrowId}/fund`, body);
  }

  /**
   * Release escrowed funds to the seller (property owner).
   *
   * @param escrowId - ID of the escrow to release
   * @param reason - Human-readable reason for the release
   * @throws EscrowError on non-2xx API responses
   */
  async releaseEscrow(escrowId: string, reason: string): Promise<void> {
    const body: ReleaseEscrowRequest = { escrowId, reason };
    await this.request<void>('POST', `/escrows/${escrowId}/release`, body);
  }

  /**
   * Cancel the escrow and return funds to the buyer (tenant).
   *
   * @param escrowId - ID of the escrow to cancel
   * @throws EscrowError on non-2xx API responses
   */
  async cancelEscrow(escrowId: string): Promise<void> {
    await this.request<void>('POST', `/escrows/${escrowId}/cancel`);
  }

  /**
   * Retrieve the current status of an escrow.
   *
   * @param escrowId - ID of the escrow to query
   * @returns EscrowStatus with amounts, participants, and current state
   * @throws EscrowError on non-2xx API responses
   */
  async getEscrowStatus(escrowId: string): Promise<EscrowStatus> {
    return this.request<EscrowStatus>('GET', `/escrows/${escrowId}`);
  }

  /**
   * Create an escrow from structured booking parameters, setting a
   * human-readable title and relevant metadata automatically.
   *
   * @param params - Booking-specific parameters
   * @returns CreateEscrowResponse containing escrowId, contractId, and status
   * @throws EscrowError on non-2xx API responses
   */
  async createBookingEscrow(params: BookingEscrowParams): Promise<CreateEscrowResponse> {
    return this.createEscrow({
      buyer: params.buyerAddress,
      seller: params.sellerAddress,
      amount: params.amountUsdc,
      token: 'USDC',
      title: `Booking ${params.bookingId} — Property ${params.propertyId}`,
      description: `Rental escrow for check-in ${params.checkIn} to check-out ${params.checkOut}`,
      metadata: {
        bookingId: params.bookingId,
        propertyId: params.propertyId,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
      },
    });
  }

  // ─── Soroban Escrow Integration ──────────────────────────────────────────────

  /**
   * Fund an on-chain escrow via the Soroban booking contract.
   * Tenants call this to deposit USDC into the contract.
   *
   * @param tenant - Stellar address of the tenant (must authorize).
   * @param bookingId - On-chain u64 booking ID.
   */
  async fundOnChainEscrow(tenant: string, bookingId: bigint): Promise<void> {
    await fundEscrowOnChain(tenant, bookingId);
  }

  /**
   * Dispute a funded booking on-chain. Only the tenant may dispute.
   *
   * @param tenant - Stellar address of the tenant (must authorize).
   * @param bookingId - On-chain u64 booking ID.
   */
  async disputeBookingOnChain(tenant: string, bookingId: bigint): Promise<void> {
    await disputeBookingOnChain(tenant, bookingId);
  }

  /**
   * Resolve a disputed booking on-chain. Admin decides the outcome.
   *
   * @param admin - Stellar address of the admin caller.
   * @param bookingId - On-chain u64 booking ID.
   * @param releaseToOwner - true to release to owner, false to refund tenant.
   */
  async resolveDisputeOnChain(
    admin: string,
    bookingId: bigint,
    releaseToOwner: boolean,
  ): Promise<void> {
    await resolveDisputeOnChain(admin, bookingId, releaseToOwner);
  }

  /**
   * Get the on-chain escrow status for a booking.
   *
   * @param bookingId - On-chain u64 booking ID.
   * @returns Object with status, owner, tenant, and price.
   */
  async getOnChainEscrowStatus(
    bookingId: bigint,
  ): Promise<{
    status: string;
    escrowStatus: string;
    propertyOwner: string;
    tenant: string;
    amount: string;
  }> {
    const booking = await getBookingWithEscrow(bookingId);
    return {
      status: booking.status,
      escrowStatus: booking.escrow_status,
      propertyOwner: booking.property_owner,
      tenant: booking.tenant,
      amount: booking.total_price.toString(),
    };
  }

  // ─── Provider Identity Verification ──────────────────────────────────────────

  /**
   * The provider identity this client is configured to trust. Callback
   * handlers must compare the identity carried by an incoming event against
   * this value before applying any state changes.
   */
  getExpectedProviderIdentity(): ProviderIdentity {
    return {
      providerId: this.providerId,
      accountAddress: this.accountAddress,
    };
  }

  /**
   * Verify that a callback event was emitted by the expected provider and
   * account. Comparison is exact (case-sensitive) to avoid accepting
   * look-alike identifiers.
   *
   * @param eventProviderId - Provider id carried by the callback event.
   * @param eventAccountAddress - Account address carried by the callback event.
   * @returns Verification result; `ok` is true only on a full match.
   */
  verifyProviderIdentity(
    eventProviderId: string | undefined | null,
    eventAccountAddress: string | undefined | null,
  ): ProviderIdentityVerification {
    if (!eventProviderId) {
      return { ok: false, reason: 'missing_provider_id' };
    }
    if (!eventAccountAddress) {
      return { ok: false, reason: 'missing_account_address' };
    }
    if (eventProviderId !== this.providerId) {
      return { ok: false, reason: 'provider_mismatch' };
    }
    if (eventAccountAddress !== this.accountAddress) {
      return { ok: false, reason: 'account_mismatch' };
    }
    return { ok: true };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const trustlessWorkClient = new TrustlessWorkClient(
  process.env.TRUSTLESS_WORK_API_URL ?? 'https://api.trustlesswork.com',
  process.env.TRUSTLESS_WORK_API_KEY ?? '',
  process.env.TRUSTLESS_WORK_PROVIDER_ID ?? '',
  process.env.TRUSTLESS_WORK_ACCOUNT_ADDRESS ?? '',
);
