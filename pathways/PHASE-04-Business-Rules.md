# PHASE 04 — Business Rules

## Objective
Capture the rules that govern recommendations and approvals.

## Recommendation Rules
- Every recommendation must include an explanation.
- Recommendations use existing TrendScore scoring.
- AI may enrich explanations but cannot override scoring.

## Student Rules
- Can explore careers and schools.
- Can save favourites.
- Cannot finalize without required approvals.

## Parent Rules
- Can provide preferences.
- Can comment.
- Cannot directly change recommendation scores.

## Counsellor Rules
- Reviews evidence.
- Adds notes.
- Approves or returns for revision.

## School Matching Rules
- Only schools offering the selected combination are eligible.
- Filters include county, boarding/day, affordability and learner preferences.

## Audit Rules
Every action must record:
- User
- Timestamp
- Previous state
- New state
- Reason (when applicable)

## Security
All operations are role-based and audited.

## Acceptance
No workflow bypasses the approval lifecycle.
