import { API_BASE_URL, clearApiCache, fetchWithAuth } from './core';

import { authAPI } from './auth.api';
import { onboardingAPI } from './onboarding.api';
import { dashboardAPI } from './dashboard.api';
import { configAPI } from './config.api';
import { communicationAPI } from './communication.api';
import { broadcastAPI } from './broadcast.api';
import { userAPI } from './user.api';
import { schoolAPI } from './school.api';
import { facilityAPI } from './facility.api';
import { teacherAPI } from './teacher.api';
import { parentAPI } from './parent.api';
import { learnerAPI } from './learner.api';
import { subjectAssignmentAPI } from './subjectassignment.api';
import { classAPI } from './class.api';
import { attendanceAPI } from './attendance.api';
import { assessmentAPI } from './assessment.api';
import { feeAPI } from './fee.api';
import { notificationAPI } from './notification.api';
import { reportAPI } from './report.api';
import { healthAPI } from './health.api';
import { cbcAPI } from './cbc.api';
import { workflowAPI } from './workflow.api';
import { gradingAPI } from './grading.api';
import { adminAPI } from './admin.api';
import { documentsAPI } from './documents.api';
import { bookAPI, libraryAPI } from './book.api';
import { sharingAPI } from './sharing.api';
import { hrAPI } from './hr.api';
import { accountingAPI } from './accounting.api';
import { financeAPI } from './finance.api';
import { inventoryAPI } from './inventory.api';
import { noticesAPI } from './notices.api';
import { aiAPI } from './ai.api';
import { schemeOfWorkAPI } from './schemeofwork.api';
import { lmsAPI } from './lms.api';

import { plannerAPI } from './planner.api';
import { idTemplateAPI } from './idTemplate.api';
import { transportAPI } from './transport.api';
import { changelogAPI } from './changelog.api';
import { mpesaAPI } from './mpesa.api';
import { systemLogsAPI } from './systemLogs.api';
import { pathwayAPI } from './pathway.api';
import { seniorPathwayAPI } from './seniorPathway.api';
import { chatAPI } from './chat.api';
import { approvalAPI } from './approval.api';

export { API_BASE_URL, clearApiCache };

export { authAPI };
export { onboardingAPI };
export { dashboardAPI };
export { configAPI };
export { communicationAPI };
export { broadcastAPI };
export { userAPI };
export { schoolAPI };
export { facilityAPI };
export { teacherAPI };
export { parentAPI };
export { learnerAPI };
export { subjectAssignmentAPI };
export { classAPI };
export { attendanceAPI };
export { assessmentAPI };
export { feeAPI };
export { notificationAPI };
export { reportAPI };
export { healthAPI };
export { cbcAPI };
export { workflowAPI };
export { gradingAPI };
export { adminAPI };
export { documentsAPI };
export { bookAPI };
export { libraryAPI };
export { sharingAPI };
export { hrAPI };
export { accountingAPI };
export { financeAPI };
export { inventoryAPI };
export { noticesAPI };
export { aiAPI };
export { schemeOfWorkAPI };
export { lmsAPI };
export { plannerAPI as planner };
export { idTemplateAPI };
export { transportAPI };
export { mpesaAPI };
export { systemLogsAPI };
export { pathwayAPI };
export { seniorPathwayAPI };
export { approvalAPI };

const api = {
  // ── Core Axios-like Methods ───────────────────────────────────────────
  get:    async (url, params) => fetchWithAuth(url, { method: 'GET', params }),
  post:   async (url, data)   => fetchWithAuth(url, { method: 'POST', body: JSON.stringify(data) }),
  put:    async (url, data)   => fetchWithAuth(url, { method: 'PUT', body: JSON.stringify(data) }),
  patch:  async (url, data)   => fetchWithAuth(url, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: async (url)         => fetchWithAuth(url, { method: 'DELETE' }),

  // ── Service Modules ───────────────────────────────────────────────────
  auth: authAPI,
  onboarding: onboardingAPI,
  dashboard: dashboardAPI,
  config: configAPI,
  branding: {
    get: async () => configAPI.getBranding()
  },
  ...configAPI,
  communication: communicationAPI,
  broadcasts: broadcastAPI,
  users: userAPI,
  school: schoolAPI,
  facility: facilityAPI,
  teachers: teacherAPI,
  parents: parentAPI,
  learners: learnerAPI,
  subjectAssignments: subjectAssignmentAPI,
  classes: classAPI,
  attendance: attendanceAPI,
  assessments: assessmentAPI,
  fees: feeAPI,
  notifications: {
    ...notificationAPI,
    getAuditLogs: async (params = {}) => {
      Object.keys(params).forEach(key => {
        if (params[key] === undefined || params[key] === null || params[key] === '') {
          delete params[key];
        }
      });
      const queryString = new URLSearchParams(params).toString();
      return fetchWithAuth(`/notifications/audit-logs${queryString ? `?${queryString}` : ''}`);
    },
  },
  userNotifications: {
    getAll: async () => fetchWithAuth('/user-notifications'),
    markAsRead: async (id) => fetchWithAuth(`/user-notifications/${id}/read`, { method: 'PATCH' }),
    markAllAsRead: async () => fetchWithAuth('/user-notifications/read-all', { method: 'PATCH' }),
    getVapidPublicKey: async () => fetchWithAuth('/user-notifications/vapid-public-key'),
    savePushSubscription: async (subscription) =>
      fetchWithAuth('/user-notifications/push-subscription', {
        method: 'POST',
        body: JSON.stringify(subscription),
      }),
  },
  reports: reportAPI,
  health: healthAPI,
  cbc: cbcAPI,
  workflow: workflowAPI,
  grading: gradingAPI,
  admin: adminAPI,
  documents: documentsAPI,
  books: bookAPI,
  library: libraryAPI,
  sharing: sharingAPI,
  hr: hrAPI,
  accounting: accountingAPI,
  finance: financeAPI,
  inventory: inventoryAPI,
  notices: noticesAPI,
  ai: aiAPI,
  schemesOfWork: schemeOfWorkAPI,
  lms: lmsAPI,
  planner: plannerAPI,
  idTemplates: idTemplateAPI,
  transport: transportAPI,
  changelog: changelogAPI,
  mpesa: mpesaAPI,
  systemLogs: systemLogsAPI,
  pathways: pathwayAPI,
  seniorPathways: seniorPathwayAPI,
  chat: chatAPI,
  approvals: approvalAPI,
  gitNotifications: {
    preview: async (data) => fetchWithAuth('/git-notifications/preview', { method: 'POST', body: JSON.stringify(data) }),
    publish: async (data) => fetchWithAuth('/git-notifications/publish', { method: 'POST', body: JSON.stringify(data) }),
    list: async (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return fetchWithAuth(`/git-notifications${qs ? `?${qs}` : ''}`);
    },
  },
};

export default api;
