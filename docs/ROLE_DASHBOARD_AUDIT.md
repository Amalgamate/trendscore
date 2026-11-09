# Role dashboard and landing page audit

**Reviewed:** 7 November 2026  
**Scope:** TrendSCORE web/PWA role routing, dashboard components, mobile dashboard routing, bottom navigation, route permissions, and available role modules. The audit findings below include the follow-up dashboard wiring completed after the initial review.

## Summary

There are 18 canonical application roles in `server/src/config/roleDefinitions.ts`. The web app has role-specific dashboard components for the main school roles, but desktop and phone routing do not cover the same set of roles. At the start of this audit, the mobile dashboard router had explicit cases for only 10 roles (plus the `OWNER` alias), and its default sent unknown roles to `OwnerMobileDashboard`. The original mobile navigation also lacked entries for most support roles.

The largest structural issue is **role fallback**, not visual style. A user can land on a dashboard that implies school-wide authority or shows unrelated actions. The support-role permissions also grant `VIEW_ALL_LEARNERS` to Librarian, Nurse, Security, Driver, Cook, Cleaner, Groundskeeper, and IT Support, but the inspected code does not provide role-specific workflows for most of those roles. Dashboard design must not turn this broad permission into unnecessary learner-record access.

## Mobile navigation update

Following the audit, the shared bottom bar now renders as a full-width, single row of equal-height blue buttons. Each canonical role and the legacy `OWNER` alias has an explicit mobile navigation configuration; permissions and enabled modules filter the destinations before display. Roles with more than five available destinations retain every icon and compact to icon-only buttons. Deputy Head and Head of Curriculum have separate nav definitions. Librarian has links to the existing Library routes; support roles without implemented tools currently have a Home-only bar.

The dashboard router is now wired to role-specific landings on both desktop and phone. The starter-package generic landing no longer overrides the leadership role landing; enabled modules still control which actions are available. Support roles with no implemented workflow receive an explicit, role-labelled unavailable state rather than school Admin/Owner controls.

## Current dashboard coverage

| Role | Desktop landing today | Mobile/PWA landing today | Findings and recommended landing |
|---|---|---|---|
| Super Admin | `SuperAdminDashboard` | `RoleLandingDashboard` — Platform Command Centre | Desktop remains platform governance. Mobile now provides compact user, logs, system, and backup links. A school switch/search and platform health summary remain recommended additions if their data/routes are available. |
| School Admin (`ADMIN`) | `AdminDashboard` / `SchoolAdminDashboard` | `OwnerMobileDashboard` | A distinct **School Operations** landing exists. Keep the same role identity and task order on phone; tighten summary density and make the first rows “Review today”, “Learners”, “Fees”, “Staff”, and “Approvals” according to permissions/modules. |
| Head Teacher | `RoleLandingDashboard` — School Leadership | `RoleLandingDashboard` — School Leadership | Replaced the chart-heavy desktop dashboard and teacher mobile landing with a compact leadership workspace. Current actions include attendance, digital diary, assessment, staff list, and timetable, filtered by permissions and enabled modules. |
| Deputy Head Teacher | `DeputyHeadDashboard` | `DeputyHeadDashboard` | A compact role workspace exists on both. Preserve it, but keep actions to operational follow-up (attendance, diary, assessment, timetable) and confirm every row is permission and module gated. |
| Head of Curriculum | `RoleLandingDashboard` — Curriculum & Assessment | `RoleLandingDashboard` — Curriculum & Assessment | Replaced the chart-heavy desktop dashboard and owner mobile fallback with a compact workspace for diary, assessment, schemes, timetable, and teacher follow-up. |
| Teacher | `TeacherDashboard` | `TeacherMobileDashboard` | Strongest established pattern: Teacher Workspace with action-first rows, clock-in, class plan, diary, scores, attendance, and learner review. Keep teacher-only class scope and the current compact responsive pattern. |
| Parent | `ParentDashboard` | `ParentMobileDashboard` | Parent-specific child-first landing exists. Keep “My children”, “Read the diary”, “Pay/check fees”, attendance, school message, help/settings. Preserve the global full-width Inbox and Chat controls on mobile/PWA. |
| Student | `StudentDashboard` | `StudentMobileDashboard` | A student landing exists. Start with today’s learning, diary/homework due, timetable, and own progress. Keep own-record scope; show a clear account-linking state where no learner profile is connected. |
| Accountant | `AccountantDashboard` | `AccountantMobileDashboard` | Dedicated finance landing exists on both sizes. Keep collections, unmatched payments, receipts/reconciliation, balances and financial reports; avoid academic navigation unless explicitly required. |
| Receptionist | `ReceptionistDashboard` | `ReceptionistDashboard` | Compact front-office workspace exists. Keep learner lookup, payment receipt flow, inbox, notices, and visitor/appointment actions only if those workflows exist and permissions allow them. Do not imply general learner editing. |
| Librarian | `RoleLandingDashboard` — Library Desk | Same role landing; Library links appear when enabled | Uses the existing catalogue, circulation, inventory, and member routes, each permission and module gated. Live counts and overdue queues can follow when API support is confirmed. |
| Nurse | `RoleLandingDashboard` — Health Office | Same role landing; Home-only bottom bar | Shows a safe role-specific state because health tools are not available yet. Add a health workflow and narrow permissions before exposing learner health records. |
| Security | `RoleLandingDashboard` — School Safety | Same role landing; Home-only bottom bar | Shows a safe role-specific state because visitor and incident tools are not available yet. Add those workflows before exposing actions. |
| Driver | `RoleLandingDashboard` — Transport Desk | Same role landing; Home-only bottom bar | The web portal has no driver self-service routes, and this checkout’s `apps/` tree contains no driver app source. Verify the separate driver app/repository before adding functionality. |
| Cook | `RoleLandingDashboard` — Kitchen Day Sheet | Same role landing; Home-only bottom bar | Shows a safe role-specific state because kitchen tasks are not available yet. Add meal counts, menus, dietary needs, and task completion before navigation. |
| Cleaner | `RoleLandingDashboard` — Facilities Tasks | Same role landing; Home-only bottom bar | Shows a safe role-specific state because cleaning tasks are not available yet. Add assigned work orders and completion tracking before navigation. |
| Groundskeeper | `RoleLandingDashboard` — Grounds Tasks | Same role landing; Home-only bottom bar | Shows a safe role-specific state because grounds tasks are not available yet. Add assigned work orders and completion tracking before navigation. |
| IT Support | `RoleLandingDashboard` — IT Service Desk | Same role landing; Home-only bottom bar | Shows a safe role-specific state because support tools are not available yet. Add ticket/device workflows; do not grant system settings based only on the role label. |

`OWNER` is accepted in frontend dashboard routing as a legacy/owner alias but is not one of the 18 canonical backend roles listed above. It currently shares school-admin/owner treatment; resolve whether it should remain an alias or be normalized to `ADMIN`.

## What exists, beyond the dashboards

- The route router has specific page handling for the Library module, and the navigation hook defines Librarian-accessible library items. This is the clearest support role ready for a dedicated workspace.
- Transport administration routes are present, but `TRANSPORT_MANAGEMENT`, driver management, route management, and transport reports are assigned to Super Admin/Admin. That does not provide a Driver self-service experience.
- Permissions for Nurse, Security, Cook, Cleaner, Groundskeeper, Driver, and IT Support mostly stop at `VIEW_ALL_LEARNERS`. That broad permission is not a usable job workflow and should be reviewed against least-privilege access.
- Existing mobile navigation is explicit and filters entries through `hasPageAccess`, but missing role configs mean no bottom nav at all. Aliasing roles to another role’s nav can expose the wrong information architecture even if individual routes are later filtered.
- The page route authorization layer and the dashboard action filtering should be checked together. Hiding a dashboard link is not a substitute for server-side authorization.

## Recommended landing-page structure

### Shared design rules

Use the Teacher Workspace visual language across roles: a compact, role-named header and short greeting; one actionable prompt; at most three useful status counts; then a short list of high-frequency actions as colored icon rows. Keep the primary surface light, text dark, icons legible, and saturated colors reserved for the action icon or key action. Do not put long explanations, charts, or every module on the landing page. Desktop can use two columns for the same prioritized rows; phone/PWA should stack the same order with comfortable touch targets and a role-appropriate bottom navigation.

Each role should have an explicit landing resolver. Reuse the visual component, not the permissions or action list. Landing actions should be gated by both role permission and enabled module, and a role with no implemented workflow should see a useful limited state rather than another role’s dashboard.

### Landing priorities by role group

1. **Platform governance:** Super Admin — schools, platform health, support queue, privileged controls.
2. **School leadership:** School Admin, Head Teacher, Deputy Head — school operations, attendance/academic risk, diary oversight, approvals; differentiated by authority.
3. **Teaching and learning:** Head of Curriculum, Teacher, Student — curriculum coverage and assessment oversight; assigned-class teaching actions; personal learning and homework.
4. **Family:** Parent — children and the child’s daily diary/fees/attendance, with Inbox and Chat available across mobile pages.
5. **Finance/front office:** Accountant, Receptionist — collections/reconciliation vs learner lookup/receipts/inbox.
6. **Operational services:** Librarian first, because the Library module exists. Nurse, Security, Driver, Cook, Cleaner, Groundskeeper, and IT Support need workflow/permission design before a meaningful dashboard can be built.

## Recommended order for the UI pass

1. Complete visual review of the wired landings at desktop and phone widths, then tune spacing and action order from the running PWA.
2. Add Super Admin school search/switch and platform health summary after confirming their live routes and data source.
3. Agree operational workflows and narrow permissions for Nurse, Security, Driver, Cook, Cleaner, Groundskeeper, and IT Support before adding action rows.
4. Add real Library counts (loans due, overdue, stock) when the Library API can provide reliable data.
5. Audit all 18 roles at desktop and phone widths: correct landing, correct nav, only authorized actions, readable labels, no horizontal overflow, and no generic role fallback.

## Files reviewed

- `server/src/config/roleDefinitions.ts`
- `src/config/permissions.js`
- `src/components/CBCGrading/pages/dashboard/RoleDashboard.jsx`
- `src/components/CBCGrading/dashboard/MobileDashboard.jsx`
- `src/components/CBCGrading/dashboard/mobile/MobileNavigationConfig.ts`
- `src/components/CBCGrading/dashboard/mobile/MobileBottomNav.jsx`
- `src/components/CBCGrading/hooks/useNavigation.js`
- `src/components/CBCGrading/layout/PageRouter.jsx`
- role dashboard components under `src/components/CBCGrading/pages/dashboard/`
- available app sources under `apps/`


