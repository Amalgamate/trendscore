# Rollback notes

This migration adds case-management data and should not be rolled back in normal
operation. If an emergency rollback is required, export
`pathway_interventions`, then drop that table and remove the added columns from
`counselling_sessions` and `action_items`. Removing those columns destroys
session outcomes, follow-up data, action priority, and completion notes.
