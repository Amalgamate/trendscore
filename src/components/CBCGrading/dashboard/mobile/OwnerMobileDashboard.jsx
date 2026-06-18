/**
 * Owner/Admin Mobile Dashboard
 * Compact mobile view for executives with greeting banner and entity stat cards.
 *
 * NOTE: Location/GPS geofence has been replaced with IP-based verification.
 * Staff must be connected to the school Wi-Fi to clock in.
 */

import React, { useEffect, useState } from 'react';
import { Users, GraduationCap, UserCheck } from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';
import { GreetingToast } from '../../pages/dashboard/DashboardSummary';

// ── GPS / Geofence (DISABLED — replaced by IP/Wi-Fi check) ───────────────────
// Location-based clock-in is paused because indoor GPS accuracy (5–50 m) causes
// legitimate staff to be rejected. Restore by un-commenting the block below and
// wiring geoStatus back into handleClockAction / ClockInButton.
//
// import axiosInstance from '../../../../services/api/axiosConfig';
//
// function haversineMetres(lat1, lon1, lat2, lon2) {
//   const R = 6_371_000;
//   const toRad = (d) => (d * Math.PI) / 180;
//   const dLat = toRad(lat2 - lat1);
//   const dLon = toRad(lon2 - lon1);
//   const a =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
//   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// }
//
// const GEOFENCE_RADIUS_M = 30;
// ─────────────────────────────────────────────────────────────────────────────

// ─── Tone helpers ─────────────────────────────────────────────────────────────
const CARD_TONES = {
  navy: { bg: 'bg-[#0f2355]', iconBg: 'bg-white/10', label: 'text-white/70', value: 'text-white', sub: 'text-white/60', chip: 'bg-white/10 text-white/80' },
  teal: { bg: 'bg-[#0d7369]', iconBg: 'bg-white/10', label: 'text-white/70', value: 'text-white', sub: 'text-white/60', chip: 'bg-white/10 text-white/80' },
  red:  { bg: 'bg-[#b91c1c]', iconBg: 'bg-white/10', label: 'text-white/70', value: 'text-white', sub: 'text-white/60', chip: 'bg-white/10 text-white/80' },
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ tone = 'navy', icon: Icon, label, value, subvalue, chips = [], loading }) => {
  const t = CARD_TONES[tone] || CARD_TONES.navy;
  return (
    <div className={`${t.bg} rounded-2xl p-4 flex flex-col gap-3 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div className={`${t.iconBg} rounded-xl p-2`}>
          <Icon size={22} className="text-white" />
        </div>
        <span className={`text-[10px] font-semibold uppercase tracking-widest ${t.label}`}>{label}</span>
      </div>
      {loading ? (
        <div className="h-8 w-16 bg-white/10 rounded animate-pulse" />
      ) : (
        <div>
          <p className={`text-3xl font-black leading-none ${t.value}`}>{value}</p>
          {subvalue && <p className={`text-xs mt-0.5 font-medium ${t.sub}`}>{subvalue}</p>}
        </div>
      )}
      {chips.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-auto">
          {chips.map((chip, i) => (
            <span key={i} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${t.chip}`}>
              {chip.value} {chip.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Dashboard ────────────────────────────────────────────────────────────
const OwnerMobileDashboard = ({ user, onNavigate, brandingSettings }) => {
  const [metrics, setMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    dashboardAPI.getAdminMetrics('today')
      .then((res) => { if (res?.success) setMetrics(res.data); })
      .catch(() => {})
      .finally(() => setLoadingMetrics(false));
  }, []);

  const s = metrics?.stats ?? {};

  const fmtAttendance = (rate) =>
    rate != null ? `${Math.round(rate)}% present today` : 'Attendance pending';

  const studentAttendanceRate = s.studentAttendanceRate ?? s.attendanceRate ?? null;
  const teacherAttendanceRate = s.teacherAttendanceRate ?? null;
  const staffAttendanceRate   = s.staffAttendanceRate   ?? null;

  return (
    <div className="pb-24 bg-gray-50 min-h-screen">

      {/* ── Top bar: logo only ── */}
      {brandingSettings?.logoUrl && (
        <div className="px-4 pt-3 pb-1 flex justify-end">
          <img
            src={brandingSettings.logoUrl}
            alt="School Logo"
            className="w-10 h-10 object-contain drop-shadow-sm"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
      )}

      {/* ── Greeting banner ── */}
      <GreetingToast
        user={user}
        fallbackName="Admin"
        description="School Overview · Admin Portal"
        onNavigate={onNavigate}
      />

      {/* ── Stat Cards ── */}
      <div className="px-4 pt-4 grid grid-cols-1 gap-3">
        <StatCard
          tone="navy" icon={Users} label="Students"
          value={(s.totalStudents ?? s.activeStudents ?? 0).toLocaleString()}
          subvalue={fmtAttendance(studentAttendanceRate)}
          loading={loadingMetrics}
          chips={[
            { value: s.activeStudents ?? s.totalStudents ?? 0, label: 'active' },
            ...(s.males   != null ? [{ value: s.males,   label: 'M' }] : []),
            ...(s.females != null ? [{ value: s.females, label: 'F' }] : []),
          ]}
        />
        <StatCard
          tone="teal" icon={GraduationCap} label="Tutors"
          value={(s.totalTeachers ?? s.activeTeachers ?? 0).toLocaleString()}
          subvalue={fmtAttendance(teacherAttendanceRate)}
          loading={loadingMetrics}
          chips={[
            { value: s.presentTeachers ?? s.activeTeachers ?? 0,  label: 'present' },
            { value: s.absentTeachers  ?? 0,                       label: 'absent'  },
            ...(s.staffOnLeave != null ? [{ value: s.staffOnLeave, label: 'on leave' }] : []),
          ]}
        />
        <StatCard
          tone="red" icon={UserCheck} label="Subordinate Staff"
          value={(s.totalSubordinateStaff ?? s.subordinateStaff ?? 0).toLocaleString()}
          subvalue={fmtAttendance(staffAttendanceRate)}
          loading={loadingMetrics}
          chips={[
            { value: s.presentSubordinateStaff ?? 0, label: 'present' },
            { value: s.absentSubordinateStaff  ?? 0, label: 'absent'  },
          ]}
        />
      </div>

      {/* ── Quick Actions ── */}
      <div className="px-4 pt-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onNavigate('attendance-daily')}
            className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold active:scale-95 transition">
            Daily Attendance
          </button>
          <button onClick={() => onNavigate('learners-list')}
            className="p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold active:scale-95 transition">
            Learners
          </button>
          <button onClick={() => onNavigate('settings-users')}
            className="p-3 rounded-xl border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold active:scale-95 transition">
            Users
          </button>
          <button onClick={() => onNavigate('finance-fees')}
            className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold active:scale-95 transition">
            Fees
          </button>
        </div>
      </div>
    </div>
  );
};

export default OwnerMobileDashboard;
