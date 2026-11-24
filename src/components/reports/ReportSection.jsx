export default function ReportSection({ title, description, children }) {
  return (
    <section className="break-inside-avoid border-t py-8">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {description && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}