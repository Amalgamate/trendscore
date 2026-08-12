import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Play, 
  AlertTriangle,
  Calendar,
  User,
  Database
} from 'lucide-react';
import { biometricAPI } from '../../../../services/api/biometric.api';

const LogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
    page: 1,
    limit: 20
  });

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = { ...filters };
      if (params.status === 'all') delete params.status;
      
      const data = await biometricAPI.getLogs(params);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters.status, filters.page]);

  const handleProcess = async (id) => {
    try {
      await biometricAPI.processLog(id);
      fetchLogs(); // Refresh
    } catch (error) {
      console.error('Error processing log:', error);
      alert('Manual processing failed. Check server logs.');
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'PROCESSED': return 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20';
      case 'FAILED': return 'bg-rose-50 text-rose-600 ring-1 ring-rose-500/20';
      case 'PENDING': return 'bg-amber-50 text-amber-600 ring-1 ring-amber-500/20';
      default: return 'bg-slate-50 text-slate-400';
    }
  };

  const visibleLogs = logs.filter((log) => {
    const query = filters.search.trim().toLowerCase();
    return !query || [log.personId, log.personType, log.device?.name]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
          {['all', 'PENDING', 'PROCESSED', 'FAILED'].map((s) => (
            <button
              key={s}
              onClick={() => setFilters({...filters, status: s, page: 1})}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-widest transition-all ${
                filters.status === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {s === 'all' ? 'Universal' : s}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text"
            placeholder="Search by ID or Reference..."
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium focus:ring-4 focus:ring-indigo-500/5 outline-none"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-left text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest">Temporal Node</th>
                <th className="px-6 py-4 text-left text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest">Entity Source</th>
                <th className="px-6 py-4 text-left text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest">Terminal</th>
                <th className="px-6 py-4 text-center text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest">Process State</th>
                <th className="px-6 py-4 text-right text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan="5" className="px-6 py-6"><div className="h-4 bg-slate-50 rounded-lg w-full" /></td>
                  </tr>
                ))
              ) : visibleLogs.length > 0 ? (
                visibleLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Clock size={14} className="text-slate-300" />
                        <div>
                          <p className="text-xs font-semibold text-slate-900 font-mono">
                            {new Date(log.timestamp).toLocaleDateString('en-GB')}
                          </p>
                          <p className="text-[10px] font-medium text-slate-400 tracking-tighter">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-semibold text-[10px]">
                          {log.personType === 'LEARNER' ? 'LN' : 'ST'}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-900">
                            {log.personType === 'LEARNER' ? 'Learner' : 'Staff'} scan
                          </p>
                          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">
                            Ref: {log.personId}
                          </p>
                          {log.resultPayload?.message && <p className="mt-1 max-w-xs text-[9px] text-slate-400">{log.resultPayload.message}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-[10px] font-medium text-slate-600">{log.device?.name || 'Manual Upload'}</p>
                      <p className="mt-1 text-[9px] uppercase tracking-wider text-slate-400">{log.modality || 'UNKNOWN'}{log.offlineCaptured ? ' · OFFLINE SYNC' : ''}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-semibold uppercase tracking-widest ${getStatusStyle(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {log.status === 'FAILED' && (
                        <button 
                          onClick={() => handleProcess(log.id)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Retry Processing"
                        >
                          <Play size={16} />
                        </button>
                      )}
                      {log.status === 'FAILED' && log.errorMessage && (
                        <div className="group relative inline-block ml-2">
                          <AlertTriangle size={16} className="text-rose-500 cursor-help" />
                          <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-slate-900 text-white text-[9px] rounded-lg shadow-xl z-50">
                            {log.errorMessage}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-20 text-center">
                    <Database size={40} className="text-slate-100 mx-auto mb-4" />
                    <h4 className="text-slate-400 font-semibold uppercase tracking-widest leading-none">No Log Synchronization</h4>
                    <p className="text-[10px] text-slate-300 font-semibold uppercase tracking-widest mt-2">Observatory is clear. All packets addressed.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Placeholder */}
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest italic">
            Telemetry Feed: {total} total events captured
          </p>
          <div className="flex gap-2">
            <button 
              disabled={filters.page === 1}
              onClick={() => setFilters({...filters, page: filters.page - 1})}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-semibold uppercase tracking-widest hover:bg-slate-50 disabled:opacity-30"
            >
              Previous
            </button>
            <button 
              disabled={logs.length < filters.limit}
              onClick={() => setFilters({...filters, page: filters.page + 1})}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-semibold uppercase tracking-widest hover:bg-slate-50 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogViewer;
