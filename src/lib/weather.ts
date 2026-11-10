/**
 * Real Yangon weather from Open-Meteo (free, no API key).
 * https://open-meteo.com — forecast + historical archive.
 */
import { cacheGetOrSet } from '@/lib/ttlCache';

export const WEATHER_KINDS = ['Sunny', 'Cloudy', 'Rainy', 'Stormy'] as const;
export type WeatherKind = (typeof WEATHER_KINDS)[number];

const YANGON = { lat: 16.8409, lng: 96.1735 };
const TZ = 'Asia/Yangon';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

/** WMO weather code → our four kinds. */
export function kindFromWmo(code: number): WeatherKind {
  if (code >= 95) return 'Stormy';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 86) || (code >= 71 && code <= 77)) {
    return 'Rainy';
  }
  if (code <= 1) return 'Sunny';
  return 'Cloudy';
}

export const isWet = (k: string | null | undefined) => k === 'Rainy' || k === 'Stormy';

/** Season guess used only when Open-Meteo cannot be reached. */
export function seasonalGuess(date = new Date()): WeatherKind {
  const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'numeric' }).format(date));
  return month >= 5 && month <= 10 ? 'Rainy' : 'Sunny';
}

export type YangonWeather = {
  source: 'open-meteo' | 'seasonal-estimate';
  now: { kind: WeatherKind; code: number | null; temperatureC: number | null; precipitationMm: number | null };
  tomorrow: { kind: WeatherKind; rainChancePct: number | null; precipitationMm: number | null; date: string | null };
};

async function fetchJson(url: string, timeoutMs: number) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return res.json();
}

/** Current weather + tomorrow's forecast for Yangon, cached for 15 minutes. */
export function getYangonWeather(): Promise<YangonWeather> {
  return cacheGetOrSet('weather:yangon', 15 * 60_000, async () => {
    try {
      const params = new URLSearchParams({
        latitude: String(YANGON.lat),
        longitude: String(YANGON.lng),
        current: 'weather_code,temperature_2m,precipitation',
        daily: 'weather_code,precipitation_probability_max,precipitation_sum',
        forecast_days: '2',
        timezone: TZ,
      });
      const j = await fetchJson(`${FORECAST_URL}?${params}`, 3000);
      const code = Number(j.current?.weather_code);
      const tCode = Number(j.daily?.weather_code?.[1]);
      return {
        source: 'open-meteo',
        now: {
          kind: kindFromWmo(code),
          code: Number.isFinite(code) ? code : null,
          temperatureC: Number.isFinite(Number(j.current?.temperature_2m)) ? Number(j.current.temperature_2m) : null,
          precipitationMm: Number.isFinite(Number(j.current?.precipitation)) ? Number(j.current.precipitation) : null,
        },
        tomorrow: {
          kind: kindFromWmo(tCode),
          rainChancePct: Number.isFinite(Number(j.daily?.precipitation_probability_max?.[1]))
            ? Number(j.daily.precipitation_probability_max[1])
            : null,
          precipitationMm: Number.isFinite(Number(j.daily?.precipitation_sum?.[1]))
            ? Number(j.daily.precipitation_sum[1])
            : null,
          date: j.daily?.time?.[1] ? String(j.daily.time[1]) : null,
        },
      } satisfies YangonWeather;
    } catch (error) {
      console.warn('Open-Meteo unavailable, using seasonal estimate:', error);
      const guess = seasonalGuess();
      return {
        source: 'seasonal-estimate',
        now: { kind: guess, code: null, temperatureC: null, precipitationMm: null },
        tomorrow: { kind: guess, rainChancePct: null, precipitationMm: null, date: null },
      } satisfies YangonWeather;
    }
  });
}

/** Yangon wall-clock key 'YYYY-MM-DDTHH' for a timestamp. */
export function yangonHourKey(date: Date) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => p.find((x) => x.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}`;
}

/**
 * Hourly weather kinds for a past date range (Yangon days, inclusive).
 * Archive data lags ~5 days, so the last week comes from the forecast API.
 */
export async function getHourlyHistory(startDay: string, endDay: string): Promise<Map<string, WeatherKind>> {
  const out = new Map<string, WeatherKind>();
  const add = (j: { hourly?: { time?: string[]; weather_code?: number[] } }) => {
    const times = j.hourly?.time || [];
    const codes = j.hourly?.weather_code || [];
    times.forEach((t, i) => {
      const c = Number(codes[i]);
      if (Number.isFinite(c)) out.set(t.slice(0, 13), kindFromWmo(c));
    });
  };
  const base = { latitude: String(YANGON.lat), longitude: String(YANGON.lng), hourly: 'weather_code', timezone: TZ };
  const archiveEnd = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
  if (startDay <= archiveEnd) {
    const end = endDay < archiveEnd ? endDay : archiveEnd;
    add(await fetchJson(`${ARCHIVE_URL}?${new URLSearchParams({ ...base, start_date: startDay, end_date: end })}`, 20000));
  }
  // Recent days: forecast API with past_days covers what the archive lacks.
  add(await fetchJson(`${FORECAST_URL}?${new URLSearchParams({ ...base, past_days: '10', forecast_days: '1' })}`, 20000));
  return out;
}
