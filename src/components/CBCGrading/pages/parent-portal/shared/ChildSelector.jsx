import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Shared child selector for parent portal screens.
 *
 * Props:
 *   children     — array of child objects { id, name, photoUrl/profilePicture/photo, grade, className, todayStatus, isPresent }
 *   selectedId   — currently selected child id
 *   onSelect     — callback(childId) when a child is selected
 *   variant      — "tabs" | "dropdown" | "pills"  (default: "tabs")
 *   showPresence — boolean, show presence dot (default: false)
 *   accentColor  — hex color for active state (default: "#3B1FA3")
 */

const getPhoto = (c) => c?.photoUrl || c?.profilePicture || c?.photo || null;
const getFirstName = (c) => (c?.name || '?').split(' ')[0];
const getInitial = (c) => (c?.name || '?')[0];

function Avatar({ child, size = 'sm', active, accent = '#3B1FA3' }) {
  const photo = getPhoto(child);
  const dims = size === 'sm' ? 'w-6 h-6' : size === 'md' ? 'w-7 h-7' : 'w-8 h-8';
  const fontSize = size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-sm';

  if (photo) {
    return <img src={photo} alt="" className={`${dims} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div
      className={`${dims} rounded-full flex items-center justify-center font-black ${fontSize} flex-shrink-0 ${
        active ? 'bg-white/20 text-white' : ''
      }`}
      style={active ? undefined : { backgroundColor: `${accent}1A`, color: accent }}
    >
      {getInitial(child)}
    </div>
  );
}

function PresenceDot({ child }) {
  const isPresent = child?.todayStatus === 'PRESENT' || child?.isPresent;
  return (
    <span
      className={`w-2 h-2 rounded-full flex-shrink-0 ${isPresent ? 'bg-emerald-400' : 'bg-gray-300'}`}
      aria-label={isPresent ? 'Present' : 'Not recorded'}
    />
  );
}

/* ─── Tab strip variant ─── */
function TabStrip({ children, selectedId, onSelect, showPresence, accent }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {children.map(child => {
        const active = child.id === selectedId;
        return (
          <button
            key={child.id}
            type="button"
            onClick={() => onSelect(child.id)}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={active ? { backgroundColor: accent, color: '#fff' } : undefined}
            {...(active ? {} : { className: 'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors bg-white border border-gray-200 text-gray-700' })}
          >
            <Avatar child={child} active={active} accent={accent} />
            <span className="truncate max-w-[80px]">{getFirstName(child)}</span>
            {showPresence && <PresenceDot child={child} />}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Dropdown variant ─── */
function Dropdown({ children, selectedId, onSelect, accent }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = children.find(c => c.id === selectedId) || children[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!selected) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-left shadow-sm w-full sm:w-auto"
      >
        <Avatar child={selected} size="md" accent={accent} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 truncate">{selected.name}</p>
          <p className="text-[10px] text-gray-500">{selected.grade || ''}{selected.grade && selected.className ? ' · ' : ''}{selected.className || ''}</p>
        </div>
        <ChevronDown size={14} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && children.length > 1 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {children.map(c => {
            const active = c.id === selectedId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => { onSelect(c.id); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50 ${active ? 'font-bold' : 'text-gray-700'}`}
                style={active ? { color: accent, backgroundColor: `${accent}0D` } : undefined}
              >
                <Avatar child={c} accent={accent} />
                <span className="truncate">{c.name}</span>
                <span className="text-[10px] text-gray-400 ml-auto">{c.grade || ''}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Pill buttons variant ─── */
function Pills({ children, selectedId, onSelect, accent }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {children.map(c => {
        const active = c.id === selectedId;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className="flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold border transition-colors"
            style={active ? { backgroundColor: accent, color: '#fff', borderColor: accent } : undefined}
            {...(active ? {} : { className: 'flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold border transition-colors bg-white text-gray-700 border-gray-200 hover:border-indigo-300' })}
          >
            {getFirstName(c)}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Main export ─── */
export default function ChildSelector({
  children = [],
  selectedId,
  onSelect,
  variant = 'tabs',
  showPresence = false,
  accentColor = '#3B1FA3',
}) {
  if (!children || children.length === 0) return null;
  if (children.length === 1) {
    // Single child — still show the selector so the parent sees who they're viewing
    const child = children[0];
    if (variant === 'pills') {
      return (
        <div className="flex gap-2">
          <span className="flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold border" style={{ backgroundColor: accentColor, color: '#fff', borderColor: accentColor }}>
            {getFirstName(child)}
          </span>
        </div>
      );
    }
    if (variant === 'dropdown') {
      return (
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm w-full sm:w-auto">
          <Avatar child={child} size="md" accent={accentColor} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900 truncate">{child.name}</p>
            <p className="text-[10px] text-gray-500">{child.grade || ''}{child.grade && child.className ? ' · ' : ''}{child.className || ''}</p>
          </div>
        </div>
      );
    }
    // tabs
    return (
      <div className="flex gap-2">
        <span className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: accentColor, color: '#fff' }}>
          <Avatar child={child} active accent={accentColor} />
          <span className="truncate max-w-[80px]">{getFirstName(child)}</span>
          {showPresence && <PresenceDot child={child} />}
        </span>
      </div>
    );
  }

  const props = { children, selectedId, onSelect, accent: accentColor };
  if (variant === 'dropdown') return <Dropdown {...props} />;
  if (variant === 'pills') return <Pills {...props} />;
  return <TabStrip {...props} showPresence={showPresence} />;
}
