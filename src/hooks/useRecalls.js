import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ACTIVE_STATUSES, CLOSED_STATUSES } from "@/constants";

export const PAGE_SIZE = 20;

// Only the columns a list needs. Never select `raw` for lists; its large.
const LIST_COLUMNS = 
    'id, recall_number, product_description, reason_for_recall, recalling_firm, status, classification, report_date';

function buildSearchQuery({ query, status}) {
    let request = supabase
        .from('recalls')
        .select(LIST_COLUMNS, {count: 'exact'});

    if (query) {
        request = request
            .textSearch('search_vector', query, { type: 'websearch', config: 'english'});
    }
    if (status === 'active') request = request.in('status', ACTIVE_STATUSES);
    if (status === 'closed') request = request.in('status', CLOSED_STATUSES);

    // sort by report_data and id as a tiebreaker
    return request
        .order('report_date', {ascending: false, nullsFirst: false })
        .order('id', {ascending: false});
}

 /**
 * Search recalls, 20 at a time.
 * Changing query or status starts over at page 1
 */
export function useRecallSearch({ query = '', status = 'active'}) {
    const filterKey = `${query}|${status}`;

    //  Page resets automatically when the filter change
    const [pageState, setPageState] = useState({ key: filterKey, page: 0});
    const page = pageState.key === filterKey ? pageState.page: 0;

    const [results, setResults] = useState({ key: null, items: [], total: 0});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let ignore = false; // drop responses from searches that were replaced
        setLoading(true);
        setError(null);

        const from = page * PAGE_SIZE;
        buildSearchQuery({ query, status })
            .range(from, from + PAGE_SIZE - 1)
            .then(({data, error: requestError, count}) => {
                if (ignore) return;
                if (requestError) {
                    console.error('Recall search failed:', requestError.message);
                    setError(requestError.message);
                } else {
                    setResults((prev) => ({
                        key: filterKey,
                        items: page === 0 || prev.key !== filterKey ? data : [...prev.items, ...data],
                        total: count ?? 0,
                    }));
                }
                setLoading(false);
            });

            return () => {
                ignore = true;
            };
    }, [query, status, page, filterKey]);

    // Never show results from an older search while a new one loads
    const current = results.key === filterKey ? results : { items: [], total: 0};

    return {
        recalls: current.items,
        total: current.total,
        loading,
        error,
        hasMore: current.items.length < current.total,
        loadMore: () => setPageState({ key: filterKey, page: page + 1}),
    };
}

/** Most recent report date in the data, for the footer */
export function useLatestReportDate() {
    const [date, setDate] = useState(null);

    useEffect(() => {
        supabase
            .from('recalls')
            .select('report_date')
            .not('report_date', 'is', null)
            .order('report_date', { ascending: false})
            .limit(1)
            .maybeSingle()
            .then(({ data }) => setDate(data?.report_date ?? null));
    }, []);

    return date;
}