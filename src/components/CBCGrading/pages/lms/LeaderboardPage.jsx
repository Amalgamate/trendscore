/**
 * LeaderboardPage — School-wide XP leaderboard
 *
 * Reads GET /api/lms/analytics/leaderboard, ranked by total achievement XP.
 * Highlights the authenticated learner's own row when present.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Trophy, RefreshCw, Medal } from 'lucide-react';
import { lmsAPI } from '../../../../services/api';
import { usePermissions } from '../../../../hooks/usePermissions';
import { Skeleton } from '../../../ui';

const RANK_STYLES = {
  1: 'bg-amber-100 text-amber-700 border-amber-200',
  2: 'bg-slate-100 text-slate-600 border-slate-200',
  3: 'bg-orange-100 text-orange-700 border-orange-200',
};

function RankBadge({ rank }) {
  const style = RANK_STYLES[rank] || 'bg-slate-50 text-slate-500 border-slate-100';
  return (
    <div className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold text-sm flex-shrink-0 ${style}`}>
      {rank <= 3 ? <Medal size={16} /> : rank}
    </div>
  );
}

export function LeaderboardList() {
  const { user } = usePermissions();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await lmsAPI.getLeaderboard({ limit: 25 });
      setEntries(res?.data?.entries || []);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
      setError('Failed to load the leaderboard. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Best-effort match to highlight the current learner's row (by admission number in username)
  const currentUsername = user?.username;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="p-4 border border-rose-200 rounded-lg bg-rose-50 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="p-10 border border-dashed border-slate-200 rounded-lg text-center bg-slate-50">
          <Trophy size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No XP earned yet this term</p>
          <p className="text-xs text-slate-400 mt-1">Complete lessons and assignments to appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isSelf = currentUsername && entry.admissionNumber === currentUsername;
            return (
              <div
                key={entry.learnerId}
                className={`flex items-center gap-3 p-3 rounded-lg border bg-white ${
                  isSelf ? 'border-[#ff7900]/50 ring-1 ring-[#ff7900]/30' : 'border-slate-100'
                }`}
              >
                <RankBadge rank={entry.rank} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {entry.name}
                    {isSelf && <span className="ml-2 text-xs font-medium text-[#ff7900]">(You)</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {[entry.grade, entry.stream].filter(Boolean).join(' • ') || 'Learner'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{entry.xp}</p>
                  <p className="text-xs text-slate-400">XP</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function LeaderboardPage({ onNavigate }) {
  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('learning-dashboard')}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to Learning
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-[#ff7900]/10 text-[#ff7900] flex items-center justify-center">
          <Trophy size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Leaderboard</h1>
          <p className="text-sm text-slate-500">Top learners ranked by XP earned this term</p>
        </div>
      </div>

      <LeaderboardList />
    </div>
  );
}
