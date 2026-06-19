import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '../api/axios.ts';
import { useAuth } from './AuthContext.tsx';

interface CompanySummary {
  current_risk: string;
  risk_color:   string;
  fetched_at:   string;
}

interface RefreshContextType {
  unreadAlerts:   number;
  companySummary: CompanySummary | null;
  lastUpdated:    Date | null;
  refresh:        () => void;
}

const RefreshContext = createContext<RefreshContextType>({
  unreadAlerts:   0,
  companySummary: null,
  lastUpdated:    null,
  refresh:        () => {},
});

const POLL_INTERVAL = 60_000;

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [unreadAlerts,   setUnreadAlerts]   = useState(0);
  const [companySummary, setCompanySummary] = useState<CompanySummary | null>(null);
  const [lastUpdated,    setLastUpdated]    = useState<Date | null>(null);
  const { isAuthenticated } = useAuth();

  const fetchAll = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const [alertsRes, companyRes] = await Promise.all([
        api.get('/alerts/unread'),
        api.get('/company'),
      ]);

      setUnreadAlerts(alertsRes.data.alerts?.length ?? 0);
      setCompanySummary({
        current_risk: companyRes.data.current_risk,
        risk_color:   companyRes.data.risk_color,
        fetched_at:   companyRes.data.fetched_at,
      });
      // Use functional update to guarantee a new Date reference every time,
      // even if called in quick succession
      setLastUpdated(() => new Date());
    } catch {
      // silent
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return (
    <RefreshContext.Provider value={{
      unreadAlerts,
      companySummary,
      lastUpdated,
      refresh: fetchAll,
    }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  return useContext(RefreshContext);
}
