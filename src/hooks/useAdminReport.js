import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** Runs admin_report for a date range. Pass empty dates to skip. */
export function useAdminReport({ from, to }) {
  const key = `${from}|${to}`;
  const [state, setState] = useState({ key: null, report: null, error: null });

  useEffect(() => {
    if (!from || !to) return;
    let ignore = false;

    supabase.rpc('admin_report', { p_from: from, p_to: to }).then(({ data, error }) => {
      if (ignore) return;
      if (error) console.error('Failed to load report:', error.message);
      setState({ key, report: data ?? null, error: error?.message ?? null });
    });

    return () => {
      ignore = true;
    };
  }, [from, to, key]);

  // Never show an older range's report while a new one loads
  const current = state.key === key ? state : null;
  return { report: current?.report ?? null, error: current?.error ?? null, loading: !current };
}