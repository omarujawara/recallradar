/** A headline number with its change from the previous period */
export default function Metric({ label, current, previous }) {
  const diff = current - previous;
  let change = 'Same as the previous period';
  if (previous === 0 && current > 0) {
    change = 'None in the previous period';
  } else if (diff !== 0) {
    const percent = Math.round((Math.abs(diff) / previous) * 100);
    change = `${diff > 0 ? 'Up' : 'Down'} ${percent}% from ${previous.toLocaleString()}`;
  }

  return (
    <div className="border-l-2 pl-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{current.toLocaleString()}</p>
      <p className="mt-1 text-sm text-muted-foreground">{change}</p>
    </div>
  );
}