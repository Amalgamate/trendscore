import { useMemo } from 'react';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAuth } from '../../../hooks/useAuth';
import { useInstitutionLabels } from '../../../hooks/useInstitutionLabels';
import { useModuleAccess } from '../../../contexts/ModuleAccessContext';
import { hasPageAccess } from '../utils/appAccess';
import {
  secondaryNavSections,
  SECONDARY_SCHOOL_SECTIONS,
  SECONDARY_RESULTS_SECTIONS,
  SECONDARY_BACKOFFICE_SECTIONS,
  SECONDARY_SYSTEM_SECTIONS,
} from '../../../config/secondaryNav';
import {
  tertiaryNavSections,
  TERTIARY_SCHOOL_SECTIONS,
  TERTIARY_RESULTS_SECTIONS,
  TERTIARY_BACKOFFICE_SECTIONS,
  TERTIARY_SYSTEM_SECTIONS,
} from '../../../config/tertiaryNav';
import {
    Home, Mail, Calendar, Users, GraduationCap, UserCheck,
    TrendingUp, Zap, CheckSquare, Settings, BookOpen,
    Users2, Truck, Fingerprint, CreditCard, PieChart, BarChart3, AlertCircle,
    Package, Building2, HelpCircle, Receipt, FileText,
    Shirt, ClipboardList, Video, PlayCircle, Gift, Wrench, Activity, Brain, MoreHorizontal
} from 'lucide-react';

const focusModules = ['dashboard', 'communications', 'planner', 'learners', 'teachers', 'assessment', 'academic-intelligence', 'learning-hub', 'attendance', 'docs-center', 'settings', 'hr', 'finance', 'inventory', 'transport'];

const RESTRICTED_SIDEBAR_HOSTS = new Set([
    'kambigarba-cs.trendscore.co.ke',
    'merti-cs.trendscore.co.ke'
]);
const RESTRICTED_SIDEBAR_SECTION_IDS = new Set(['learners', 'teachers', 'assessment', 'academic-intelligence', 'planner', 'communications', 'settings']);
const RESTRICTED_SIDEBAR_SECTION_LABELS = {
    learners: 'Students',
    teachers: 'Tutors',
    assessment: 'Assessments',
    'academic-intelligence': 'Reports & Growth',
    planner: 'Planner',
    communications: 'Communications',
    settings: 'Settings'
};

const isRestrictedSidebarHost = () => (
    typeof window !== 'undefined' &&
    RESTRICTED_SIDEBAR_HOSTS.has(window.location.hostname.toLowerCase())
);

const restrictNavSections = (nav, allowedIds, labelsById = {}) => {
    const withRestrictedLabel = (section) => (
        section ? { ...section, label: labelsById[section.id] || section.label } : section
    );
    const isAllowed = (section) => section && allowedIds.has(section.id);
    const filterSections = (sections = []) => sections.filter(isAllowed).map(withRestrictedLabel);

    return {
        ...nav,
        isSidebarRestricted: true,
        navSections: filterSections(nav.navSections),
        dashboardSection: isAllowed(nav.dashboardSection) ? withRestrictedLabel(nav.dashboardSection) : null,
        communicationSection: isAllowed(nav.communicationSection) ? withRestrictedLabel(nav.communicationSection) : null,
        schoolSections: filterSections(nav.schoolSections),
        lmsSection: isAllowed(nav.lmsSection) ? withRestrictedLabel(nav.lmsSection) : null,
        studentLmsSection: isAllowed(nav.studentLmsSection) ? withRestrictedLabel(nav.studentLmsSection) : null,
        backOfficeSections: filterSections(nav.backOfficeSections),
        docsCenterSection: isAllowed(nav.docsCenterSection) ? withRestrictedLabel(nav.docsCenterSection) : null,
        systemAdminSections: filterSections(nav.systemAdminSections)
    };
};

const filterItemsByModule = (items = [], accessUser, isModuleEnabled) => items.reduce((acc, item) => {
    if (item.app && !isModuleEnabled(item.app)) return acc;
    if (item.path && !hasPageAccess(accessUser, item.path)) return acc;

    if (item.type === 'group') {
        const children = filterItemsByModule(item.items || [], accessUser, isModuleEnabled);
        if (children.length) acc.push({ ...item, items: children });
        return acc;
    }

    acc.push(item);
    return acc;
}, []);

const filterSectionsByModule = (sections = [], accessUser, isModuleEnabled) => sections.reduce((acc, section) => {
    if (!section) return acc;
    if (section.app && !isModuleEnabled(section.app)) return acc;
    if (section.path && !hasPageAccess(accessUser, section.path)) return acc;

    const items = filterItemsByModule(section.items || [], accessUser, isModuleEnabled);
    if ((section.items || []).length > 0 && items.length === 0 && !['dashboard', 'settings', 'docs-center'].includes(section.id)) {
        return acc;
    }

    acc.push({ ...section, items });
    return acc;
}, []);

const filterNavByModules = (nav, accessUser, isModuleEnabled) => {
    const filterOne = (section) => filterSectionsByModule(section ? [section] : [], accessUser, isModuleEnabled)[0] || null;
    return {
        ...nav,
        navSections: filterSectionsByModule(nav.navSections || [], accessUser, isModuleEnabled),
        dashboardSection: filterOne(nav.dashboardSection),
        communicationSection: filterOne(nav.communicationSection),
        schoolSections: filterSectionsByModule(nav.schoolSections || [], accessUser, isModuleEnabled),
        lmsSection: filterOne(nav.lmsSection),
        studentLmsSection: filterOne(nav.studentLmsSection),
        backOfficeSections: filterSectionsByModule(nav.backOfficeSections || [], accessUser, isModuleEnabled),
        docsCenterSection: filterOne(nav.docsCenterSection),
        systemAdminSections: filterSectionsByModule(nav.systemAdminSections || [], accessUser, isModuleEnabled),
    };
};

export const allNavSections = [
    {
        id: 'dashboard',
        label: 'Overview',
        icon: Home,
        items: [],
        permission: null
    },
    {
        id: 'communications',
        label: 'Inbox',
        icon: Mail,
        app: 'sms-notifications',
        permission: null,
        items: [
            { id: 'comm-notices', label: 'Notices & Announcements', path: 'comm-notices', permission: null, app: 'announcements' },
            { id: 'comm-messages', label: 'Messages', path: 'comm-messages', permission: 'VIEW_INBOX', app: 'sms-notifications' },
            { id: 'comm-history', label: 'Message History', path: 'comm-history', permission: null, app: 'sms-notifications' }
        ]
    },
    {
        id: 'planner',
        label: 'Planner',
        icon: Calendar,
        app: 'planner',
        permission: null,
        items: [
            { id: 'planner-calendar', label: 'Calendar', path: 'planner-calendar', permission: null },
            { id: 'planner-timetable', label: 'Timetable', path: 'planner-timetable', permission: 'ACCESS_TIMETABLE', app: 'timetable' },
            { id: 'planner-duty-roster', label: 'Duty Roster', path: 'planner-duty-roster', permission: null, app: 'planner' },
            { id: 'planner-schemes', label: 'Schemes of Work', path: 'planner-schemes', permission: null, icon: ClipboardList, app: 'curriculum' },
        ]
    },
    {
        id: 'learners',
        label: 'Scholars',
        icon: Users,
        app: 'student-registry',
        permission: null,
        items: [
            { id: 'learners-list',       label: 'Students List',      path: 'learners-list',       permission: 'VIEW_ALL_LEARNERS' },
            { id: 'learners-admissions', label: 'Admissions',         path: 'learners-admissions', permission: 'CREATE_LEARNER'    },
            { id: 'learners-promotion',  label: 'Promotion',          path: 'learners-promotion',  permission: 'PROMOTE_LEARNER', app: 'planner' },
            { id: 'learners-uniform',    label: 'Uniform Allocation', path: 'learners-uniform',    permission: 'VIEW_ALL_LEARNERS', icon: Shirt, app: 'inventory' },
            { id: 'learners-id-print',   label: 'ID Card Printing',   path: 'learners-id-print',   permission: 'VIEW_ALL_LEARNERS', icon: CreditCard },
            { id: 'parents-list',        label: 'Parents List',       path: 'parents-list',        permission: 'VIEW_ALL_USERS' },
        ]
    },
    {
        id: 'teachers',
        label: 'Tutors',
        icon: GraduationCap,
        permission: 'MANAGE_TEACHERS',
        items: [
            { id: 'teachers-list', label: 'Tutors List', path: 'teachers-list', permission: 'MANAGE_TEACHERS' }
        ]
    },
    // Parents is no longer a standalone menu — Parents List is nested under Learners
    // {
    //     id: 'parents',
    //     label: 'Guardians',
    //     icon: UserCheck,
    //     permission: 'VIEW_ALL_USERS',
    //     items: [
    //         { id: 'parents-list', label: 'Parents List', path: 'parents-list', permission: 'VIEW_ALL_USERS' }
    //     ]
    // },
    {
        id: 'assessment',
        label: 'Assessment',
        icon: TrendingUp,
        app: 'gradebook',
        permission: 'ACCESS_ASSESSMENT_MODULE',
        items: [
            {
                id: 'group-summative',
                label: 'Summative',
                type: 'group',
                icon: Zap,
                items: [
                    { id: 'assess-mobile-dashboard',      label: 'Assessment Overview', path: 'assess-mobile-dashboard',      permission: 'ACCESS_ASSESSMENT_MODULE' },
                    { id: 'assess-summative-assessment', label: 'Summative Assessments', path: 'assess-summative-assessment', permission: 'ACCESS_ASSESSMENT_MODULE' },
                    { id: 'assess-summary-report',       label: 'Assessment Matrix', path: 'assess-summary-report',      permission: 'ACCESS_ASSESSMENT_MODULE' },
                ]
            },
            {
                id: 'group-formative',
                label: 'Formative',
                type: 'group',
                icon: CheckSquare,
                items: [
                    { id: 'assess-formative',        label: 'Formative Assessments', path: 'assess-formative',        permission: 'ACCESS_ASSESSMENT_MODULE' },
                    { id: 'assess-formative-report', label: 'Formative Reports',     path: 'assess-formative-report', permission: 'ACCESS_ASSESSMENT_MODULE' },
                ]
            },
            {
                id: 'group-holistic',
                label: 'CBC Holistic',
                type: 'group',
                icon: BookOpen,
                items: [
                    { id: 'assess-core-competencies', label: 'Core Competencies', path: 'assess-core-competencies', permission: 'ACCESS_ASSESSMENT_MODULE' },
                    { id: 'assess-values',            label: 'National Values',   path: 'assess-values',            permission: 'ACCESS_ASSESSMENT_MODULE' },
                    { id: 'assess-cocurricular',      label: 'Co-Curricular',     path: 'assess-cocurricular',      permission: 'ACCESS_ASSESSMENT_MODULE' },
                ]
            },
            {
                id: 'group-general',
                label: 'Configuration',
                type: 'group',
                icon: Settings,
                items: [
                    { id: 'assess-learning-areas',    label: 'Learning Areas', path: 'assess-learning-areas',   permission: 'MANAGE_LEARNING_AREAS'    },
                    { id: 'assess-summative-tests',   label: 'Tests',          path: 'assess-summative-tests',  permission: 'ACCESS_ASSESSMENT_MODULE' },
                    { id: 'assess-performance-scale', label: 'Performance Scale', path: 'assess-performance-scale', permission: 'MANAGE_LEARNING_AREAS' }
                ]
            }
        ]
    },
    {
        id: 'academic-intelligence',
        label: 'Reports & Growth',
        icon: BarChart3,
        app: 'exams',
        permission: 'VIEW_ALL_REPORTS',
        items: [
            { id: 'academic-executive-dashboard',  label: 'Analytics Dashboards', path: 'academic-intelligence',          permission: 'VIEW_ALL_REPORTS' },
            {
                id: 'group-academic-analysis',
                label: 'Performance Analysis',
                type: 'group',
                icon: BarChart3,
                items: [
                    { id: 'academic-section-analysis',     label: 'Section Analysis',     path: 'academic-section-analysis',      permission: 'VIEW_ALL_REPORTS' },
                    { id: 'academic-subject-intelligence', label: 'Subject Analysis', path: 'academic-subject-intelligence',  permission: 'VIEW_ALL_REPORTS' },
                    { id: 'academic-gender-analysis',      label: 'Gender Analysis',      path: 'academic-gender-analysis',       permission: 'VIEW_ALL_REPORTS' },
                    { id: 'academic-stream-analysis',      label: 'Stream Analysis',      path: 'academic-stream-analysis',       permission: 'VIEW_ALL_REPORTS' },
                    { id: 'academic-competency-analysis',  label: 'Competency Analysis',  path: 'academic-competency-analysis',   permission: 'VIEW_ALL_REPORTS' },
                ]
            },
            {
                id: 'group-academic-insights',
                label: 'Learner Insights',
                type: 'group',
                icon: Brain,
                items: [
                    { id: 'academic-learner-risk',         label: 'Learner Risk',         path: 'academic-learner-risk',          permission: 'VIEW_ALL_REPORTS' },
                    { id: 'academic-growth-trends',        label: 'Growth Trends',        path: 'academic-growth-trends',         permission: 'VIEW_ALL_REPORTS' },
                    { id: 'academic-ai-insights',          label: 'AI Insights',          path: 'academic-ai-insights',           permission: 'VIEW_ALL_REPORTS' },
                    { id: 'academic-top-bottom-performers', label: 'Top / Bottom Performers', path: 'academic-top-bottom-performers', permission: 'VIEW_ALL_REPORTS' },
                ]
            },
            {
                id: 'group-academic-reports',
                label: 'Reports & Printing',
                type: 'group',
                icon: FileText,
                items: [
                    { id: 'academic-grade-sheet',         label: 'Grade Sheet',       path: 'assess-summative-report',     params: { reportType: 'GRADE_REPORT' },   permission: 'ACCESS_ASSESSMENT_MODULE' },
                    { id: 'academic-stream-sheet',        label: 'Stream Sheet',      path: 'assess-summative-report',     params: { reportType: 'STREAM_REPORT' },  permission: 'ACCESS_ASSESSMENT_MODULE' },
                    { id: 'academic-learner-sheet',       label: 'Learner Sheet',     path: 'assess-summative-report',     params: { reportType: 'LEARNER_REPORT' }, permission: 'ACCESS_ASSESSMENT_MODULE' },
                    { id: 'academic-report-cards',         label: 'Report Cards',         path: 'assess-termly-report',           permission: 'ACCESS_ASSESSMENT_MODULE' },
                    { id: 'academic-print-center',         label: 'Print Center',         path: 'assess-print-center',            permission: 'ACCESS_ASSESSMENT_MODULE' },
                ]
            },
        ]
    },
    {
        id: 'learning-hub',
        label: 'Resource Center',
        icon: BookOpen,
        app: 'lms',
        permission: 'ACCESS_LEARNING_HUB',
        items: [
            { id: 'learning-hub-materials',    label: 'Class Materials',  path: 'learning-hub-materials',    permission: null },
            { id: 'learning-hub-assignments',  label: 'Assignments',      path: 'learning-hub-assignments',  permission: null },
            { id: 'learning-hub-lesson-plans', label: 'Lesson Plans',     path: 'learning-hub-lesson-plans', permission: 'ACCESS_LEARNING_HUB' },
            { id: 'coding-playground',         label: 'Coding Playground',path: 'coding-playground',         permission: null },
            { id: 'learning-hub-library',      label: 'Resource Library', path: 'learning-hub-library',      permission: null, app: 'library' }
        ]
    },
    {
        id: 'lms',
        label: 'Learning Management',
        icon: PlayCircle,
        app: 'lms',
        permission: 'ACCESS_LMS',
        items: [
            { id: 'lms-courses',      label: 'Courses',           path: 'lms-courses',      permission: 'ACCESS_LMS' },
            { id: 'lms-content',      label: 'Content Library',   path: 'lms-content',      permission: 'ACCESS_LMS' },
            { id: 'lms-enrollments',  label: 'Enrollments',       path: 'lms-enrollments',  permission: 'ACCESS_LMS' },
            { id: 'lms-progress',     label: 'Progress Tracking', path: 'lms-progress',     permission: 'ACCESS_LMS' },
            { id: 'lms-reports',      label: 'Learning Reports',  path: 'lms-reports',      permission: 'ACCESS_LMS' }
        ]
    },

    {
        id: 'attendance',
        label: 'Attendance',
        icon: CheckSquare,
        app: 'attendance',
        permission: null,
        items: [
            { id: 'attendance-daily',          label: 'Daily Attendance',   path: 'attendance-daily',          permission: 'MARK_ATTENDANCE'               },
            { id: 'attendance-reports',        label: 'Attendance Reports', path: 'attendance-reports',        permission: 'GENERATE_ATTENDANCE_REPORTS'  },
            { id: 'attendance-configuration',  label: 'Configuration',      path: 'attendance-configuration',  permission: 'VIEW_ALL_ATTENDANCE'          }
        ]
    },
    {
        id: 'docs-center',
        label: 'Document Center',
        icon: FileText,
        permission: null,
        items: []
    },
    {
        id: 'hr',
        label: 'HR',
        icon: Users2,
        app: 'staff-hr',
        permission: 'HR_MANAGEMENT',
        items: [
            { id: 'hr-portal',         label: 'HR Dashboard',      path: 'hr-portal',         permission: 'HR_MANAGEMENT' },
            { id: 'hr-staff-profiles', label: 'Staff Directory',   path: 'hr-staff-profiles', permission: 'HR_MANAGEMENT' },
            { id: 'hr-payroll',        label: 'Payroll Processing', path: 'hr-payroll',       permission: 'HR_MANAGEMENT', app: 'payroll' },
            { id: 'hr-leave',          label: 'Leave Management',  path: 'hr-leave',          permission: 'HR_MANAGEMENT' },
            { id: 'hr-documents',      label: 'Staff Documents',   path: 'hr-documents',      permission: 'HR_MANAGEMENT' },
            { id: 'hr-attendance',     label: 'Attendance',        path: 'hr-attendance',     permission: 'HR_MANAGEMENT' },
            { id: 'hr-performance',    label: 'Performance',       path: 'hr-performance',    permission: 'HR_MANAGEMENT' }
        ]
    },
    {
        id: 'library',
        label: 'Library Management',
        icon: BookOpen,
        app: 'library',
        permission: null,
        items: [
            { id: 'library-catalog',     label: 'Book Catalog',           path: 'library-catalog',     permission: 'LIBRARY_MANAGEMENT' },
            { id: 'library-circulation', label: 'Borrow/Return Tracking', path: 'library-circulation', permission: 'LIBRARY_MANAGEMENT' },
            { id: 'library-fees',        label: 'Late Fee Automation',    path: 'library-fees',        permission: 'LIBRARY_MANAGEMENT' },
            { id: 'library-inventory',   label: 'Inventory Reports',      path: 'library-inventory',   permission: 'LIBRARY_MANAGEMENT' },
            { id: 'library-members',     label: 'Member Management',      path: 'library-members',     permission: 'LIBRARY_MANAGEMENT' }
        ]
    },
    {
        id: 'transport',
        label: 'Transport',
        icon: Truck,
        app: 'transport',
        permission: null,
        items: [
            { id: 'transport-routes',   label: 'Bus Routes & Roster',  path: 'transport-routes',   permission: 'TRANSPORT_MANAGEMENT' },
            { id: 'transport-tracking', label: 'GPS Tracking',         path: 'transport-tracking', permission: 'TRANSPORT_MANAGEMENT' },
            { id: 'transport-drivers',  label: 'Driver Management',    path: 'transport-drivers',  permission: 'TRANSPORT_MANAGEMENT' },
            { id: 'hostel-fees',        label: 'Transport Fee Manager',path: 'hostel-fees',        permission: 'TRANSPORT_MANAGEMENT' },
            { id: 'transport-reports',  label: 'Transport Reports',    path: 'transport-reports',  permission: 'TRANSPORT_MANAGEMENT' }
        ]
    },
    {
        id: 'finance',
        label: 'Finance',
        icon: CreditCard,
        app: 'fee-management',
        permission: 'FEE_MANAGEMENT',
        items: [
            {
                id: 'group-fees',
                label: 'Fee Management',
                type: 'group',
                icon: Receipt,
                permission: 'FEE_MANAGEMENT',
                items: [
                    { id: 'fees-overview', label: 'Fee Overview', path: 'fees-overview', permission: 'FEE_MANAGEMENT', icon: Receipt },
                    { id: 'fees-invoices', label: 'Fee Invoices', path: 'fees-invoices', permission: 'FEE_MANAGEMENT', icon: FileText },
                    { id: 'fees-pledges', label: 'Pledges', path: 'fees-pledges', permission: 'FEE_MANAGEMENT', icon: Gift },
                    { id: 'fees-types', label: 'Fee Types', path: 'fees-types', permission: 'FEE_MANAGEMENT', icon: Receipt },
                    { id: 'fees-structure', label: 'Fee Structure', path: 'fees-structure', permission: 'FEE_MANAGEMENT', icon: Building2 },
                    { id: 'fees-unmatched', label: 'Unmatched Payments', path: 'fees-unmatched', permission: 'FEE_MANAGEMENT', icon: AlertCircle },
                ],
            },
            {
                id: 'group-accounting',
                label: 'Accounting',
                type: 'group',
                icon: PieChart,
                app: 'accounting',
                permission: 'ACCOUNTING_MANAGEMENT',
                items: [
                    { id: 'accounting-dashboard',      label: 'Accounting Dashboard', path: 'accounting-dashboard',      permission: 'ACCOUNTING_MANAGEMENT' },
                    { id: 'accounting-accounts',       label: 'Chart of Accounts',    path: 'accounting-accounts',       permission: 'ACCOUNTING_MANAGEMENT' },
                    { id: 'accounting-entries',        label: 'Journal Entries',      path: 'accounting-entries',        permission: 'ACCOUNTING_MANAGEMENT' },
                    { id: 'accounting-expenses',       label: 'Expenses',             path: 'accounting-expenses',       permission: 'ACCOUNTING_MANAGEMENT' },
                    { id: 'accounting-vendors',        label: 'Vendors',              path: 'accounting-vendors',        permission: 'ACCOUNTING_MANAGEMENT' },
                    { id: 'accounting-reconciliation', label: 'Reconciliation',       path: 'accounting-reconciliation', permission: 'ACCOUNTING_MANAGEMENT' },
                    { id: 'accounting-reports',        label: 'Financial Reports',    path: 'accounting-reports',        permission: 'ACCOUNTING_MANAGEMENT' }
                ]
            },
            {
                id: 'group-accounting-config',
                label: 'Configuration',
                type: 'group',
                icon: Settings,
                permission: 'ACCOUNTING_MANAGEMENT',
                items: [
                    { id: 'accounting-config', label: 'Accounts & Categories', path: 'accounting-config', permission: 'ACCOUNTING_MANAGEMENT' }
                ]
            }
        ]
    },
    {
        id: 'inventory',
        label: 'Inventory',
        icon: Package,
        app: 'inventory',
        permission: 'SCHOOL_SETTINGS',
        items: [
            { id: 'inventory-items',            label: 'Items',             path: 'inventory-items',            permission: 'SCHOOL_SETTINGS' },
            { id: 'inventory-categories',       label: 'Categories',        path: 'inventory-categories',       permission: 'SCHOOL_SETTINGS' },
            { id: 'inventory-stores',           label: 'Stores',            path: 'inventory-stores',           permission: 'SCHOOL_SETTINGS' },
            { id: 'inventory-movements',        label: 'Stock Movements',   path: 'inventory-movements',        permission: 'SCHOOL_SETTINGS' },
            { id: 'inventory-requisitions',     label: 'Requisitions',      path: 'inventory-requisitions',     permission: 'SCHOOL_SETTINGS' },
            { id: 'inventory-transfers',        label: 'Transfers',         path: 'inventory-transfers',        permission: 'SCHOOL_SETTINGS' },
            { id: 'inventory-adjustments',      label: 'Adjustments',       path: 'inventory-adjustments',      permission: 'SCHOOL_SETTINGS' },
            { id: 'inventory-assets',           label: 'Asset Register',    path: 'inventory-assets',           permission: 'SCHOOL_SETTINGS' },
            { id: 'inventory-class-assignments',label: 'Class Assignments', path: 'inventory-class-assignments',permission: 'SCHOOL_SETTINGS' }
        ]
    },
    {
        id: 'biometric',
        label: 'Biometric Attendance',
        icon: Fingerprint,
        app: 'biometric',
        permission: 'BIOMETRIC_ATTENDANCE',
        items: [
            { id: 'biometric-dashboard',  label: 'Biometric Authority',    path: 'biometric-dashboard',  permission: 'BIOMETRIC_ATTENDANCE' },
            { id: 'biometric-enrollment', label: 'Fingerprint Enrollment', path: 'biometric-dashboard?tab=enrollment', permission: 'ENROLL_FINGERPRINTS' },
            { id: 'biometric-devices',    label: 'Terminal Management',    path: 'biometric-dashboard?tab=devices',    permission: 'MANAGE_BIOMETRIC_DEVICES' },
            { id: 'biometric-logs',       label: 'Attendance Data Feed',   path: 'biometric-dashboard?tab=logs',       permission: 'VIEW_BIOMETRIC_LOGS' },
            { id: 'biometric-api',        label: 'API & Bridge Info',      path: 'biometric-dashboard?tab=config',     permission: 'CONFIGURE_BIOMETRIC_API' }
        ]
    },
    // {
    //     id: 'help',
    //     label: 'Help & Support',
    //     icon: HelpCircle,
    //     permission: null,
    //     items: []
    // },
    {
        id: 'facilities',
        label: 'The Campus',
        icon: Building2,
        permission: 'MANAGE_FACILITIES',
        items: [
            { id: 'facilities-classes',  label: 'Classes & Streams',      path: 'facilities-classes',  permission: 'MANAGE_FACILITIES' },
            { id: 'hostel-allocation',   label: 'Hostel Room Allocation', path: 'hostel-allocation',   permission: 'MANAGE_FACILITIES' }
        ]
    },
    {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        permission: 'SCHOOL_SETTINGS',
        items: [
            { id: 'settings-school',         label: 'School Settings',         path: 'settings-school',         permission: 'SCHOOL_SETTINGS'   },
            { id: 'settings-modules',        label: 'Modules & Package',       path: 'settings-modules',        permission: 'SCHOOL_SETTINGS'   },
            { id: 'settings-academic',       label: 'Academic Settings',       path: 'settings-academic',       permission: 'ACADEMIC_SETTINGS' },
            { id: 'settings-communication',  label: 'Communication Settings',  path: 'settings-communication',  permission: 'SCHOOL_SETTINGS'   },
            { id: 'settings-payment',        label: 'Payment Settings',        path: 'settings-payment',        permission: 'SCHOOL_SETTINGS'   },
            { id: 'settings-users',          label: 'User Management',         path: 'settings-users',          permission: 'EDIT_USER'         },
            { id: 'settings-approvals',      label: 'Approvals',               path: 'settings-approvals',      permission: 'SCHOOL_SETTINGS'   },
            { id: 'settings-system-logs',    label: 'System Logs',             path: 'settings-system-logs',    permission: 'SYSTEM_SETTINGS', icon: Activity },
            { id: 'settings-system-control', label: 'System Control',          path: 'settings-system-control', permission: 'SYSTEM_SETTINGS', icon: Wrench   },
            { id: 'system-maintenance',      label: 'Backup, Restore & Reset', path: 'system-maintenance',      permission: 'SYSTEM_SETTINGS', icon: Wrench }
        ]
    }
];

const PARENT_PORTAL_KEEP_EMPTY_SECTION_IDS = new Set(['dashboard', 'communications', 'docs-center', 'help']);

const accountantFinanceNavigation = [
    { id: 'finance-dashboard', label: 'Dashboard', path: 'finance-dashboard', permission: null, icon: Home },
    { id: 'fees-overview', label: 'Fee Management', path: 'fees-overview', permission: 'FEE_MANAGEMENT', icon: Receipt },
    { id: 'accounting-expenses', label: 'Expenses', path: 'accounting-expenses', permission: 'ACCOUNTING_MANAGEMENT', icon: ClipboardList },
    { id: 'accounting-reconciliation', label: 'Banking', path: 'accounting-reconciliation', permission: 'ACCOUNTING_MANAGEMENT', icon: Building2 },
    { id: 'accounting-accounts', label: 'Chart of Accounts', path: 'accounting-accounts', permission: 'ACCOUNTING_MANAGEMENT', icon: BookOpen },
    { id: 'accounting-budgets', label: 'Budgets', path: 'accounting-dashboard', permission: 'ACCOUNTING_MANAGEMENT', icon: Activity },
    { id: 'accounting-reports', label: 'Reports', path: 'accounting-reports', permission: 'FINANCIAL_REPORTS', icon: TrendingUp },
    { id: 'audit-trail', label: 'Audit Trail', path: 'settings-system-logs', permission: null, icon: Wrench },
];

const accountantConfigurationNavigation = [
    { id: 'settings-users', label: 'Users & Roles', path: 'settings-users', permission: null, icon: Users2 },
    { id: 'settings-system-logs', label: 'System Logs', path: 'settings-system-logs', permission: null, icon: Activity },
];

const accountantCommunicationNavigation = [
    { id: 'comm-notices', label: 'Notices & Announcements', path: 'comm-notices', permission: null, icon: Mail },
    { id: 'comm-messages', label: 'Messages', path: 'comm-messages', permission: 'VIEW_INBOX', icon: Mail },
    { id: 'comm-history', label: 'Message History', path: 'comm-history', permission: null, icon: ClipboardList },
];

/** Remove Schemes of Work and full Timetable from nav; drop sections with no visible items. */
function transformNavForParentRole(sections) {
  const stripItems = (items, sectionId = null) => {
    if (!items?.length) return [];
    if (sectionId === 'planner') {
      return [
        { id: 'events-calendar', label: 'Upcoming Events', path: 'events-calendar', permission: null }
      ];
    }
    if (sectionId === 'communications') {
      return items
        .filter((item) => item.id === 'comm-messages')
        .map((item) => ({ ...item, label: 'Inbox' }));
    }
    return items.reduce((acc, item) => {
      if (item.type === 'group') {
        const children = stripItems(item.items, sectionId);
        if (children.length) acc.push({ ...item, items: children });
      } else if (item.path !== 'planner-schemes' && item.path !== 'planner-timetable') {
        acc.push(item);
      }
      return acc;
    }, []);
  };

  return sections
    .map((s) => ({
      ...s,
      label: s.id === 'communications' ? 'Inbox' : s.id === 'planner' ? 'Events' : s.label,
      items: stripItems(s.items || [], s.id),
    }))
    .filter(
      (s) =>
        PARENT_PORTAL_KEEP_EMPTY_SECTION_IDS.has(s.id) ||
        (s.items && s.items.length > 0)
    );
}

function parentSchoolSectionsFromNav(nav) {
  return nav.filter(
    (s) =>
      (s.items?.length > 0 && !['dashboard', 'communications', 'help', 'docs-center'].includes(s.id))
  );
}

export const useNavigation = () => {
    const { can, role, isRole } = usePermissions();
    const { user, institutionType } = useAuth();
    const { activeSlugs, isModuleEnabled } = useModuleAccess();
    const labels = useInstitutionLabels();
    const restrictSidebarForSchool = isRestrictedSidebarHost();
    const accessUser = useMemo(() => ({ ...(user || {}), enabledApps: activeSlugs }), [activeSlugs, user]);
    const accountantNav = useMemo(() => {
        const financeItems = accountantFinanceNavigation.filter(item => !item.permission || can(item.permission));
        const communicationItems = accountantCommunicationNavigation.filter(item => !item.permission || can(item.permission));
        const configItems = accountantConfigurationNavigation;
        return {
            navSections: [],
            dashboardSection: {
                id: 'finance-dashboard',
                label: 'Dashboard',
                icon: Home,
                items: [],
                permission: null
            },
            communicationSection: {
                id: 'communications',
                label: 'Communication',
                icon: Mail,
                items: communicationItems
            },
            schoolSections: [],
            lmsSection: null,
            studentLmsSection: null,
            backOfficeSections: [
                {
                    id: 'finance',
                    label: 'Finance',
                    icon: CreditCard,
                    items: financeItems.filter(item => item.id !== 'finance-dashboard')
                }
            ],
            docsCenterSection: {
                id: 'docs-center',
                label: 'Document Center',
                icon: FileText,
                items: []
            },
            systemAdminSections: [
                {
                    id: 'administration',
                    label: 'Administration',
                    icon: Users2,
                    items: configItems
                },
                // {
                //     id: 'help',
                //     label: 'Help & Support',
                //     icon: HelpCircle,
                //     items: []
                // }
            ],
        };
    }, [can]);

    // ── Institution type branching ───────────────────────────────────────────
    // Each type gets its own filtered nav — CBC users NEVER see secondary/tertiary
    // items and vice versa. The filtering logic is identical; only the source
    // nav array and category groupings differ.

    const buildNav = (sourceSections) => {
        const isItemVisible = (item) => {
            // Teachers may access their own class admissions only (special override).
            if (item.path === 'learners-admissions' && isRole('TEACHER')) return true;

            // Teachers must NOT see admin-only learner management tabs.
            // These items are only relevant to staff who run the registry.
            if (isRole('TEACHER') && [
                'learners-promotion',
                'learners-uniform',
                'learners-id-print',
                'parents-list',
            ].includes(item.id)) return false;

            if (item.app && !isModuleEnabled(item.app)) return false;
            if (item.path && !hasPageAccess(accessUser, item.path)) return false;
            if (item.permission && !can(item.permission)) return false;
            
            return true;
        };

        const processItems = (items) => items.reduce((acc, item) => {
            if (item.type === 'group') {
                const visible = item.items.filter(isItemVisible);
                if (visible.length > 0) acc.push({ ...item, items: visible });
            } else if (isItemVisible(item)) {
                acc.push(item);
            }
            return acc;
        }, []);

        return sourceSections.filter(section => {
            if (section.permission && !can(section.permission)) return false;

            if (section.items.length > 0) {
                return processItems(section.items).length > 0;
            }
            return true;
        }).map(section => ({ ...section, items: processItems(section.items) }));
    };

    // ── Secondary ────────────────────────────────────────────────────────────
    const secondaryNav = useMemo(() => {
        if (institutionType !== 'SECONDARY') return null;
        let nav = buildNav(secondaryNavSections);
        if (role === 'PARENT') nav = transformNavForParentRole(nav);
        const find = (id) => nav.find(s => s.id === id);
        if (role === 'STUDENT') {
            const dashboard = find('dashboard');
            return {
                navSections: dashboard ? [dashboard] : [],
                dashboardSection: dashboard,
                communicationSection: null,
                schoolSections: [],
                lmsSection: null,
                studentLmsSection: {
                    id: 'student-portal',
                    label: 'Student Portal',
                    icon: PlayCircle,
                    items: [
                        { id: 'student-courses', label: 'My Courses', path: 'student-courses', permission: null },
                        { id: 'student-assignments', label: 'My Assignments', path: 'student-assignments', permission: null },
                        { id: 'student-quizzes', label: 'Quizzes & Progress', path: 'student-quizzes', permission: null }
                    ]
                },
                backOfficeSections: [],
                docsCenterSection: null,
                systemAdminSections: [],
            };
        }
        return {
            navSections: nav,
            dashboardSection:    find('dashboard'),
            communicationSection: find('communications'),
            schoolSections: role === 'PARENT'
                ? parentSchoolSectionsFromNav(nav)
                : nav.filter(s => SECONDARY_SCHOOL_SECTIONS.includes(s.id)),
            lmsSection:          null, // Learning Management hidden until ready
            studentLmsSection:   null,
            backOfficeSections:  nav.filter(s => SECONDARY_BACKOFFICE_SECTIONS.includes(s.id)),
            docsCenterSection:   find('docs-center'),
            systemAdminSections: nav.filter(s => SECONDARY_SYSTEM_SECTIONS.includes(s.id)),
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [institutionType, can, role, accessUser, isModuleEnabled]);

    // ── Tertiary ─────────────────────────────────────────────────────────────
    const tertiaryNav = useMemo(() => {
        if (institutionType !== 'TERTIARY') return null;
        let nav = buildNav(tertiaryNavSections);
        if (role === 'PARENT') nav = transformNavForParentRole(nav);
        const find = (id) => nav.find(s => s.id === id);
        if (role === 'STUDENT') {
            const dashboard = find('dashboard');
            return {
                navSections: dashboard ? [dashboard] : [],
                dashboardSection: dashboard,
                communicationSection: null,
                schoolSections: [],
                lmsSection: null,
                studentLmsSection: {
                    id: 'student-portal',
                    label: 'Student Portal',
                    icon: PlayCircle,
                    items: [
                        { id: 'student-courses', label: 'My Courses', path: 'student-courses', permission: null },
                        { id: 'student-assignments', label: 'My Assignments', path: 'student-assignments', permission: null },
                        { id: 'student-quizzes', label: 'Quizzes & Progress', path: 'student-quizzes', permission: null }
                    ]
                },
                backOfficeSections: [],
                docsCenterSection: null,
                systemAdminSections: [],
            };
        }
        return {
            navSections: nav,
            dashboardSection:    find('dashboard'),
            communicationSection: find('communications'),
            schoolSections: role === 'PARENT'
                ? parentSchoolSectionsFromNav(nav)
                : nav.filter(s => TERTIARY_SCHOOL_SECTIONS.includes(s.id)),
            lmsSection:          null, // Learning Management hidden until ready
            studentLmsSection:   null,
            backOfficeSections:  nav.filter(s => TERTIARY_BACKOFFICE_SECTIONS.includes(s.id)),
            docsCenterSection:   find('docs-center'),
            systemAdminSections: nav.filter(s => TERTIARY_SYSTEM_SECTIONS.includes(s.id)),
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [institutionType, can, role, accessUser, isModuleEnabled]);

    // ── CBC (default) ─────────────────────────────────────────────────────────

    const navSections = useMemo(() => {
        const isItemVisible = (item) => {
            if (item.path === 'learners-admissions' && isRole('TEACHER')) return true;

            // Teachers must NOT see admin-only learner management tabs.
            if (isRole('TEACHER') && [
                'learners-promotion',
                'learners-uniform',
                'learners-id-print',
                'parents-list',
            ].includes(item.id)) return false;

            if (item.app && !isModuleEnabled(item.app)) return false;
            if (item.path && !hasPageAccess(accessUser, item.path)) return false;
            if (item.permission && !can(item.permission)) return false;
            return true;
        };

        const processItems = (items) => {
            return items.reduce((acc, item) => {
                if (item.type === 'group') {
                    const visibleChildren = item.items.filter(isItemVisible);
                    if (visibleChildren.length > 0) {
                        acc.push({ ...item, items: visibleChildren });
                    }
                } else {
                    if (isItemVisible(item)) {
                        acc.push(item);
                    }
                }
                return acc;
            }, []);
        };

        if (role === 'STUDENT') {
            return allNavSections
                .filter(section => section.id === 'dashboard')
                .map(section => ({ ...section, items: [] }));
        }

        let built = allNavSections.filter(section => {
            if (!focusModules.includes(section.id)) return false;
            if (section.id === 'settings') return false;
            if (role === 'STUDENT' && section.id === 'lms') return false;
            if (section.permission && !can(section.permission)) return false;
            if (section.items.length > 0) {
                const visibleItems = processItems(section.items);
                return visibleItems.length > 0;
            }
            return true;
        }).map(section => {
            // Apply dynamic labels
            let label = section.label;
            if (section.id === 'learners') label = labels.students;
            if (section.id === 'teachers') label = labels.teachers;
            if (section.id === 'assessment') label = labels.subjects || 'Learner Analytics';

            return {
                ...section,
                label,
                items: processItems(section.items)
            };
        });

        if (role === 'PARENT') {
            built = transformNavForParentRole(built);
        }
        return built;
    }, [can, role, isRole, labels, accessUser, isModuleEnabled]);

    const dashboardSection = navSections.find(s => s.id === 'dashboard');
    const lmsSection = navSections.find(s => s.id === 'lms');
    const studentLmsSection = useMemo(() => {
        if (role !== 'STUDENT') return null;
        return {
            id: 'student-portal',
            label: 'Student Portal',
            icon: PlayCircle,
            items: [
                { id: 'student-courses', label: 'My Courses', path: 'student-courses', permission: null },
                { id: 'student-assignments', label: 'My Assignments', path: 'student-assignments', permission: null },
                { id: 'student-quizzes', label: 'Quizzes & Progress', path: 'student-quizzes', permission: null }
            ]
        };
    }, [role]);

    const schoolSections = useMemo(() => {
        if (role === 'PARENT') {
            // Build the standard parent nav sections, then inject the Academics portal section
            const existing = parentSchoolSectionsFromNav(navSections);
            const academicsSection = {
                id: 'parent-portal-academics',
                label: 'Academics',
                icon: GraduationCap,
                portalSection: true,
                items: [
                    { id: 'portal-results',    label: 'Results',    path: 'parent-portal-results'    },
                    { id: 'portal-attendance', label: 'Attendance', path: 'parent-portal-attendance' },
                    { id: 'portal-children',   label: 'Children',   path: 'parent-portal-children'   },
                ],
            };
            // Avoid duplicating if already present (hot-reload safety)
            const hasAcademics = existing.some(s => s.id === 'parent-portal-academics');
            return hasAcademics ? existing : [...existing, academicsSection];
        }
        if (role === 'ACCOUNTANT') {
            return navSections.filter(s => ['learners', 'assessment', 'academic-intelligence', 'attendance'].includes(s.id));
        }
        return navSections.filter(s => 
            ['learners', 'teachers', 'assessment', 'academic-intelligence', 'planner', 'timetable', 'learning-hub', 'attendance', 'facilities'].includes(s.id)
        );
    }, [navSections, role]);

    const backOfficeSections = useMemo(() => {
        if (role === 'TEACHER') return [];
        if (role === 'PARENT') {
            // Inject a parent-specific "School Fees" section into the Finance group
            return [
                {
                    id: 'parent-portal-finance',
                    label: 'School Fees',
                    icon: Receipt,
                    portalSection: true,
                    items: [
                        { id: 'portal-fees', label: 'School Fees', path: 'parent-portal-fees' },
                        { id: 'portal-fees-statement', label: 'Fee Statement', path: 'parent-portal-fees' },
                    ],
                },
            ];
        }
        return navSections.filter(s => 
            ['hr', 'finance', 'inventory', 'library', 'transport', 'biometric'].includes(s.id)
        );
    }, [navSections, role]);

    const docsCenterSection = useMemo(() => {
        return navSections.find(s => s.id === 'docs-center');
    }, [navSections]);

    const communicationSection = useMemo(() => {
        const section = navSections.find(s => s.id === 'communications');
        if (!section) return null;
        if (role === 'PARENT') {
            return {
                ...section,
                label: 'Inbox',
                items: (section.items || [])
                    .filter(item => item.id === 'comm-messages')
                    .map(item => ({ ...item, label: 'Inbox' }))
            };
        }
        if (role === 'TEACHER') {
            return { ...section, items: section.items.filter(item => item.id === 'comm-messages') };
        }
        return section;
    }, [navSections, role]);

    const systemAdminSections = useMemo(() => {
        if (role === 'TEACHER') return [];
        const isItemVisible = (item) => !item.permission || can(item.permission);

        const built = allNavSections
            .filter(s => ['settings'].includes(s.id))
            .filter(section => !section.permission || can(section.permission))
            .map(section => ({
                ...section,
                items: section.items ? section.items.filter(isItemVisible) : []
            }));

        if (role === 'PARENT') {
            return built.filter((s) => s.id === 'help');
        }
        return built;
    }, [can, role]);

    return useMemo(() => {
        let builtNav;
        if (role === 'ACCOUNTANT') {
            builtNav = accountantNav;
        } else if (institutionType === 'SECONDARY' && secondaryNav) {
            builtNav = secondaryNav;
        } else if (institutionType === 'TERTIARY' && tertiaryNav) {
            builtNav = tertiaryNav;
        } else {
            builtNav = {
                navSections,
                dashboardSection,
                communicationSection,
                schoolSections,
                lmsSection,
                studentLmsSection,
                backOfficeSections,
                docsCenterSection,
                systemAdminSections
            };
        }

        const visibleNav = filterNavByModules(builtNav, accessUser, isModuleEnabled);

        return restrictSidebarForSchool
            ? restrictNavSections(visibleNav, RESTRICTED_SIDEBAR_SECTION_IDS, RESTRICTED_SIDEBAR_SECTION_LABELS)
            : visibleNav;
    }, [
        accessUser,
        institutionType,
        isModuleEnabled,
        role,
        restrictSidebarForSchool,
        accountantNav,
        secondaryNav,
        tertiaryNav,
        navSections,
        dashboardSection,
        communicationSection,
        schoolSections,
        lmsSection,
        studentLmsSection,
        backOfficeSections,
        docsCenterSection,
        systemAdminSections
    ]);
};

/**
 * Organizes navigation into simplified grouped categories:
 * Home, Academics, Finance, Operations, Communication, Insights, More
 */
export const groupNavigationByCategory = (nav) => {
    const groups = {
        home: { id: 'home', label: 'Home', icon: nav.dashboardSection?.icon, items: [] },
        academics: { id: 'academics', label: 'Academics', items: [] },
        finance: { id: 'finance', label: 'Finance', icon: CreditCard, items: [] },
        operations: { id: 'operations', label: 'Operations', icon: Wrench, items: [] },
        communication: { id: 'communication', label: 'Communication', icon: Mail, items: [] },
        insights: { id: 'insights', label: 'Insights', icon: Brain, items: [] },
        more: { id: 'more', label: 'More', icon: MoreHorizontal, items: [], collapsed: true },
    };

    // Populate Home
    if (nav.dashboardSection) {
        groups.home.items.push(nav.dashboardSection);
    }

    // Populate Academics
    if (nav.schoolSections && nav.schoolSections.length > 0) {
        groups.academics.items.push(...nav.schoolSections);
    }
    if (nav.lmsSection) {
        groups.academics.items.push(nav.lmsSection);
    }
    if (nav.studentLmsSection) {
        groups.academics.items.push(nav.studentLmsSection);
    }

    // Populate Finance
    const financeSection = nav.backOfficeSections?.find(s => s.id === 'finance' || s.id === 'parent-portal-finance');
    if (financeSection) {
        groups.finance.items.push(financeSection);
    }

    // Populate Operations
    const operationsIds = ['hr', 'inventory', 'library', 'transport', 'biometric'];
    const operationsSections = nav.backOfficeSections?.filter(s => operationsIds.includes(s.id)) || [];
    if (operationsSections.length > 0) {
        groups.operations.items.push(...operationsSections);
    }

    // Populate Communication
    if (nav.communicationSection) {
        groups.communication.items.push(nav.communicationSection);
    }
    if (nav.docsCenterSection) {
        groups.communication.items.push(nav.docsCenterSection);
    }

    // Populate More (less-used sections)
    if (nav.systemAdminSections && nav.systemAdminSections.length > 0) {
        groups.more.items.push(...nav.systemAdminSections);
    }

    // Filter out empty groups
    return Object.values(groups).filter(group => group.items.length > 0);
};

/**
 * Returns a flat array of all navigation items for search indexing
 */
export const getFlattenedNav = (nav) => {
    const flat = [];
    
    const processItems = (items, parentLabel = '') => {
        if (!items || !Array.isArray(items)) return;
        
        items.forEach(item => {
            // If it's a category/group of items, recurse
            if (item.type === 'group' || (item.items && item.items.length > 0)) {
                processItems(item.items, item.label || parentLabel);
            } 
            
            // If it's a leaf node with a path, it's searchable
            if (item.path) {
                flat.push({
                    id: item.id,
                    label: item.label,
                    path: item.path,
                    icon: item.icon,
                    category: parentLabel || 'Navigation',
                    type: 'nav'
                });
            }
        });
    };

    if (nav.dashboardSection) {
        flat.push({
            id: 'dashboard',
            label: 'Dashboard Overview',
            path: 'dashboard',
            icon: nav.dashboardSection.icon,
            category: 'General',
            type: 'nav'
        });
    }

    if (nav.communicationSection) {
        processItems(nav.communicationSection.items, 'Communications');
    }

    nav.schoolSections?.forEach(s => {
        if (s.path) {
            flat.push({ ...s, category: 'School', type: 'nav' });
        }
        processItems(s.items, s.label || 'School');
    });

    if (nav.lmsSection) processItems(nav.lmsSection.items, 'LMS');
    if (nav.studentLmsSection) processItems(nav.studentLmsSection.items, 'Portal');
    
    nav.backOfficeSections?.forEach(s => {
        if (s.path) {
            flat.push({ ...s, category: 'Back Office', type: 'nav' });
        }
        processItems(s.items, s.label || 'Back Office');
    });

    if (nav.docsCenterSection) {
        flat.push({
            id: 'docs-center',
            label: 'Document Center',
            path: 'docs-center',
            icon: nav.docsCenterSection.icon,
            category: 'Documents',
            type: 'nav'
        });
    }

    nav.systemAdminSections?.forEach(s => {
        if (s.path) {
            flat.push({ ...s, category: 'System', type: 'nav' });
        }
        processItems(s.items, s.label || 'System');
    });

    return flat;
};
