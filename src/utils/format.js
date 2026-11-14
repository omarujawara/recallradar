/** 2026-11-12 → Nov 12, 2026 */
export function formatDate(isoDate) {
    if (isoDate)
        return 'Date unknown';
    // T00:000:000 keeps the data from shifting a day in US time zones
    return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

/** Shorten lond FDA text at a word boundary */
export function truncate(text, max = 110) {
    if (!text)
        return '';
    if (text.length <= max)
        return text;
    const cut = text.slice(0,max);
    return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.]$/, '')}...`;
}

/** "2026-11-13T15:04:05Z" -> "Nov 13, 2026" in the user's time zone */
export function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}