import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/recall/StatusBadge';
import { useRecallSearch } from '@/hooks/useRecalls';
import { STATUS_FILTERS } from '@/constants';
import { formatDate, truncate } from '@/utils/format';

export default function RecallManager() {
  const location = useLocation();
  const savedMessage = location.state?.message; // set by the form after saving

  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');

  const { recalls, total, loading, error, hasMore, loadMore } = useRecallSearch({ query, status });

  function handleSubmit(event) {
    event.preventDefault();
    setQuery(input.trim());
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Recalls</h1>
        <Button asChild>
          <Link to="/admin/recalls/new">Add recall</Link>
        </Button>
      </div>

      {savedMessage && (
        <p role="status" className="mt-4 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {savedMessage}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleSubmit} role="search" className="flex w-full max-w-md gap-2">
          <label htmlFor="admin-recall-search" className="sr-only">
            Search recalls
          </label>
          <Input
            id="admin-recall-search"
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Product, company, or reason"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <div role="group" aria-label="Filter by recall status" className="flex gap-1">
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              type="button"
              size="sm"
              variant={status === filter.value ? 'secondary' : 'ghost'}
              aria-pressed={status === filter.value}
              onClick={() => setStatus(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
        {loading && recalls.length === 0 ? 'Loading…' : `${total.toLocaleString()} ${total === 1 ? 'recall' : 'recalls'}`}
      </p>

      {error ? (
        <p className="mt-4 text-destructive">Recalls couldn’t be loaded. Refresh the page to try again.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Product</th>
                <th scope="col" className="px-3 py-2 font-medium">Company</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Reported</th>
                <th scope="col" className="px-3 py-2 font-medium">Source</th>
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recalls.map((recall) => (
                <tr key={recall.id}>
                  <td className="min-w-64 px-3 py-2">
                    <Link to={`/recalls/${recall.id}`} className="font-medium underline-offset-4 hover:underline">
                      {truncate(recall.product_description, 70)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{recall.recalling_firm ?? 'Not listed'}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={recall.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{formatDate(recall.report_date)}</td>
                  <td className="px-3 py-2">{recall.source === 'manual' ? 'Admin' : 'FDA'}</td>
                  <td className="px-3 py-2 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/admin/recalls/${recall.id}/edit`} aria-label={`Edit ${truncate(recall.product_description, 40)}`}>
                        Edit
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {!loading && recalls.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No recalls match this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && !loading && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={loadMore}>
            Show more recalls
          </Button>
        </div>
      )}
    </div>
  );
}