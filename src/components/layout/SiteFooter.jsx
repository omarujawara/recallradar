import { useLatestReportDate } from '@/hooks/useRecalls';
import { formatDate } from '@/utils/format';

export default function SiteFooter() {
  const latestReportDate = useLatestReportDate();

  return (
    <footer className="border-t">
      <div className="mx-auto max-w-5xl space-y-1 px-4 py-8 text-sm text-muted-foreground">
        <p>
          Recall data comes from U.S. FDA enforcement reports through openFDA
          {latestReportDate && `, with reports through ${formatDate(latestReportDate)}`}.
        </p>
        <p>Confirm details with the recalling company or FDA.gov before acting on a recall.</p>
        <p className="pt-3">© {new Date().getFullYear()} RecallRadar. All rights reserved.</p>
      </div>
    </footer>
  );
}