/**
 * ImpersonationSearchBox
 *
 * Replaces the static role-dropdown area in AccountSwitcherMenu for SUPER_ADMIN
 * and ADMIN users. Provides debounced live search across user attributes and
 * renders a contextual results dropdown.
 *
 * Requirements: 1.1, 1.2, 1.5, 1.6, 1.7, 1.8, 1.9
 *
 * @component
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, AlertCircle, Shield, UserX } from 'lucide-react';
import { impersonationApi } from '../services/api/impersonation.api';
import { cn } from '../utils/cn';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format a role string for display: "HEAD_TEACHER" → "Head Teacher"
 */
const formatRoleName = (role) => {
  if (!role) return '';
  return role
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Role badge colour — mirrors AccountSwitcherMenu's getRoleColor utility.
 */
const getRoleColor = (role) => {
  const colorMap = {
    SUPER_ADMIN: 'bg-red-50 text-red-700 border-red-200',
    ADMIN: 'bg-purple-50 text-purple-700 border-purple-200',
    HEAD_TEACHER: 'bg-blue-50 text-blue-700 border-blue-200',
    HEAD_OF_CURRICULUM: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    TEACHER: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    ACCOUNTANT: 'bg-green-50 text-green-700 border-green-200',
    RECEPTIONIST: 'bg-amber-50 text-amber-700 border-amber-200',
    PARENT: 'bg-pink-50 text-pink-700 border-pink-200',
    STUDENT: 'bg-teal-50 text-teal-700 border-teal-200',
  };
  return colorMap[role] || 'bg-gray-50 text-gray-700 border-gray-200';
};

/**
 * Build the contextual secondary line shown under a result card.
 *
 * - Teachers: list up to 3 class names
 * - Parents: list linked learner ADM + name
 */
const buildContextLine = (user) => {
  if (user.role === 'TEACHER' && user.classesAsTeacher?.length > 0) {
    return user.classesAsTeacher.map((c) => c.name || `Grade ${c.grade}`).join(', ');
  }
  if (user.role === 'PARENT' && user.linkedLearners?.length > 0) {
    return user.linkedLearners
      .map((l) => `${l.admissionNumber} – ${l.firstName} ${l.lastName}`)
      .join(', ');
  }
  return null;
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * @param {{ onUserSelect: (user: UserSearchResult) => void, disabled?: boolean }} props
 */
const ImpersonationSearchBox = ({ onUserSelect, disabled = false }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  // Tracks the most recent request so stale responses are discarded
  const currentRequestRef = useRef(0);

  // ── Outside-click handler ─────────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        clearQueryAndResults();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // ── Core helpers ──────────────────────────────────────────────────────────
  const clearQueryAndResults = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
    setIsLoading(false);
    setIsOpen(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    const requestId = ++currentRequestRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const data = await impersonationApi.searchUsers(searchQuery, 10);
      // Discard if a newer request superseded this one
      if (requestId !== currentRequestRef.current) return;

      const users = Array.isArray(data) ? data : (data?.data ?? []);
      setResults(users);
      setIsOpen(true);
    } catch (err) {
      if (requestId !== currentRequestRef.current) return;
      // Requirement 1.8: preserve previous results on error
      setError(err?.message || 'Search failed. Please try again.');
      setIsOpen(true);
    } finally {
      if (requestId === currentRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // ── Input change + 300 ms debounce ────────────────────────────────────────
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    // Clear previous debounce timer
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    // Requirement 1.2: suppress when disabled
    if (disabled) return;

    if (!value.trim()) {
      setResults([]);
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    // 300 ms debounce (Requirement 1.2)
    debounceTimerRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // ── Keyboard handler ──────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      clearQueryAndResults();
    }
  };

  // ── Result selection ──────────────────────────────────────────────────────
  const handleResultClick = (user) => {
    clearQueryAndResults();
    onUserSelect?.(user);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const showDropdown = isOpen && (results.length > 0 || error || (!isLoading && query.trim()));

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search users to impersonate..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label="Search users for impersonation"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          className={cn(
            'w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-md',
            'focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent',
            'bg-white placeholder-gray-400',
            disabled && 'opacity-50 cursor-not-allowed bg-gray-50'
          )}
        />
        {/* Inline spinner — shown WHILE loading (Requirement 1.6) */}
        {isLoading && (
          <Loader2
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-purple animate-spin"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Results Dropdown */}
      {showDropdown && (
        <div
          role="listbox"
          aria-label="User search results"
          className={cn(
            'absolute left-0 right-0 top-full mt-1',
            'bg-white border border-gray-200 rounded-md shadow-lg',
            'z-50 max-h-80 overflow-y-auto'
          )}
        >
          {/* Inline error message (Requirement 1.8) */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 text-xs text-red-700 bg-red-50 border-b border-red-100">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* "No users found" empty state (Requirement 1.7) */}
          {!error && !isLoading && results.length === 0 && query.trim() && (
            <div className="flex flex-col items-center gap-1 py-5 text-sm text-slate-500">
              <UserX size={20} className="text-gray-300" aria-hidden="true" />
              <span>No users found</span>
            </div>
          )}

          {/* Result cards (Requirement 1.5) */}
          {results.map((user) => {
            const contextLine = buildContextLine(user);
            const fullName = `${user.firstName} ${user.lastName}`.trim();

            return (
              <button
                key={user.id}
                role="option"
                aria-selected="false"
                onClick={() => handleResultClick(user)}
                className={cn(
                  'w-full flex items-start gap-3 px-3 py-2.5 text-left',
                  'hover:bg-slate-50 active:bg-slate-100 transition-colors',
                  'border-b border-gray-50 last:border-b-0',
                  'focus:outline-none focus:bg-slate-50',
                  'cursor-pointer'
                )}
              >
                {/* Role badge */}
                <div
                  className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border',
                    'text-[10px] font-semibold flex-shrink-0 mt-0.5',
                    getRoleColor(user.role)
                  )}
                >
                  <Shield size={9} aria-hidden="true" />
                  <span>{formatRoleName(user.role)}</span>
                </div>

                {/* User info */}
                <div className="flex-1 min-w-0">
                  {/* Full name */}
                  <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                    {fullName || '—'}
                  </p>
                  {/* Email */}
                  <p className="text-xs text-slate-500 truncate leading-snug mt-0.5">
                    {user.email}
                  </p>
                  {/* Contextual info: class names or linked learner ADM */}
                  {contextLine && (
                    <p className="text-xs text-slate-500 truncate leading-snug mt-0.5">
                      {contextLine}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ImpersonationSearchBox;
