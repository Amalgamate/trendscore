import React, { lazy, Suspense, useState, useEffect } from 'react';
import ErrorBoundary from '../shared/ErrorBoundary';
import EmptyState from '../shared/EmptyState';
import ComingSoon from '../shared/ComingSoon';
import { hasPageAccess } from '../utils/appAccess';
import { useRolePreview } from '../../../contexts/RolePreviewContext';
import { PRODUCT_DISPLAY_NAME } from '../../../config/productIdentity';

// ── Dashboard — EAGERLY imported: it's the first page every user sees after login.
// Never lazy-load the default landing page — it forces a Suspense stall on every cold open.
import RoleDashboard from '../pages/dashboard/RoleDashboard';
import DashboardPageLayout from '../pages/dashboard/DashboardPageLayout';
// Student dashboard also eager — it's the default page for STUDENT role
import StudentDashboardView from '../pages/student/StudentDashboard';
import FeeCollectionPage from '../pages/FeeCollectionPage';
const LearnersList = lazy(() => import('../pages/LearnersList'));
const TeachersList = lazy(() => import('../pages/TeachersList'));
const AddEditTeacherPage = lazy(() => import('../pages/AddEditTeacherPage'));
const ParentsList = lazy(() => import('../pages/ParentsList'));
const LearningHubPage = lazy(() => import('../pages/LearningHubPage'));
const PromotionPage = lazy(() => import('../pages/PromotionPage'));
const TransferOutPage = lazy(() => import('../pages/TransferOutPage'));
const DailyAttendance = lazy(() => import('../pages/DailyAttendanceAPI'));
const AttendanceReports = lazy(() => import('../pages/AttendanceReports'));
const AdmissionsPage = lazy(() => import('../pages/AdmissionsPage'));
const TransfersInPage = lazy(() => import('../pages/TransfersInPage'));
const ExitedLearnersPage = lazy(() => import('../pages/ExitedLearnersPage'));
const FormativeAssessment = lazy(() => import('../pages/FormativeAssessment'));
const FormativeReport = lazy(() => import('../pages/FormativeReport'));
const MobileAssessmentsDashboard = lazy(() => import('../pages/MobileAssessmentsDashboard'));
const SummativeTestsRouter = lazy(() => import('../pages/SummativeTestsRouter'));
const SummativeAssessmentRouter = lazy(() => import('../pages/SummativeAssessmentRouter'));
const SummativeReport = lazy(() => import('../pages/SummativeReport'));
const CustomReportsPage = lazy(() => import('../pages/CustomReportsPage'));
const TermlyReport = lazy(() => import('../pages/TermlyReport'));
const ValuesAssessment = lazy(() => import('../pages/ValuesAssessment'));
const CoCurricularActivities = lazy(() => import('../pages/CoCurricularActivities'));
const CoreCompetenciesAssessment = lazy(() => import('../pages/CoreCompetenciesAssessment'));
const SummaryReportPage = lazy(() => import('../pages/reports/SummaryReportPage'));
const PerformanceScale = lazy(() => import('../pages/PerformanceScale'));
const LearningAreasManagement = lazy(() => import('../pages/LearningAreasManagement'));
const FacilityManager = lazy(() => import('../pages/FacilityManager'));
const NoticesPage = lazy(() => import('../pages/NoticesPage'));
const MessagesPage = lazy(() => import('../pages/MessagesPage'));
const MessageHistoryPage = lazy(() => import('../pages/MessageHistoryPage'));
const SupportHub = lazy(() => import('../pages/SupportHub'));
const TimetablePage = lazy(() => import('../pages/TimetablePage'));
const CodingPlayground = lazy(() => import('../pages/CodingPlayground'));
const ClassList = lazy(() => import('../pages/ClassList'));
const CreateClassForm = lazy(() => import('../pages/CreateClassForm'));
const ClassDetailPage = lazy(() => import('../pages/ClassDetailPage'));
const SchoolSettings = lazy(() => import('../pages/settings/SchoolSettings'));
const AcademicSettings = lazy(() => import('../pages/settings/AcademicSettings'));
const UserManagement = lazy(() => import('../pages/settings/UserManagement'));
const CommunicationSettings = lazy(() => import('../pages/settings/CommunicationSettings'));
const PaymentSettings = lazy(() => import('../pages/settings/PaymentSettings'));
const IDCardTemplatesDesigner = lazy(() => import('../pages/settings/IDCardTemplatesDesigner'));
const SystemLogsPage = lazy(() => import('../pages/settings/SystemLogsPage'));
const SystemControlPage = lazy(() => import('../pages/settings/SystemControlPage'));
const InvoiceDetailPage = lazy(() => import('../pages/InvoiceDetailPage'));
const RecordPaymentPage = lazy(() => import('../pages/RecordPaymentPage'));
const FeeTypesPage = lazy(() => import('../pages/FeeTypesPage'));
const FeeStructurePage = lazy(() => import('../pages/FeeStructurePage'));
const FeeReportsPage = lazy(() => import('../pages/FeeReportsPage'));
const WaiversPage = lazy(() => import('../pages/WaiversPage'));
const StudentStatementsPage = lazy(() => import('../pages/StudentStatementsPage'));
const UnmatchedPaymentsPanel = lazy(() => import('../pages/fees/UnmatchedPaymentsPanel'));
const DocumentCenter = lazy(() => import('../pages/DocumentCenter'));
const SystemMaintenancePage = lazy(() => import('../pages/SystemMaintenancePage'));
const LearnerProfile = lazy(() => import('../pages/profiles/LearnerProfile'));
const TeacherProfile = lazy(() => import('../pages/profiles/TeacherProfile'));
const ParentProfile = lazy(() => import('../pages/profiles/ParentProfile'));
const PlannerLayout = lazy(() => import('../pages/planner/PlannerLayout'));
const DutyRosterPage = lazy(() => import('../pages/planner/DutyRosterPage'));
const ParentEventsPage = lazy(() => import('../pages/parent/ParentEventsPage'));
const UniformAllocationPage = lazy(() => import('../pages/UniformAllocationPage'));
const IDPrintingPage = lazy(() => import('../pages/IDPrintingPage'));
const PathwaysHub = lazy(() => import('../pages/secondary/PathwaysHub'));
const SubjectManagement = lazy(() => import('../pages/secondary/SubjectManagement'));
const FormGroups = lazy(() => import('../pages/secondary/FormGroups'));
const ReportsHub = lazy(() => import('../pages/secondary/ReportsHub'));
const ResultsWorkbench = lazy(() => import('../pages/secondary/ResultsWorkbench'));
const AcademicIntelligenceShell = lazy(() => import('../pages/academic-intelligence/AcademicIntelligenceShell'));
const AnalyticsDashboards = lazy(() => import('../pages/academic-intelligence/AnalyticsDashboards'));
const SectionAnalysis = lazy(() => import('../pages/academic-intelligence/SectionAnalysis'));
const SubjectIntelligence = lazy(() => import('../pages/academic-intelligence/SubjectIntelligence'));
const GenderAnalysis = lazy(() => import('../pages/academic-intelligence/GenderAnalysis'));
const CompetencyAnalysis = lazy(() => import('../pages/academic-intelligence/CompetencyAnalysis'));
const LearnerRiskCenter = lazy(() => import('../pages/academic-intelligence/LearnerRiskCenter'));
const GrowthTrends = lazy(() => import('../pages/academic-intelligence/GrowthTrends'));
const AIInsights = lazy(() => import('../pages/academic-intelligence/AIInsights'));
const AcademicIntelligenceComingSoon = lazy(() => import('../pages/academic-intelligence/AcademicIntelligenceShell').then((module) => ({
  default: module.AcademicIntelligenceComingSoon,
})));

// HR Module
const HRManager = lazy(() => import('../pages/hr/HRManager'));
const StaffDirectory = lazy(() => import('../pages/hr/StaffDirectory'));
const LeaveManager = lazy(() => import('../pages/hr/LeaveManager'));
const PayrollManager = lazy(() => import('../pages/hr/PayrollManager'));
const StaffDocuments = lazy(() => import('../pages/hr/StaffDocuments'));
const PerformanceManager = lazy(() => import('../pages/hr/PerformanceManager'));

// Accounting Module
const AccountingManager = lazy(() => import('../pages/accounting/AccountingManager'));
const AccountingConfiguration = lazy(() => import('../pages/accounting/AccountingConfiguration'));
const ChartOfAccounts = lazy(() => import('../pages/accounting/ChartOfAccounts'));
const JournalEntries = lazy(() => import('../pages/accounting/JournalEntries'));
const ExpenseManager = lazy(() => import('../pages/accounting/ExpenseManager'));
const VendorManager = lazy(() => import('../pages/accounting/VendorManager'));
const BankReconciliation = lazy(() => import('../pages/accounting/BankReconciliation'));
const FinancialReports = lazy(() => import('../pages/accounting/FinancialReports'));

// Inventory Module
const InventoryItems = lazy(() => import('../pages/inventory/InventoryItems'));
const InventoryCategories = lazy(() => import('../pages/inventory/InventoryCategories'));
const InventoryStores = lazy(() => import('../pages/inventory/InventoryStores'));
const StockMovements = lazy(() => import('../pages/inventory/StockMovements'));
const StockRequisitions = lazy(() => import('../pages/inventory/StockRequisitions'));
const StockTransfers = lazy(() => import('../pages/inventory/StockTransfers'));
const StockAdjustments = lazy(() => import('../pages/inventory/StockAdjustments'));
const AssetRegister = lazy(() => import('../pages/inventory/AssetRegister'));
const AssetAssignments = lazy(() => import('../pages/inventory/AssetAssignments'));

// Transport, Library and Biometrics Modules
const TransportManager    = lazy(() => import('../pages/transport/TransportManager'));
const TransportReports    = lazy(() => import('../pages/transport/TransportReports'));
const GPSTracking         = lazy(() => import('../pages/transport/GPSTracking'));
const DriverManagement    = lazy(() => import('../pages/transport/DriverManagement'));
const TransportFeeManager = lazy(() => import('../pages/transport/TransportFeeManager'));
const HostelAllocation    = lazy(() => import('../pages/transport/HostelAllocation'));
const LibraryManager = lazy(() => import('../pages/library/LibraryManager'));
const BiometricManager = lazy(() => import('../pages/biometric/BiometricManager'));

// LMS Module
const LMSManager = lazy(() => import('../pages/LMSManager'));
const LMSAssignments = lazy(() => import('../pages/lms/LMSAssignments'));

// Student Portal
const MyCourses = lazy(() => import('../pages/student/MyCourses'));
const CourseViewer = lazy(() => import('../pages/student/CourseViewer'));
const MyAssignments = lazy(() => import('../pages/student/MyAssignments'));
const MyProgress = lazy(() => import('../pages/student/MyProgress'));

// Mobile Components
const MobileUserManagement = lazy(() => import('../dashboard/mobile/MobileUserManagement'));
const MobileGeneralSettings = lazy(() => import('../dashboard/mobile/MobileGeneralSettings'));

const ACADEMIC_INTELLIGENCE_PAGE_COPY = {
  'academic-intelligence': {
    title: 'Analytics Dashboards',
    eyebrow: 'Academic Intelligence',
    breadcrumbs: ['Assessment', 'Academic Intelligence', 'Analytics Dashboards'],
    description: 'A consolidated academic intelligence view is planned for performance, completion, intervention and trend signals.',
  },
  'academic-section-analysis': {
    title: 'Section Analysis',
    eyebrow: 'Academic Intelligence',
    breadcrumbs: ['Assessment', 'Academic Intelligence', 'Section Analysis'],
    description: 'Compare academic performance by school section once section-level analytics are connected.',
  },
  'academic-gender-analysis': {
    title: 'Gender Analysis',
    eyebrow: 'Academic Intelligence',
    breadcrumbs: ['Assessment', 'Academic Intelligence', 'Gender Analysis'],
    description: 'Review gender-based academic patterns and equity indicators.',
  },
  'academic-stream-analysis': {
    title: 'Stream Analysis',
    eyebrow: 'Academic Intelligence',
    breadcrumbs: ['Assessment', 'Academic Intelligence', 'Stream Analysis'],
    description: 'Compare streams and detect class-level performance movement.',
  },
  'academic-competency-analysis': {
    title: 'Competency Analysis',
    eyebrow: 'Academic Intelligence',
    breadcrumbs: ['Assessment', 'Academic Intelligence', 'Competency Analysis'],
    description: 'Analyze competency development across CBC learning areas.',
  },
  'academic-learner-risk': {
    title: 'Learner Risk',
    eyebrow: 'Academic Intelligence',
    breadcrumbs: ['Assessment', 'Academic Intelligence', 'Learner Risk'],
    description: 'Identify learners needing academic intervention from assessment trends.',
  },
  'academic-growth-trends': {
    title: 'Growth Trends',
    eyebrow: 'Academic Intelligence',
    breadcrumbs: ['Assessment', 'Academic Intelligence', 'Growth Trends'],
    description: 'Track learner, class and subject growth across terms.',
  },
  'academic-ai-insights': {
    title: 'AI Insights',
    eyebrow: 'Academic Intelligence',
    breadcrumbs: ['Assessment', 'Academic Intelligence', 'AI Insights'],
    description: 'Surface explainable insights after the academic intelligence engine is connected.',
  },
  'academic-subject-intelligence': {
    title: 'Subject Analysis',
    eyebrow: 'Academic Intelligence',
    breadcrumbs: ['Assessment', 'Academic Intelligence', 'Subject Analysis'],
    description: 'Analyze subject-level performance using the existing subject analysis workbench.',
  },
  'academic-top-bottom-performers': {
    title: 'Top / Bottom Performers',
    eyebrow: 'Academic Intelligence',
    breadcrumbs: ['Assessment', 'Academic Intelligence', 'Top / Bottom Performers'],
    description: 'Rank top and bottom learners by grade, stream, term and academic category.',
  },
};

const LoadingOverlay = () => (
  <div className="flex-1 flex flex-col gap-4 p-6 animate-pulse">
    {/* Page title skeleton */}
    <div className="h-8 w-48 bg-gray-200 rounded-lg" />
    {/* Metric cards row */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 bg-gray-200 rounded-xl" />
      ))}
    </div>
    {/* Content block */}
    <div className="flex gap-4 flex-1">
      <div className="flex-1 bg-gray-200 rounded-xl min-h-[200px]" />
      <div className="w-64 bg-gray-200 rounded-xl hidden lg:block" />
    </div>
    {/* Table skeleton */}
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-10 bg-gray-100 rounded-lg" />
      ))}
    </div>
  </div>
);

const PageRouter = ({
  currentPage,
  pageParams,
  user,
  learners,
  teachers,
  parents,
  pagination,
  teacherPagination,
  parentPagination,
  learnersLoading,
  brandingSettings,
  editingLearner,
  editingTeacher,
  handlers
}) => {
  const rolePreview = useRolePreview();
  const effectiveRole = rolePreview?.effectiveRole || user?.role;
  
  // Mobile detection for responsive routes
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    setIsMobile(mediaQuery.matches);
    const handleMediaChange = (e) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);
  
  const {
    handleNavigate,
    fetchLearners,
    handleAddLearner,
    handleEditLearner,
    handleViewLearner,
    handleMarkAsExited,
    handleDeleteLearner,
    handleBulkDeleteLearners,
    handleSaveLearner,
    setCurrentPage,
    setEditingLearner,
    handlePromoteLearners,
    handleTransferOut,
    fetchTeachers,
    handleAddTeacher,
    handleEditTeacher,
    handleViewTeacher,
    handleDeleteTeacher,
    handleSaveTeacher,
    setEditingTeacher,
    fetchParents,
    handleAddParent,
    handleEditParent,
    handleViewParent,
    handleDeleteParent,
    handleArchiveParent,
    showSuccess
  } = handlers;

  const normalizedPage = currentPage?.split('?')[0] || 'dashboard';
  const admissionLearnerId = pageParams?.learnerId || pageParams?.learner?.id || editingLearner?.id;
  const admissionLearner = editingLearner
    || pageParams?.learner
    || (admissionLearnerId ? learners?.find((learner) => learner.id === admissionLearnerId) : null);
  const renderAcademicIntelligencePage = (activePage, content, fallbackCopy = {}) => {
    const copy = ACADEMIC_INTELLIGENCE_PAGE_COPY[activePage] || fallbackCopy;
    return (
      <AcademicIntelligenceShell
        activePage={activePage}
        title={copy.title}
        eyebrow={copy.eyebrow}
        description={copy.description}
        breadcrumbs={copy.breadcrumbs}
        filters={copy.filters}
        onNavigate={handleNavigate}
      >
        {content}
      </AcademicIntelligenceShell>
    );
  };

  const renderAcademicIntelligencePlaceholder = (activePage) => {
    const copy = ACADEMIC_INTELLIGENCE_PAGE_COPY[activePage] || {
      title: 'Academic Intelligence',
      description: 'This Academic Intelligence workspace is planned.',
    };
    return renderAcademicIntelligencePage(
      activePage,
      <AcademicIntelligenceComingSoon
        title={copy.title}
        description={copy.description}
      />,
      copy
    );
  };

  if (!hasPageAccess(user, normalizedPage)) {
    return (
      <EmptyState
        title="Module Disabled"
        description="This module is not enabled for your school."
      />
    );
  }

  return (
    <Suspense fallback={<LoadingOverlay />}>
      {(() => {
        switch (normalizedPage) {
          case 'dashboard':
            return effectiveRole === 'STUDENT'
              ? <StudentDashboardView user={user} onNavigate={handleNavigate} />
              : <RoleDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={handleNavigate} />;
          case 'finance-dashboard':
            return <RoleDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={handleNavigate} />;

          // Planner Module
          case 'planner-calendar':
          case 'planner-timetable':
          case 'planner-agenda':
          case 'planner-schemes':
            return <DashboardPageLayout activeTab="calendar" onNavigate={handleNavigate}><PlannerLayout currentPage={currentPage === 'events-calendar' ? 'planner-calendar' : currentPage} onNavigate={handleNavigate} /></DashboardPageLayout>;
          case 'planner-duty-roster':
            return <DutyRosterPage />;
          case 'events-calendar':
            return user?.role === 'PARENT'
              ? <ParentEventsPage />
              : <DashboardPageLayout activeTab="calendar" onNavigate={handleNavigate}><PlannerLayout currentPage="planner-calendar" onNavigate={handleNavigate} /></DashboardPageLayout>;

          // Learners Module
          case 'learners-list':
            return (
              <ErrorBoundary>
                <LearnersList
                  learners={learners}
                  loading={learnersLoading}
                  pagination={pagination}
                  onFetchLearners={fetchLearners}
                  onAddLearner={handleAddLearner}
                  onEditLearner={handleEditLearner}
                  onViewLearner={handleViewLearner}
                  onMarkAsExited={handleMarkAsExited}
                  onDeleteLearner={handleDeleteLearner}
                  onBulkDelete={handleBulkDeleteLearners}
                  onRefresh={fetchLearners}
                />
              </ErrorBoundary>
            );
          case 'learners-admissions':
            return (
              <AdmissionsPage
                onSave={handleSaveLearner}
                onCancel={() => {
                  setCurrentPage('learners-list');
                  setEditingLearner(null);
                }}
                onDelete={admissionLearner ? () => handleDeleteLearner(admissionLearner.id) : null}
                learner={admissionLearner}
                learnerId={admissionLearnerId}
              />
            );
          case 'learners-transfers-in': return <TransfersInPage />;
          case 'learners-exited': return <ExitedLearnersPage />;
          case 'learners-promotion':
            return <PromotionPage learners={learners} onPromote={handlePromoteLearners} showNotification={showSuccess} />;
          case 'learners-transfer-out':
            return <TransferOutPage learners={learners} onTransferOut={handleTransferOut} showNotification={showSuccess} />;
          case 'learners-uniform': return <UniformAllocationPage />;
          case 'learners-id-print': return <IDPrintingPage />;

          case 'learner-profile':
            return <LearnerProfile learner={pageParams.learner} onBack={() => handleNavigate('learners-list')} brandingSettings={brandingSettings} onNavigate={handleNavigate} />;

          // Teachers Module
          case 'teachers-list':
            return (
              <TeachersList
                teachers={teachers}
                pagination={teacherPagination}
                onFetchTeachers={fetchTeachers}
                onAddTeacher={handleAddTeacher}
                onEditTeacher={handleEditTeacher}
                onViewTeacher={handleViewTeacher}
                onDeleteTeacher={handleDeleteTeacher}
                onRefresh={fetchTeachers}
              />
            );
          case 'teacher-profile':
            return <TeacherProfile teacher={pageParams.teacher} onBack={() => handleNavigate('teachers-list')} onEdit={handleEditTeacher} />;
          case 'add-teacher':
            return (
              <AddEditTeacherPage
                onSave={handleSaveTeacher}
                onCancel={() => {
                  setCurrentPage('teachers-list');
                  setEditingTeacher(null);
                }}
                teacher={editingTeacher}
              />
            );

          // Parents Module
          case 'parents-list':
            return (
              <ParentsList
                parents={parents}
                pagination={parentPagination}
                onFetchParents={fetchParents}
                onAddParent={handleAddParent}
                onEditParent={handleEditParent}
                onViewParent={handleViewParent}
                onDeleteParent={handleDeleteParent}
                onArchiveParent={handleArchiveParent}
              />
            );
          case 'parent-profile':
            return <ParentProfile parent={pageParams.parent} onBack={() => handleNavigate('parents-list')} />;

          // Others
          case 'timetable': return <TimetablePage />;
          case 'coding-playground': return <CodingPlayground />;
          case 'attendance-daily': return <DailyAttendance learners={learners} />;
          case 'attendance-reports': return <DashboardPageLayout activeTab="operations" onNavigate={handleNavigate}><AttendanceReports learners={learners} /></DashboardPageLayout>;

          // Assessment Module
          case 'assess-mobile-dashboard':
            return <MobileAssessmentsDashboard learners={learners} brandingSettings={brandingSettings} onNavigate={handleNavigate} />;
          case 'assess-formative': return <ErrorBoundary><FormativeAssessment learners={learners} /></ErrorBoundary>;
          case 'assess-formative-report': return <ErrorBoundary><FormativeReport learners={learners} brandingSettings={brandingSettings} user={user} /></ErrorBoundary>;
          case 'assess-summative-tests': return <ErrorBoundary><SummativeTestsRouter onNavigate={handleNavigate} defaultTestType={pageParams.defaultTestType} /></ErrorBoundary>;
          case 'assess-summative-assessment': return <ErrorBoundary><SummativeAssessmentRouter learners={learners} initialTestId={pageParams.initialTestId} defaultTestType={pageParams.defaultTestType} brandingSettings={brandingSettings} /></ErrorBoundary>;
          case 'assess-summative-report': return <ErrorBoundary><SummativeReport learners={learners} onFetchLearners={fetchLearners} brandingSettings={brandingSettings} user={user} pageParams={pageParams} onNavigate={handleNavigate} /></ErrorBoundary>;
          case 'assess-summary-report': return <ErrorBoundary><SummaryReportPage pageParams={pageParams} /></ErrorBoundary>;
          case 'assess-termly-report': return <ErrorBoundary><TermlyReport learners={learners} brandingSettings={brandingSettings} user={user} pageParams={pageParams} /></ErrorBoundary>;
          case 'assess-values': return <ValuesAssessment learners={learners} />;
          case 'assess-cocurricular': return <CoCurricularActivities learners={learners} />;
          case 'assess-core-competencies': return <CoreCompetenciesAssessment learners={learners} />;
          case 'assess-learning-areas': return <LearningAreasManagement />;
          case 'assess-performance-scale': return <PerformanceScale />;
          case 'assess-print-center':
            return <ComingSoon badge="Assessment" title="Print Center - Coming soon" description="Centralized printing for sheets, report cards and assessment packs will be connected here." />;

          // Academic Intelligence Module
          case 'academic-intelligence':
            return renderAcademicIntelligencePage(
              'academic-intelligence',
              <AnalyticsDashboards learners={learners} />,
              ACADEMIC_INTELLIGENCE_PAGE_COPY['academic-intelligence']
            );
          case 'academic-section-analysis':
            return renderAcademicIntelligencePage(
              'academic-section-analysis',
              <SectionAnalysis learners={learners} />,
              ACADEMIC_INTELLIGENCE_PAGE_COPY['academic-section-analysis']
            );
          case 'academic-gender-analysis':
            return renderAcademicIntelligencePage(
              'academic-gender-analysis',
              <GenderAnalysis learners={learners} />,
              ACADEMIC_INTELLIGENCE_PAGE_COPY['academic-gender-analysis']
            );
          case 'academic-competency-analysis':
            return renderAcademicIntelligencePage(
              'academic-competency-analysis',
              <CompetencyAnalysis learners={learners} />,
              ACADEMIC_INTELLIGENCE_PAGE_COPY['academic-competency-analysis']
            );
          case 'academic-learner-risk':
            return renderAcademicIntelligencePage(
              'academic-learner-risk',
              <LearnerRiskCenter learners={learners} />,
              ACADEMIC_INTELLIGENCE_PAGE_COPY['academic-learner-risk']
            );
          case 'academic-growth-trends':
            return renderAcademicIntelligencePage(
              'academic-growth-trends',
              <GrowthTrends learners={learners} />,
              ACADEMIC_INTELLIGENCE_PAGE_COPY['academic-growth-trends']
            );
          case 'academic-ai-insights':
            return renderAcademicIntelligencePage(
              'academic-ai-insights',
              <DashboardPageLayout activeTab="insights" onNavigate={handleNavigate}><AIInsights /></DashboardPageLayout>,
              ACADEMIC_INTELLIGENCE_PAGE_COPY['academic-ai-insights']
            );
          case 'academic-stream-analysis':
            return renderAcademicIntelligencePlaceholder(normalizedPage);
          case 'academic-subject-intelligence':
          case 'assess-subject-analysis':
            return renderAcademicIntelligencePage(
              'academic-subject-intelligence',
              <SubjectIntelligence learners={learners} />,
              ACADEMIC_INTELLIGENCE_PAGE_COPY['academic-subject-intelligence']
            );
          case 'academic-top-bottom-performers':
          case 'assess-custom-reports':
            return renderAcademicIntelligencePage(
              'academic-top-bottom-performers',
              <ErrorBoundary><CustomReportsPage onNavigate={handleNavigate} user={user} brandingSettings={brandingSettings} /></ErrorBoundary>,
              ACADEMIC_INTELLIGENCE_PAGE_COPY['academic-top-bottom-performers']
            );

          // Classes Module
          case 'classes': return <ClassList />;
          case 'create-class': return <CreateClassForm />;
          case 'class-detail': return <ClassDetailPage pageParams={pageParams} />;

          // Accounting Module
          case 'accounting-dashboard': return <AccountingManager user={user} />;
          case 'accounting-accounts': return <ChartOfAccounts />;
          case 'accounting-entries': return <JournalEntries />;
          case 'accounting-expenses': return <ExpenseManager />;
          case 'accounting-vendors': return <VendorManager />;
          case 'accounting-reconciliation': return <BankReconciliation />;
          case 'accounting-reports': return <FinancialReports />;
          case 'accounting-config': return <AccountingConfiguration />;

          case 'facilities-classes': return <FacilityManager />;
          case 'hostel-allocation':   return <HostelAllocation />;
          case 'learning-hub-materials':
          case 'learning-hub-lesson-plans':
          case 'learning-hub-library':
            return <LearningHubPage />;
          case 'learning-hub-assignments':
            return <LMSAssignments />;

          // LMS Module
          case 'lms-courses': return <LMSManager currentPage={currentPage} />;
          case 'lms-content': return <LMSManager currentPage={currentPage} />;
          case 'lms-enrollments': return <LMSManager currentPage={currentPage} />;
          case 'lms-progress': return <LMSManager currentPage={currentPage} />;
          case 'lms-reports': return <LMSManager currentPage={currentPage} />;

          // Student Portal
          case 'student-courses': return <ErrorBoundary><MyCourses onNavigate={handleNavigate} /></ErrorBoundary>;
          case 'student-assignments': return <ErrorBoundary><MyAssignments onNavigate={handleNavigate} /></ErrorBoundary>;
          case 'student-quizzes':
          case 'student-progress': return <ErrorBoundary><MyProgress onNavigate={handleNavigate} /></ErrorBoundary>;
          case 'student-course-view': return <ErrorBoundary><CourseViewer courseId={pageParams.courseId} onNavigate={handleNavigate} /></ErrorBoundary>;

          // Library Module
          case 'library-catalog':
          case 'library-circulation':
          case 'library-fees':
          case 'library-inventory':
          case 'library-members':
            return <LibraryManager currentPage={currentPage} />;

          // ── Transport Module ───────────────────────────────────────────────
          case 'transport-routes':    return <TransportManager />;
          case 'transport-tracking':  return <GPSTracking />;
          case 'transport-drivers':   return <DriverManagement />;
          case 'transport-students':  return <TransportManager />; // opens TransportManager on students tab via deep-link
          case 'hostel-fees':         return <TransportFeeManager onEditLearner={handleEditLearner} onViewLearner={handleViewLearner} />;
          case 'transport-reports':   return <TransportReports />;

          // Biometric Module
          case 'biometric-devices':
          case 'biometric-enrollment':
          case 'biometric-logs':
          case 'biometric-reports':
          case 'biometric-api':
          case 'biometric-dashboard':
            return <BiometricManager currentPage={currentPage} />;

          case 'comm-notices':
            return user?.role === 'PARENT'
              ? <MessagesPage />
              : <NoticesPage initialTab={pageParams.activeTab} />;
          case 'comm-messages': return <MessagesPage />;
          case 'comm-history':
            return user?.role === 'PARENT'
              ? <MessagesPage />
              : <MessageHistoryPage />;

          case 'inventory-items': return <DashboardPageLayout activeTab="inventory" onNavigate={handleNavigate}><InventoryItems /></DashboardPageLayout>;
          case 'inventory-categories': return <InventoryCategories />;
          case 'inventory-stores': return <InventoryStores />;
          case 'inventory-movements': return <StockMovements />;
          case 'inventory-requisitions': return <StockRequisitions />;
          case 'inventory-transfers': return <StockTransfers />;
          case 'inventory-adjustments': return <StockAdjustments />;
          case 'inventory-assets': return <AssetRegister />;
          case 'inventory-class-assignments': return <AssetAssignments />;

          case 'docs-center': return <DocumentCenter />;

          case 'fees-structure': return <FeeStructurePage />;
          case 'fees-types': return <FeeTypesPage />;
          case 'fees-invoices':
          case 'fees-collection': return <FeeCollectionPage learnerId={pageParams.learnerId} grade={pageParams.grade} />;
          case 'fees-invoice-detail': return <InvoiceDetailPage invoice={pageParams.invoice} />;
          case 'fees-record-payment': return <RecordPaymentPage invoice={pageParams.invoice} initialMode={pageParams.initialMode} />;
          case 'fees-waivers': return <WaiversPage />;
          case 'fees-reports': return <FeeReportsPage />;
          case 'fees-statements': return <StudentStatementsPage />;
          case 'fees-unmatched': return <UnmatchedPaymentsPanel />;

          case 'help': return <SupportHub />;

          case 'hr-portal': return <DashboardPageLayout activeTab="hr" onNavigate={handleNavigate}><HRManager onNavigate={handleNavigate} /></DashboardPageLayout>;
          case 'hr-staff-profiles': return <StaffDirectory />;
          case 'hr-leave': return <LeaveManager />;
          case 'hr-payroll': return <PayrollManager />;
          case 'hr-documents': return <StaffDocuments />;
          case 'hr-performance': return <PerformanceManager />;

          case 'settings-school': return <SchoolSettings brandingSettings={brandingSettings} setBrandingSettings={handlers.setBrandingSettings} />;
          case 'settings-academic': return <AcademicSettings />;
          case 'settings-users': 
            return isMobile ? (
              <MobileUserManagement onNavigate={handleNavigate} />
            ) : (
              <UserManagement />
            );
          case 'settings': 
            return isMobile ? (
              <MobileGeneralSettings user={user} onLogout={handlers.onLogout} brandingSettings={brandingSettings} />
            ) : (
              <SchoolSettings brandingSettings={brandingSettings} setBrandingSettings={handlers.setBrandingSettings} />
            );
          case 'settings-branding':
            return <SchoolSettings brandingSettings={brandingSettings} setBrandingSettings={handlers.setBrandingSettings} />;
          case 'settings-backup': return <SystemMaintenancePage />;
          case 'settings-communication': return <ErrorBoundary><CommunicationSettings /></ErrorBoundary>;
          case 'settings-payment': return <PaymentSettings />;
          case 'settings-system-logs': return <ErrorBoundary><SystemLogsPage /></ErrorBoundary>;
          case 'settings-system-control': return <ErrorBoundary><SystemControlPage /></ErrorBoundary>;
          case 'settings-id-templates': return <ErrorBoundary><IDCardTemplatesDesigner /></ErrorBoundary>;

          case 'system-maintenance': return <SystemMaintenancePage />;

          // ── Secondary School modules ──────────────────────────────────────
          case 'sec-pathways':        return <PathwaysHub />;
          case 'sec-subjects':        return <SubjectManagement />;
          case 'sec-form-groups':     return <FormGroups />;
          case 'sec-schemes':         return <PlannerLayout currentPage="planner-schemes" onNavigate={handleNavigate} />;
          case 'sec-mark-entry':      return <ErrorBoundary><SummativeAssessmentRouter learners={learners} defaultTestType={pageParams.defaultTestType} brandingSettings={brandingSettings} /></ErrorBoundary>;
          case 'sec-cats':            return <ErrorBoundary><SummativeAssessmentRouter learners={learners} defaultTestType="CAT" brandingSettings={brandingSettings} /></ErrorBoundary>;
          case 'sec-mid-term':        return <ErrorBoundary><SummativeAssessmentRouter learners={learners} defaultTestType="MID_TERM" brandingSettings={brandingSettings} /></ErrorBoundary>;
          case 'sec-end-term':        return <ErrorBoundary><SummativeAssessmentRouter learners={learners} defaultTestType="END_TERM" brandingSettings={brandingSettings} /></ErrorBoundary>;
          case 'sec-kcse-mock':       return <ErrorBoundary><SummativeAssessmentRouter learners={learners} defaultTestType="MOCK" brandingSettings={brandingSettings} /></ErrorBoundary>;
          case 'sec-mean-grades':     return <ResultsWorkbench variant="mean" pageParams={pageParams} onNavigate={handleNavigate} />;
          case 'sec-rankings':        return <ResultsWorkbench variant="rankings" pageParams={pageParams} onNavigate={handleNavigate} />;
          case 'sec-subject-analysis':return <ResultsWorkbench variant="subject" pageParams={pageParams} onNavigate={handleNavigate} />;
          case 'sec-report-cards':    return <ReportsHub onNavigate={handleNavigate} />;
          case 'sec-kcse-prediction': return <ResultsWorkbench variant="forecast" pageParams={pageParams} onNavigate={handleNavigate} />;

          // ── Tertiary Institution modules ──────────────────────────────────
          case 'tert-departments':    return <ComingSoon badge="Tertiary" title="Departments"          description="Department setup for tertiary institutions is coming soon." />;
          case 'tert-programs':       return <ComingSoon badge="Tertiary" title="Programs"             description="Program management for tertiary institutions is coming soon." />;
          case 'tert-units':          return <ComingSoon badge="Tertiary" title="Unit Management"      description="Unit setup and unit catalog management is coming soon." />;
          case 'tert-enrollment':     return <ComingSoon badge="Tertiary" title="Unit Enrollment"        description="Enroll students into units for the current semester." />;
          case 'tert-cats':           return <ComingSoon badge="Tertiary" title="CATs (30%)"             description="Record Continuous Assessment Test scores — 30% of the final grade." />;
          case 'tert-exams':          return <ComingSoon badge="Tertiary" title="Exams (70%)"            description="Record end-of-semester examination scores — 70% of the final grade." />;
          case 'tert-mark-entry':     return <ComingSoon badge="Tertiary" title="Mark Entry"            description="Enter and review unit marks for both CATs and final examinations." />;
          case 'tert-grade-sheet':    return <ComingSoon badge="Tertiary" title="Grade Sheets"           description="Generate official grade sheets per unit and per semester." />;
          case 'tert-unit-results':   return <ComingSoon badge="Tertiary" title="Unit Results"           description="View and publish results per unit for the current semester." />;
          case 'tert-gpa':            return <ComingSoon badge="Tertiary" title="GPA Calculator"         description="Compute semester GPA and cumulative GPA for all enrolled students." />;
          case 'tert-semester-report':return <ComingSoon badge="Tertiary" title="Semester Reports"       description="Generate and distribute end-of-semester academic progress reports." />;
          case 'tert-transcripts':    return <ComingSoon badge="Tertiary" title="Transcripts"            description="Generate official academic transcripts for students." />;
          case 'tert-classifications':return <ComingSoon badge="Tertiary" title="Degree Classification"  description="Compute degree classifications — First Class, Second Upper, Second Lower, Pass." />;
          case 'tert-clubs':          return <ComingSoon badge="Tertiary" title="Clubs & Societies"      description="Manage student clubs, societies and extra-curricular activities." />;
          case 'tert-clearance':      return <ComingSoon badge="Tertiary" title="Student Clearance"      description="Process student clearance before graduation or withdrawal." />;

          default:
            return (
              <EmptyState
                title="Application Portal"
                description={`Use the sidebar to explore ${PRODUCT_DISPLAY_NAME} modules.`}
              />
            );
        }
      })()}
    </Suspense>
  );
};

export default PageRouter;
