-- #65: Add explicit role to users for admin/moderator authorization
-- role: tenant | host | admin — matches the frontend's UserRole enum
-- (apps/web/src/types/roles.ts)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'tenant' CHECK (role IN ('tenant', 'host', 'admin'));

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE role != 'tenant';

-- Backfill any pre-existing rows explicitly (DEFAULT already covers this on ADD COLUMN,
-- this UPDATE is a no-op safety net in case the column already existed as nullable).
UPDATE users SET role = 'tenant' WHERE role IS NULL;
