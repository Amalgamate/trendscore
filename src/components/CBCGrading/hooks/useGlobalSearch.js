import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigation, getFlattenedNav } from './useNavigation';
import { learnerAPI } from '../../../services/api/learner.api';
import { userAPI } from '../../../services/api/user.api';

const RECENT_SEARCHES_KEY = 'trendscore_recent_searches';
const MAX_RECENT_SEARCHES = 8;

/**
 * useGlobalSearch - Manages search query, results, and keyboard shortcuts
 */
export const useGlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ nav: [], learners: [], teachers: [] });
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);

  // Get current navigation structure for indexing
  const nav = useNavigation();
  const flattenedNav = useMemo(() => getFlattenedNav(nav), [nav]);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        setRecentSearches([]);
      }
    }
  }, []);

  // Keyboard shortcut listener for '/'
  useEffect(() => {
    const down = (e) => {
      // Trigger on '/' unless user is already in an input/textarea
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      
      // Also support Cmd/Ctrl + K as a standard alternative
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Static Navigation Filtering (Local)
  useEffect(() => {
    if (!query) {
      setResults((prev) => (prev.nav.length === 0 ? prev : { ...prev, nav: [] }));
      return;
    }

    const q = query.toLowerCase();
    const filteredNav = flattenedNav.filter((item) =>
      item.label.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );

    setResults((prev) => ({ ...prev, nav: filteredNav }));
  }, [query, flattenedNav]);

  // Dynamic Data Search (API-based with Debounce)
  useEffect(() => {
    if (query.length < 1) { // Changed from 2 to 1 for instant feel
      setResults((prev) => (
        prev.learners.length === 0 && prev.teachers.length === 0
          ? prev
          : { ...prev, learners: [], teachers: [] }
      ));
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [learnerRes, userRes] = await Promise.all([
          learnerAPI.getAll({ search: query, limit: 8 }),
          userAPI.getAll({ search: query, limit: 8 }) // Search across ALL staff members
        ]);

        setResults((prev) => ({
          ...prev,
          learners: (learnerRes.data || []).map(l => ({
            id: l.id,
            label: `${l.firstName} ${l.lastName}`,
            path: 'learner-profile',
            params: { learner: l },
            icon: 'Users',
            category: 'Scholars',
            sublabel: l.admissionNumber || 'No ID',
            type: 'data'
          })),
          teachers: (userRes.data || []).filter(u => u.role !== 'STUDENT' && u.role !== 'PARENT').map(t => ({
            id: t.id,
            label: `${t.firstName} ${t.lastName}`,
            path: 'teacher-profile',
            params: { teacher: t },
            icon: 'GraduationCap',
            category: 'Tutors & Staff',
            sublabel: t.role.replace(/_/g, ' '),
            type: 'data'
          }))
        }));
      } catch (error) {
        console.error('[GlobalSearch] API Error:', error);
      } finally {
        setLoading(false);
      }
    }, 400); // Slightly faster debounce

    return () => clearTimeout(timer);
  }, [query]);

  /** Persist a selected item to recent searches */
  const addToRecent = useCallback((item) => {
    setRecentSearches((prev) => {
      // Remove if already exists (move to top)
      const filtered = prev.filter((i) => 
        (i.id && i.id === item.id) || (i.path && i.path === item.path) ? false : true
      );
      
      const updated = [item, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  /** Clear all recent searches */
  const clearRecent = useCallback(() => {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
    setRecentSearches([]);
  }, []);

  return {
    open,
    setOpen,
    query,
    setQuery,
    results,
    loading,
    recentSearches,
    addToRecent,
    clearRecent
  };
};
