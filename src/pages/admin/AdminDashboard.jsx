import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { ACTIVE_STATUSES, CLOSED_STATUSES } from '@/constants';
import { formatDate, formatTimestamp } from '@/utils/format';

// head: true returns only the count, not the rows
const countRecalls = (filter = (query) => query) =>
  filter(supabase.from('recalls').select('id', { count: 'exact', head: true }));

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{children}</dd>
    </div>
  );
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState(null); // { kind: 'success' | 'error', text }
  
  useEffect(() => {
    let ignore = false;

    Promise.all([
      countRecalls(),
      countRecalls((query) => query.in('status', ACTIVE_STATUSES)),
      countRecalls((query) => query.in('status', CLOSED_STATUSES)),
      countRecalls((query) => query.eq('source', 'manual')),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase
        .from('sync_runs')
        .select('status, started_at, records_fetched, fda_last_updated')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then((results) => {
      if (ignore) return;
      const failed = results.find((result) => result.error);
      if (failed) {
        console.error('Failed to load overview:', failed.error.message);
        setError(true);
        return;
      }
      const [total, active, closed, manual, accounts, lastImport] = results;
      setOverview({
        total: total.count,
        active: active.count,
        closed: closed.count,
        manual: manual.count,
        accounts: accounts.count,
        lastImport: lastImport.data,
      });
    });

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  function importSummary(result) {
    if (result.status === 'skipped') {
      return 'Already up to date. The FDA hasn’t published new reports since the last import.';
    }
    const parts = [
      `Added ${result.inserted.toLocaleString()} new ${result.inserted === 1 ? 'recall' : 'recalls'} and checked ${result.updated.toLocaleString()} existing ${result.updated === 1 ? 'one' : 'ones'}.`,
    ];
    if (result.changes > 0) {
      parts.push(
        `${result.changes} ${result.changes === 1 ? 'change was' : 'changes were'} recorded. Users following a recall whose status changed have been alerted.`,
      );
    }
    if (result.rejected > 0) {
      parts.push(`${result.rejected} FDA ${result.rejected === 1 ? 'record was' : 'records were'} skipped because of missing data.`);
    }
    return parts.join(' ');
  }

  async function runImport() {
    setImporting(true);
    setImportMessage(null);

    const { data, error: invokeError } = await supabase.functions.invoke('import-openfda', { body: {} });

    if (invokeError) {
      let text = 'The import couldn’t run. Try again in a few minutes.';
      try {
        const details = await invokeError.context?.json();
        if (details?.error) text = details.error;
      } catch {
        // keep the default message
      }
      setImportMessage({ kind: 'error', text });
    } else {
      setImportMessage({ kind: 'success', text: importSummary(data) });
      setReloadKey((key) => key + 1);
    }
    setImporting(false);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <Button asChild>
          <Link to="/admin/recalls/new">Add recall</Link>
        </Button>
      </div>

      {error && <p className="mt-6 text-destructive">The overview couldn’t be loaded. Refresh the page to try again.</p>}

      {!error && !overview && (
        <div className="mt-6 space-y-2" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {overview && (
        <>
          <section className="mt-8">
            <h2 className="text-lg font-semibold tracking-tight">Recalls</h2>
            <dl className="mt-2">
              <Row label="All recalls">{overview.total.toLocaleString()}</Row>
              <Row label="Active">{overview.active.toLocaleString()}</Row>
              <Row label="Closed">{overview.closed.toLocaleString()}</Row>
              <Row label="Added by admins">{overview.manual.toLocaleString()}</Row>
            </dl>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold tracking-tight">Accounts</h2>
            <dl className="mt-2">
              <Row label="Registered accounts">{overview.accounts.toLocaleString()}</Row>
            </dl>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold tracking-tight">Last FDA import</h2>
            {overview.lastImport ? (
              <dl className="mt-2">
                <Row label="Ran on">{formatTimestamp(overview.lastImport.started_at)}</Row>
                <Row label="Result">{overview.lastImport.status}</Row>
                <Row label="Records fetched">{overview.lastImport.records_fetched.toLocaleString()}</Row>
                <Row label="FDA data updated">
                  {overview.lastImport.fda_last_updated ? formatDate(overview.lastImport.fda_last_updated) : 'Unknown'}
                </Row>
              </dl>
            ) : (
              <p className="mt-2 text-muted-foreground">No import has been recorded.</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={runImport} disabled={importing}>
                {importing ? 'Importing…' : 'Import new FDA reports'}
              </Button>
              {importing && (
                <span className="text-sm text-muted-foreground">This can take up to a minute.</span>
              )}
            </div>
            <p
              role="status"
              aria-live="polite"
              className={`mt-3 max-w-prose text-sm ${importMessage?.kind === 'error' ? 'text-destructive' : ''}`}
            >
              {importMessage?.text}
            </p>
          </section>
        </>
      )}
    </div>
  );
}