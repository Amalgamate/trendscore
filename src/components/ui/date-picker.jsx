/**
 * DatePicker — single source of truth for all date inputs.
 *
 * Props
 * ─────
 * value        : string (YYYY-MM-DD) | Date | null
 * onChange     : (isoString: string) => void   — always emits YYYY-MM-DD
 * label        : string
 * placeholder  : string
 * required     : bool
 * disabled     : bool
 * error        : string | null
 * className    : string  (outer wrapper)
 * disableFuture / disablePast : bool
 * fromYear / toYear           : number
 *
 * Built with a hand-rolled grid — no DayPicker classNames quirks.
 */

import * as React from 'react';
import { format, isValid, parseISO, startOfMonth, endOfMonth,
         startOfWeek, endOfWeek, addDays, addMonths, subMonths,
         isSameMonth, isSameDay, isAfter, isBefore, isToday } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '../../utils/cn';

/* ─── close-on-outside-click hook ───────────────────────────────────────────── */
function useOutsideClick(cb) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) cb(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cb]);
  return ref;
}

/* ─── value helpers ─────────────────────────────────────────────────────────── */
function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isValid(v) ? v : null;
  if (typeof v === 'string') { const d = parseISO(v); return isValid(d) ? d : null; }
  return null;
}
function toISO(d) { return d && isValid(d) ? format(d, 'yyyy-MM-dd') : ''; }

/* ─── build calendar grid (42 cells = 6 rows × 7 cols) ─────────────────────── */
function buildGrid(month) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 }); // Sun
  const end   = endOfWeek(endOfMonth(month),     { weekStartsOn: 0 });
  const days  = [];
  let cur = start;
  while (cur <= end) { days.push(cur); cur = addDays(cur, 1); }
  return days;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

/* ─── Calendar panel ────────────────────────────────────────────────────────── */
function CalendarPanel({ selected, month, onMonthChange, onSelect,
                          disableFuture, disablePast, fromYear, toYear }) {
  const today   = new Date();
  const grid    = buildGrid(month);
  const curYear = month.getFullYear();
  const curMon  = month.getMonth();

  const years = React.useMemo(() => {
    const s = fromYear ?? 1920;
    const e = toYear   ?? today.getFullYear() + 10;
    return Array.from({ length: e - s + 1 }, (_, i) => s + i);
  }, [fromYear, toYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const setMonth = (m) => { const d = new Date(month); d.setMonth(m); onMonthChange(d); };
  const setYear  = (y) => { const d = new Date(month); d.setFullYear(y); onMonthChange(d); };

  const isDisabled = (d) => {
    if (disableFuture && isAfter(d, today))  return true;
    if (disablePast  && isBefore(d, today))  return true;
    return false;
  };

  return (
    <div className="p-3 w-[280px]">
      {/* ── Navigation header ── */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => onMonthChange(subMonths(month, 1))}
          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={15} />
        </button>

        <div className="flex items-center gap-1">
          {/* Month selector */}
          <select
            value={curMon}
            onChange={(e) => setMonth(Number(e.target.value))}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold text-gray-800 bg-transparent border-0 outline-none cursor-pointer rounded px-1 hover:bg-gray-100 transition-colors appearance-none"
            aria-label="Select month"
          >
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          {/* Year selector */}
          <select
            value={curYear}
            onChange={(e) => setYear(Number(e.target.value))}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold text-gray-800 bg-transparent border-0 outline-none cursor-pointer rounded px-1 hover:bg-gray-100 transition-colors appearance-none"
            aria-label="Select year"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* ── Day-of-week headers ── */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="h-8 flex items-center justify-center text-[11px] font-semibold text-gray-400">
            {d}
          </div>
        ))}
      </div>

      {/* ── Date grid ── */}
      <div className="grid grid-cols-7">
        {grid.map((day, i) => {
          const outside  = !isSameMonth(day, month);
          const sel      = selected && isSameDay(day, selected);
          const todayDay = isToday(day);
          const disabled = isDisabled(day);

          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onSelect(day)}
              className={cn(
                'h-9 w-full flex items-center justify-center rounded-full text-sm transition-colors',
                sel
                  ? 'bg-brand-purple text-white font-semibold'
                  : todayDay
                  ? 'font-bold text-brand-purple hover:bg-brand-purple/10'
                  : outside
                  ? 'text-gray-300 hover:bg-gray-50'
                  : disabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100',
              )}
              aria-label={format(day, 'PPP')}
              aria-pressed={sel}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main DatePicker ────────────────────────────────────────────────────────── */
export function DatePicker({
  value,
  onChange,
  label,
  placeholder = 'Select date',
  required   = false,
  disabled   = false,
  error,
  className,
  disableFuture = false,
  disablePast   = false,
  fromYear,
  toYear,
}) {
  const selected = toDate(value);
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState(selected ?? new Date());

  // Sync calendar month when value changes externally
  React.useEffect(() => {
    const d = toDate(value);
    if (d) setMonth(d);
  }, [value]); // eslint-disable-line

  const close = React.useCallback(() => setOpen(false), []);
  const containerRef = useOutsideClick(close);

  const handleSelect = (day) => {
    onChange(toISO(day));
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      {/* Label */}
      {label && (
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-tight mb-1">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border rounded-md text-sm transition-all focus:outline-none focus:ring-1',
          error
            ? 'border-red-400 bg-red-50 focus:ring-red-400'
            : open
            ? 'border-brand-purple ring-1 ring-brand-purple'
            : 'border-gray-200 hover:border-gray-300 focus:ring-brand-purple focus:border-brand-purple',
          disabled && 'opacity-50 cursor-not-allowed bg-gray-50',
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={cn('flex items-center gap-2 min-w-0', !selected && 'text-gray-400')}>
          <CalendarDays size={15} className={cn('flex-shrink-0', selected ? 'text-brand-purple' : 'text-gray-400')} />
          <span className={selected ? 'font-medium text-gray-800' : ''}>
            {selected ? format(selected, 'dd MMM yyyy') : placeholder}
          </span>
        </span>
        {selected && !disabled && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear date"
            onClick={handleClear}
            onKeyDown={(e) => e.key === 'Enter' && handleClear(e)}
            className="flex-shrink-0 p-0.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={13} />
          </span>
        )}
      </button>

      {/* Error */}
      {error && <p className="text-xs text-red-500 font-semibold mt-1">{error}</p>}

      {/* Popover */}
      {open && (
        <div className="absolute z-50 mt-1.5 left-0 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
          <CalendarPanel
            selected={selected}
            month={month}
            onMonthChange={setMonth}
            onSelect={handleSelect}
            disableFuture={disableFuture}
            disablePast={disablePast}
            fromYear={fromYear}
            toYear={toYear}
          />
        </div>
      )}
    </div>
  );
}
