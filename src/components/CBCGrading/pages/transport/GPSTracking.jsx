import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bus, Clock, ExternalLink, Loader2, MapPin, Navigation, RefreshCw, Signal, Wifi, WifiOff } from 'lucide-react';
import api from '../../../../services/api';

const POLL_MS = 10000;

function ageLabel(location) {
  if (!location) return 'Waiting for phone GPS';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(location.receivedAt).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return 'Time unavailable';
  if (seconds < 60) return `Updated ${seconds}s ago`;
  return `Updated ${Math.floor(seconds / 60)}m ago`;
}

function mapUrl(location) {
  const lat = Number(location.latitude);
  const lon = Number(location.longitude);
  const padLat = 0.008;
  const padLon = 0.008 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const bbox = [lon - padLon, lat - padLat, lon + padLon, lat + padLat].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
}

function StatePill({ location }) {
  const live = location && Date.now() - new Date(location.receivedAt).getTime() <= 45000;
  const label = !location ? 'Waiting for GPS' : live ? 'Live' : 'Signal stale';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${live ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
      <span className={`h-2 w-2 rounded-full ${live ? 'animate-pulse bg-emerald-500' : 'bg-amber-500'}`} />{label}
    </span>
  );
}

function LiveRunRow({ run, selected, onSelect }) {
  const location = run.location;
  const speed = location?.speedMps == null ? null : Math.round(Number(location.speedMps) * 3.6);
  return (
    <button type="button" onClick={onSelect} className={`w-full rounded-xl border p-4 text-left transition ${selected ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="rounded-lg bg-indigo-100 p-2 text-indigo-700"><Bus size={19} /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">{run.vehicle?.registrationNumber || 'Vehicle not assigned'}</span>
              <StatePill location={location} />
            </div>
            <p className="mt-1 text-sm text-slate-600">{run.driverName || run.vehicle?.driverName || 'Driver'} · {run.routeName} · {run.direction === 'OUTBOUND' ? 'Morning' : 'Afternoon'}</p>
            <p className="mt-1 text-xs text-slate-500">{ageLabel(location)}{location?.accuracyMeters != null ? ` · ±${Math.round(location.accuracyMeters)} m` : ''}{speed != null ? ` · ${speed} km/h` : ''}</p>
          </div>
        </div>
        {location && <span className="text-xs text-blue-700">View map</span>}
      </div>
    </button>
  );
}

export default function GPSTracking() {
  const [runs, setRuns] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const locationResponse = await api.transport.getLiveDriverLocations();
      if (locationResponse?.success) {
        const nextRuns = Array.isArray(locationResponse.data) ? locationResponse.data : [];
        setRuns(nextRuns);
        setSelectedTripId((current) => nextRuns.some((run) => run.tripId === current)
          ? current
          : nextRuns.find((run) => run.location)?.tripId || nextRuns[0]?.tripId || null);
      }
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e?.message || 'Could not load live driver locations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
    const timer = window.setInterval(() => load(false), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const selectedRun = useMemo(() => runs.find((run) => run.tripId === selectedTripId) || null, [runs, selectedTripId]);
  const liveCount = runs.filter((run) => run.location && Date.now() - new Date(run.location.receivedAt).getTime() <= 45000).length;
  const selectedLocation = selectedRun?.location;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700"><Navigation size={15} /> Transport</div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Live Driver Tracking</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">The driver’s phone reports its position while a trip is active. Updates refresh every 10 seconds.</p>
        </div>
        <button onClick={() => load(true)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Refresh
        </button>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><div className="flex items-center gap-2 text-sm text-slate-500"><Bus size={17} /> Active trips</div><p className="mt-2 text-3xl font-bold text-slate-900">{runs.length}</p></div>
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><div className="flex items-center gap-2 text-sm text-slate-500"><Wifi size={17} /> Live phone signals</div><p className="mt-2 text-3xl font-bold text-emerald-700">{liveCount}</p></div>
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><div className="flex items-center gap-2 text-sm text-slate-500"><WifiOff size={17} /> Waiting or stale</div><p className="mt-2 text-3xl font-bold text-amber-700">{runs.length - liveCount}</p></div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div><h2 className="font-semibold text-slate-900">Active runs</h2><p className="text-xs text-slate-500">{lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : 'Loading locations…'}</p></div>
            <Signal size={18} className="text-blue-600" />
          </div>
          <div className="space-y-3 p-4">
            {loading && runs.length === 0 ? <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" /> Loading active trips…</div>
              : runs.length === 0 ? <div className="py-12 text-center"><Bus size={30} className="mx-auto text-slate-300" /><p className="mt-3 font-medium text-slate-700">No active trips</p><p className="mt-1 text-sm text-slate-500">A driver’s run appears here after they start it in the app.</p></div>
                : runs.map((run) => <LiveRunRow key={run.tripId} run={run} selected={run.tripId === selectedTripId} onSelect={() => setSelectedTripId(run.tripId)} />)}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Vehicle position</h2><p className="text-xs text-slate-500">{selectedRun ? `${selectedRun.vehicle?.registrationNumber || 'Vehicle'} · ${selectedRun.routeName}` : 'Select an active driver'}</p></div>
          {selectedLocation ? <>
            <iframe title="Selected active vehicle location" src={mapUrl(selectedLocation)} className="h-72 w-full border-0" loading="lazy" referrerPolicy="no-referrer" />
            <div className="space-y-3 p-4">
              <div className="flex items-start gap-2 text-sm text-slate-700"><MapPin size={17} className="mt-0.5 shrink-0 text-blue-600" /><span>{Number(selectedLocation.latitude).toFixed(6)}, {Number(selectedLocation.longitude).toFixed(6)}<span className="block text-xs text-slate-500">{ageLabel(selectedLocation)}</span></span></div>
              <a href={`https://www.google.com/maps/search/?api=1&query=${selectedLocation.latitude},${selectedLocation.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"><ExternalLink size={15} /> Open in Google Maps</a>
            </div>
          </> : <div className="flex h-72 flex-col items-center justify-center px-6 text-center text-slate-500"><Clock size={32} className="text-amber-500" /><p className="mt-3 font-medium text-slate-800">Waiting for the phone’s first GPS update</p><p className="mt-1 text-sm">The driver must allow location access, turn on Location, and keep the trip active.</p></div>}
        </section>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">Location sharing and privacy</p>
        <p className="mt-1 text-blue-800">The driver starts sharing by starting a trip. Android shows an ongoing notification while tracking. The live point is cleared when the trip is completed or cancelled.</p>
      </div>
    </div>
  );
}
