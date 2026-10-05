import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRightLeft, Bus, CalendarDays, Check, Clock3, Loader2, RefreshCw, Repeat2 } from 'lucide-react';
import api from '../../../../services/api';

const WEEKDAYS = [
  { value: 1, short: 'Mon' }, { value: 2, short: 'Tue' }, { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' }, { value: 5, short: 'Fri' }, { value: 6, short: 'Sat' },
  { value: 0, short: 'Sun' },
];
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = () => localDate(new Date());
const dateAfter = (days) => localDate(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + days));
const nameOf = (user) => user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : '';
const tripVehicle = (trip) => trip.vehicle || trip.route?.vehicle || null;
const tripDriver = (trip) => trip.driver || tripVehicle(trip)?.driver || trip.route?.vehicle?.driver || null;

function StatusBadge({ status }) {
  const style = status === 'COMPLETED' ? 'bg-slate-100 text-slate-600' : status === 'IN_PROGRESS' ? 'bg-emerald-100 text-emerald-700' : status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800';
  const label = status === 'IN_PROGRESS' ? 'Running' : status === 'COMPLETED' ? 'Completed' : status === 'CANCELLED' ? 'Cancelled' : 'Scheduled';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{label}</span>;
}

export default function DriverRunPlanner() {
  const [routes, setRoutes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [notice, setNotice] = useState(null);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(() => dateAfter(14));
  const [filterRouteId, setFilterRouteId] = useState('');
  const [selectedRuns, setSelectedRuns] = useState([]);
  const [replacementVehicleId, setReplacementVehicleId] = useState('');
  const [replacementDriverId, setReplacementDriverId] = useState('');

  const [plan, setPlan] = useState(() => ({
    routeId: '', vehicleId: '', driverUserId: '', startDate: today(), endDate: dateAfter(30),
    directions: ['OUTBOUND', 'INBOUND'], daysOfWeek: [1, 2, 3, 4, 5], notes: '',
  }));

  const loadSetup = useCallback(async () => {
    try {
      const [routeResponse, vehicleResponse, driverResponse] = await Promise.all([
        api.transport.getRoutes(), api.transport.getVehicles(), api.users.getByRole('DRIVER'),
      ]);
      const nextRoutes = routeResponse?.data || [];
      setRoutes(nextRoutes);
      setVehicles(vehicleResponse?.data || []);
      setDrivers(driverResponse?.data || []);
      setPlan((current) => {
        if (current.routeId || !nextRoutes.length) return current;
        const route = nextRoutes[0];
        return { ...current, routeId: route.id, vehicleId: route.vehicleId || '', driverUserId: route.vehicle?.driverId || '' };
      });
    } catch (error) {
      setNotice({ type: 'error', text: error?.message || 'Could not load routes, vehicles, and driver accounts.' });
    }
  }, []);

  const loadRuns = useCallback(async () => {
    if (!fromDate || !toDate || toDate < fromDate) return;
    setLoading(true);
    try {
      const response = await api.transport.listRunTrips({ fromDate, toDate, routeId: filterRouteId || undefined });
      setTrips(response?.data || []);
      setSelectedRuns([]);
    } catch (error) {
      setNotice({ type: 'error', text: error?.message || 'Could not load runs for those dates.' });
    } finally {
      setLoading(false);
    }
  }, [filterRouteId, fromDate, toDate]);

  useEffect(() => { loadSetup(); }, [loadSetup]);
  useEffect(() => { loadRuns(); }, [loadRuns]);

  const selectedRoute = useMemo(() => routes.find((route) => route.id === plan.routeId), [routes, plan.routeId]);
  const visibleSelectableIds = trips.filter((trip) => trip.status === 'SCHEDULED').map((trip) => trip.id);
  const allSelected = visibleSelectableIds.length > 0 && visibleSelectableIds.every((id) => selectedRuns.includes(id));

  const changePlanRoute = (routeId) => {
    const route = routes.find((candidate) => candidate.id === routeId);
    const vehicleId = route?.vehicleId || '';
    const vehicle = vehicles.find((candidate) => candidate.id === vehicleId);
    setPlan((current) => ({ ...current, routeId, vehicleId, driverUserId: vehicle?.driverId || route?.vehicle?.driverId || '' }));
  };

  const changePlanVehicle = (vehicleId) => {
    const vehicle = vehicles.find((candidate) => candidate.id === vehicleId);
    setPlan((current) => ({ ...current, vehicleId, driverUserId: vehicle?.driverId || '' }));
  };

  const toggleValue = (key, value) => setPlan((current) => {
    const values = new Set(current[key]);
    if (values.has(value)) values.delete(value); else values.add(value);
    return { ...current, [key]: [...values] };
  });

  const submitPlan = async (event) => {
    event.preventDefault();
    if (!plan.routeId || !plan.vehicleId || !plan.startDate || !plan.endDate || plan.endDate < plan.startDate) {
      setNotice({ type: 'error', text: 'Choose a route, active vehicle, and valid date range.' });
      return;
    }
    setSavingPlan(true);
    setNotice(null);
    try {
      const response = await api.transport.createRunPlan({
        ...plan,
        driverUserId: plan.driverUserId || undefined,
      });
      const result = response?.data || {};
      setFromDate(plan.startDate);
      setToDate(plan.endDate > dateAfter(45) ? dateAfter(45) : plan.endDate);
      setFilterRouteId(plan.routeId);
      setNotice({ type: 'success', text: `Run plan saved. ${result.scheduled || 0} scheduled runs assigned; ${result.unchanged || 0} started or completed runs left unchanged.` });
    } catch (error) {
      setNotice({ type: 'error', text: error?.message || 'Could not create the run plan.' });
    } finally {
      setSavingPlan(false);
    }
  };

  const toggleRun = (tripId) => setSelectedRuns((current) => current.includes(tripId) ? current.filter((id) => id !== tripId) : [...current, tripId]);

  const reassignSelected = async () => {
    if (!selectedRuns.length || !replacementVehicleId) {
      setNotice({ type: 'error', text: 'Select scheduled runs and choose the replacement vehicle.' });
      return;
    }
    setSavingAssignment(true);
    setNotice(null);
    try {
      const data = { tripIds: selectedRuns, vehicleId: replacementVehicleId };
      if (replacementDriverId) data.driverUserId = replacementDriverId;
      const response = await api.transport.reassignRuns(data);
      setNotice({ type: 'success', text: `${response?.data?.updated || selectedRuns.length} selected runs reassigned. Their original route and student roster are unchanged.` });
      setReplacementVehicleId('');
      setReplacementDriverId('');
      await loadRuns();
    } catch (error) {
      setNotice({ type: 'error', text: error?.message || 'Could not reassign the selected runs.' });
    } finally {
      setSavingAssignment(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900"><Bus className="text-blue-600" /> Driver Run Planner</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Set a route’s weekly runs for a term or chosen date range. Daily trips are created together, and a broken vehicle can be replaced on one run or a selected group of future runs.</p>
        </div>
        <button type="button" onClick={() => { loadSetup(); loadRuns(); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw size={16} /> Refresh</button>
      </header>

      {notice && <div role="status" className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
        {notice.type === 'error' ? <AlertCircle size={18} className="mt-0.5 shrink-0" /> : <Check size={18} className="mt-0.5 shrink-0" />}{notice.text}
      </div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Repeat2 size={20} /></div>
          <div><h2 className="font-bold text-slate-900">Set a repeating run plan</h2><p className="mt-1 text-sm text-slate-600">Choose weekdays and directions once. We’ll create the dated trips for the selected period, rather than asking you to add them every morning.</p></div>
        </div>
        <form onSubmit={submitPlan} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-semibold text-slate-700">Route
              <select value={plan.routeId} onChange={(event) => changePlanRoute(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5 font-normal" required>
                <option value="">Choose route</option>{routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Vehicle
              <select value={plan.vehicleId} onChange={(event) => changePlanVehicle(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5 font-normal" required>
                <option value="">Choose vehicle</option>{vehicles.filter((vehicle) => vehicle.status === 'ACTIVE' && !vehicle.archived).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber} ({vehicle.capacity} seats)</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Driver account
              <select value={plan.driverUserId} onChange={(event) => setPlan((current) => ({ ...current, driverUserId: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5 font-normal">
                <option value="">Use the selected vehicle’s driver</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{nameOf(driver)}{driver.phone ? ` · ${driver.phone}` : ''}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Run days
              <span className="mt-1.5 flex flex-wrap gap-1.5">{WEEKDAYS.map((day) => <button key={day.value} type="button" onClick={() => toggleValue('daysOfWeek', day.value)} className={`rounded-md border px-2 py-1.5 text-xs ${plan.daysOfWeek.includes(day.value) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-600'}`}>{day.short}</button>)}</span>
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-semibold text-slate-700">From<input type="date" value={plan.startDate} onChange={(event) => setPlan((current) => ({ ...current, startDate: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5 font-normal" required /></label>
            <label className="text-sm font-semibold text-slate-700">Through<input type="date" value={plan.endDate} min={plan.startDate} onChange={(event) => setPlan((current) => ({ ...current, endDate: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5 font-normal" required /></label>
            <fieldset className="text-sm font-semibold text-slate-700"><legend>Directions</legend><div className="mt-2 flex flex-wrap gap-3">{[['OUTBOUND', 'Morning pickup'], ['INBOUND', 'Afternoon drop-off']].map(([value, label]) => <label key={value} className="flex items-center gap-2 font-normal"><input type="checkbox" checked={plan.directions.includes(value)} onChange={() => toggleValue('directions', value)} />{label}</label>)}</div></fieldset>
            <label className="text-sm font-semibold text-slate-700">Notes (optional)<input value={plan.notes} onChange={(event) => setPlan((current) => ({ ...current, notes: event.target.value }))} placeholder="e.g. Term 3 transport roster" className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5 font-normal" /></label>
          </div>
          {selectedRoute && <p className="text-xs text-slate-500">Students stay assigned to <strong>{selectedRoute.name}</strong>. This planner creates dated trips using that route’s existing roster. Limit: 370 days per plan.</p>}
          <button disabled={savingPlan} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{savingPlan ? <Loader2 size={17} className="animate-spin" /> : <CalendarDays size={17} />}{savingPlan ? 'Saving plan…' : 'Create runs for this period'}</button>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 p-5">
          <div><h2 className="font-bold text-slate-900">Scheduled runs</h2><p className="mt-1 text-sm text-slate-600">Select upcoming runs to reassign when a driver or vehicle is unavailable. Started runs are locked against accidental changes.</p></div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-slate-600">From<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 block rounded-md border border-slate-300 p-2 text-sm font-normal" /></label>
            <label className="text-xs font-semibold text-slate-600">Through<input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 block rounded-md border border-slate-300 p-2 text-sm font-normal" /></label>
            <label className="text-xs font-semibold text-slate-600">Route<select value={filterRouteId} onChange={(event) => setFilterRouteId(event.target.value)} className="mt-1 block min-w-36 rounded-md border border-slate-300 p-2 text-sm font-normal"><option value="">All routes</option>{routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}</select></label>
          </div>
        </div>

        {selectedRuns.length > 0 && <div className="flex flex-wrap items-end gap-3 border-b border-blue-100 bg-blue-50 p-4">
          <div className="mr-auto text-sm font-semibold text-blue-900"><ArrowRightLeft size={16} className="mr-1 inline" />Reassign {selectedRuns.length} scheduled run{selectedRuns.length === 1 ? '' : 's'}</div>
          <label className="text-xs font-semibold text-slate-600">Replacement vehicle<select value={replacementVehicleId} onChange={(event) => setReplacementVehicleId(event.target.value)} className="mt-1 block min-w-48 rounded-md border border-slate-300 bg-white p-2 text-sm font-normal"><option value="">Choose vehicle</option>{vehicles.filter((vehicle) => vehicle.status === 'ACTIVE' && !vehicle.archived).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber} ({vehicle.capacity} seats)</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Driver<select value={replacementDriverId} onChange={(event) => setReplacementDriverId(event.target.value)} className="mt-1 block min-w-48 rounded-md border border-slate-300 bg-white p-2 text-sm font-normal"><option value="">Use replacement vehicle’s driver</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{nameOf(driver)}{driver.phone ? ` · ${driver.phone}` : ''}</option>)}</select></label>
          <button disabled={savingAssignment || !replacementVehicleId} onClick={reassignSelected} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{savingAssignment && <Loader2 size={15} className="animate-spin" />}Apply change</button>
        </div>}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
              <th className="p-3"><input aria-label="Select all scheduled runs" type="checkbox" checked={allSelected} onChange={() => setSelectedRuns(allSelected ? [] : visibleSelectableIds)} /></th>
              <th className="p-3">Date</th><th className="p-3">Run</th><th className="p-3">Route</th><th className="p-3">Driver</th><th className="p-3">Vehicle</th><th className="p-3">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan="7" className="p-10 text-center text-slate-500"><Loader2 size={20} className="mx-auto mb-2 animate-spin" />Loading runs…</td></tr>
                : trips.length === 0 ? <tr><td colSpan="7" className="p-10 text-center text-slate-500"><CalendarDays size={24} className="mx-auto mb-2 text-slate-300" />No runs in this period. Create a plan above to generate them.</td></tr>
                  : trips.map((trip) => {
                    const vehicle = tripVehicle(trip);
                    const driver = tripDriver(trip);
                    const canSelect = trip.status === 'SCHEDULED';
                    return <tr key={trip.id} className="hover:bg-slate-50">
                      <td className="p-3"><input aria-label={`Select ${trip.route?.name || 'route'} run`} type="checkbox" disabled={!canSelect} checked={selectedRuns.includes(trip.id)} onChange={() => toggleRun(trip.id)} /></td>
                      <td className="whitespace-nowrap p-3 font-medium text-slate-800">{new Date(`${String(trip.date).slice(0, 10)}T00:00:00`).toLocaleDateString()}</td>
                      <td className="whitespace-nowrap p-3 text-slate-700"><span className="inline-flex items-center gap-1.5">{trip.direction === 'OUTBOUND' ? <Clock3 size={14} className="text-amber-600" /> : <Clock3 size={14} className="text-indigo-600" />}{trip.direction === 'OUTBOUND' ? 'Morning pickup' : 'Afternoon drop-off'}</span></td>
                      <td className="p-3 font-semibold text-slate-800">{trip.route?.name || 'Route'}</td>
                      <td className="p-3 text-slate-700">{nameOf(driver) || <span className="text-red-600">Unassigned</span>}{driver?.phone && <div className="text-xs text-slate-500">{driver.phone}</div>}</td>
                      <td className="p-3 text-slate-700">{vehicle?.registrationNumber || <span className="text-red-600">Unassigned</span>}</td>
                      <td className="p-3"><StatusBadge status={trip.status} /></td>
                    </tr>;
                  })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
