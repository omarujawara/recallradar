import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import RecallCard from '@/components/recall/RecallCard';
import { useMatches } from '@/hooks/useMatches';
import { useWatchlist } from '@/hooks/useWatchlist';
import { ACTIVE_STATUSES, MATCHED_FIELD_LABELS, STATUS_FILTERS, WATCH_ITEM_TYPES } from '@/constants';

const PAGE_SIZE = 20;

function reasonText(reason) {
  const type = WATCH_ITEM_TYPES.find((item) => item.value === reason.itemType)?.label.toLowerCase() ?? 'item';
  const where = MATCHED_FIELD_LABELS[reason.field] ?? 'this recall';
  return `Your ${type} “${reason.term}” appears in ${where}.`;
}

export default function Dashboard() {
  const { matchedRecalls, loading, error } = useMatches();
  const { items: watchlist, loading: watchlistLoading } = useWatchlist();

  const [status, setStatus] = useState('active');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const isActive = (entry) => ACTIVE_STATUSES.includes(entry.recall.status);
  const activeCount = matchedRecalls.filter(isActive).length;
  const closedCount = matchedRecalls.length - activeCount;

  const filtered = matchedRecalls.filter((entry) => {
    if (status === 'active') return isActive(entry);
    if (status === 'closed') return !isActive(entry);
    return true;
  });
  const visible = filtered.slice(0, visibleCount);

  function changeStatus(value) {
    setStatus(value);
    setVisibleCount(PAGE_SIZE);
  }

  const isLoading = loading || watchlistLoading;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Recalls that match your watchlist</h1>

      {isLoading && (
        <div className="mt-6 space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <p className="mt-6 text-destructive">Your matches couldn’t be loaded. Refresh the page to try again.</p>
      )}

      {/* Nothing on the watchlist yet */}
      {!isLoading && !error && watchlist.length === 0 && (
        <div className="mt-6 max-w-prose space-y-3">
          <p className="text-muted-foreground">
            Your watchlist is empty. Add the allergens, brands, and products you care about, and the recalls
            that mention them show up here.
          </p>
          <Button asChild>
            <Link to="/app/watchlist">Add to watchlist</Link>
          </Button>
        </div>
      )}

      {/* Watching things, but nothing matched */}
      {!isLoading && !error && watchlist.length > 0 && matchedRecalls.length === 0 && (
        <p className="mt-6 max-w-prose text-muted-foreground">
          No recalls mention anything on your watchlist.
        </p>
      )}

      {!isLoading && !error && matchedRecalls.length > 0 && (
        <>
          <p className="mt-2 text-muted-foreground">
            {activeCount} active and {closedCount} closed, from {watchlist.length} watchlist{' '}
            {watchlist.length === 1 ? 'item' : 'items'}.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <h2 className="text-base font-medium" aria-live="polite">
              {filtered.length.toLocaleString()} {filtered.length === 1 ? 'recall' : 'recalls'}
            </h2>
            <div role="group" aria-label="Filter by recall status" className="flex gap-1">
              {STATUS_FILTERS.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  size="sm"
                  variant={status === filter.value ? 'secondary' : 'ghost'}
                  aria-pressed={status === filter.value}
                  onClick={() => changeStatus(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-6 space-y-3">
              <p>No {status} recalls match your watchlist.</p>
              <Button variant="outline" onClick={() => changeStatus('all')}>
                Show all matches
              </Button>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {visible.map(({ recall, reasons }) => (
                <li key={recall.id}>
                  <RecallCard recall={recall}>
                    <ul className="mt-3 space-y-1 border-t pt-3 text-sm text-muted-foreground">
                      {reasons.map((reason) => (
                        <li key={reason.id}>{reasonText(reason)}</li>
                      ))}
                    </ul>
                  </RecallCard>
                </li>
              ))}
            </ul>
          )}

          {visibleCount < filtered.length && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                Show more recalls
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}