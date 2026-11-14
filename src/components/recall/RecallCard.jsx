import { Link } from 'react-router-dom';
import ClassBadge from './ClassBadge';
import StatusBadge from './StatusBadge';
import { formatDate, truncate } from '@/utils/format';

export default function RecallCard({ recall, children }) {
  return (
    <Link
      to={`/recalls/${recall.id}`}
      className="block rounded-lg border p-4 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h3 className="max-w-prose font-medium leading-snug">
          {truncate(recall.product_description, 110)}
        </h3>
        <div className="flex shrink-0 gap-1.5">
          <ClassBadge classification={recall.classification} />
          <StatusBadge status={recall.status} />
        </div>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        {recall.recalling_firm ?? 'Company not listed'}, reported {formatDate(recall.report_date)}
      </p>

      {recall.reason_for_recall && (
        <p className="mt-2 line-clamp-2 max-w-prose text-sm">{recall.reason_for_recall}</p>
      )}

      {children}
    </Link>
  );
}