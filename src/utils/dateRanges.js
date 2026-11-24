/** Date -> "YYYY-MM-DD" in the user's own time zone */
export const toIsoDate = (date) => date.toLocaleDateString('en-CA');

/** Start and end dates for a preset, ending today */
export function rangeForPreset(preset, today = new Date()) {
  const start = new Date(today);
  switch (preset) {
    case '30d':
      start.setDate(start.getDate() - 29);
      break;
    case '90d':
      start.setDate(start.getDate() - 89);
      break;
    case '12m':
      start.setFullYear(start.getFullYear() - 1);
      start.setDate(start.getDate() + 1);
      break;
    case 'ytd':
      start.setMonth(0, 1);
      break;
    default:
      return null;
  }
  return { from: toIsoDate(start), to: toIsoDate(today) };
}

/** Chart axis label for a week or month */
export function formatPeriod(periodStart, bucket) {
  const date = new Date(`${periodStart}T00:00:00`);
  return bucket === 'month'
    ? date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}