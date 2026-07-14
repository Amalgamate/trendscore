# PHASE 02 — Architecture

## Goal
Integrate the Pathway Decision Centre into the existing TrendScore platform without duplicating existing services.

## Module Boundaries
The module owns:
- Pathway orchestration
- Career exploration
- Subject combination planning
- School matching
- Parent collaboration
- Counsellor workflow

The module reuses:
- Authentication
- User management
- Assessments
- Recommendation engine
- Notifications
- Reports
- Analytics

## Stakeholder Views
- Student: My Future
- Parent: My Child's Future
- Counsellor: Decision Workspace
- School Admin: Pathway Analytics
- Super Admin: Configuration & Knowledge Base

## Integration Rules
- Extend existing models where possible.
- Never duplicate recommendation logic.
- Keep APIs role-aware.
- Maintain audit history for all decisions.

## Deliverables
Next phase defines the business domain model and entity relationships.
