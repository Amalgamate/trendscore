# TrendScore

TrendScore is a CBE-ready School ERP for modern African schools. It helps schools manage academics, CBE assessments, fees, finance, staff, parents, communication, and analytics from one platform.

- Website: https://www.trendscore.co.ke/
- Repository: https://github.com/Amalgamate/trendscore

![Status](https://img.shields.io/badge/Status-Active%20Build-orange)
![Version](https://img.shields.io/badge/Version-1.0.0--Alpha-blue)
![Curriculum](https://img.shields.io/badge/Curriculum-CBE%20Ready-green)
![Payments](https://img.shields.io/badge/Payments-M--Pesa%20Integrated-brightgreen)

## Current Status

TrendScore is in active v1.0 development. The core School ERP is functional and under continuous refinement, with the current focus on product identity cleanup, CBE/KJSEA grading correctness, reporting reliability, deployment hygiene, and preparing the public project for cleaner GitHub review.

Current working areas:

- Core School ERP modules are implemented across frontend and backend.
- CBE assessment, achievement levels, report cards, and administrative status-code handling are actively maintained.
- M-Pesa payment workflows are integrated through payment service layers.
- Deployment is managed through GitHub Actions, Docker builds, and a school-instance manifest.
- Public positioning is now aligned around TrendScore at https://www.trendscore.co.ke/.
- Digital Campus and Creators Hub are upcoming product tracks and should be treated as roadmap work, not fully shipped modules.

## Product Direction

TrendScore is organized around four product areas:

| Area | Status | Purpose |
| --- | --- | --- |
| Platform | Active | Multi-school operating layer, setup, deployment, identity, settings, backups, and system governance. |
| School ERP | Active | The main school management system for academics, finance, people, operations, and reports. |
| Digital Campus | Upcoming | Online learning, learner workspaces, digital classes, assignments, content, and remote engagement. |
| Creators Hub | Upcoming | A resource and content ecosystem for educators, content creators, templates, lessons, and assessments. |

## Core School ERP Modules

### 1. Institution Setup and Administration

TrendScore supports initial school setup, school profile configuration, branding, academic years, terms, user roles, permissions, and institution type selection. This allows the platform to adapt to CBC primary, junior school, senior school, and future tertiary workflows.

Key capabilities:

- School profile and branding settings.
- Superadmin bootstrap on first deployment.
- Role-based access control for admins, teachers, accountants, parents, and platform users.
- Module gating and per-school feature control.
- System settings, support, logs, backups, and maintenance tools.

### 2. Learner, Admissions, and Parent Records

The learner module manages the student lifecycle from admission to progression, transfer, archiving, and profile history. It keeps learner details connected to parent records, class placement, transport status, fee accounts, reports, and communication.

Key capabilities:

- Learner admission and profile management.
- Parent and guardian links.
- Class, stream, grade, and enrollment tracking.
- Learner photos and document records.
- Admission numbers and school-specific learner metadata.
- Exited or archived learner handling.

### 3. Academics and CBE Assessment

The academic engine is built around Kenyan CBE workflows. It supports formative assessment, summative assessment, grading scales, learning areas, strands, sub-strands, test setup, performance bands, and report generation.

Key capabilities:

- Learning area management.
- Formative observations and rubric-based scoring.
- Summative tests and mark entry.
- CBE achievement codes such as EE, ME, AE, and BE with detailed bands.
- Administrative assessment status codes such as absent, transferred, withdrawn, or exempt cases.
- Status-only results excluded from averages, ranking, analytics, and report calculations.
- Assessment setup, completion, ranking, summaries, and printable report cards.

### 4. Reports, Analytics, and Academic Intelligence

TrendScore includes dashboards and reporting workflows for academic performance, learner progress, class summaries, subject performance, pathway insights, and report-card production.

Key capabilities:

- Termly report cards.
- Formative and summative reports.
- Learner profile reporting.
- CBE achievement legends and status-code explanations.
- Class and learning-area summaries.
- Pathway prediction and senior school readiness insights.
- Academic dashboards for school leaders and teachers.

### 5. Fees, Invoicing, and M-Pesa Payments

The finance module manages fee structures, invoices, balances, payments, waivers, statements, receipts, and parent-facing fee visibility. It is designed for Kenyan school finance workflows and M-Pesa payment reconciliation.

Key capabilities:

- Fee structures by term, class, and fee type.
- Learner invoice generation.
- Student statements and printable invoices.
- Payment recording and reconciliation.
- M-Pesa/Daraja integration support.
- Unmatched payment handling.
- Waivers and adjustments.
- Parent fee statement visibility.

### 6. Accounting and Financial Control

TrendScore includes accounting workflows that connect school finance activity to a more structured ledger model. This supports better control over income, expenses, fee payments, payroll posting, journals, and financial reports.

Key capabilities:

- Chart of accounts.
- Journals and journal entries.
- Expense categories and expense recording.
- Financial reports.
- Bank reconciliation workflows.
- Automatic ledger posting hooks for fee and payroll activity.
- Accounting configuration screens.

### 7. HR, Staff, and Payroll

The HR module manages teachers, staff records, assignments, attendance, leave, payroll, and staff documents. It is designed to connect staff administration with class teaching duties and school operations.

Key capabilities:

- Teacher and staff profiles.
- Staff directory and documents.
- Subject and class assignment support.
- Payroll generation and confirmation.
- Payroll payment status tracking.
- Leave management.
- Staff attendance workflows.

### 8. Communication, Notices, and Support

TrendScore centralizes school communication across notices, messages, email, SMS, WhatsApp, and notification workflows. Communication settings are configurable so schools can connect the providers they use.

Key capabilities:

- Noticeboard and announcements.
- Parent, teacher, and school messaging.
- Email provider configuration.
- SMS provider configuration.
- WhatsApp service integration.
- Push notifications.
- Assessment report distribution.
- Fee reminders and attendance alerts.
- Support hub and help content.

### 9. Attendance and Biometric Readiness

Attendance workflows cover learner and staff attendance, with readiness for biometric bridge integration where schools use local scanning hardware.

Key capabilities:

- Daily learner attendance.
- Staff attendance.
- Attendance reports.
- Absence tracking.
- Parent alert workflows.
- Biometric device and bridge integration paths.

### 10. Timetable, Planner, and Calendar

The planner tools help schools organize academic activities, schedules, and calendar workflows.

Key capabilities:

- Timetable management.
- Academic calendar views.
- Planning pages and scheduling helpers.
- External calendar link support.
- Operational reminders and activity planning.

### 11. Transport, Hostel, and Movement Tracking

The transport module supports route and driver workflows, learner transport assignment, transport fees, and related operational reporting. Hostel and boarding allocation workflows are also part of the wider operations track.

Key capabilities:

- Transport fee logic.
- Route and driver management.
- Learner transport assignments.
- GPS tracking pages.
- Transport reports.
- Hostel allocation workflows.

### 12. Inventory, Assets, Uniforms, and Library

TrendScore includes inventory and asset tools for schools that need to track stock, assets, uniforms, books, and resource circulation.

Key capabilities:

- Inventory categories, stores, items, and stock movements.
- Stock requisitions, transfers, and adjustments.
- Asset register and asset assignments.
- Uniform allocation.
- Library catalog, circulation, and reports.
- Resource library foundations.

### 13. Learning Hub and LMS Foundations

The current codebase includes LMS and learning hub foundations. These are the base layer for richer Digital Campus work.

Key capabilities:

- Courses and learning hub pages.
- Assignment and content placeholders.
- Learner-facing learning workflows.
- Resource library integration.
- Future online-class and digital-content expansion.

### 14. Secondary, Senior School, and Pathways

TrendScore is being extended beyond basic primary workflows into junior and senior school pathways, with support for senior subject selection, pathway analysis, and institution-type-specific modules.

Key capabilities:

- Secondary module routes and pages.
- Senior school pathway models.
- Pathway prediction and learner pathway profiles.
- Senior school report foundations.
- Institution-aware module behavior.

## Upcoming Product Tracks

### Digital Campus

Digital Campus is the upcoming online learning experience for schools using TrendScore. It is expected to build on the existing LMS, learner portal, learning hub, resource library, assignments, calendar, and communication layers.

Planned direction:

- Digital classrooms and online learning spaces.
- Learner dashboards and assignment tracking.
- Teacher content delivery workflows.
- Course resources and school content libraries.
- Parent visibility into learning progress.
- Remote learning and blended learning support.

### Creators Hub

Creators Hub is the upcoming educator and content ecosystem around TrendScore. It is intended to support teachers, schools, and education creators who produce lessons, assessments, templates, guides, and learning resources.

Planned direction:

- Assessment templates and reusable CBE resources.
- Lesson plans, worksheets, and learning materials.
- Creator profiles and resource publishing.
- School-approved content libraries.
- Future marketplace or distribution workflows for educator-created content.

### Mobile Apps

Mobile apps remain part of the broader roadmap, especially for parent access, teacher attendance, notifications, report access, and fee visibility.

Planned direction:

- Parent app for fee statements, alerts, reports, and messages.
- Teacher app for attendance, marks entry, and class communication.
- Push notifications for urgent school updates.

## CBE Assessment Workflow

TrendScore follows a structured CBE workflow:

1. Configure academic year, terms, classes, streams, learning areas, and grading scales.
2. Create formative and summative assessment structures.
3. Record learner observations, marks, rubric levels, or valid administrative status codes.
4. Exclude status-only records from calculations where no academic score should be counted.
5. Generate summaries, rankings, analytics, and report cards.
6. Share reports through downloadable files or communication channels.

## Formative vs Summative Assessment

| Area | Formative Assessment | Summative Assessment |
| --- | --- | --- |
| Purpose | Assessment for learning during the term. | Assessment of learning at a defined point. |
| Frequency | Ongoing, daily, weekly, or per strand. | Mid-term, end-term, yearly, or structured tests. |
| Evidence | Rubrics, observations, skill mastery, comments. | Marks, percentages, grade bands, rankings, summaries. |
| Reporting | Feeds learner growth and progress records. | Feeds report cards, term summaries, and class analytics. |
| Weighting | Configurable by school policy. | Configurable by school policy. |

## Architecture

TrendScore is maintained as a monorepo.

| Path | Purpose |
| --- | --- |
| `/src` | React frontend for the School ERP user interface. |
| `/public` | Public assets, app metadata, service worker, and web manifest. |
| `/server` | Express API, Prisma models, services, controllers, routes, and backend jobs. |
| `/deploy` | Deployment documentation and instance manifest. |
| `.github/workflows` | CI, image publishing, demo deployment, and promotion workflows. |

## Tech Stack

- Frontend: React, Vite, Tailwind-style utility classes, Zustand-style state stores, Lucide icons.
- Backend: Node.js, Express, TypeScript, Prisma ORM.
- Database: PostgreSQL.
- Realtime: Socket.io for realtime alerts and app events.
- Payments: M-Pesa/Daraja integration paths and payment resolver services.
- Communication: Email, SMS, WhatsApp, and push-notification services.
- Media and documents: Cloudinary and document service layers.
- Caching: Redis-ready cache architecture with development fallbacks.
- Deployment: GitHub Actions, Docker image publishing, and school-instance promotion workflows.

## First Time Login

The backend can create or update the first Superadmin account during startup.

Set these in `server/.env` before first boot:

```bash
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=change-this-password
```

Do not commit real credentials. Rotate credentials immediately if they were ever shared publicly.

## Local Development

### 1. Clone

```bash
git clone https://github.com/Amalgamate/trendscore.git
cd trendscore
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Configure backend

```bash
cd server
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate deploy
npm run dev
```

### 4. Run frontend

```bash
cd ..
npm run dev
```

## Deployment

Deployment is designed around safe promotion rather than pushing every instance at once.

- Pushes to `main` build the application and deploy the demo/canary path.
- Production, pilot, or individual school deployments use the Promote Release workflow.
- School instances are tracked in `deploy/instances.manifest.json`.
- Deployment details live in `deploy/DEPLOYMENT.md` and `deploy/WORKFLOW.md`.

## Verification Commands

Useful checks before opening or merging a PR:

```bash
npm run build
cd server
npx tsc --noEmit
npx prisma validate
```

Focused CBE grading tests should be run from `server` when needed:

```bash
npx jest src/__tests__/cbe-grading.util.spec.ts --runInBand
```

## Repository Hygiene

This repository now uses `.gitattributes` to normalize line endings and reduce noisy diffs across Windows and Linux environments. Local archive/debug artifacts should stay out of active product commits unless they are intentionally promoted into maintained tooling.

## License and Ownership

Copyright 2026 TrendScore. Managed by Amalgamate.
