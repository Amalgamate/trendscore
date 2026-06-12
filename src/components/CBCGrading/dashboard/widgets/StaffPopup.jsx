/**
 * StaffPopup — unified staff list popup used by all dashboard cards.
 *
 * Modes:
 *   'grouped'  — users passed in as prop, grouped by role (Administration, Subordinate Staff)
 *   'attendance' — fetches HR attendance report for today, filters by status (Tutors card)
 *
 * Contact actions per row: Call · SMS · WhatsApp
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  X, Search, Users, Shield, Loader2, AlertCircle,
  Phone, MessageSquare, PhoneCall,
} from 'lucide-react';
import { hrAPI, userAPI } from '../../../../services/api';

// ── helpers ──────────────────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().split('T')[0];

const getInitials = (first = '', last = '') =>
  `${(first[0] || '').toUpperCase()}${(last[0] || '').toUpperCase()}` || '?';

const ROLE_META = {
  // Admin tier
  SUPER_ADMIN:        { label: 'Super Admin',        color: 'bg-red-100    text-red-700'    },
  ADMIN:              { label: 'Admin',               color: 'bg-purple-100 text-purple-700' },
  HEAD_TEACHER:       { label: 'Head Teacher',        color: 'bg-indigo-100 text-indigo-700' },
  HEAD_OF_CURRICULUM: { label: 'Head of Curriculum',  color: 'bg-violet-100 text-violet-700' },
  RECEPTIONIST:       { label: 'Receptionist',        color: 'bg-pink-100   text-pink-700'   },
  ACCOUNTANT:         { label: 'Accountant',          color: 'bg-yellow-100 text-yellow-700' },
  // Subordinate tier
  TEACHER:            { label: 'Teacher',             color: 'bg-blue-100   text-blue-700'   },
  LIBRARIAN:          { label: 'Librarian',           color: 'bg-teal-100   text-teal-700'   },
  NURSE:              { label: 'Nurse',               color: 'bg-cyan-100   text-cyan-700'   },
  SECURITY:           { label: 'Security',            color: 'bg-gray-100   text-gray-700'   },
  DRIVER:             { label: 'Driver',              color: 'bg-orange-100 text-orange-700' },
  COOK:               { label: 'Cook',                color: 'bg-amber-100  text-amber-700'  },
  CLEANER:            { label: 'Cleaner',             color: 'bg-lime-100   text-lime-700'   },
  GROUNDSKEEPER:      { label: 'Groundskeeper',       color: 'bg-emerald-100 text-emerald-700'},
  IT_SUPPORT:         { label: 'IT Support',          color: 'bg-violet-100 text-violet-700' },
};

const ATTENDANCE_STATUS_COLORS = {
  PRESENT:  'bg-green-100  text-green-700',
  ABSENT:   'bg-red-100    text-red-700',
  ON_LEAVE: 'bg-yellow-100 text-yellow-700',
  LATE:     'bg-orange-100 text-orange-700',
};

// ── contact action buttons ────────────────────────────────────────────────────

function ContactActions({ phone }) {
  if (!phone) return null;
  const clean = String(phone).replace(/\D/g, '');
  const wa = `https://wa.me/${clean}`;
  const sms = `sms:${phone}`;
  const call = `tel:${phone}`;

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {/* Call */}
      <a
        href={call}
        onClick={e => e.stopPropagation()}
        title={`Call ${phone}`}
        className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
      >
        <PhoneCall size={13} strokeWidth={2} />
      </a>

      {/* SMS */}
      <a
        href={sms}
        onClick={e => e.stopPropagation()}
        title={`SMS ${phone}`}
        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
      >
        <MessageSquare size={13} strokeWidth={2} />
      </a>

      {/* WhatsApp */}
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        title={`WhatsApp ${phone}`}
        className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
      >
        {/* inline WhatsApp SVG — no extra dep */}
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
    </div>
  );
}

// ── row components ────────────────────────────────────────────────────────────

function UserRow({ person, showRole = false, statusBadge }) {
  const phone = person.phone || person.phoneNumber || '';
  const isActive = person.status !== 'INACTIVE' && person.archived !== true;
  const roleMeta = ROLE_META[person.role];

  return (
    <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50">
      {/* avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
        {getInitials(person.firstName, person.lastName)}
      </div>

      {/* name + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {person.firstName} {person.lastName}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {showRole && roleMeta && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${roleMeta.color}`}>
              {roleMeta.label}
            </span>
          )}
          {person.assignedClass && (
            <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              {String(person.assignedClass).replace(/_/g, ' ')}
            </span>
          )}
          {person.reason && (
            <span className="text-xs text-gray-400 italic truncate">{person.reason}</span>
          )}
        </div>
      </div>

      {/* contact actions */}
      <ContactActions phone={phone} />

      {/* status / badge */}
      {statusBadge
        ? <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge.color}`}>{statusBadge.label}</span>
        : <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
      }
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

/**
 * Props:
 *   open          boolean
 *   onClose       () => void
 *   mode          'grouped' | 'attendance'
 *   title         string
 *   headerIcon    ReactNode  (optional, defaults to Users)
 *   headerColor   string     tailwind bg class for header icon circle (e.g. 'bg-red-50')
 *   iconColor     string     tailwind text class (e.g. 'text-red-500')
 *
 *   — for mode='grouped' —
 *   users         array      raw user objects
 *   roleOrder     string[]   role keys in display order
 *
 *   — for mode='attendance' —
 *   statusFilter  string     'ABSENT' | 'PRESENT' | 'ON_LEAVE'
 */
const StaffPopup = ({
  open,
  onClose,
  mode = 'grouped',
  title = 'Staff',
  headerIcon,
  headerColor = 'bg-gray-50',
  iconColor = 'text-gray-500',
  // grouped mode
  users = [],
  roleOrder = [],
  // attendance mode
  statusFilter = 'ABSENT',
}) => {
  const [search, setSearch] = useState('');
  const [statusToggle, setStatusToggle] = useState('all'); // grouped mode only

  // attendance mode state
  const [attRecords, setAttRecords] = useState([]);
  const [attLoading, setAttLoading] = useState(false);
  const [attError, setAttError] = useState(null);
  const [classFilter, setClassFilter] = useState('all');

  const overlayRef = useRef(null);

  // reset on open
  useEffect(() => {
    if (open) {
      setSearch('');
      setStatusToggle('all');
      setClassFilter('all');
    }
  }, [open]);

  // ── attendance fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || mode !== 'attendance') return;
    let cancelled = false;
    const fetch = async () => {
      setAttLoading(true);
      setAttError(null);
      try {
        const res = await hrAPI.getAttendanceReport({ date: todayISO(), limit: 200 });
        if (cancelled) return;
        const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const filtered = statusFilter === 'ALL' ? rows
          : rows.filter(r => String(r.status || r.attendanceStatus || '').toUpperCase() === statusFilter);

        if (filtered.length === 0 && statusFilter === 'ABSENT') {
          // fallback: all teachers with no record = absent
          const usersRes = await userAPI.getAll();
          if (cancelled) return;
          const all = Array.isArray(usersRes?.data) ? usersRes.data : Array.isArray(usersRes) ? usersRes : [];
          setAttRecords(all
            .filter(u => u.role === 'TEACHER' || u.role === 'HEAD_TEACHER')
            .map(u => ({
              id: u.id,
              firstName: u.firstName || '',
              lastName: u.lastName || '',
              phone: u.phone || u.phoneNumber || '',
              status: 'ABSENT',
              assignedClass: u.assignedClass || u.class || u.grade || '',
              role: u.role,
            })));
        } else {
          setAttRecords(filtered.map(r => ({
            id: r.id || r.userId || r.user?.id,
            firstName: r.firstName || r.user?.firstName || '',
            lastName: r.lastName || r.user?.lastName || '',
            phone: r.phone || r.user?.phone || r.user?.phoneNumber || '',
            status: String(r.status || r.attendanceStatus || 'ABSENT').toUpperCase(),
            assignedClass: r.assignedClass || r.class || r.grade
              || r.user?.assignedClass || r.user?.class || r.user?.grade || '',
            role: r.role || r.user?.role || 'TEACHER',
            reason: r.reason || r.note || '',
          })));
        }
      } catch (err) {
        if (!cancelled) setAttError(err.message || 'Failed to load data');
      } finally {
        if (!cancelled) setAttLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [open, mode, statusFilter]);

  // ── grouped mode — filtered + grouped ─────────────────────────────────────
  const grouped = useMemo(() => {
    if (mode !== 'grouped') return [];
    const q = search.toLowerCase();
    const filtered = users.filter(u => {
      const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
      const matchQ = !q || name.includes(q) || (u.email || '').toLowerCase().includes(q);
      const isActive = u.status !== 'INACTIVE' && u.archived !== true;
      const matchStatus =
        statusToggle === 'all' ||
        (statusToggle === 'active' && isActive) ||
        (statusToggle === 'inactive' && !isActive);
      return matchQ && matchStatus;
    });
    const groups = {};
    roleOrder.forEach(r => { groups[r] = []; });
    filtered.forEach(u => { if (groups[u.role]) groups[u.role].push(u); });
    return roleOrder.filter(r => groups[r].length > 0).map(r => ({
      role: r,
      meta: ROLE_META[r] || { label: r, color: 'bg-gray-100 text-gray-700' },
      members: groups[r],
    }));
  }, [mode, users, roleOrder, search, statusToggle]);

  // ── attendance mode — filtered ─────────────────────────────────────────────
  const classOptions = useMemo(() => {
    const set = new Set(attRecords.map(r => r.assignedClass).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [attRecords]);

  const visibleAtt = useMemo(() => {
    const q = search.toLowerCase();
    return attRecords.filter(r => {
      const name = `${r.firstName} ${r.lastName}`.toLowerCase();
      const matchQ = !q || name.includes(q) || (r.assignedClass || '').toLowerCase().includes(q);
      const matchClass = classFilter === 'all' || r.assignedClass === classFilter;
      return matchQ && matchClass;
    });
  }, [attRecords, search, classFilter]);

  const totalVisible = mode === 'grouped'
    ? grouped.reduce((s, g) => s + g.members.length, 0)
    : visibleAtt.length;
  const totalAll = mode === 'grouped' ? users.length : attRecords.length;

  const handleBackdrop = (e) => { if (e.target === overlayRef.current) onClose(); };

  if (!open) return null;

  const Icon = headerIcon ?? <Users size={14} className={iconColor} />;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">

        {/* ── header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <span className={`flex items-center justify-center w-7 h-7 rounded-full ${headerColor}`}>
              {React.isValidElement(Icon) ? Icon : <Users size={14} className={iconColor} />}
            </span>
            <div>
              <h2 className="text-base font-bold text-gray-900">{title}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {attLoading ? 'Loading…' : `${totalVisible} of ${totalAll} staff`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* ── filters ──────────────────────────────────────────────────── */}
        <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name…"
              className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* grouped: active/inactive toggle */}
          {mode === 'grouped' && (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              {[['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive']].map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setStatusToggle(val)}
                  className={`px-2.5 py-1.5 transition-colors ${statusToggle === val ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          )}

          {/* attendance: class filter */}
          {mode === 'attendance' && classOptions.length > 1 && (
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
            >
              {classOptions.map(c => (
                <option key={c} value={c}>{c === 'all' ? 'All Classes' : c.replace(/_/g, ' ')}</option>
              ))}
            </select>
          )}
        </div>

        {/* ── body ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── grouped mode ─────────────────────────────────────────── */}
          {mode === 'grouped' && (
            <>
              {grouped.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
                  <Users size={22} /><p className="text-xs">No staff found</p>
                </div>
              )}
              {grouped.map(({ role, meta, members }) => (
                <div key={role}>
                  <div className="sticky top-0 bg-gray-50 border-y border-gray-100 px-5 py-1.5 flex items-center justify-between">
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${meta.color}`}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">{members.length}</span>
                  </div>
                  {members.map((u, i) => <UserRow key={u.id || i} person={u} />)}
                </div>
              ))}
            </>
          )}

          {/* ── attendance mode ───────────────────────────────────────── */}
          {mode === 'attendance' && (
            <>
              {attLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                  <Loader2 size={22} className="animate-spin" /><p className="text-xs">Loading…</p>
                </div>
              )}
              {!attLoading && attError && (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-red-400 px-6">
                  <AlertCircle size={22} /><p className="text-xs text-center">{attError}</p>
                </div>
              )}
              {!attLoading && !attError && visibleAtt.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
                  <Users size={22} /><p className="text-xs">No records found</p>
                </div>
              )}
              {!attLoading && !attError && visibleAtt.map((s, i) => {
                const sc = ATTENDANCE_STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-500';
                return (
                  <UserRow
                    key={s.id || i}
                    person={s}
                    showRole
                    statusBadge={{ label: s.status.replace('_', ' '), color: sc }}
                  />
                );
              })}
            </>
          )}
        </div>

        {/* ── footer ───────────────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center">
          <p className="text-xs text-gray-400">
            {mode === 'attendance'
              ? `Today · ${new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`
              : `${totalAll} total`}
          </p>
          <button
            onClick={onClose}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffPopup;
