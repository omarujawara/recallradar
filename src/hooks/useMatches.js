import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

/** The logged-in user's watchlist matches for one recall. Empty for guests. */
export function useRecallMatches(recallId) {
  const { user } = useAuth();
  const userId = user?.id;
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    if (!userId || !recallId) {
      setMatches([]);
      return;
    }

    let ignore = false;
    supabase
      .from('matches')
      .select('id, match_reason, matched_field')
      .eq('recall_id', recallId)
      .eq('is_dismissed', false)
      .then(({ data, error }) => {
        if (ignore) return;
        if (error) console.error('Failed to load matches:', error.message);
        setMatches(data ?? []);
      });

    return () => {
      ignore = true;
    };
  }, [userId, recallId]);

  return matches;
}

const MATCH_COLUMNS = `
  id, recall_id, matched_field,
  watchlist_items ( term, item_type ),
  recalls ( id, recall_number, product_description, reason_for_recall, recalling_firm, status, classification, report_date )
`;

/** One entry per recall, with every reason it matched, newest recall first. */
function groupByRecall(rows) {
  const byRecall = new Map();

  for (const row of rows) {
    if (!row.recalls) continue;
    const entry = byRecall.get(row.recall_id) ?? { recall: row.recalls, reasons: [] };
    entry.reasons.push({
      id: row.id,
      term: row.watchlist_items?.term,
      itemType: row.watchlist_items?.item_type,
      field: row.matched_field,
    });
    byRecall.set(row.recall_id, entry);
  }

  return [...byRecall.values()].sort((a, b) =>
    (b.recall.report_date ?? '').localeCompare(a.recall.report_date ?? ''),
  );
}

/** All of the logged-in user's matches, grouped by recall. */
export function useMatches() {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState({ rows: [], loading: true, error: null });

  useEffect(() => {
    if (!userId) {
      setState({ rows: [], loading: false, error: null });
      return;
    }

    let ignore = false;
    supabase
      .from('matches')
      .select(MATCH_COLUMNS)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .limit(1000)
      .then(({ data, error }) => {
        if (ignore) return;
        if (error) console.error('Failed to load matches:', error.message);
        setState({ rows: data ?? [], loading: false, error: error?.message ?? null });
      });

    return () => {
      ignore = true;
    };
  }, [userId]);

  const matchedRecalls = useMemo(() => groupByRecall(state.rows), [state.rows]);

  return { matchedRecalls, loading: state.loading, error: state.error };
}