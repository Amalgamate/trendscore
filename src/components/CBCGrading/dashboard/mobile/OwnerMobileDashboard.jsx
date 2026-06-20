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
  navy: { bg: 'ts-mobile-card', iconBg: 'bg-[#06285a]', icon: 'text-white', label: 'text-[#06285a]/70', value: 'text-[#06285a]', sub: 'text-[#06285a]/60', chip: 'bg-[#06285a]/10 text-[#06285a]' },
  teal: { bg: 'ts-mobile-card-orange', iconBg: 'bg-[#06285a]', icon: 'text-white', label: 'text-[#06285a]/70', value: 'text-[#06285a]', sub: 'text-[#06285a]/60', chip: 'bg-[#06285a]/10 text-[#06285a]' },
  red:  { bg: 'ts-mobile-card', iconBg: 'bg-[#06285a]', icon: 'text-white', label: 'text-[#06285a]/70', value: 'text-[#06285a]', sub: 'text-[#06285a]/60', chip: 'bg-[#06285a]/10 text-[#06285a]' },
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ tone = 'navy', icon: Icon, label, value, subvalue, chips = [], loading }) => {
  const t = CARD_TONES[tone] || CARD_TONES.navy;
  return (
    <div className={`${t.bg} rounded-2xl p-4 flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <div className={`${t.iconBg} rounded-xl p-2`}>
          <Icon size={22} className={t.icon} />
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
    <div className="min-h-full pb-24 text-white">

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
        <p className="ts-mobile-section-title text-[10px] font-bold uppercase tracking-widest mb-2">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onNavigate('attendance-daily')}
            className="ts-mobile-action-solid p-3 rounded-xl text-xs font-semibold active:scale-95 transition">
            Daily Attendance
          </button>
          <button onClick={() => onNavigate('learners-list')}
            className="ts-mobile-action p-3 rounded-xl text-xs font-semibold active:scale-95 transition">
            Learners
          </button>
          <button onClick={() => onNavigate('settings-users')}
            className="ts-mobile-action p-3 rounded-xl text-xs font-semibold active:scale-95 transition">
            Users
          </button>
          <button onClick={() => onNavigate('finance-fees')}
            className="ts-mobile-action-solid p-3 rounded-xl text-xs font-semibold active:scale-95 transition">
            Fees
          </button>
        </div>
      </div>
    </div>
  );
};

export default OwnerMobileDashboard;
