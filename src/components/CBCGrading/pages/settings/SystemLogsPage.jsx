import React, { useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, ShieldAlert } from 'lucide-react';
import { systemLogsAPI } from '../../../../services/api';
import SettingsPageShell from '../../shared/SettingsPageShell';

const formatTimeAgo = (iso) => {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.max(1, Math.floor((now - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
};

const sourceBadgeClass = (source) => {
  if (source === 'ACADEMIC') return 'bg-blue-100 text-blue-700';
  return 'bg-amber-100 text-amber-700';
};

const SystemLogsPage = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState('ALL');

  const loadLogs = async (asRefresh = false) => {
    try {
      setError('');
      if (asRefresh) setRefreshing(true);
      else setLoading(true);
      const response = await systemLogsAPI.getLogs({ limit: 120 });
      setLogs(Array.isArray(response?.data) ? response.data : []);
    } catch (e) {
      setError(e?.message || 'Failed to load system logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLogs(false);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = setInterval(() => {
      loadLogs(true);
    }, 20000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  const summary = useMemo(() => {
    const academic = logs.filter((l) => l.source === 'ACADEMIC').length;
    const system = logs.filter((l) => l.source === 'SYSTEM').length;
    const sensitive = logs.filter((l) => l.sensitiveLearnerChange).length;
    return { total: logs.length, academic, system, sensitive };
  }, [logs]);

  const visibleLogs = useMemo(() => {
    if (filter === 'ACADEMIC') return logs.filter((l) => l.source === 'ACADEMIC');
    if (filter === 'SYSTEM') return logs.filter((l) => l.source === 'SYSTEM');
    if (filter === 'SENSITIVE') return logs.filter((l) => l.sensitiveLearnerChange);
    return logs;
  }, [filter, logs]);

  return (
    <SettingsPageShell
      title="System Logs"
      description="Live activity feed in plain language for school administrators."
      actions={<div className="flex items-center gap-2"><label className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />Auto refresh</label><button onClick={() => loadLogs(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh</button></div>}
    >
      <div className="surface-panel p-4 md:p-5">
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Events</p>
            <p className="text-2xl font-semibold text-gray-900">{summary.total}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-600 uppercase tracking-wide">Academic Actions</p>
            <p className="text-2xl font-semibold text-blue-700">{summary.academic}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-700 uppercase tracking-wide">System Actions</p>
            <p className="text-2xl font-semibold text-amber-800">{summary.system}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { key: 'ALL', label: 'All Logs' },
            { key: 'ACADEMIC', label: 'Academic' },
            { key: 'SYSTEM', label: 'System' },
            { key: 'SENSITIVE', label: `Sensitive Learner Changes (${summary.sensitive})` },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filter === option.key
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="surface-panel">
        {loading ? (
          <div className="p-6 text-sm text-gray-600">Loading system logs...</div>
        ) : error ? (
          <div className="p-6">
            <div className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <ShieldAlert className="h-4 w-4" />
              {error}
            </div>
          </div>
        ) : visibleLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Activity className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            No logs match the selected filter.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visibleLogs.map((log) => (
              <div key={log.id} className="p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm md:text-base text-gray-900">
                      <span className="font-semibold">{log.actorName}</span>{' '}
                      <span className="text-gray-700">{log.message}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span>{log.actorRole}</span>
                      <span>•</span>
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                      <span>({formatTimeAgo(log.timestamp)})</span>
                      {log.details ? (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[360px]">{log.details}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${sourceBadgeClass(log.source)}`}>
                    {log.source}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingsPageShell>
  );
};

export default SystemLogsPage;
