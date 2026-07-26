import { syncAllBookings, syncAllProperties } from './sync.service.js';
import { runReminderScheduler } from './reminder.service.js';

const SYNC_INTERVAL_MS     = 60 * 60 * 1000; // 1 hour
const REMINDER_INTERVAL_MS = 60 * 60 * 1000; // 1 hour — configurable via REMINDER_INTERVAL_HOURS

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

async function runReminders(): Promise<void> {
  const result = await runReminderScheduler();
  if (result.success && result.data) {
    const { sent, skipped, errors } = result.data;
    console.log(`[reminders] sent=${sent} skipped=${skipped} errors=${errors}`);
  } else {
    console.error(`[reminders] Scheduler error: ${result.error}`);
  }
}

export function startSyncScheduler(): void {
  // Blockchain sync
  setInterval(() => {
    runSync().catch((err) => console.error('[sync] Scheduler error:', err));
  }, SYNC_INTERVAL_MS);

  console.log(`[sync] Scheduler started — interval: ${SYNC_INTERVAL_MS / 1000}s`);

  // Booking reminders — run immediately on startup then on the interval
  runReminders().catch((err) => console.error('[reminders] Initial run error:', err));

  const reminderIntervalMs =
    Number(process.env.REMINDER_INTERVAL_HOURS ?? 1) * 60 * 60 * 1000;

  setInterval(() => {
    runReminders().catch((err) => console.error('[reminders] Scheduler error:', err));
  }, reminderIntervalMs);

  console.log(`[reminders] Scheduler started — interval: ${reminderIntervalMs / 1000}s`);
}
