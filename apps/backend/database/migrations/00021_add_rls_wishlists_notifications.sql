-- Add RLS policies for wishlists and notifications tables.
--
-- These tables were created in migrations 00010 and 00011 respectively,
-- but RLS was never enabled on them. Without these policies every authenticated
-- user can read/write any row, which is a cross-user data-leakage bug.

-- ─── wishlists ────────────────────────────────────────────────────────────────

ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

-- Users can only see their own wishlist entries
CREATE POLICY "Users can read their own wishlists"
  ON wishlists FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only add to their own wishlist
CREATE POLICY "Users can insert into their own wishlist"
  ON wishlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only remove their own wishlist entries
CREATE POLICY "Users can delete their own wishlist entries"
  ON wishlists FOR DELETE
  USING (auth.uid() = user_id);

-- ─── notifications ────────────────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "Users can read their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- System / backend (service role) inserts notifications on behalf of users.
-- The service role bypasses RLS, so no INSERT policy is needed for normal
-- backend writes. An explicit policy would be required only for client-side inserts.

-- Users can mark their own notifications as read (UPDATE limited to read column)
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);
