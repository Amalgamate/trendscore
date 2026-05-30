# Context switching fix — Zawadi SMS

## What is broken and why

The app has three independent places that each track `institutionType`, and they can
disagree with each other at runtime:

| Source | Where it lives | How it updates |
|---|---|---|
| `AuthContext` | React state | `login()` / `updateUser()` |
| `useAuthStore` (Zustand) | `localStorage → cbc_auth_state` | `setAuth()` — called separately |
| `axiosConfig` interceptor | `localStorage.getItem('user')` | Read cold on every request |

When a user logs in or the type is updated via `updateUser()`, only `AuthContext` is
guaranteed to change. `useAuthStore` is not synced to it. The axios interceptor reads
cold `localStorage` and can race with React state. `useBootstrapStore` caches
institution-scoped data for 5 minutes and never flushes when the type changes.
`RoleDashboard` has no branch for `TERTIARY`, so tertiary users hit "Invalid user role".

Five bugs, stacked:

1. **Dual auth stores** — `AuthContext` and `useAuthStore` are not in sync.
2. **Axios reads cold localStorage** — `x-institution-type` header can be wrong for the
   current session.
3. **`useNavigation` memo dependency** — it reads `user?.institutionType` which can be a
   stale object reference even if the string value changed.
4. **Bootstrap cache not invalidated on type change** — stale learner/class/subject data
   from the old context bleeds into the new one.
5. **`handleAuthSuccess` only clears `cbc_ui_state` for SECONDARY logins** — other
   transitions carry over stale navigation state.

Tertiary is additionally broken because `RoleDashboard` has no `TERTIARY` branch at all,
making it fall through to "Invalid user role" instead of `ComingSoon`.

---

## The fix — 6 changes across 6 files + 1 new file

The strategy is a single source of truth: **`AuthContext` owns `institutionType`**.
Everything else reads from it reactively via a tiny module-level signal that the
interceptor can access without hooks.

---

### File 1 — NEW: `src/services/api/institutionContext.js`

Create this file. It is a plain module-level variable — no React, no Zustand — that
`AuthContext` writes to on every user change, and that `axiosConfig` reads synchronously
inside the interceptor. This is the bridge between React's reactive world and axios's
non-reactive interceptor world.

```js
// src/services/api/institutionContext.js

let _institutionType = 'PRIMARY_CBC';

export const setInstitutionType = (type) => {
  _institutionType = type || 'PRIMARY_CBC';
};

export const getInstitutionType = () => _institutionType;
```

---

### File 2 — `src/contexts/AuthContext.jsx`

Three changes:
- Import and call `setInstitutionType` whenever the user object changes.
- Detect when `institutionType` changes mid-session and clear the bootstrap cache so
  stale scoped data is never shown for the new context.
- Expose `institutionType` as a first-class value in the context so consumers get a
  stable string primitive instead of digging into `user?.institutionType` (which can
  be a stale object reference).

```jsx
// src/contexts/AuthContext.jsx
// FULL REPLACEMENT — diff shown as comments

import React, { createContext, useState, useEffect, useRef, useCallback } from 'react'; // add useRef
import { setInstitutionType } from '../services/api/institutionContext';     // NEW import
import { useBootstrapStore } from '../store/useBootstrapStore';               // NEW import

export const AuthContext = createContext({
  isAuthenticated: false,
  user: null,
  institutionType: 'PRIMARY_CBC',   // NEW field in default context shape
  login: () => {},
  logout: () => {},
  updateUser: () => {},
});

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const prevInstitutionTypeRef = useRef(null);   // NEW — tracks previous type

  const normalizeUser = useCallback((u) => {
    if (!u) return u;
    const institutionType = u.requiresInstitutionSetup
      ? (u.institutionType ?? null)
      : (u.institutionType || 'PRIMARY_CBC');
    const activeApps = Array.isArray(u.activeApps) ? u.activeApps : undefined;
    return { ...u, institutionType, activeApps };
  }, []);

  // ── NEW: keep the axios interceptor in sync whenever the user changes ──
  useEffect(() => {
    const type = user?.institutionType || 'PRIMARY_CBC';
    setInstitutionType(type);

    // If the institution type changed mid-session, wipe the bootstrap cache.
    // This prevents learner / class / subject data from the old context
    // from bleeding into the new one.
    if (
      prevInstitutionTypeRef.current !== null &&
      prevInstitutionTypeRef.current !== type
    ) {
      useBootstrapStore.getState().clear();
    }
    prevInstitutionTypeRef.current = type;
  }, [user?.institutionType]);

  // Check for existing auth on mount — unchanged
  useEffect(() => {
    const checkAuth = () => {
      try {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        if (storedUser && (token || document.cookie.includes('accessToken'))) {
          const parsedUser = normalizeUser(JSON.parse(storedUser));
          localStorage.setItem('user', JSON.stringify(parsedUser));
          setUser(parsedUser);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Error restoring auth state:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [normalizeUser]);

  const login = useCallback((userData, token, refreshToken) => {
    try {
      const normalizedUser = normalizeUser(userData);
      localStorage.setItem('token', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      setUser(normalizedUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  }, [normalizeUser]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('authToken');
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser(prevUser => {
      const updatedUser = { ...prevUser, ...updates };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, []);

  const value = React.useMemo(() => ({
    isAuthenticated,
    user,
    loading,
    institutionType: user?.institutionType || 'PRIMARY_CBC',  // NEW — stable string
    login,
    logout,
    updateUser,
  }), [isAuthenticated, user, loading, login, logout, updateUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
```

---

### File 3 — `src/services/api/axiosConfig.js`

Replace the cold `localStorage` read in the request interceptor with a call to
`getInstitutionType()`. Also remove the `selectedInstitutionType` override key — that
localStorage key was a workaround for this exact bug and is no longer needed.

Find this block in the request interceptor and replace it:

```js
// BEFORE — in the request interceptor, replace this entire try/catch block:
try {
    const selectedInstitutionType = localStorage.getItem('selectedInstitutionType');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const institutionType = selectedInstitutionType || user?.institutionType;
    if (institutionType) {
        config.headers['x-institution-type'] = institutionType;
    }
} catch (_err) {
    // Ignore malformed local storage and proceed without context override.
}
```

```js
// AFTER — add this import at the top of the file:
import { getInstitutionType } from './institutionContext';

// Then in the request interceptor, replace the try/catch block above with:
const institutionType = getInstitutionType();
if (institutionType) {
    config.headers['x-institution-type'] = institutionType;
}
```

The full interceptor after the change should look like:

```js
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token && token.startsWith('ey')) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        const institutionType = getInstitutionType();
        if (institutionType) {
            config.headers['x-institution-type'] = institutionType;
        }
        return config;
    },
    (error) => Promise.reject(error)
);
```

---

### File 4 — `src/components/CBCGrading/hooks/useNavigation.js`

The `institutionType` variable in `useNavigation` is derived from `user?.institutionType`.
Because `user` is an object reference, React's `useMemo` dependency comparison can miss
changes when the object is mutated but keeps the same identity. Fix by reading the
dedicated stable string from `useAuth()` instead.

Find the line near the top of `useNavigation`:

```js
// BEFORE — line ~27 inside useNavigation():
const institutionType = user?.institutionType || 'PRIMARY_CBC';
```

```js
// AFTER — destructure institutionType directly from the context:
const { user, institutionType } = useAuth();
```

The `useAuth` import is already at the top of the file. No other changes needed in this
file — the memos already list `institutionType` in their dependency arrays, so they will
now reliably re-run when the type changes.

---

### File 5 — `src/App.jsx`

`handleAuthSuccess` currently only clears `cbc_ui_state` when the incoming user is
SECONDARY. This means a PRIMARY → SECONDARY transition works, but SECONDARY → PRIMARY
or any tertiary transition carries over stale navigation state. Also, `clearBootstrap()`
is not called here — it's only called on logout. Fix both.

Find `handleAuthSuccess` and replace it:

```jsx
// BEFORE:
const handleAuthSuccess = (userData, token, refreshToken) => {
  localStorage.removeItem('cbc_current_page');
  localStorage.removeItem('cbc_page_params');
  localStorage.removeItem('cbc_expanded_sections');
  if (userData?.institutionType === 'SECONDARY') {
    localStorage.removeItem('cbc_ui_state');
  }
  login(userData, token, refreshToken);
  // ...
};
```

```jsx
// AFTER — always wipe bootstrap and UI state on every login,
// regardless of institution type:
const handleAuthSuccess = (userData, token, refreshToken) => {
  // Always clear bootstrap and UI state on login. The incoming user may
  // have a different institutionType and stale cached data must not bleed
  // through. The bootstrap store will refill during the splash screen.
  clearBootstrap();
  localStorage.removeItem('cbc_ui_state');
  localStorage.removeItem('cbc_current_page');
  localStorage.removeItem('cbc_page_params');
  localStorage.removeItem('cbc_expanded_sections');

  login(userData, token, refreshToken);

  if (userData.mustChangePassword) {
    navigate('/auth/reset-password?token=INITIAL_SETUP_REQUIRED', { replace: true });
  } else if (userData.requiresInstitutionSetup) {
    navigate('/auth/setup-institution', { replace: true });
  } else {
    navigate('/app', { replace: true });
  }
};
```

---

### File 6 — `src/components/CBCGrading/pages/dashboard/RoleDashboard.jsx`

`RoleDashboard` has a `SECONDARY` branch but no `TERTIARY` branch. Tertiary users fall
through to the default `switch` case and see "Invalid user role". Add a TERTIARY guard
that shows `ComingSoon` and also move the SECONDARY placeholder guard to a consistent
position — before the mobile check so mobile tertiary users also see `ComingSoon`
instead of `MobileDashboard`.

```jsx
// FULL REPLACEMENT of RoleDashboard.jsx:

import React from 'react';
import { usePermissions } from '../../../../hooks/usePermissions';
import { useAuth } from '../../../../hooks/useAuth';
import AdminDashboard from './AdminDashboard';
import HeadTeacherDashboard from './HeadTeacherDashboard';
import TeacherDashboard from './TeacherDashboard';
import ParentDashboard from './ParentDashboard';
import AccountantDashboard from './AccountantDashboard';
import ReceptionistDashboard from './ReceptionistDashboard';
import MobileDashboard from './MobileDashboard';
import StudentDashboard from '../student/StudentDashboard';
import ComingSoon from '../../shared/ComingSoon';
import useMediaQuery from '../../hooks/useMediaQuery';
import { MOBILE_MEDIA_QUERY } from '../../../../constants/breakpoints';

// Secondary placeholder tiles — kept until SecondaryAdminDashboard is built
const SecondaryPlaceholder = ({ role, user, onNavigate }) => {
  const Tile = ({ title, description, onClick, badge, tone = 'indigo' }) => {
    const toneClasses =
      tone === 'emerald'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
        : tone === 'slate'
        ? 'border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100'
        : 'border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100';
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left rounded-2xl border p-4 shadow-sm transition ${toneClasses}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold">{title}</div>
            <div className="mt-1 text-xs font-medium opacity-80">{description}</div>
          </div>
          {badge && (
            <span className="shrink-0 inline-flex items-center rounded-full border border-white/40 bg-white/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
              {badge}
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-indigo-50 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-indigo-900">Senior School Dashboard</h1>
            <p className="mt-2 text-sm font-medium text-indigo-900/80">
              This is the Senior School environment. Modules open progressively; anything
              unfinished shows "Coming Soon".
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-indigo-800">
                Portal: Senior
              </span>
              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-indigo-800">
                Role: {String(role || user?.role || 'USER').replaceAll('_', ' ')}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.('learners-list')}
            className="hidden sm:inline-flex items-center px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold uppercase tracking-widest shadow hover:bg-indigo-700"
          >
            View Students
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Tile title="CBC Pathways" description="STEM / Social Sciences / Arts & Sports pathways and category rules." badge="Live" onClick={() => onNavigate?.('sec-pathways')} />
        <Tile title="Students" description="Senior School learners (Grade 10–12)." badge="Ready" tone="emerald" onClick={() => onNavigate?.('learners-list')} />
        <Tile title="Learning Areas" description="Manage learning areas for the active institution type." badge="Ready" tone="emerald" onClick={() => onNavigate?.('assess-learning-areas')} />
        <Tile title="Assessments" description="Summative and formative assessment flows." badge="Ready" tone="emerald" onClick={() => onNavigate?.('assess-summative-assessment')} />
        <Tile title="Reports" description="Termly report and analytics." badge="Ready" tone="emerald" onClick={() => onNavigate?.('assess-termly-report')} />
        <Tile title="Grade Streams" description="Grade 10–12 class streams." badge="Ready" tone="emerald" onClick={() => onNavigate?.('sec-form-groups')} />
      </div>
    </div>
  );
};

const RoleDashboard = ({ learners, pagination, teachers, user, onNavigate, brandingSettings }) => {
  const { role } = usePermissions();
  const { institutionType } = useAuth();
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);

  // ── Tertiary: entire module is Coming Soon ────────────────────────────────
  if (institutionType === 'TERTIARY') {
    return (
      <ComingSoon
        badge="Tertiary"
        title="Tertiary portal"
        description="The tertiary institution module is currently under development and will be available in a future release."
      />
    );
  }

  // ── Secondary: placeholder until SecondaryAdminDashboard is built ─────────
  if (institutionType === 'SECONDARY') {
    return (
      <SecondaryPlaceholder role={role} user={user} onNavigate={onNavigate} />
    );
  }

  // ── Primary CBC: mobile shell or role-based dashboard ─────────────────────
  if (isMobile) {
    return <MobileDashboard user={user} onNavigate={onNavigate} brandingSettings={brandingSettings} />;
  }

  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return <AdminDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} />;
    case 'HEAD_TEACHER':
      return <HeadTeacherDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} />;
    case 'TEACHER':
      return <TeacherDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} />;
    case 'PARENT':
      return <ParentDashboard user={user} onNavigate={onNavigate} />;
    case 'STUDENT':
      return <StudentDashboard user={user} onNavigate={onNavigate} />;
    case 'ACCOUNTANT':
      return <AccountantDashboard learners={learners} pagination={pagination} user={user} onNavigate={onNavigate} />;
    case 'RECEPTIONIST':
      return <ReceptionistDashboard learners={learners} pagination={pagination} user={user} onNavigate={onNavigate} />;
    default:
      return (
        <div className="text-center py-12">
          <p className="text-gray-600">Invalid user role</p>
        </div>
      );
  }
};

export default RoleDashboard;
```

---

## Tertiary — lock all assessment and learning areas pages to ComingSoon

The `PageRouter` already routes all `tert-*` cases to `<ComingSoon>`. No change needed
there. What needs adding is the `comingSoon: true` flag on individual nav items so the
horizontal submenu renders them greyed-out rather than active links (the `NavItem`
component in `HorizontalSubmenu.jsx` already checks `item.comingSoon`).

### `src/config/tertiaryNav.js`

Add `comingSoon: true` to the `tertiary-assessment` and `tertiary-results` sections and
all their children. The `tertiary-programs` section (departments, units, enrollment) is
also not built, so mark it as well.

Find the `tertiary-programs` section object and add the flag:

```js
// In tertiaryNav.js — add comingSoon: true to these three sections and their items:

{
  id: 'tertiary-programs',
  label: 'Academic Programs',
  comingSoon: true,        // ADD
  icon: BookMarked,
  permission: null,
  items: [
    { id: 'tert-departments', label: 'Departments',       path: 'tert-departments', permission: 'ACADEMIC_SETTINGS', comingSoon: true },
    { id: 'tert-programs',    label: 'Programs',          path: 'tert-programs',    permission: 'ACADEMIC_SETTINGS', comingSoon: true },
    { id: 'tert-units',       label: 'Unit Management',   path: 'tert-units',       permission: 'ACADEMIC_SETTINGS', comingSoon: true },
    { id: 'tert-enrollment',  label: 'Unit Enrollment',   path: 'tert-enrollment',  permission: 'MANAGE_FACILITIES', comingSoon: true },
    { id: 'tert-timetable',   label: 'Lecture Timetable', path: 'planner-timetable', permission: 'ACCESS_TIMETABLE', comingSoon: true },
  ],
},

{
  id: 'tertiary-assessment',
  label: 'Assessment',
  comingSoon: true,        // ADD
  icon: TrendingUp,
  permission: 'ACCESS_ASSESSMENT_MODULE',
  items: [
    { id: 'tert-cats',        label: 'CATs (30%)',   path: 'tert-cats',        permission: 'ACCESS_ASSESSMENT_MODULE', comingSoon: true },
    { id: 'tert-exams',       label: 'Exams (70%)',  path: 'tert-exams',       permission: 'ACCESS_ASSESSMENT_MODULE', comingSoon: true },
    { id: 'tert-mark-entry',  label: 'Mark Entry',   path: 'tert-mark-entry',  permission: 'ACCESS_ASSESSMENT_MODULE', comingSoon: true },
    { id: 'tert-grade-sheet', label: 'Grade Sheets', path: 'tert-grade-sheet', permission: 'ACCESS_ASSESSMENT_MODULE', comingSoon: true },
  ],
},

{
  id: 'tertiary-results',
  label: 'Results & Transcripts',
  comingSoon: true,        // ADD
  icon: BarChart3,
  permission: 'VIEW_ALL_REPORTS',
  items: [
    { id: 'tert-unit-results',    label: 'Unit Results',         path: 'tert-unit-results',    permission: 'VIEW_ALL_REPORTS', comingSoon: true },
    { id: 'tert-gpa',             label: 'GPA Calculator',       path: 'tert-gpa',             permission: 'VIEW_ALL_REPORTS', comingSoon: true },
    { id: 'tert-semester-report', label: 'Semester Reports',     path: 'tert-semester-report', permission: 'DOWNLOAD_REPORTS', comingSoon: true },
    { id: 'tert-transcripts',     label: 'Transcripts',          path: 'tert-transcripts',     permission: 'DOWNLOAD_REPORTS', comingSoon: true },
    { id: 'tert-classifications', label: 'Degree Classification',path: 'tert-classifications', permission: 'VIEW_ALL_REPORTS', comingSoon: true },
  ],
},
```

---

## What is deliberately NOT changed

| File | Reason left alone |
|---|---|
| `useAuthStore.js` | Only used for legacy token checks in a handful of places. Removing it is a refactor, not a bug fix. Leave it but stop reading `institutionType` from it — `AuthContext` owns that now. |
| `SummativeAssessmentRouter.jsx` | Shared between Junior and SS by design. Scoping it by `institutionType` is a separate feature (phase 3 work), not part of this fix. |
| `useBootstrapStore.js` | The `clear()` method is now called from `AuthContext` when the type changes. No changes to the store itself are needed. |
| `appAccess.js` | `hasPageAccess` already correctly gates `SECONDARY_ONLY_PAGES` and `TERTIARY_ONLY_PAGES`. No change needed. |
| `secondaryNav.js` | Navigation structure is correct. The `SECONDARY_RESULTS_SECTIONS` grouping issue is a cosmetic sidebar layout concern, not a context switching bug. |

---

## What shared modules mean after this fix

These modules are intentionally shared across institution types — they use the same
component but the API now reliably receives the correct `x-institution-type` header
on every request, so the server can scope the data correctly:

- Fee collection, HR, Inventory, Transport, Library, Biometric — not curriculum-specific
- Attendance (daily + reports) — same mechanics, different labels
- Admissions / learner list — same form, server scopes data by institution
- Settings, Users, Communications — admin infrastructure

These modules are NOT shared and must never bleed between types:

- CBC Formative / Core Competencies / Values / Co-Curricular — Junior only, guarded by
  `appAccess.js` SECONDARY_ONLY_PAGES / plain absence from secondaryNavSections
- SS Assessment (CATs / mid / end / mock), Pathways, Grade Streams — Secondary only
- All `tert-*` routes — Tertiary only, currently all → ComingSoon

---

## Apply order

1. Create `src/services/api/institutionContext.js`
2. Update `src/contexts/AuthContext.jsx`
3. Update `src/services/api/axiosConfig.js`
4. Update `src/components/CBCGrading/hooks/useNavigation.js` (one-line change)
5. Update `src/App.jsx` (`handleAuthSuccess` function only)
6. Replace `src/components/CBCGrading/pages/dashboard/RoleDashboard.jsx`
7. Update `src/config/tertiaryNav.js` (add `comingSoon: true` flags)

No backend changes are required. The server already reads `x-institution-type` from
request headers — the fix just makes the frontend send the correct value reliably.
