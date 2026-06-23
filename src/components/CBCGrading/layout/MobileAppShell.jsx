import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  ClipboardList,
  LogOut,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react';
import MobileBottomNav from '../dashboard/mobile/MobileBottomNav';
import MobileCommunicationCenter from './MobileCommunicationCenter';
import axiosInstance from '../../../services/api/axiosConfig';

// ── MobileSearchSheet ─────────────────────────────────────────────────────
// Slide-up full-screen search panel for quickly finding learners by name or
// admission number. Only mounts when open to avoid idle network usage.
function MobileSearchSheet({ open, onClose, onNavigate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Focus input whenever the sheet opens; reset state on close.
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
    return () => clearTimeout(debounceRef.current);
  }, [open]);

  const doSearch = useCallback(async (q) => {
    if (!q.trim() || q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/learners?search=${encodeURIComponent(q.trim())}&limit=12`);
      setResults(res.data?.data ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 320);
  };

  const handleSelect = (learner) => {
    onClose();
    onNavigate?.('learner-profile', { learner });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: 'var(--ts-mobile-navy, #06285a)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Search learners"
    >
      {/* Search bar */}
      <div
        className="flex items-center gap-3 px-4 pb-3 border-b border-white/15"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <div className="flex-1 flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-3 h-11">
          <Search size={16} className="text-white/60 shrink-0" />
          <input
            ref={inputRef}
            type="search"
            placeholder="Search learners…"
            value={query}
            onChange={handleChange}
            className="flex-1 bg-transparent text-white placeholder-white/50 text-sm outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults([]); }}
              className="text-white/60 hover:text-white"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-11 px-3 text-sm font-semibold text-white/80 hover:text-white"
        >
          Cancel
        </button>
      </div>

      {/* Results area */}
      <div
        className="flex-1 overflow-y-auto px-4 pt-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        {loading && (
          <div className="flex items-center gap-2 py-8 justify-center text-white/60 text-sm">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Searching…
          </div>
        )}

        {!loading && query.length >= 2 && results.length === 0 && (
          <p className="text-center py-12 text-white/50 text-sm">
            No learners found for "{query}"
          </p>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
            {results.map((learner) => (
              <button
                key={learner.id}
                type="button"
                onClick={() => handleSelect(learner)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/8 border border-white/10 text-left hover:bg-white/12 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white shrink-0 uppercase">
                  {learner.firstName?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {learner.firstName} {learner.lastName}
                  </div>
                  <div className="text-[11px] text-white/60 flex items-center gap-2 mt-0.5">
                    {learner.grade && (
                      <span className="flex items-center gap-1">
                        <BookOpen size={10} />{learner.grade}
                      </span>
                    )}
                    {learner.admissionNumber && (
                      <span className="flex items-center gap-1">
                        <ClipboardList size={10} />{learner.admissionNumber}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight size={14} className="text-white/40 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {!query && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
              <Users size={24} className="text-white/60" />
            </div>
            <p className="text-sm font-semibold text-white/70">Find a learner</p>
            <p className="text-xs text-white/40 mt-1">Search by name or admission number</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MobileAppShell ────────────────────────────────────────────────────────
// Outer chrome for all non-parent mobile users: branded header, scroll body,
// fixed bottom nav. Brand colors come from CSS vars set by branding settings
// so every school gets its own look automatically.
const MobileAppShell = ({ children, user, onNavigate, onLogout, currentPage, brandingSettings }) => {
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const avatarMenuRef = useRef(null);

  const schoolName =
    brandingSettings?.schoolName ||
    brandingSettings?.name ||
    user?.school?.name ||
    user?.schoolName ||
    'School Portal';

  const schoolLogo =
    brandingSettings?.logoUrl ||
    user?.school?.logoUrl ||
    user?.school?.logo ||
    '/branding/logo.png';

  const fullName =
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
    user?.name ||
    user?.email ||
    'User';

  const initials =
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U';

  const avatarUrl =
    user?.profilePicture ||
    user?.avatarUrl ||
    user?.avatar ||
    user?.photoUrl ||
    user?.imageUrl;

  // Close avatar dropdown on outside tap
  useEffect(() => {
    if (!avatarMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [avatarMenuOpen]);

  const handleMenuNavigate = (page) => {
    setAvatarMenuOpen(false);
    onNavigate?.(page);
  };

  return (
    <>
      <div className="ts-mobile-app h-[100dvh] w-full flex flex-col overflow-hidden relative text-white">
        {/* ── Header ── */}
        <div
          className="ts-mobile-header flex min-h-16 items-center justify-between border-b px-5 pb-3"
          style={{ borderColor: 'var(--brand-secondary, #ff7900)33' }}
        >
          {/* School identity */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-[10px] bg-white flex items-center justify-center overflow-hidden border"
              style={{ borderColor: 'var(--brand-secondary, #ff7900)' }}
            >
              <img
                src={schoolLogo}
                alt={`${schoolName} logo`}
                className="w-7 h-7 object-contain"
                onError={(e) => { e.currentTarget.src = '/branding/logo.png'; }}
              />
            </div>
            <div>
              <div className="max-w-[170px] truncate text-[13px] font-semibold text-white leading-tight">
                {schoolName}
              </div>
              <div className="text-[10px] uppercase tracking-[0.06em] text-white/65">
                School Portal
              </div>
            </div>
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-2">
            {/* Search — now wired */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="w-9 h-9 rounded-[10px] bg-transparent flex items-center justify-center text-white border"
              style={{ borderColor: 'var(--brand-secondary, #ff7900)' }}
              aria-label="Search learners"
            >
              <Search size={16} />
            </button>

            <MobileCommunicationCenter user={user} onNavigate={onNavigate} />

            {/* Avatar / account menu */}
            <div className="relative" ref={avatarMenuRef}>
              <button
                type="button"
                onClick={() => setAvatarMenuOpen((open) => !open)}
                className="h-9 rounded-[10px] bg-white/10 px-1.5 flex items-center gap-1.5 text-white border"
                style={{ borderColor: 'var(--brand-secondary, #ff7900)' }}
                aria-label="Open account menu"
                aria-expanded={avatarMenuOpen}
              >
                <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center overflow-hidden text-[11px] font-bold"
                  style={{ color: 'var(--toolbar-bg, #06285a)' }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </span>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${avatarMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {avatarMenuOpen && (
                <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900 shadow-xl">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="text-sm font-semibold truncate">{fullName}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {user?.role || user?.email || 'Account'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMenuNavigate('settings-profile')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-gray-50"
                  >
                    <Settings size={17} className="text-brand-purple" />
                    Settings
                  </button>
                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => { setAvatarMenuOpen(false); onLogout(); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={17} />
                      Sign Out
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Scrollable content area ── */}
        <div className="ts-mobile-scroll flex-1 overflow-y-auto pb-24">
          {children}
        </div>

        {/* ── Fixed bottom nav ── */}
        <MobileBottomNav role={user?.role} currentPath={currentPage} onNavigate={onNavigate} />
      </div>

      {/* ── Search sheet — rendered outside shell so it covers header too ── */}
      <MobileSearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={onNavigate}
        user={user}
      />
    </>
  );
};

export default MobileAppShell;
