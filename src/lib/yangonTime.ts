const YANGON_TZ = 'Asia/Yangon';
const YANGON_OFFSET_MS = (6 * 60 + 30) * 60 * 1000;

export { YANGON_TZ };

function partNumber(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): number {
  return Number(parts.find((p) => p.type === type)?.value || 0);
}

export function yangonParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: YANGON_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);

  return {
    year: partNumber(parts, 'year'),
    month: partNumber(parts, 'month'),
    day: partNumber(parts, 'day'),
    hour: partNumber(parts, 'hour'),
  };
}

export function yangonWallToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0
): Date {
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, ms) - YANGON_OFFSET_MS
  );
}

export function startOfYangonDay(date = new Date()): Date {
  const { year, month, day } = yangonParts(date);
  return yangonWallToUtc(year, month, day);
}

export function yangonMonthBounds(year: number, month: number) {
  const start = yangonWallToUtc(year, month, 1);
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = new Date(yangonWallToUtc(endYear, endMonth, 1).getTime() - 1);
  return { start, end };
}

export function yangonYearBounds(year: number) {
  const start = yangonWallToUtc(year, 1, 1);
  const end = new Date(yangonWallToUtc(year + 1, 1, 1).getTime() - 1);
  return { start, end };
}

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}
