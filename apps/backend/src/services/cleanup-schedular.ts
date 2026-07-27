import { syncAllBookings, syncAllProperties, reconcileAllPendingEscrows } from './sync.service.js';

const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const RECONCILIATION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CONCURRENT_RECONCILIATIONS = 5;
const INITIAL_BACKOFF_MS = 1000; // 1 second
const MAX_BACKOFF_MS = 30000; // 30 seconds

let concurrentReconciliations = 0;
let reconciliationBackoffMs = INITIAL_BACKOFF_MS;

async function runSync(): Promise<void> {
  const propertiesResult = await syncAllProperties();
  if (propertiesResult.success) {
    console.log(
      `[sync] Properties: ${propertiesResult.data?.synced} synced, ${propertiesResult.data?.failed} failed`,
    );
  } else {
    console.error(`[sync] Property sync failed: ${propertiesResult.error}`);
  }

  const bookingsResult = await syncAllBookings();
  if (bookingsResult.success) {
    console.log(
      `[sync] Bookings: ${bookingsResult.data?.synced} synced, ${bookingsResult.data?.failed} failed`,
    );
  } else {
    console.error(`[sync] Booking sync failed: ${bookingsResult.error}`);
  }
}

async function runEscrowReconciliation(): Promise<void> {
  if (concurrentReconciliations >= MAX_CONCURRENT_RECONCILIATIONS) {
    console.log(`[reconcile] Skipping reconciliation — max concurrency (${MAX_CONCURRENT_RECONCILIATIONS}) reached`);
    return;
  }

  concurrentReconciliations++;

  try {
    const result = await reconcileAllPendingEscrows();
    if (result.success) {
      console.log(
        `[reconcile] Escrows: ${result.data?.reconciled} reconciled, ${result.data?.failed} failed`,
      );
      reconciliationBackoffMs = INITIAL_BACKOFF_MS;
    } else {
      console.error(`[reconcile] Reconciliation failed: ${result.error}`);
      reconciliationBackoffMs = Math.min(
        reconciliationBackoffMs * 2,
        MAX_BACKOFF_MS,
      );
    }
  } catch (err) {
    console.error('[reconcile] Scheduler error:', err);
    reconciliationBackoffMs = Math.min(
      reconciliationBackoffMs * 2,
      MAX_BACKOFF_MS,
    );
  } finally {
    concurrentReconciliations--;
  }
}

export function startSyncScheduler(): void {
  // Blockchain sync
  setInterval(() => {
    runSync().catch((err) => console.error('[sync] Scheduler error:', err));
  }, SYNC_INTERVAL_MS);

  setInterval(() => {
    runEscrowReconciliation().catch((err) => console.error('[reconcile] Scheduler error:', err));
  }, RECONCILIATION_INTERVAL_MS);

  console.log(`[sync] Scheduler started — sync interval: ${SYNC_INTERVAL_MS / 1000}s, reconciliation interval: ${RECONCILIATION_INTERVAL_MS / 1000}s`);
}
