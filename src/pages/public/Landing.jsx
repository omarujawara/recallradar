import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import RecallCard from "@/components/recall/RecallCard";
import { useAuth } from "@/hooks/useAuth";
import { useLatestReportDate, useRecallSearch } from "@/hooks/useRecalls";
import { EXAMPLE_SEARCHES, STATUS_FILTERS } from "@/constants";
import { formatDate } from "@/utils/format";


export default function Landing() {
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') ?? '';
  const status = searchParams.get('status') ?? 'active';

  const [input, setInput] = useState(query);
  // Keep the box in sync when the URL changes (back button, example searches)
  useEffect(() => setInput(query), [query]);

  const { recalls, total, loading, error, hasMore, loadMore } = useRecallSearch({ query, status });
  const latestReportDate = useLatestReportDate();

  function updateParams(changes) {
    const next = { q: query, status, ...changes };
    const params = {};
    if (next.q) params.q = next.q;
    if (next.status && next.status !== 'active') params.status = next.status; // active is the default
    setSearchParams(params);
  }

  function handleSubmit(event) {
    event.preventDefault();
    updateParams({ q: input.trim() });
  }

  const statusWord = { active: 'active ', closed: 'closed ', all: '' }[status];
  let heading = `Latest ${statusWord}recalls`;
  if (query) {
    heading = loading && recalls.length === 0
      ? 'Searching…'
      : `${total.toLocaleString()} ${statusWord}${total === 1 ? 'recall' : 'recalls'} matching “${query}”`;
  }

  const isEmpty = !loading && !error && recalls.length === 0;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            RecallRadar
          </Link>
          <nav className="flex items-center gap-2">
            {user ? (
              <Button asChild>
                <Link to={isAdmin ? '/admin' : '/app'}>Go to dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild>
                  <Link to="/signup">Create account</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 pb-10 pt-16 sm:pt-24">
          <h1 className="max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Has something you bought been recalled?
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Search U.S. FDA food recalls by product, brand, company, or ingredient. No account needed.
          </p>

          <form onSubmit={handleSubmit} role="search" className="mt-8 flex max-w-2xl gap-2">
            <label htmlFor="recall-search" className="sr-only">
              Search recalls
            </label>
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="recall-search"
                type="search"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Product, brand, company, or ingredient"
                className="h-12 pl-10 text-base"
              />
            </div>
            <Button type="submit" size="lg" className="h-12">
              Search
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Try:</span>
            {EXAMPLE_SEARCHES.map((term) => (
              <Button
                key={term}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-full"
                onClick={() => updateParams({ q: term })}
              >
                {term}
              </Button>
            ))}
          </div>
        </section>

        <section aria-labelledby="results-heading" className="mx-auto max-w-5xl px-4 pb-16">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <h2 id="results-heading" className="text-base font-medium" aria-live="polite">
              {heading}
            </h2>
            <div role="group" aria-label="Filter by recall status" className="flex gap-1">
              {STATUS_FILTERS.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  size="sm"
                  variant={status === filter.value ? 'secondary' : 'ghost'}
                  aria-pressed={status === filter.value}
                  onClick={() => updateParams({ status: filter.value })}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>

          {error ? (
            <p className="mt-6 text-destructive">Recalls couldn’t be loaded. Refresh the page to try again.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {recalls.map((recall) => (
                <li key={recall.id}>
                  <RecallCard recall={recall} />
                </li>
              ))}
            </ul>
          )}

          {loading && (
            <div className="mt-3 space-y-3" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-lg" />
              ))}
            </div>
          )}

          {isEmpty && (
            <div className="mt-6 max-w-prose space-y-3">
              <p>
                {query
                  ? `No ${statusWord}recalls match “${query}”. Try a single ingredient, a different spelling, or the company name.`
                  : `There are no ${statusWord}recalls to show.`}
              </p>
              {status !== 'all' && (
                <Button variant="outline" onClick={() => updateParams({ status: 'all' })}>
                  Search all recalls
                </Button>
              )}
            </div>
          )}

          {hasMore && !loading && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={loadMore}>
                Show more recalls
              </Button>
            </div>
          )}
        </section>

        {!user && (
          <section className="border-t bg-muted/40">
            <div className="mx-auto grid max-w-5xl gap-6 px-4 py-14 md:grid-cols-[1fr_auto] md:items-center">
              <div className="max-w-xl">
                <h2 className="text-2xl font-semibold tracking-tight">Get told when a recall affects you</h2>
                <p className="mt-3 text-muted-foreground">
                  Add the allergens, brands, and products you care about. RecallRadar shows every recall that
                  matches, explains why it matched, and lets you know when one is resolved.
                </p>
                <p className="mt-2 text-muted-foreground">
                  Running a restaurant or store? Track your suppliers and lot numbers too.
                </p>
              </div>
              <Button asChild size="lg">
                <Link to="/signup">Create account</Link>
              </Button>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-5xl space-y-1 px-4 py-8 text-sm text-muted-foreground">
          <p>
            Recall data comes from U.S. FDA enforcement reports through openFDA
            {latestReportDate && `, with reports through ${formatDate(latestReportDate)}`}.
          </p>
          <p>Confirm details with the recalling company or FDA.gov before acting on a recall.</p>
        </div>
      </footer>
    </div>
  );
}