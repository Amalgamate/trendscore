# Dashboard Data Source Notes

This file tracks dashboard sections that were previously filled with local sample data and now either use live endpoints or show an empty state until a matching backend source exists.

## Wired to Existing Sources

- Parent dashboard: children, attendance summary, fee balances, latest result summaries, and school notices use `GET /api/dashboard/parent`.
- Parent dashboard homework uses LMS assignments from learner course enrollments via `GET /api/dashboard/parent`.
- Parent and teacher dashboard messages use message receipts and user notifications via their role dashboard endpoints.
- Teacher dashboard: assigned classes, today's schedule when timetable rows exist, attendance due, draft assessments, and learner-risk items use `GET /api/dashboard/teacher`.
- Head teacher dashboard: academic metrics, assessment completion by grade, classes requiring assessment attention, attendance trends, and subject-wise teacher attendance use `GET /api/dashboard/admin`.
- Accountant dashboard: ledger balances, recent posted entries, bank account cards, overdue invoice totals, and reconciliation totals use `GET /api/accounting/dashboard-stats`; fee collection totals and monthly collection trend use `GET /api/dashboard/admin`.

## No Current Data Source

- Teacher attendance grouping uses `User.subject` because school staff users do not currently have a department field.
- LMS assignment content does not currently store due dates or grades, so parent homework returns `dueDate: null` and submission state from LMS progress.
- Accountant bank account cards use cash ledger accounts and latest bank statements. The schema does not store external bank account numbers for `Account`, so the card uses the account code.
