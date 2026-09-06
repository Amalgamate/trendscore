import { useEffect, useState } from 'react';
import { Check, Loader2, MessageSquarePlus, X } from 'lucide-react';
import api from '../../../../services/api';
import { usePermissions } from '../../../../hooks/usePermissions';

const STATUS_BADGE = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200'
};

const userName = (user) => [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Unknown';

/** Review inbox for timetable change requests. EDIT_TIMETABLE users review and
 *  approve/reject; other timetable viewers (teachers/tutors) see the status of
 *  their own submissions. */
const TimetableChangeRequests = ({ open, onClose }) => {
  const { can } = usePermissions();
  const canReview = can('EDIT_TIMETABLE');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [busyId, setBusyId] = useState(null);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.timetable.listChangeRequests(statusFilter || undefined);
      const payload = response.data || {};
      setRequests(payload.requests || []);
      setHasMore(Boolean(payload.hasMore));
      setNextCursor(payload.nextCursor || null);
    } catch (err) {
      console.error('Failed to load change requests:', err);
      setError(err.message || 'Failed to load change requests');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await api.timetable.listChangeRequests(statusFilter || undefined, { cursor: nextCursor });
      const payload = response.data || {};
      setRequests(prev => [...prev, ...(payload.requests || [])]);
      setHasMore(Boolean(payload.hasMore));
      setNextCursor(payload.nextCursor || null);
    } catch (err) {
      console.error('Failed to load more change requests:', err);
      setError(err.message || 'Failed to load more change requests');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => { if (open) load(); }, [open, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const review = async (requestId, action) => {
    setBusyId(requestId);
    setError('');
    try {
      const caller = action === 'approve' ? api.timetable.approveChangeRequest : api.timetable.rejectChangeRequest;
      await caller(requestId, notes[requestId] || undefined);
      await load();
    } catch (err) {
      console.error(`Failed to ${action} change request:`, err);
      setError(err.message || `Failed to ${action} change request`);
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/35 backdrop-blur-sm flex justify-end" role="dialog" aria-modal="true" aria-label="Timetable change requests">
      <div className="w-full max-w-2xl h-full bg-[#f6f8fc] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-5 sm:px-7 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Timetable</p>
            <h2 className="text-xl font-semibold text-gray-900">
              {canReview ? 'Change requests' : 'My change requests'}
            </h2>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-gray-900"><X size={19} /></button>
        </div>

        {/* Filter */}
        <div className="px-5 sm:px-7 py-3 bg-white border-b border-gray-200 flex items-center gap-2">
          {['PENDING', 'APPROVED', 'REJECTED', ''].map(status => (
            <button key={status || 'all'} onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${statusFilter === status ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}>
              {status || 'All'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-4">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3">{error}</div>}
          {loading ? (
            <div className="h-48 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>
          ) : requests.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
              <MessageSquarePlus className="mx-auto text-gray-300" size={40} />
              <p className="mt-3 text-sm font-semibold text-gray-600">No {statusFilter ? statusFilter.toLowerCase() : ''} change requests</p>
              <p className="text-xs text-gray-400 mt-1">
                {canReview ? 'Requests submitted by teachers and tutors will appear here.' : 'Requests you submit from a class schedule will appear here.'}
              </p>
            </div>
          ) : requests.map(request => (
            <div key={request.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{request.class?.name || 'Class'}</p>
                  <p className="text-sm text-gray-500">
                    {request.day} · {request.startTime}–{request.endTime}
                    {request.learningArea ? ` · ${request.learningArea.name}` : ''}
                    {request.teacher ? ` · ${userName(request.teacher)}` : ''}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_BADGE[request.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {request.status}
                </span>
              </div>
              <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">“{request.reason}”</p>
              <p className="text-xs text-gray-400">
                Requested by {userName(request.requestedBy)}{request.reviewedBy ? ` · Reviewed by ${userName(request.reviewedBy)}` : ''}
              </p>
              {request.reviewNote && <p className="text-xs text-gray-600">Note: {request.reviewNote}</p>}

              {canReview && request.status === 'PENDING' && (
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <input
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Optional review note"
                    value={notes[request.id] || ''}
                    onChange={e => setNotes({ ...notes, [request.id]: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => review(request.id, 'approve')}
                      disabled={busyId === request.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {busyId === request.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve & apply
                    </button>
                    <button
                      onClick={() => review(request.id, 'reject')}
                      disabled={busyId === request.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
              >
                {loadingMore ? <Loader2 size={14} className="animate-spin" /> : null}
                Load more
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimetableChangeRequests;
