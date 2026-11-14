import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const AlertsContext = createContext(null);

const ALERT_COLUMNS = `
  id, alert_type, read_at, created_at,
  matches (
    watchlist_items ( term ),
    recalls ( id, product_description, recalling_firm, status )
  )
`;

export function AlertsProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    const { data, error: requestError } = await supabase
      .from('alerts')
      .select(ALERT_COLUMNS)
      .eq('channel', 'in_app')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1000);

    if (requestError) {
      console.error('Failed to load alerts:', requestError.message);
      setError(requestError.message);
    } else {
      setAlerts(
        data.map((row) => ({
          id: row.id,
          type: row.alert_type,
          readAt: row.read_at,
          createdAt: row.created_at,
          term: row.matches?.watchlist_items?.term,
          recall: row.matches?.recalls,
        })),
      );
      setError(null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function markRead(id) {
    const readAt = new Date().toISOString();
    // Update the screen first, then the database
    setAlerts((prev) => prev.map((alert) => (alert.id === id && !alert.readAt ? { ...alert, readAt } : alert)));

    const { error: updateError } = await supabase
      .from('alerts')
      .update({ read_at: readAt })
      .eq('id', id)
      .is('read_at', null);
    if (updateError) {
      console.error('Failed to mark alert as read:', updateError.message);
      refresh(); // put the screen back in sync with the database
    }
  }

  async function markAllRead() {
    const readAt = new Date().toISOString();
    setAlerts((prev) => prev.map((alert) => (alert.readAt ? alert : { ...alert, readAt })));

    // RLS limits this to the logged-in user's alerts
    const { error: updateError } = await supabase
      .from('alerts')
      .update({ read_at: readAt })
      .is('read_at', null);
    if (updateError) {
      console.error('Failed to mark alerts as read:', updateError.message);
      refresh();
    }
  }

  const value = {
    alerts,
    unreadCount: alerts.filter((alert) => !alert.readAt).length,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
  };

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export function useAlerts() {
  const context = useContext(AlertsContext);
  if (!context) throw new Error('useAlerts must be used inside <AlertsProvider>');
  return context;
}