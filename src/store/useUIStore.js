import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getAuthItem } from '../utils/authStorage';

/**
 * useUIStore
 * Manages global UI state: navigation, sidebar, layout preferences, and in-app history.
 *
 * PERF NOTE: currentPage is persisted so refreshes keep users on the page
 * they are actively using. Login handlers must explicitly reset this store so
 * a new session starts at the role's dashboard instead of an old restricted
 * page from a previous user.
 */

function sanitisePersistedPage(page) {
    const hasToken = !!(getAuthItem('token') || document.cookie.includes('accessToken'));
    if (!hasToken) return 'dashboard';
    return page || 'dashboard';
}

export const useUIStore = create(
  persist(
    (set, get) => ({
      // Navigation
      currentPage: 'dashboard',
      pageParams: {},

      // In-app history stack (not persisted — rebuilt each session)
      historyStack: ['dashboard'],
      historyIndex: 0,

      // Sidebar
      sidebarOpen: true,

      // Actions
      setCurrentPage: (page, params = {}) => set((state) => {
        const baseStack = state.historyStack.slice(0, state.historyIndex + 1);
        const lastPage  = baseStack[baseStack.length - 1];
        const newStack  = lastPage === page ? baseStack : [...baseStack, page];
        const newIndex  = newStack.length - 1;
        return { currentPage: page, pageParams: params, historyStack: newStack, historyIndex: newIndex };
      }),

      goBack: () => set((state) => {
        if (state.historyIndex <= 0) return state;
        const newIndex = state.historyIndex - 1;
        return { currentPage: state.historyStack[newIndex], pageParams: {}, historyIndex: newIndex };
      }),

      goForward: () => set((state) => {
        if (state.historyIndex >= state.historyStack.length - 1) return state;
        const newIndex = state.historyIndex + 1;
        return { currentPage: state.historyStack[newIndex], pageParams: {}, historyIndex: newIndex };
      }),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      resetUI: (page = 'dashboard') => set({
        currentPage: page,
        pageParams: {},
        historyStack: [page],
        historyIndex: 0,
        sidebarOpen: true
      })
    }),
    {
      name: 'cbc_ui_state',
      partialize: (state) => ({
        currentPage: state.currentPage,
        pageParams:  state.pageParams,
        sidebarOpen: state.sidebarOpen,
      }),
      // Guard: if there’s no auth token when the store rehydrates (e.g. the
      // user cleared cookies), reset to dashboard so no page-level API call
      // fires before authentication is confirmed.
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        currentPage: sanitisePersistedPage(persisted?.currentPage || 'dashboard'),
        // Never restore history stack from storage — it’s rebuilt each session
        historyStack: [sanitisePersistedPage(persisted?.currentPage || 'dashboard')],
        historyIndex: 0,
      }),
    }
  )
);
