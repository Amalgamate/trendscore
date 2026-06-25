/**
 * Parent Portal Transport Screen
 * Shows each child's school transport route, vehicle and driver info.
 * Data: dashboardAPI.getParentMetrics() for children, then
 *       api.transport.getLearnerAssignments(childId) per child for route detail.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, MapPin, Bus, Phone, RefreshCw, AlertCircle, Navigation, Users,
} from 'lucide-react';
import api, { dashboardAPI } from '../../../../services/api';

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />;
}

function fmtMoney(n) {
  const v = Number(n || 0);
  return `KES ${v.toLocaleString()}`;
}

const getChildPhoto = (child) => child?.photoUrl || child?.profilePicture || child?.photo || child?.imageUrl || null;

// ─── Child transport card ───────────────────────────────────────────────────

function ChildTransportCard({ child }) {
  const assignment = child.transport;
  const route = assignment?.route;
  const vehicle = route?.vehicle;
  const photoSrc = getChildPhoto(child);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg, #7c3aed, #a78bfa)' }} />
      <div className="p-4">
        {/* Child header */}
        <div className="flex items-center gap-3 mb-3">
          {photoSrc ? (
            <img
              src={photoSrc}
              alt={child.name}
              className="w-10 h-10 rounded-full object-cover border border-blue-500 shadow-sm flex-shrink-0"
              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
            />
          ) : null}
          <div
            style={{ display: photoSrc ? 'none' : 'flex' }}
            className="w-10 h-10 rounded-full bg-purple-50 border border-blue-500 text-purple-700 font-bold text-sm items-center justify-center flex-shrink-0"
          >
            {child.name?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{child.name}</p>
            <p className="text-xs text-gray-500">{child.grade}</p>
          </div>
          {route && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 flex-shrink-0">
              On Transport
            </span>
          )}
        </div>

        {!route ? (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-5 text-center">
            <MapPin size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-xs font-semibold text-gray-600">Not using school transport</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Contact the school office to enrol this child on a route.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Route info */}
            <div className="bg-purple-50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Bus size={14} className="text-purple-700" />
                <p className="text-sm font-bold text-purple-900">{route.name}</p>
              </div>
              {route.description && (
                <p className="text-xs text-purple-700/80 mb-1">{route.description}</p>
              )}
              {Number(route.amount) > 0 && (
                <p className="text-[11px] text-purple-700/70">Fee: {fmtMoney(route.amount)} / term</p>
              )}
            </div>

            {/* Pickup / dropoff */}
            {(assignment.pickupPoint || assignment.dropoffPoint) && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Pickup</p>
                  <p className="text-xs font-semibold text-gray-800">{assignment.pickupPoint || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Drop-off</p>
                  <p className="text-xs font-semibold text-gray-800">{assignment.dropoffPoint || '—'}</p>
                </div>
              </div>
            )}

            {/* Vehicle / driver */}
            {vehicle && (
              <div className="flex items-center gap-3 border border-gray-100 rounded-xl p-3">
                <div className="p-2 rounded-lg bg-gray-100 text-gray-600 flex-shrink-0">
                  <Navigation size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900">{vehicle.registrationNumber}</p>
                  <p className="text-[11px] text-gray-500 truncate">Driver: {vehicle.driverName}</p>
                </div>
                {vehicle.driverPhone && (
                  <a
                    href={`tel:${vehicle.driverPhone}`}
                    className="p-2 rounded-lg bg-emerald-50 text-emerald-700 flex-shrink-0"
                    aria-label={`Call driver ${vehicle.driverName}`}
                  >
                    <Phone size={15} />
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

const ParentPortalTransport = ({ onNavigate }) => {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardAPI.getParentMetrics();
      if (!res?.success) {
        setError(res?.message || 'Failed to load children');
        setChildren([]);
        return;
      }
      const kids = res.data?.children || [];

      const withTransport = await Promise.all(
        kids.map(async (child) => {
          try {
            const r = await api.transport.getLearnerAssignments(child.id);
            const assignments = r?.data || [];
            return { ...child, transport: assignments[0] || null };
          } catch {
            return { ...child, transport: null };
          }
        })
      );

      setChildren(withTransport);
    } catch (e) {
      setError(e?.message || 'Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => onNavigate('parent-portal-more')}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">Transport</h1>
            <p className="text-[10px] text-gray-500">Bus routes & schedules</p>
          </div>
          <button
            type="button"
            onClick={load}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4 space-y-3">
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-600 flex-shrink-0" />
            <p className="text-xs text-rose-700 flex-1">{error}</p>
            <button type="button" onClick={load} className="text-[10px] text-rose-600 font-bold underline">Retry</button>
          </div>
        )}

        {loading ? (
          [1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ))
        ) : children.length > 0 ? (
          children.map((child) => <ChildTransportCard key={child.id} child={child} />)
        ) : (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
            <Users size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-semibold text-gray-700 mb-1">No children linked</p>
            <p className="text-xs text-gray-400">Contact your school to link your children to this account.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentPortalTransport;
