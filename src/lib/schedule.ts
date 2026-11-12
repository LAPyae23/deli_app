/** Scheduled (pre-)orders: check the requested time is sensible and inside opening hours. */

export const MIN_LEAD_MINS = 30;
export const MAX_AHEAD_DAYS = 3;
const YANGON_OFFSET_MIN = 6 * 60 + 30;

/** Minutes since midnight, Yangon time. */
export function yangonMinuteOfDay(date: Date) {
  const m = Math.floor(date.getTime() / 60000) + YANGON_OFFSET_MIN;
  return ((m % 1440) + 1440) % 1440;
}

export function parseHHMM(value: unknown, fallback: number) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return fallback;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59) return fallback;
  return Math.min(1440, h * 60 + m);
}

/** Opening hours may cross midnight (e.g. 18:00–02:00). */
export function isWithinHours(date: Date, openingTime?: string, closingTime?: string) {
  const open = parseHHMM(openingTime, 9 * 60);
  const close = parseHHMM(closingTime, 22 * 60);
  const t = yangonMinuteOfDay(date);
  if (open === close) return true;
  return open < close ? t >= open && t < close : t >= open || t < close;
}

/** Minutes until closing time, or null when already closed. */
export function minutesUntilClose(now: Date, openingTime?: string, closingTime?: string) {
  if (!isWithinHours(now, openingTime, closingTime)) return null;
  const close = parseHHMM(closingTime, 22 * 60);
  const t = yangonMinuteOfDay(now);
  return close > t ? close - t : close + 1440 - t;
}

export type ScheduleCheck = { ok: true; at: Date | null } | { ok: false; message: string };

export function checkSchedule(
  raw: unknown,
  hours: { openingTime?: string; closingTime?: string },
  now = new Date()
): ScheduleCheck {
  if (raw == null || raw === '') return { ok: true, at: null };
  const at = new Date(String(raw));
  if (Number.isNaN(at.getTime())) return { ok: false, message: 'Invalid delivery time' };
  const leadMins = (at.getTime() - now.getTime()) / 60000;
  if (leadMins < MIN_LEAD_MINS) {
    return { ok: false, message: `Pick a time at least ${MIN_LEAD_MINS} minutes from now` };
  }
  if (leadMins > MAX_AHEAD_DAYS * 1440) {
    return { ok: false, message: `You can schedule up to ${MAX_AHEAD_DAYS} days ahead` };
  }
  if (!isWithinHours(at, hours.openingTime, hours.closingTime)) {
    return {
      ok: false,
      message: `The restaurant is open ${hours.openingTime || '09:00'}–${hours.closingTime || '22:00'}. Pick a time in those hours.`,
    };
  }
  return { ok: true, at };
}
