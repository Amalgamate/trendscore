import React from 'react';
import { Command } from 'cmdk';
import * as LucideIcons from 'lucide-react';
import { Dialog, DialogContent, DialogOverlay } from '@radix-ui/react-dialog';
import { useGlobalSearch } from '../hooks/useGlobalSearch';

/**
 * Renders a Lucide icon by name (string) or by component reference.
 */
const IconRenderer = ({ icon, size = 18, className = "" }) => {
  if (!icon) return <LucideIcons.Search size={size} className={className} />;
  
  if (typeof icon === 'string') {
    // Check if the string exists in LucideIcons exports
    const Icon = LucideIcons[icon] || LucideIcons.Search;
    return <Icon size={size} className={className} />;
  }
  
  // Assume it's a component reference
  const IconComponent = icon;
  return <IconComponent size={size} className={className} />;
};

/**
 * CommandPalette - Global search overlay triggered by '/'
 */
const CommandPalette = ({ onNavigate }) => {
  const { 
    open, 
    setOpen, 
    query, 
    setQuery, 
    results, 
    loading, 
    recentSearches, 
    addToRecent 
  } = useGlobalSearch();

  const handleSelect = (item) => {
    // Mark as recent
    addToRecent(item);
    
    // Perform navigation
    if (onNavigate) {
      onNavigate(item.path, item.params || {});
    }
    
    // Close palette
    setOpen(false);
    setQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogOverlay 
        className="fixed inset-0 bg-black/60 backdrop-blur-[12px] z-[9998] animate-in fade-in duration-500" 
      />
      <DialogContent 
        className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[95%] max-w-[640px] z-[9999] outline-none"
      >
        <Command 
          shouldFilter={false}
          className="bg-[#1A1A1E]/90 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 slide-in-from-top-4 duration-300 ring-1 ring-white/5"
        >
          {/* Search Header */}
          <div className="flex items-center px-5 py-4 border-b border-white/5 bg-white/[0.02]">
            <LucideIcons.Search size={22} className="text-gray-500 mr-4" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Where can we take you today? (Press / to open)"
              className="flex-1 bg-transparent border-none outline-none text-lg placeholder:text-gray-600 text-gray-100 h-10 font-medium tracking-tight"
            />
            {loading ? (
              <LucideIcons.Loader2 size={20} className="animate-spin text-brand-teal" />
            ) : query && (
              <button 
                onClick={() => setQuery('')}
                className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-gray-500"
              >
                <LucideIcons.X size={16} />
              </button>
            )}
          </div>

          {/* Search Results */}
          <Command.List className="max-h-[480px] overflow-y-auto p-2 scrollbar-none">
            <Command.Empty className="py-16 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 bg-white/5 rounded-full text-gray-600 ring-1 ring-white/5">
                    <LucideIcons.Search size={28} />
                </div>
                <p className="text-base font-semibold text-gray-400">No results found for "{query}"</p>
                <p className="text-sm text-gray-500">Check for typos or try a different keyword.</p>
              </div>
            </Command.Empty>

            {/* Recently Visited */}
            {!query && recentSearches.length > 0 && (
              <Command.Group 
                heading={<span className="px-3 text-[10px] font-semibold text-brand-teal uppercase tracking-[0.25em] mb-3 mt-2 block opacity-80">Recently Explored</span>}
              >
                {recentSearches.map((item) => (
                  <SearchItem 
                    key={`recent-${item.id || item.path}`} 
                    item={item} 
                    onSelect={handleSelect} 
                  />
                ))}
              </Command.Group>
            )}

            {/* Navigation Results */}
            {results.nav.length > 0 && (
              <Command.Group 
                heading={<span className="px-3 text-[10px] font-semibold text-gray-600 uppercase tracking-[0.25em] mt-5 mb-3 block">Navigation</span>}
              >
                {results.nav.map((item) => (
                  <SearchItem 
                    key={`nav-${item.id}`} 
                    item={item} 
                    onSelect={handleSelect} 
                  />
                ))}
              </Command.Group>
            )}

            {/* Scholar Results */}
            {results.learners.length > 0 && (
              <Command.Group 
                heading={<span className="px-3 text-[10px] font-semibold text-gray-600 uppercase tracking-[0.25em] mt-5 mb-3 block">Scholars</span>}
              >
                {results.learners.map((item) => (
                  <SearchItem 
                    key={`student-${item.id}`} 
                    item={item} 
                    onSelect={handleSelect} 
                  />
                ))}
              </Command.Group>
            )}

            {/* Tutor Results */}
            {results.teachers.length > 0 && (
              <Command.Group 
                heading={<span className="px-3 text-[10px] font-semibold text-gray-600 uppercase tracking-[0.25em] mt-5 mb-3 block">Tutors & Staff</span>}
              >
                {results.teachers.map((item) => (
                  <SearchItem 
                    key={`teacher-${item.id}`} 
                    item={item} 
                    onSelect={handleSelect} 
                  />
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer / Shortcut Help */}
          <div className="px-5 py-3 border-t border-white/5 bg-black/20 flex justify-between items-center sm:flex-row flex-col gap-3">
            <div className="flex gap-5">
              <span className="flex items-center gap-2 text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                 <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-300 font-sans text-[9px] shadow-inner">↵ Enter</kbd> Select
              </span>
              <span className="flex items-center gap-2 text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                 <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-300 font-sans text-[9px] shadow-inner">↑↓</kbd> Navigate
              </span>
              <span className="flex items-center gap-2 text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                 <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-300 font-sans text-[9px] shadow-inner">Esc</kbd> Close
              </span>
            </div>
            <div className="flex items-center gap-2 group cursor-help transition-opacity hover:opacity-100 opacity-60">
                <LucideIcons.Zap size={13} className="text-brand-teal animate-pulse" />
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em]">TrendScore QuickJump</span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
};

/** Shared Item Component */
const SearchItem = ({ item, onSelect }) => (
  <Command.Item
    onSelect={() => onSelect(item)}
    className="flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer aria-selected:bg-white/[0.08] aria-selected:ring-1 aria-selected:ring-white/10 transition-all group"
  >
    <div className="p-2.5 rounded-xl bg-white/5 text-gray-500 group-aria-selected:bg-brand-teal group-aria-selected:text-white transition-all transform group-aria-selected:scale-110">
      <IconRenderer icon={item.icon} size={18} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[15px] font-medium text-gray-200 truncate tracking-tight group-aria-selected:text-white">{item.label}</p>
      <div className="flex items-center gap-2.5 mt-0.5">
        <span className="text-[10px] uppercase font-semibold tracking-[0.12em] text-gray-500 group-aria-selected:text-brand-teal">
            {item.category}
        </span>
        {item.sublabel && (
          <>
            <span className="w-1 h-1 rounded-full bg-white/10 group-aria-selected:bg-brand-teal/40" />
            <span className="text-[10px] font-medium font-mono text-gray-600 group-aria-selected:text-gray-400">{item.sublabel}</span>
          </>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2 opacity-0 group-aria-selected:opacity-100 transition-all transform translate-x-1 group-aria-selected:translate-x-0">
        <span className="text-[10px] font-semibold text-brand-teal uppercase tracking-widest hidden sm:block">Jump</span>
        <LucideIcons.ChevronRight size={16} className="text-brand-teal" />
    </div>
  </Command.Item>
);

export default CommandPalette;
