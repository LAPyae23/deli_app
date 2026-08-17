export type DashboardRange = 'today' | '7d' | '30d';

export const DASHBOARD_RANGES: { id: DashboardRange; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
];

export function parseDashboardRange(raw: string | null | undefined): DashboardRange {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'today' || value === '7d' || value === '30d') return value;
  return '7d';
}

export function dashboardRangeStart(range: DashboardRange, now = new Date()): Date {
  if (range === 'today') {
    const ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Yangon',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    return new Date(`${ymd}T00:00:00+06:30`);
  }
  const days = range === '30d' ? 30 : 7;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function dashboardPeriodLabel(range: DashboardRange) {
  if (range === 'today') return 'Today';
  if (range === '30d') return 'This Month';
  return 'This Week';
}

export function dashboardSummaryTitle(range: DashboardRange) {
  if (range === 'today') return "Today's Summary";
  if (range === '30d') return "This Month's Summary";
  return "This Week's Summary";
}

export function dashboardChartMeta(range: DashboardRange) {
  if (range === 'today') {
    return { title: "Today's Earnings", subtitle: 'Since midnight' };
  }
  if (range === '30d') {
    return { title: 'Monthly Earnings', subtitle: 'Last 30 days' };
  }
  return { title: 'Weekly Earnings', subtitle: 'Last 7 days' };
}

export function yangonHour(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Yangon',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Number(parts.find((p) => p.type === 'hour')?.value || 0);
}

export function yangonWeekdayIndex(date: Date) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Yangon',
    weekday: 'short',
  }).format(date);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return map[weekday] ?? 0;
}
