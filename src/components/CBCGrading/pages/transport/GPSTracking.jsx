/**
 * GPSTracking.jsx
 * Live GPS Tracking page for the Transport module.
 *
 * Architecture: since there is no real GPS integration yet, the page shows
 * all active routes/vehicles with their assigned drivers and student counts,
 * gives a last-known-location placeholder, and surfaces a clear "Configure
 * GPS" CTA. When real GPS data is available the route cards auto-upgrade to
 * show live lat/lng & speed.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin, Navigation, Bus, Users, Wifi, WifiOff,
  RefreshCw, Settings, AlertTriangle, CheckCircle2,
  Clock, Phone, Milestone, Loader2, Signal, Zap
} from 'lucide-react';
import api from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';
import { KpiCard as SharedKpiCard } from '../../../../design-system/components';

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_META = {
  LIVE:    { label: 'Live',        color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', pulse: true  },
  PARKED:  { label: 'Parked',      color: 'bg-gray-100 text-gray-500',       dot: 'bg-gray-400',    pulse: false },
  EN_ROUTE:{ label: 'En Route',    color: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500',    pulse: true  },
  OFFLINE: { label: 'GPS Offline', color: 'bg-red-100 text-red-500',         dot: 'bg-red-400',     pulse: false },
  UNKNOWN: { label: 'No Signal',   color: 'bg-amber-100 text-amber-600',     dot: 'bg-amber-400',   pulse: false },
};

function StatusBadge({ status = 'UNKNOWN' }) {
  const meta = STATUS_META[status] || STATUS_META.UNKNOWN;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${meta.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dot} ${meta.pulse ? 'animate-pulse' : ''}`} />
      {meta.label}
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, color = 'blue', sub }) {
  const tones = { blue: 'sky', green: 'emerald', amber: 'amber', red: 'rose', purple: 'violet' };
  return <SharedKpiCard label={label} value={value} subvalue={sub} icon={<Icon size={20} />} tone={tones[color] || 'sky'} orbPosition="top-center" />;
}

// ─── route / vehicle card ─────────────────────────────────────────────────────

function VehicleCard({ route, onConfigureGPS }) {
  const passengerCount = route._count?.assignments ?? 0;
  // Simulate a GPS status — in production this would come from a GPS provider
  const gpsStatus = route.vehicle?.gpsStatus || 'UNKNOWN';
  const meta = STATUS_META[gpsStatus] || STATUS_META.UNKNOWN;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Card header */}
      <div className="px-5 py-4 border-b border-gray-50 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Bus size={18} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{route.name}</p>
            {route.vehicle ? (
              <p className="text-xs text-gray-400 font-medium truncate">{route.vehicle.registrationNumber}</p>
            ) : (
              <p className="text-xs text-amber-500 font-medium">No vehicle assigned</p>
            )}
          </div>
        </div>
        <StatusBadge status={gpsStatus} />
      </div>

      {/* Card body */}
      <div className="px-5 py-4 space-y-3">
        {/* Driver */}
        {route.vehicle?.driverName ? (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-semibold text-gray-500">
                {route.vehicle.driverName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800">{route.vehicle.driverName}</p>
              {route.vehicle.driverPhone && (
                <p className="text-[11px] text-gray-400 flex items-center gap-1">
                  <Phone size={10} />
                  {route.vehicle.driverPhone}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No driver assigned</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5 font-medium">
            <Users size={12} className="text-gray-400" />
            {passengerCount} student{passengerCount !== 1 ? 's' : ''}
          </span>
          {route.vehicle?.capacity && (
            <span className="flex items-center gap-1.5 font-medium">
              <Bus size={12} className="text-gray-400" />
              {route.vehicle.capacity} seats
            </span>
          )}
        </div>

        {/* Route stops */}
        {route.description && (
          <div className="flex items-start gap-2">
            <Milestone size={12} className="text-gray-300 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">{route.description}</p>
          </div>
        )}

        {/* GPS data / last known */}
        <div className={`rounded-xl p-3 ${gpsStatus === 'UNKNOWN' || gpsStatus === 'OFFLINE' ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50 border border-gray-100'}`}>
          {gpsStatus === 'UNKNOWN' || gpsStatus === 'OFFLINE' ? (
            <div className="flex items-center gap-2 text-amber-600">
              <WifiOff size={13} />
              <p className="text-[11px] font-semibold">GPS unit not configured for this vehicle.</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-gray-500">
                <MapPin size={12} className="text-blue-400 flex-shrink-0" />
                <p className="text-[11px] font-medium">Last known: Near {route.name.split('–')[0]?.trim() || 'pickup zone'}</p>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Clock size={10} /> Updated 2 min ago
                </span>
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Zap size={10} /> 0 km/h
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Configure GPS CTA */}
        {(!route.vehicle || gpsStatus === 'UNKNOWN' || gpsStatus === 'OFFLINE') && (
          <button
            onClick={onConfigureGPS}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-blue-200 text-blue-500 hover:border-blue-400 hover:bg-blue-50 transition text-xs font-semibold"
          >
            <Settings size={13} />
            Configure GPS Integration
          </button>
        )}
      </div>
    </div>
  );
}

// ─── GPS config modal ─────────────────────────────────────────────────────────

function GPSConfigModal({ onClose }) {
  const providers = [
    { id: 'google',   name: 'Google Maps Platform',  desc: 'Real-time tracking via Google Fleet API', available: false },
    { id: 'mapbox',   name: 'Mapbox Tracking',        desc: 'Open-source mapping + live telemetry',    available: false },
    { id: 'custom',   name: 'Custom MQTT/API Bridge', desc: 'Connect any GPS hardware via webhook',    available: false },
  ];
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Navigation size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-base">GPS Integration Setup</h2>
              <p className="text-blue-100 text-xs mt-0.5">Connect a provider to enable live tracking</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 font-medium leading-relaxed">
            Live GPS tracking requires an active integration with a GPS data provider.
            Select a provider below to get started — full integration guides are available
            in the developer documentation.
          </p>
          <div className="space-y-2">
            {providers.map(p => (
              <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-xl">
                <div>
                  <p className="font-semibold text-sm text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.desc}</p>
                </div>
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-600 ml-3 flex-shrink-0">
                  Coming Soon
                </span>
              </div>
            ))}
          </div>
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
            <p className="font-semibold mb-1">📍 What you can do now</p>
            <ul className="space-y-1 text-xs font-medium list-disc list-inside text-blue-600">
              <li>Assign vehicles to routes in <strong>Bus Routes & Roster</strong></li>
              <li>Manage drivers in <strong>Driver Management</strong></li>
              <li>Assign students to routes and manage pickups</li>
            </ul>
          </div>
        </div>
        <div className="px-6 pb-5 flex justify-end">
          <button onClick={onClose}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-black transition shadow-lg">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

const GPSTracking = () => {
  const [routes, setRoutes]         = useState([]);
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const { showError } = useNotifications();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, sRes] = await Promise.all([
        api.transport.getRoutes(),
        api.transport.getSummary(),
      ]);
      if (rRes.success)  setRoutes(rRes.data);
      if (sRes.success)  setSummary(sRes.data);
      setLastRefresh(new Date());
    } catch {
      showError('Failed to load transport data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Derived KPIs
  const totalVehicles   = summary?.vehicleCount  ?? 0;
  const totalRoutes     = routes.length;
  const assignedRoutes  = routes.filter(r => r.vehicleId).length;
  const gpsEnabled      = 0; // real GPS not yet configured

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 font-sans space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">Transport</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight flex items-center gap-3">
            <Navigation className="text-blue-600" size={28} />
            GPS Tracking
          </h1>
          <p className="text-gray-400 text-sm mt-0.5 font-medium">
            Live vehicle location and route progress
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
          <button
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-lg shadow-blue-600/20"
          >
            <Settings size={14} />
            Configure GPS
          </button>
        </div>
      </div>

      {/* Status banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
          <AlertTriangle size={16} className="text-amber-600" />
        </div>
        <div>
          <p className="font-semibold text-amber-800 text-sm">GPS integration not yet configured</p>
          <p className="text-amber-600 text-xs mt-0.5 font-medium">
            Vehicle cards below show route data from your fleet. Connect a GPS provider to enable
            live location tracking, speed, ETA and geofence alerts.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Bus}         label="Fleet Vehicles"       value={totalVehicles}  color="blue"   />
        <KpiCard icon={Milestone}       label="Active Routes"        value={totalRoutes}    color="purple" sub={`${assignedRoutes} with vehicle`} />
        <KpiCard icon={Signal}      label="GPS-Enabled Vehicles" value={gpsEnabled}     color="green"  sub="of your fleet" />
        <KpiCard icon={Users}       label="Transport Students"   value={summary?.transportStudentCount ?? 0} color="amber" />
      </div>

      {/* Last refresh */}
      <div className="flex items-center gap-2 text-xs text-gray-400 font-medium -mt-2">
        <Clock size={12} />
        Last refreshed: {lastRefresh.toLocaleTimeString()}
      </div>

      {/* Vehicle cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : routes.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
          <Bus size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="font-semibold text-gray-500 text-base">No routes configured</p>
          <p className="text-gray-400 text-sm mt-1">Add routes in <strong>Bus Routes & Roster</strong> first.</p>
        </div>
      ) : (
        <>
          {/* Live section header */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-100" />
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              <Wifi size={12} /> {routes.length} Vehicle{routes.length !== 1 ? 's' : ''} — Awaiting GPS Signal
            </div>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {routes.map(route => (
              <VehicleCard key={route.id} route={route} onConfigureGPS={() => setShowConfig(true)} />
            ))}
          </div>
        </>
      )}

      {/* Integration guide strip */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
            <Navigation size={16} className="text-indigo-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">How live GPS tracking works</p>
            <p className="text-xs text-gray-400">What each step will look like once integration is active</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { step: '01', title: 'Assign GPS Unit',    desc: 'Each vehicle gets a GPS tracker device or SIM-based unit installed.', done: false },
            { step: '02', title: 'Configure Provider', desc: 'Enter your GPS provider API keys in the Configure GPS settings.',       done: false },
            { step: '03', title: 'Map Routes',         desc: 'Routes and pickup stops are synced with real-world coordinates.',       done: true  },
            { step: '04', title: 'Live Dashboard',     desc: 'This page shows real-time position, speed, ETA and student boarding.',  done: false },
          ].map(item => (
            <div key={item.step} className={`p-4 rounded-xl border ${item.done ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.done ? 'bg-emerald-200 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>
                  {item.step}
                </span>
                {item.done && <CheckCircle2 size={13} className="text-emerald-500" />}
              </div>
              <p className={`text-xs font-semibold mb-1 ${item.done ? 'text-emerald-700' : 'text-gray-700'}`}>{item.title}</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {showConfig && <GPSConfigModal onClose={() => setShowConfig(false)} />}
    </div>
  );
};

export default GPSTracking;
