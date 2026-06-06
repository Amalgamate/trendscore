# Assessment Reporting Architecture Audit

## Existing Assessment Routes Found

- Primary CBC: `assess-mobile-dashboard`, `assess-formative`, `assess-formative-report`, `assess-summative-tests`, `assess-summative-assessment`, `assess-summative-report`, `assess-summary-report`, `assess-subject-analysis`, `assess-custom-reports`, `assess-termly-report`, `assess-values`, `assess-cocurricular`, `assess-core-competencies`, `assess-learning-areas`, `assess-performance-scale`.
- Secondary aliases: `sec-mark-entry`, `sec-cats`, `sec-mid-term`, `sec-end-term`, `sec-kcse-mock`, `sec-mean-grades`, `sec-rankings`, `sec-subject-analysis`, `sec-report-cards`, `sec-kcse-prediction`.
- Tertiary placeholders: `tert-cats`, `tert-exams`, `tert-mark-entry`, `tert-grade-sheet`, `tert-unit-results`, `tert-gpa`, `tert-semester-report`, `tert-transcripts`, `tert-classifications`.

## Existing Assessment Pages Found

- Operational pages: `MobileAssessmentsDashboard`, `SummativeTestsRouter`, `SummativeAssessmentRouter`, `SummativeReport`, `SummaryReportPage`, `FormativeAssessment`, `FormativeReport`, `TermlyReport`, `ValuesAssessment`, `CoCurricularActivities`, `CoreCompetenciesAssessment`, `LearningAreasManagement`, `PerformanceScale`.
- Reporting and analysis pages: `CustomReportsPage`, `ResultsWorkbench`, `ReportsHub`.

## Existing Menu Items Found

- Primary Assessment previously grouped into `Summative`, `Formative`, `CBC Holistic`, and `Configuration`.
- Secondary has separate `Assessment` and `Results & Reports` sections.
- Tertiary has separate `Assessment` and `Results & Transcripts` sections, mostly coming-soon placeholders.

## Operational Assessment Pages

- Assessment Overview, Assessments, Assessment Matrix, Grade Sheet, Stream Sheet, Learner Sheet, Report Cards, Print Center, Configuration.
- These pages support creating tests, entering marks, generating sheets, generating report cards, and configuring assessment setup.

## Pages Moved To Academic Intelligence

- `assess-subject-analysis` is preserved as an alias and re-presented as `academic-subject-intelligence` / Subject Intelligence.
- `assess-custom-reports` is preserved as an alias and re-presented as `academic-top-bottom-performers` / Top / Bottom Performers.
- Future Academic Intelligence placeholders were added for Executive Dashboard, Section Analysis, Gender Analysis, Stream Analysis, Competency Analysis, Learner Risk, Growth Trends, and AI Insights.

## Risky Dependencies Preserved

- `SummativeReport` contains the working Grade Sheet, Stream Sheet, Learner Sheet, Subject Analysis, and custom report logic. The operational sheet routes still reuse this component instead of duplicating it.
- `CustomReportsPage` fetches live learners and bulk assessment results through `api.learners.getAll` and `api.assessments.getBulkResults`; this was renamed visually but not rewritten.
- `ResultsWorkbench` is shared by secondary analysis routes and the new Subject Intelligence route.
- `PageRouter` keeps old route IDs alive to avoid broken legacy links.
- `HorizontalSubmenu` and `Sidebar` both call `onNavigate`; param support was preserved so sheet menu entries can pass report type context safely.
