const USD_TO_MMK = 2100;

export function toMMK(usd: number) {
  const n = Number(usd);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * USD_TO_MMK);
}

/**
 * Format money for display as Myanmar Kyat.
 * Seeded / live amounts are already in MMK — do not ×2100 by default.
 * Tiny fractional USD leftovers (&lt; 100) are converted ×2100.
 */
export function formatKyat(amount: number) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '0 Ks';
  const mmk =
    Math.abs(n) > 0 && Math.abs(n) < 100 && !Number.isInteger(n)
      ? toMMK(n)
      : Math.round(n);
  return `${mmk.toLocaleString('en-US')} Ks`;
}

/** Alias — all UI money should use Kyat formatting (no $). */
export function formatMMK(amount: number) {
  return formatKyat(amount);
}
