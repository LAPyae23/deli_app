/** Display a stored rating, or "New" when none exists yet. */
export function formatRating(rating?: number | null) {
  const n = Number(rating);
  if (!Number.isFinite(n) || n <= 0) return 'New';
  return n.toFixed(1);
}
