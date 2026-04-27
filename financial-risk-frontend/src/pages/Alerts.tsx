import { useEffect, useState } from 'react';
import { Bell, BellOff, AlertTriangle, Info, CheckCircle, RefreshCw } from 'lucide-react';
import Layout from '../components/Layout.tsx';
import api from '../api/axios.ts';

interface Alert {
  id: number;
  type: string;
  severity: string;
  severity_color: string;
  message: string;
  is_read: boolean;
  triggered_at: string;
  read_at: string | null;
  company: { id: number; name: string; ticker: string };
  quarter_date: string;
}

const severityIcon = (severity: string) => {
  switch (severity) {
    case 'critical': return <AlertTriangle className="w-4 h-4 text-red-400" />;
    case 'warning':  return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    default:         return <Info className="w-4 h-4 text-blue-400" />;
  }
};

const severityBadge = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'warning':  return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
    default:         return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  }
};

const typeLabel = (type: string) => {
  const map: Record<string, string> = {
    high_risk_detected: 'High Risk Detected',
    risk_increased:     'Risk Increased',
    risk_decreased:     'Risk Decreased',
    negative_margin:    'Negative Margin',
    low_liquidity:      'Low Liquidity',
    high_leverage:      'High Leverage',
  };
  return map[type] ?? type;
};

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'month', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
};

export default function Alerts() {
  const [alerts,      setAlerts]      = useState<Alert[]>([]);
  const [filter,      setFilter]      = useState<'all' | 'unread' | 'critical' | 'warning' | 'info'>('all');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [markingAll,  setMarkingAll]  = useState(false);

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/alerts');
      setAlerts(res.data.alerts ?? []);
    } catch {
      setError('Failed to load alerts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAlerts(); }, []);

  const markRead = async (id: number) => {
    try {
      await api.patch(`/alerts/${id}/read`);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.patch('/alerts/read-all');
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
    } finally {
      setMarkingAll(false);
    }
  };

  const filtered = alerts.filter(a => {
    if (filter === 'unread')   return !a.is_read;
    if (filter === 'critical') return a.severity === 'critical';
    if (filter === 'warning')  return a.severity === 'warning';
    if (filter === 'info')     return a.severity === 'info';
    return true;
  });

  const unreadCount   = alerts.filter(a => !a.is_read).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount  = alerts.filter(a => a.severity === 'warning').length;

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="p-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Alerts</h1>
            <p className="text-gray-400 mt-1">
              {alerts.length} total · {unreadCount} unread · {criticalCount} critical
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchAlerts}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingAll}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-xl text-sm transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                {markingAll ? 'Marking...' : 'Mark all read'}
              </button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Alerts',    value: alerts.length,   color: 'text-white',        bg: 'bg-gray-800' },
            { label: 'Unread',          value: unreadCount,     color: 'text-blue-400',     bg: 'bg-blue-500/10' },
            { label: 'Critical',        value: criticalCount,   color: 'text-red-400',      bg: 'bg-red-500/10' },
            { label: 'Warnings',        value: warningCount,    color: 'text-yellow-400',   bg: 'bg-yellow-500/10' },
          ].map(card => (
            <div key={card.label} className={`${card.bg} border border-gray-800 rounded-xl p-4`}>
              <p className="text-gray-400 text-xs mb-1">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all',      label: `All (${alerts.length})` },
            { key: 'unread',   label: `Unread (${unreadCount})` },
            { key: 'critical', label: `Critical (${criticalCount})` },
            { key: 'warning',  label: `Warning (${warningCount})` },
            { key: 'info',     label: 'Info' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as typeof filter)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Alert list */}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <BellOff className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-gray-400 font-medium">No alerts found</p>
            <p className="text-gray-600 text-sm mt-1">
              {filter === 'all'
                ? 'No alerts have been generated yet.'
                : `No ${filter} alerts at this time.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(alert => (
              <div
                key={alert.id}
                className={`bg-gray-900 border rounded-xl p-5 transition-all ${
                  alert.is_read
                    ? 'border-gray-800 opacity-70'
                    : 'border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {/* Severity icon */}
                    <div className="mt-0.5">{severityIcon(alert.severity)}</div>

                    <div className="flex-1 min-w-0">
                      {/* Top row */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${severityBadge(alert.severity)}`}
                        >
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className="text-gray-400 text-xs">{typeLabel(alert.type)}</span>
                        {!alert.is_read && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                      </div>

                      {/* Message */}
                      <p className="text-white text-sm leading-relaxed">{alert.message}</p>

                      {/* Meta */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>{alert.company?.ticker ?? 'EPAM'}</span>
                        <span>·</span>
                        <span>{alert.quarter_date?.split('T')[0]}</span>
                        <span>·</span>
                        <span>{formatDate(alert.triggered_at)}</span>
                        {alert.is_read && alert.read_at && (
                          <>
                            <span>·</span>
                            <span className="text-green-600">Read {formatDate(alert.read_at)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mark read button */}
                  {!alert.is_read && (
                    <button
                      onClick={() => markRead(alert.id)}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg text-xs transition-colors"
                    >
                      <Bell className="w-3 h-3" />
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </Layout>
  );
}
