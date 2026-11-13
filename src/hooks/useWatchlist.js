import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export function useWatchlist() {
  const { user } = useAuth();
  const userId = user?.id;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return [];
    }

    // matches ( count ) returns how many recalls each item matched
    const { data, error: requestError } = await supabase
      .from('watchlist_items')
      .select('id, item_type, term, created_at, matches ( count )')
      .order('created_at', { ascending: false });

    if (requestError) {
      console.error('Failed to load watchlist:', requestError.message);
      setError(requestError.message);
      setLoading(false);
      return [];
    }

    const withCounts = data.map(({ matches, ...item }) => ({
      ...item,
      matchCount: matches?.[0]?.count ?? 0,
    }));
    setItems(withCounts);
    setError(null);
    setLoading(false);
    return withCounts;
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function addItem({ itemType, term }) {
    const cleanTerm = term.trim();
    // user_id fills itself in from auth.uid(); the database trigger creates the matches
    const { data, error: insertError } = await supabase
      .from('watchlist_items')
      .insert({ item_type: itemType, term: cleanTerm })
      .select('id')
      .single();

    if (insertError) {
      // 23505 = unique violation
      return {
        error:
          insertError.code === '23505'
            ? `“${cleanTerm}” is already on your watchlist.`
            : 'The item couldn’t be added. Try again.',
      };
    }

    const updated = await reload();
    return { item: updated.find((item) => item.id === data.id) };
  }

  async function removeItem(id) {
    // deleting the item also deletes its matches and alerts (cascade)
    const { error: deleteError } = await supabase.from('watchlist_items').delete().eq('id', id);
    if (deleteError) return { error: 'The item couldn’t be removed. Try again.' };
    setItems((prev) => prev.filter((item) => item.id !== id));
    return {};
  }

  return { items, loading, error, addItem, removeItem };
}