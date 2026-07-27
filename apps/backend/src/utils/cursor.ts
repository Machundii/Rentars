/**
 * Cursor-based (keyset) pagination utilities.
 *
 * Cursors are opaque base64-encoded JSON payloads that encode the last-seen
 * sort key(s) so the next page can be fetched with a simple WHERE clause
 * instead of OFFSET, avoiding the performance cliff and skip/duplicate
 * problems that OFFSET pagination has under concurrent writes.
 *
 * Usage:
 *   const decoded = decodeCursor(req.query.cursor);  // { created_at, id }
 *   const nextCursor = encodeCursor({ created_at: row.created_at, id: row.id });
 */

export interface CursorPayload {
  created_at: string;
  id: string;
}

/**
 * Encode a cursor payload to an opaque base64 string.
 */
export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/**
 * Decode a cursor string back to its payload.
 * Returns null if the string is missing, malformed, or missing required fields.
 */
export function decodeCursor(cursor: string | undefined | null): CursorPayload | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'created_at' in parsed &&
      'id' in parsed &&
      typeof (parsed as CursorPayload).created_at === 'string' &&
      typeof (parsed as CursorPayload).id === 'string'
    ) {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Build a pagination response envelope that includes the data array and
 * a nextCursor (null when no more rows exist).
 */
export function buildCursorPage<T extends { created_at?: string; id: string }>(
  rows: T[],
  limit: number,
): { data: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];

  const nextCursor =
    hasMore && last
      ? encodeCursor({ created_at: last.created_at ?? new Date().toISOString(), id: last.id })
      : null;

  return { data, nextCursor };
}
