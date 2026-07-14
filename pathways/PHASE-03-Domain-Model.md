# PHASE 03 — Domain Model

## Objective
Define the core business entities, ownership and relationships for the Pathway Decision Centre.

## Core Entities
- Learner
- Parent
- Teacher
- Counsellor
- School
- Assessment
- Recommendation
- Pathway
- Track
- Subject Combination
- Career
- Senior School
- School Offering
- Family Preference
- Counselling Session
- Decision Plan
- Approval
- Audit Log

## Entity Relationships
Learner
→ Assessments
→ Recommendation
→ Pathway
→ Track
→ Subject Combination
→ Career Options
→ School Matches
→ Decision Plan
→ Final Approval

## Ownership
- Learner owns exploration.
- Parent owns family preferences.
- Counsellor owns review.
- School owns offerings.
- TrendScore owns reference data.

## Lifecycle
Draft → Recommended → Under Review → Parent Reviewed → Counsellor Approved → Locked

## Versioning
Reference data (pathways, careers, combinations and schools) must be versioned and never overwritten.

## Deliverable
A normalized schema extending the existing TrendScore models without duplication.
