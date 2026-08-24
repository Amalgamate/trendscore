import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Search, X, Check, User, Hash, GraduationCap } from 'lucide-react';

/**
 * SmartLearnerSearch Component
 * 
 * An intelligent, content-aware search component for selecting learners.
 * Searches across name, admission number, and grade.
 * 
 * @param {Array}    learners          - Local list of learner objects (used when onSearch is not provided)
 * @param {string}   selectedLearnerId - Currently selected learner ID
 * @param {Function} onSelect          - Callback when a learner is selected (returns learner ID)
 * @param {Function} onSearch          - Optional async fn(query) → learner[]. When provided the component
 *                                       delegates search to the server (debounced 300ms) instead of
 *                                       filtering the local array. Falls back to local array when query
 *                                       is empty so recently-used learners still show immediately.
 * @param {string}   placeholder       - Input placeholder text
 * @param {boolean}  disabled          - Whether the input is disabled
 */
const SmartLearnerSearch = ({ 
  learners = [], 
  selectedLearnerId, 
  onSelect, 
  onSearch,           // optional: async (query) => learner[]
  placeholder = "Search learner by name, adm no...", 
  disabled = false,
  className = "",
  compact = false,
  inputClassName = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [serverResults, setServerResults] = useState(null); // null = not searched yet
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Find selected learner object for display
  const selectedLearner = useMemo(() => 
    learners.find(l => l.id === selectedLearnerId), 
    [learners, selectedLearnerId]
  );

  // Initialize search term with selected learner's name on mount/update
  useEffect(() => {
    if (selectedLearner && !isOpen) {
      const admNo = selectedLearner.admissionNumber || selectedLearner.admNo || '';
      setSearchTerm(`${selectedLearner.firstName} ${selectedLearner.lastName} (${admNo})`);
    } else if (!selectedLearner && !isOpen) {
      setSearchTerm('');
    }
  }, [selectedLearner, isOpen]);

  // Filter learners based on search term
  const filteredLearners = useMemo(() => {
    // Server-search mode: use whatever the server returned (or empty while loading)
    if (onSearch) {
      if (!searchTerm) return learners.slice(0, 50); // show local list when empty
      return serverResults ?? [];
    }

    // Client-side mode (no onSearch prop)
    if (!searchTerm) return learners.slice(0, 50);
    
    // If search term matches the selected learner exactly, return all (or relevant)
    if (selectedLearner) {
       const selectedAdmNo = selectedLearner.admissionNumber || selectedLearner.admNo || '';
       if (searchTerm === `${selectedLearner.firstName} ${selectedLearner.lastName} (${selectedAdmNo})`) {
         return learners.slice(0, 50);
       }
    }

    const lowerTerm = searchTerm.toLowerCase();
    return learners.filter(learner => {
      const fullName = `${learner.firstName} ${learner.middleName || ''} ${learner.lastName}`.toLowerCase();
      const admNo = (learner.admissionNumber || learner.admNo || '').toString().toLowerCase();
      const grade = (learner.grade || '').toString().toLowerCase();
      return fullName.includes(lowerTerm) || admNo.includes(lowerTerm) || grade.includes(lowerTerm);
    }).slice(0, 50);
  }, [learners, searchTerm, selectedLearner, onSearch, serverResults]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedInsideWrapper = wrapperRef.current?.contains(event.target);
      const clickedInsideDropdown = listRef.current?.contains(event.target);

      if (!clickedInsideWrapper && !clickedInsideDropdown) {
        setIsOpen(false);
        // Reset search term to selected learner if any, otherwise clear
        if (selectedLearner) {
          const admNo = selectedLearner.admissionNumber || selectedLearner.admNo || '';
          setSearchTerm(`${selectedLearner.firstName} ${selectedLearner.lastName} (${admNo})`);
        } else {
          setSearchTerm('');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedLearner]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current && listRef.current.children[highlightedIndex]) {
      listRef.current.children[highlightedIndex].scrollIntoView({
        block: 'nearest',
      });
    }
  }, [highlightedIndex, isOpen]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setIsOpen(true);
    setHighlightedIndex(0);
    if (value === '') {
      onSelect('');
      setServerResults(null);
      return;
    }

    // Server-search: debounce the API call
    if (onSearch) {
      clearTimeout(debounceRef.current);
      if (value.trim().length < 2) {
        setServerResults(null);
        return;
      }
      setIsSearching(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await onSearch(value.trim());
          setServerResults(Array.isArray(results) ? results : []);
        } catch {
          setServerResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    }
  };

  // Update dropdown position when opened
  useEffect(() => {
    if (isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isOpen]);

  // Handle scroll/resize to update/close dropdown
  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setDropdownPos({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen]);

  const handleSelect = (learner) => {
    onSelect(learner.id);
    const admNo = learner.admissionNumber || learner.admNo || '';
    setSearchTerm(`${learner.firstName} ${learner.lastName} (${admNo})`);
    setIsOpen(false);
    setServerResults(null);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredLearners.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (isOpen && filteredLearners[highlightedIndex]) {
          handleSelect(filteredLearners[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        if (selectedLearner) {
          const admNo = selectedLearner.admissionNumber || selectedLearner.admNo || '';
          setSearchTerm(`${selectedLearner.firstName} ${selectedLearner.lastName} (${admNo})`);
        } else {
          setSearchTerm('');
        }
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const clearSelection = (e) => {
    e.stopPropagation();
    onSelect('');
    setSearchTerm('');
    setServerResults(null);
    setIsOpen(true);
    inputRef.current?.focus();
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {!compact && (
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Learner
        </label>
      )}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className={`h-4 w-4 ${compact ? 'text-gray-400' : 'text-gray-400'}`} />
        </div>
        <input
          ref={inputRef}
          type="text"
          className={`w-full bg-white pl-10 pr-9 ${compact ? 'py-1.5' : 'py-2'} border ${isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'} rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-200 text-sm ${inputClassName}`}
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        {searchTerm && !disabled && (
          <button
            onClick={clearSelection}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Dropdown Results — Portalized */}
      {isOpen && !disabled && (
        typeof document !== 'undefined' && ReactDOM.createPortal(
          <div 
            className="fixed z-[9999] bg-white rounded-lg shadow-2xl border border-gray-200 overflow-y-auto animate-in fade-in zoom-in-95 duration-100" 
            style={{ 
              top: dropdownPos.top - window.scrollY + 4, 
              left: dropdownPos.left - window.scrollX, 
              width: dropdownPos.width,
              maxHeight: '240px'
            }} 
            ref={listRef}
          >
            {isSearching ? (
              <div className="px-4 py-6 text-center text-gray-400 text-xs font-medium flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Searching…
              </div>
            ) : filteredLearners.length > 0 ? (
              <ul className="py-1">
                {filteredLearners.map((learner, index) => {
                  const isSelected = learner.id === selectedLearnerId;
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <li
                      key={learner.id}
                      onClick={() => handleSelect(learner)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`px-4 py-2.5 cursor-pointer transition-colors duration-150 flex items-center justify-between
                        ${isHighlighted ? 'bg-blue-50' : 'hover:bg-gray-50'}
                        ${isSelected ? 'bg-blue-50' : ''}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium
                          ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}
                        `}>
                          {learner.firstName.charAt(0)}{learner.lastName.charAt(0)}
                        </div>
                        <div>
                          <div className={`text-xs font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                            {learner.firstName} {learner.middleName ? `${learner.middleName} ` : ''}{learner.lastName}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-gray-500">
                            <span className="flex items-center gap-1">
                              <Hash size={10} />
                              {learner.admissionNumber || learner.admNo}
                            </span>
                            {learner.grade && (
                              <span className="flex items-center gap-1">
                                <GraduationCap size={10} />
                                {learner.grade.replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center text-gray-500">
                <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-xs font-medium text-gray-400">
                  {onSearch && searchTerm.length >= 2
                    ? `No students found for "${searchTerm}"`
                    : 'No learners found'}
                </p>
                {onSearch && searchTerm.length >= 2 && (
                  <p className="text-[10px] text-gray-300 mt-1">Try a different name or admission number</p>
                )}
              </div>
            )}
          </div>,
          document.body
        )
      )}
    </div>
  );
};

export default SmartLearnerSearch;
