import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAlerts } from '@/hooks/useAlerts';
import { formatTimestamp, truncate } from '@/utils/format';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

const FILTERS = [
  { value: 'unread', label: 'Unread' },
  { value: 'all', label: 'All' },
];

function alertTitle(alert) {
  const term = alert.term ? `“${alert.term}”` : 'your watchlist';
  switch (alert.type) {
    case 'recall_closed':
      return `A recall matching ${term} was closed`;
    case 'status_change':
      return `Status changed on a recall matching ${term}`;
    case 'recall_updated':
      return `A recall matching ${term} was updated`;
    default:
      return `Active recall matches ${term}`;
  }
}

export default function Alerts() {
  const { alerts, unreadCount, loading, error, markRead, markAllRead } = useAlerts();
  const [filter, setFilter] = useState('unread');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = filter === 'unread' ? alerts.filter((alert) => !alert.readAt) : alerts;
  const visible = filtered.slice(0, visibleCount);

  function changeFilter(value) {
    setFilter(value);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
      <p className="mt-2 text-muted-foreground">
        You get an alert when an active recall matches something on your watchlist.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div role="group" aria-label="Filter alerts" className="flex gap-1">
          {FILTERS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={filter === option.value ? 'secondary' : 'ghost'}
              aria-pressed={filter === option.value}
              onClick={() => changeFilter(option.value)}
            >
              {option.label}
              {option.value === 'unread' && unreadCount > 0 && ` (${unreadCount})`}
            </Button>
          ))}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            Mark all as read
          </Button>
        )}
      </div>

      {loading && (
        <div className="mt-3 space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="mt-6 text-destructive">Your alerts couldn’t be loaded. Refresh the page to try again.</p>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="mt-6 max-w-prose space-y-3">
          {alerts.length === 0 ? (
            <>
              <p className="text-muted-foreground">
                You have no alerts. Add items to your watchlist to get alerts for active recalls.
              </p>
              <Button asChild>
                <Link to="/app/watchlist">Add to watchlist</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">You’ve read all your alerts.</p>
              <Button variant="outline" onClick={() => changeFilter('all')}>
                Show all alerts
              </Button>
            </>
          )}
        </div>
      )}

      <ul className="divide-y">
        {visible.map((alert) => {
          const unread = !alert.readAt;
          return (
            <li key={alert.id} className="flex items-start gap-3 py-4">
              <span
                className={cn('mt-2 size-2 shrink-0 rounded-full', unread ? 'bg-primary' : 'bg-transparent')}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <Link
                  to={alert.recall ? `/recalls/${alert.recall.id}` : '/app'}
                  onClick={() => markRead(alert.id)}
                  className={cn('underline-offset-4 hover:underline', unread && 'font-semibold')}
                >
                  {unread && <span className="sr-only">Unread: </span>}
                  {alertTitle(alert)}
                </Link>
                {alert.recall && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {truncate(alert.recall.product_description, 100)}
                    {alert.recall.recalling_firm && ` (${alert.recall.recalling_firm})`}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{formatTimestamp(alert.createdAt)}</p>
              </div>
              {unread && (
                <Button variant="ghost" size="sm" className="shrink-0" onClick={() => markRead(alert.id)}>
                  Mark as read
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {visibleCount < filtered.length && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
            Show more alerts
          </Button>
        </div>
      )}
    </div>
  );
}