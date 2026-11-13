import { useEffect, useState } from 'react';
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