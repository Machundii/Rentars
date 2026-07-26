/**
 * Minimal RFC 5545-compliant iCalendar (.ics) generator.
 *
 * Produces a single VEVENT calendar file. No external dependencies — the
 * format is simple enough to build as a string with a few helpers.
 */

export interface IcsEventInput {
  uid: string;
  summary: string;
  description: string;
  location: string;
  /** ISO-8601 date string, e.g. "2026-07-01" or "2026-07-01T14:00:00" */
  dtStart: string;
  /** ISO-8601 date string */
  dtEnd: string;
  /** ISO-8601 date-time when the event was created */
  created?: string;
}

/**
 * Format a Date to the iCalendar UTC date-time value: YYYYMMDDTHHmmssZ
 */
function toIcsDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Format an ISO date string that has no time component as an all-day
 * iCalendar DATE value: YYYYMMDD
 */
function toIcsDate(iso: string): string {
  // Handles both "YYYY-MM-DD" and full ISO strings
  const datePart = iso.split('T')[0];
  return datePart.replace(/-/g, '');
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Fold long iCalendar lines at 75 octets (RFC 5545 §3.1).
 * Each continuation line starts with a single space.
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  chunks.push(line.slice(0, 75));
  let i = 75;
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join('\r\n');
}

/**
 * Escape text values per RFC 5545 §3.3.11.
 */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Generate a full iCalendar string for a single event.
 *
 * The function uses DATE-only values when the input strings have no time
 * component, so the event shows as an all-day event in most calendar apps.
 * When a time component is present it uses UTC DATETIME values.
 */
export function generateIcs(event: IcsEventInput): string {
  const hasTime = (iso: string) => iso.includes('T');

  const dtStart = hasTime(event.dtStart)
    ? `DTSTART:${toIcsDateTime(event.dtStart)}`
    : `DTSTART;VALUE=DATE:${toIcsDate(event.dtStart)}`;

  // For all-day check-out we use the day *after* check-out as DTEND so the
  // whole stay is covered inclusively, matching how most calendars render it.
  const dtEnd = hasTime(event.dtEnd)
    ? `DTEND:${toIcsDateTime(event.dtEnd)}`
    : (() => {
        const d = new Date(event.dtEnd + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + 1);
        const y = d.getUTCFullYear();
        const m = pad(d.getUTCMonth() + 1);
        const day = pad(d.getUTCDate());
        return `DTEND;VALUE=DATE:${y}${m}${day}`;
      })();

  const stamp = toIcsDateTime(event.created ?? new Date().toISOString());

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rentars//Rentars Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    foldLine(`UID:${escapeText(event.uid)}`),
    `DTSTAMP:${stamp}`,
    dtStart,
    dtEnd,
    foldLine(`SUMMARY:${escapeText(event.summary)}`),
    foldLine(`DESCRIPTION:${escapeText(event.description)}`),
    foldLine(`LOCATION:${escapeText(event.location)}`),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  // RFC 5545 mandates CRLF line endings
  return lines.join('\r\n') + '\r\n';
}
