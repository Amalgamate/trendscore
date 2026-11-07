import React, { useMemo } from 'react';
import {
  BarChart3,
  BookOpen,
  Bus,
  CalendarDays,
  CheckCircle2,
  FileText,
  HeartPulse,
  Home,
  Leaf,
  Settings,
  ShieldCheck,
  Sparkles,
  Utensils,
  Users,
  Wrench,
} from 'lucide-react';
import { hasPermission } from '../../../../config/permissions';
import { useModuleAccess } from '../../../../contexts/ModuleAccessContext';
import { hasPageAccess } from '../../utils/appAccess';
import RoleActionWorkspace from './RoleActionWorkspace';

const ROUTES = {
  SUPER_ADMIN: {
    title: 'Platform Command Centre', prompt: 'Choose a platform task.', icon: Settings,
    emptyMessage: 'Platform tools are not enabled for this account.',
    actions: [
      { page: 'settings-users', permission: 'EDIT_USER', label: 'Manage users', detail: 'Review accounts and access.', icon: Users, color: 'bg-blue-700' },
      { page: 'settings-system-logs', permission: 'VIEW_SYSTEM_LOGS', label: 'Review system logs', detail: 'Check platform activity.', icon: FileText, color: 'bg-indigo-700' },
      { page: 'settings-system-control', permission: 'SYSTEM_SETTINGS', label: 'Open system controls', detail: 'Manage platform settings.', icon: Wrench, color: 'bg-slate-800' },
      { page: 'system-maintenance', permission: 'SYSTEM_SETTINGS', label: 'Manage backups', detail: 'Open backup and recovery tools.', icon: ShieldCheck, color: 'bg-violet-700' },
    ],
  },
  HEAD_TEACHER: {
    title: 'School Leadership', prompt: 'What needs your attention today?', icon: Home,
    emptyMessage: 'Your school has not enabled any leadership tools yet.',
    actions: [
      { page: 'attendance-daily', permission: 'VIEW_ALL_ATTENDANCE', label: 'Review attendance', detail: 'Follow up on registers and absences.', icon: CheckCircle2, color: 'bg-teal-700' },
      { page: 'digital-diary', permission: 'LEARNING_VIEW', label: 'Review the digital diary', detail: 'Check class updates and assigned work.', icon: BookOpen, color: 'bg-violet-700' },
      { page: 'assess-mobile-dashboard', permission: 'ACCESS_ASSESSMENT_MODULE', label: 'Review assessment', detail: 'See score entry and coverage.', icon: BarChart3, color: 'bg-rose-700' },
      { page: 'teachers-list', permission: 'MANAGE_TEACHERS', label: 'Open the staff list', detail: 'Find a teacher and review assignments.', icon: Users, color: 'bg-blue-700' },
      { page: 'planner-timetable', permission: 'ACCESS_TIMETABLE', label: 'Check the timetable', detail: 'Review lessons and school scheduling.', icon: CalendarDays, color: 'bg-amber-700' },
    ],
  },
  HEAD_OF_CURRICULUM: {
    title: 'Curriculum & Assessment', prompt: 'Check coverage and support teachers.', icon: BookOpen,
    emptyMessage: 'Curriculum tools are not enabled for this account.',
    actions: [
      { page: 'digital-diary', permission: 'LEARNING_VIEW', label: 'Review class diaries', detail: 'Check lesson notes and assigned work.', icon: BookOpen, color: 'bg-violet-700' },
      { page: 'assess-mobile-dashboard', permission: 'ACCESS_ASSESSMENT_MODULE', label: 'Review assessment coverage', detail: 'Find classes that need score entry.', icon: BarChart3, color: 'bg-rose-700' },
      { page: 'planner-schemes', permission: 'MANAGE_TEACHERS', label: 'Review schemes of work', detail: 'Check teacher planning and coverage.', icon: FileText, color: 'bg-blue-700' },
      { page: 'planner-timetable', permission: 'ACCESS_TIMETABLE', label: 'Check the timetable', detail: 'Review learning time by class.', icon: CalendarDays, color: 'bg-amber-700' },
      { page: 'teachers-list', permission: 'MANAGE_TEACHERS', label: 'Support a teacher', detail: 'Open the teaching staff list.', icon: Users, color: 'bg-teal-700' },
    ],
  },
  LIBRARIAN: {
    title: 'Library Desk', prompt: 'Choose a library task.', icon: BookOpen,
    emptyMessage: 'The Library module is not enabled for this school.',
    actions: [
      { page: 'library-catalog', permission: 'LIBRARY_MANAGEMENT', label: 'Search the catalogue', detail: 'Find and update library titles.', icon: BookOpen, color: 'bg-blue-700' },
      { page: 'library-circulation', permission: 'BORROW_RETURN_BOOKS', label: 'Issue or return a book', detail: 'Update a learner’s loan.', icon: FileText, color: 'bg-teal-700' },
      { page: 'library-inventory', permission: 'VIEW_LIBRARY_INVENTORY', label: 'Check library stock', detail: 'Review the book inventory.', icon: BarChart3, color: 'bg-violet-700' },
      { page: 'library-members', permission: 'MANAGE_LIBRARY_MEMBERS', label: 'Find a library member', detail: 'Review member records.', icon: Users, color: 'bg-indigo-700' },
    ],
  },
  NURSE: {
    title: 'Health Office', prompt: 'Your school health workspace.', icon: HeartPulse,
    emptyMessage: 'Health tools are not available in this portal yet. Ask your school administrator about access.', actions: [],
  },
  SECURITY: {
    title: 'School Safety', prompt: 'Your school safety workspace.', icon: ShieldCheck,
    emptyMessage: 'Visitor and incident tools are not available in this portal yet. Ask your school administrator about access.', actions: [],
  },
  DRIVER: {
    title: 'Transport Desk', prompt: 'Your transport workspace.', icon: Bus,
    emptyMessage: 'Driver tools are not available in this portal. Use the school’s driver app or ask your administrator for access.', actions: [],
  },
  COOK: {
    title: 'Kitchen Day Sheet', prompt: 'Your school kitchen workspace.', icon: Utensils,
    emptyMessage: 'Kitchen tasks are not available in this portal yet. Ask your school administrator about access.', actions: [],
  },
  CLEANER: {
    title: 'Facilities Tasks', prompt: 'Your school cleaning workspace.', icon: Sparkles,
    emptyMessage: 'Cleaning tasks are not available in this portal yet. Ask your school administrator about access.', actions: [],
  },
  GROUNDSKEEPER: {
    title: 'Grounds Tasks', prompt: 'Your school grounds workspace.', icon: Leaf,
    emptyMessage: 'Grounds tasks are not available in this portal yet. Ask your school administrator about access.', actions: [],
  },
  IT_SUPPORT: {
    title: 'IT Service Desk', prompt: 'Your school technology workspace.', icon: Wrench,
    emptyMessage: 'IT support tools are not available in this portal yet. Ask your school administrator about access.', actions: [],
  },
};

export const OPERATIONAL_STAFF_ROLES = ['LIBRARIAN', 'NURSE', 'SECURITY', 'DRIVER', 'COOK', 'CLEANER', 'GROUNDSKEEPER', 'IT_SUPPORT'];

export default function RoleLandingDashboard({ user, role: roleOverride, onNavigate }) {
  const { activeSlugs } = useModuleAccess();
  const role = String(roleOverride || user?.role || '').toUpperCase();
  const config = ROUTES[role];
  const permissionRole = role === 'OWNER' ? 'ADMIN' : role;
  const accessUser = useMemo(() => ({ ...(user || {}), role: permissionRole, enabledApps: activeSlugs }), [activeSlugs, permissionRole, user]);
  const actions = useMemo(() => (config?.actions || []).filter((action) =>
    hasPermission(permissionRole, action.permission) && hasPageAccess(accessUser, action.page)
  ), [accessUser, config, permissionRole]);

  if (!config) return null;
  return <RoleActionWorkspace
    title={config.title}
    prompt={config.prompt}
    icon={config.icon}
    user={user}
    onNavigate={onNavigate}
    actions={actions}
    emptyMessage={config.emptyMessage}
  />;
}
