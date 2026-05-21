/**
 * Summative Tests Page
 * Create and manage summative tests
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit, Trash2, Eye, Loader, Database, ChevronDown, GraduationCap, RefreshCw, Search, X } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../../../hooks/useAuth';
import { assessmentAPI, classAPI } from '../../../services/api';
import SummativeTestForm from '../../../pages/assessments/SummativeTestForm';
import BulkCreateTest from './BulkCreateTest';
import ResetUtility from '../../../pages/assessments/ResetUtility';
import ConfirmDialog from '../shared/ConfirmDialog';
import EmptyState from '../shared/EmptyState';
import { normalizeTestType, formatTestTypeLabel } from '../utils/testType';

// Shadcn UI components
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';

const SECONDARY_GRADES = ['GRADE10', 'GRADE11', 'GRADE12'];
const JUNIOR_GRADE_ORDER = ['PLAYGROUP', 'PP1', 'PP2', 'GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4', 'GRADE_5', 'GRADE_6', 'GRADE_7', 'GRADE_8', 'GRADE_9'];
const normalizeGradeCode = (grade) => String(grade || '').trim().replace(/\s+/g, '_').toUpperCase();
const toCanonicalGrade = (grade) => {
  const g = normalizeGradeCode(grade);
  if (g === 'FORM_1' || g === 'GRADE_10') return 'GRADE10';
  if (g === 'FORM_2' || g === 'GRADE_11') return 'GRADE11';
  if (g === 'FORM_3' || g === 'GRADE_12') return 'GRADE12';
  return g;
};
const isSecondaryGrade = (grade) => /^GRADE(10|11|12)$/.test(toCanonicalGrade(grade));
const isJuniorGrade = (grade) => {
  const g = toCanonicalGrade(grade);
  return g === 'PLAYGROUP' || g === 'PP1' || g === 'PP2' || /^GRADE_[1-9]$/.test(g);
};

const getSeriesDisplayName = (test, fallbackType) => {
  const title = String(test?.title || '').trim();
  const learningArea = String(test?.learningArea || '').trim();

  if (title) {
    const areaMarker = learningArea ? ` - ${learningArea} - ` : null;
    const markerIndex = areaMarker ? title.indexOf(areaMarker) : -1;
    if (markerIndex > 0) {
      return title.slice(0, markerIndex).trim();
    }

    const term = String(test?.term || '').replace(/_/g, ' ');
    const suffixPatterns = [
      /\s+-\s+(OPENER|MID TERM|MID_TERM|END TERM|END_TERM|CAT|ASSESSMENT|OTHER)\s+-\s+TERM\s+\d+\s+\d{4}$/i,
      term ? new RegExp(`\\s+-\\s+${term}\\s+\\d{4}$`, 'i') : null,
    ].filter(Boolean);
    const cleaned = suffixPatterns.reduce((value, pattern) => value.replace(pattern, ''), title).trim();
    if (cleaned) return cleaned;
  }

  return formatTestTypeLabel(fallbackType);
};

const SummativeTests = ({ onNavigate, defaultTestType = null }) => {
  const { showSuccess, showError } = useNotifications();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // View State: 'list' | 'create' | 'edit'
  const [viewMode, setViewMode] = useState('list');

  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ title: '', message: '', onConfirm: () => { } });

  // (Approval workflow removed — tests are auto-published)

  const fetchClasses = useCallback(async () => {
    try {
      const response = await classAPI.getAll();
      let classes = [];

      if (Array.isArray(response)) {
        classes = response;
      } else if (response && Array.isArray(response.data)) {
        classes = response.data;
      }

      if (classes.length > 0) {
        // Extract unique grades from classes
        const uniqueGrades = [...new Set(classes.map(c => c.grade))].filter(Boolean).sort();
        if (uniqueGrades.length > 0) {
          return;
        }
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  }, []);

  const fetchTests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await assessmentAPI.getTests();

      // Handle different response formats
      let testsData = [];
      if (response && response.data && Array.isArray(response.data)) {
        testsData = response.data;
      } else if (Array.isArray(response)) {
        testsData = response;
      }

      const isSecondaryPortal = String(user?.institutionType || '').toUpperCase() === 'SECONDARY';
      testsData = testsData.filter((t) => {
        const g = toCanonicalGrade(t?.grade);
        return isSecondaryPortal ? isSecondaryGrade(g) : isJuniorGrade(g);
      });

      setTests(testsData);
    } catch (error) {
      console.error('❌ Error fetching tests:', error);
      showError('Failed to load tests from database');
      setTests([]);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchTests();
    fetchClasses();
  }, [fetchTests, fetchClasses]);

  const handleAdd = () => {
    setViewMode('bulk_create');
  };

  const handleAddSingleTest = () => {
    setViewMode('create');
  };

  const handleDelete = async (id) => {
    // Check if id is an object (test) or just id string
    const testId = typeof id === 'object' ? id.id : id;
    const test = tests.find(t => t.id === testId);

    setConfirmConfig({
      title: 'Delete Assessment',
      message: `Are you sure you want to delete "${test?.title || 'this test'}"?\n\nIf this test has associated results, it will be archived instead of permanently deleted.`,
      confirmText: 'Delete Test',
      onConfirm: async () => {
        // Close FIRST to prevent stuck popup
        setShowConfirm(false);
        try {
          const response = await assessmentAPI.deleteTest(testId);
          if (response.success) {
            if (response.message.includes('archived')) {
              showSuccess(response.message);
              setTests(prev => prev.map(t => t.id === testId ? { ...t, archived: true, status: 'ARCHIVED' } : t));
            } else {
              showSuccess('Test permanently deleted successfully!');
              setTests(prev => prev.filter(t => t.id !== testId));
            }
            setSelectedIds(prev => prev.filter(i => i !== testId));
          } else {
            showError(response.message || 'Failed to delete test');
          }
        } catch (error) {
          console.error('Error deleting test:', error);
          showError('Failed to delete test: ' + error.message);
        } finally {
          fetchTests();
        }
      }
    });
    setShowConfirm(true);
  };

  // Status badge: all tests are published (workflow removed)
  const getStatusBadgeStyles = () => 'bg-brand-teal/10 text-brand-teal border-brand-teal/20';

  const [expandedGrades, setExpandedGrades] = useState([]);
  const [expandedMajorGrades, setExpandedMajorGrades] = useState([]); // High-level grade accordions

  // ── Filter State ──────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const normalizedDefaultTestType = useMemo(
    () => normalizeTestType(defaultTestType),
    [defaultTestType]
  );

  // Derived filter options from loaded tests
  const availableGrades = useMemo(() => [...new Set(tests.map(t => t.grade).filter(Boolean))].sort(), [tests]);
  const availableTerms = useMemo(() => [...new Set(tests.map(t => t.term).filter(Boolean))].sort(), [tests]);
  const activeFilterCount = [filterGrade, filterTerm, filterStatus, normalizedDefaultTestType].filter(Boolean).length;
  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterGrade('');
    setFilterTerm('');
    setFilterStatus('');
  };
  const toggleGrade = (grade) => {
    setExpandedGrades(prev =>
      prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]
    );
  };
  
  const toggleMajorGrade = (grade) => {
    // Only one group open at a time
    setExpandedMajorGrades(prev => prev.includes(grade) ? [] : [grade]);
  };

  const formatGradeDisplay = (grade) => {
    const g = toCanonicalGrade(grade);
    if (isSecondaryGrade(g)) return `Grade ${g.replace('GRADE', '')}`;
    if (g.startsWith('GRADE_')) return `Grade ${g.replace('GRADE_', '')}`;
    if (g === 'PLAYGROUP') return 'Playgroup';
    return g?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown Grade';
  };

  // Filtered tests honouring the search + filter bar
  const filteredTests = useMemo(() => {
    let result = tests;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.learningArea || '').toLowerCase().includes(q) ||
        (t.grade || '').toLowerCase().includes(q) ||
        (t.term || '').toLowerCase().includes(q)
      );
    }
    if (filterGrade) result = result.filter(t => toCanonicalGrade(t.grade) === toCanonicalGrade(filterGrade));
    if (filterTerm) result = result.filter(t => (t.term || '') === filterTerm);
    if (filterStatus) result = result.filter(t => (t.status || '').toUpperCase() === filterStatus.toUpperCase());
    if (normalizedDefaultTestType) {
      result = result.filter(t => normalizeTestType(t.testType) === normalizedDefaultTestType);
    }
    return result;
  }, [tests, searchQuery, filterGrade, filterTerm, filterStatus, normalizedDefaultTestType]);

  const groupedData = useMemo(() => {
    const grouped = {};
    filteredTests.forEach(test => {
      const gradeKey = test.grade || 'UNASSIGNED';
      if (!grouped[gradeKey]) {
        grouped[gradeKey] = {};
      }

      // Group key: title-derived series name + term + academicYear.
      // The DB enum has no MOCK/MONTHLY/WEEKLY values, so relying only on
      // testType collapses custom series into "OTHER" or "ASSESSMENT".
      const canonicalTestType = normalizeTestType(test.testType) || 'ASSESSMENT';
      const displayType = getSeriesDisplayName(test, canonicalTestType);
      const seriesKey = `${displayType}__${test.term || ''}__${test.academicYear || ''}`;

      if (!grouped[gradeKey][seriesKey]) {
        // Human-readable term: TERM_1 → Term 1
        const displayTerm = (test.term || '')
          .replace(/_/g, ' ')
          .toLowerCase()
          .replace(/\b\w/g, l => l.toUpperCase());

        grouped[gradeKey][seriesKey] = {
          seriesKey,
          displayType,   // e.g. "Opener"
          displayTerm,   // e.g. "Term 1"
          academicYear: test.academicYear,
          tests: []
        };
      }
      grouped[gradeKey][seriesKey].tests.push(test);
    });
    return grouped;
  }, [filteredTests]);

  // Approval workflow removed — no unapproved groups tracking needed.

  // eslint-disable-next-line no-unused-vars -- reserved for SummativeTestForm integration
  const handleSaveTest = async (formData) => {

    try {
      // Ensure testDate is present (backend expects testDate, frontend uses date)
      const payload = {
        ...formData,
        testType: normalizeTestType(formData.testType) || 'ASSESSMENT',
        testDate: formData.date || formData.testDate || new Date().toISOString(),
        id: viewMode === 'create' ? Date.now().toString() : selectedTest?.id,
        createdAt: viewMode === 'create' ? new Date().toISOString() : selectedTest?.createdAt,
        updatedAt: new Date().toISOString()
      };

      // Try API first, fall back to localStorage
      if (viewMode === 'create') {
          const newTest = await assessmentAPI.createTest({ ...payload, status: 'PUBLISHED' });
          setTests(prev => [...prev, newTest.data || newTest]);
          showSuccess('Test created successfully!');
        } else {
          const updatedTest = await assessmentAPI.updateTest(selectedTest.id, payload);
          setTests(prev => prev.map(t => t.id === selectedTest.id ? (updatedTest.data || updatedTest) : t));
          showSuccess('Test updated successfully!');
        }
        fetchTests();

      setViewMode('list');
    } catch (error) {
      console.error('❌ Save failed:', error);
      showError('Failed to save test: ' + error.message);
      throw error; // Re-throw so CreateTestPage can catch it
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    setConfirmConfig({
      title: 'Bulk Delete Tests',
      message: `Are you sure you want to delete ${selectedIds.length} selected tests? Tests with recorded results will be archived instead of permanently deleted.`,
      onConfirm: async () => {
        setShowConfirm(false);
        try {
          const response = await assessmentAPI.deleteTestsBulk(selectedIds);
          showSuccess(response.message || 'Bulk action completed');
          setSelectedIds([]);
          fetchTests();
        } catch (error) {
          console.error('Bulk delete failed:', error);
          showError('Failed to process bulk deletion: ' + error.message);
        }
      }
    });
    setShowConfirm(true);
  };

  // handleBulkApprove removed — approval workflow disabled.

  const stats = useMemo(() => ({ total: tests.length }), [tests]);



  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <SummativeTestForm
        initialTestType={viewMode === 'create' ? normalizedDefaultTestType : null}
        onBack={() => setViewMode('list')}
        onSuccess={(createdTest, selectedLearners) => {
          fetchTests(); // Refresh the tests list
          setViewMode('list');
          showSuccess('Test created successfully!');
        }}
      />
    );
  }

  if (viewMode === 'bulk_create') {
    return (
      <BulkCreateTest
        onBack={() => setViewMode('list')}
        onSuccess={(msg) => {
          fetchTests();
          setViewMode('list');
          if (msg) showSuccess(msg);
        }}
      />
    );
  }

  if (viewMode === 'reset') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <button 
            onClick={() => setViewMode('list')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-semibold uppercase tracking-widest text-[10px]"
          >
            ← Back to List
          </button>
        </div>
        <ResetUtility />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start">

          {/* Left: Stats + Bulk actions */}
          {selectedIds.length > 0 ? (
            <div className="flex items-center gap-4 bg-brand-purple/5 px-4 py-2 rounded-lg border border-brand-purple/10">
              <span className="text-sm font-medium text-brand-purple">{selectedIds.length} Selected</span>
              <div className="flex gap-2">
                <button onClick={handleBulkDelete} className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 transition">
                  <Trash2 size={14} /> Bulk Delete
                </button>
                <button onClick={() => setSelectedIds([])} className="px-3 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-md border border-gray-200 hover:bg-gray-50 transition">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 overflow-x-auto pb-2 md:pb-0 shrink-0">
              <div className="text-right border-r pr-4 border-gray-200 min-w-[80px]">
                <p className="text-[10px] text-gray-500 uppercase font-medium tracking-wider">Total Tests</p>
                <p className="text-xl font-medium text-gray-800 leading-none">{filteredTests.length}</p>
              </div>
            </div>
          )}

          {/* Centre: Search + Filters */}
          <div className="flex flex-wrap gap-2 items-center flex-1">
            {/* Search */}
            <div className="relative min-w-[200px] flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tests, subjects…"
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-purple focus:border-transparent shadow-sm"
              />
            </div>
            {/* Grade */}
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="h-9 px-2.5 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-purple cursor-pointer hover:border-slate-400 transition-colors"
            >
              <option value="">All Grades</option>
              {availableGrades.map(g => <option key={g} value={g}>{formatGradeDisplay(g)}</option>)}
            </select>
            {/* Term */}
            <select
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value)}
              className="h-9 px-2.5 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-purple cursor-pointer hover:border-slate-400 transition-colors"
            >
              <option value="">All Terms</option>
              {availableTerms.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
            {/* Status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 px-2.5 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-purple cursor-pointer hover:border-slate-400 transition-colors"
            >
              <option value="">All Status</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            {/* Clear */}
            {(searchQuery || activeFilterCount > 0) && (
              <button onClick={clearAllFilters} className="flex items-center gap-1 h-9 px-3 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition">
                <X size={13} /> Clear
              </button>
            )}
          </div>

          {/* Right: Action buttons */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <button onClick={handleAddSingleTest} className="flex items-center gap-2 px-4 py-2 bg-brand-teal text-white rounded-xl hover:bg-brand-teal/90 transition shadow-sm font-medium text-sm">
              <Plus size={16} /> <span className="hidden sm:inline">New Test</span><span className="inline sm:hidden">+</span>
            </button>
            <button onClick={handleAdd} className="flex items-center gap-2 px-4 py-2 bg-brand-purple text-white rounded-xl hover:bg-brand-purple/90 transition shadow-sm font-medium text-sm border border-brand-purple/20">
              <Plus size={16} /> <span className="hidden sm:inline">Bulk Create</span><span className="inline sm:hidden">Bulk</span>
            </button>
            {user?.role !== 'TEACHER' && (
              <button onClick={() => setViewMode('reset')} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition shadow-sm font-medium text-sm">
                <RefreshCw size={16} /> <span className="hidden sm:inline">Reset DB</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center">
            <Loader className="animate-spin text-brand-purple mb-4" size={40} />
            <p className="text-slate-400 font-semibold uppercase tracking-widest text-[10px]">Synchronizing Assessment Matrix...</p>
          </div>
        </div>
      ) : Object.keys(groupedData).length > 0 ? (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse [&_th]:border [&_th]:border-slate-200 [&_td]:border [&_td]:border-slate-200">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-5 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-slate-200 text-brand-purple focus:ring-brand-purple"
                    checked={selectedIds.length > 0 && selectedIds.length === tests.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(tests.map(t => t.id));
                      else setSelectedIds([]);
                    }}
                  />
                </th>
                <th className="px-6 py-5 text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest">Level / Series</th>
                <th className="px-6 py-5 text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest text-center">Coverage</th>
                <th className="px-6 py-5 text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest text-center">Tests</th>
                <th className="px-6 py-5 text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {Object.entries(groupedData)
                .sort((a, b) => {
                  const isSecondaryPortal = String(user?.institutionType || '').toUpperCase() === 'SECONDARY';
                  const order = isSecondaryPortal ? SECONDARY_GRADES : JUNIOR_GRADE_ORDER;
                  return order.indexOf(toCanonicalGrade(a[0])) - order.indexOf(toCanonicalGrade(b[0]));
                })
                .map(([gradeKey, seriesGroups]) => {
                  const isMajorExpanded = expandedMajorGrades.includes(gradeKey);
                  const totalTests = Object.values(seriesGroups).reduce((acc, g) => acc + g.tests.length, 0);
                  const totalSeries = Object.keys(seriesGroups).length;

                  return (
                    <React.Fragment key={gradeKey}>
                      {/* Grade Header Row (Accordion Trigger) */}
                      <tr 
                        onClick={() => toggleMajorGrade(gradeKey)}
                        className={`cursor-pointer transition-all border-b border-slate-100 ${isMajorExpanded ? 'bg-slate-50/80' : 'bg-white hover:bg-slate-50/50'}`}
                      >
                        <td colSpan={5} className="px-6 py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isMajorExpanded ? 'bg-brand-purple text-white' : 'bg-brand-purple/5 text-brand-purple border border-brand-purple/10'}`}>
                                <GraduationCap size={16} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-slate-900 uppercase tracking-tight leading-none">
                                  {formatGradeDisplay(gradeKey)}
                                </span>
                                <span className="text-[9px] text-slate-400 font-medium uppercase tracking-widest mt-1">
                                  {totalSeries} Assessment {totalSeries === 1 ? 'Series' : 'Series'} • {totalTests} Total Tests
                                </span>
                              </div>
                            </div>
                            <div className={`transition-transform duration-300 ${isMajorExpanded ? 'rotate-180' : ''}`}>
                              <ChevronDown className="text-slate-300" size={18} />
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Series Rows (Visible when Grade is expanded) */}
                      {isMajorExpanded && Object.entries(seriesGroups).map(([seriesName, data]) => {
                        const groupKey = `${gradeKey}-${seriesName}`;
                        const isExpanded = expandedGrades.includes(groupKey);

                        return (
                          <React.Fragment key={seriesName}>
                            <tr className="hover:bg-slate-50/50 transition-all group animate-in slide-in-from-top-2 duration-200">
                              <td className="px-6 py-5 border-l-4 border-brand-purple/20">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-200 text-brand-purple focus:ring-brand-purple"
                                  checked={data.tests.every(t => selectedIds.includes(t.id))}
                                  onChange={(e) => {
                                    const testIds = data.tests.map(t => t.id);
                                    if (e.target.checked) {
                                      setSelectedIds(prev => [...new Set([...prev, ...testIds])]);
                                    } else {
                                      setSelectedIds(prev => prev.filter(id => !testIds.includes(id)));
                                    }
                                  }}
                                />
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-slate-800 leading-tight">{data.displayType}</span>
                                  <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest mt-1">
                                    Summative Series • {data.displayTerm} {data.academicYear}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-5 text-center">
                                <Badge className="border-transparent bg-slate-100/50 text-slate-500 px-2 py-0.5 font-semibold text-[9px] uppercase tracking-widest">
                                  {data.tests.length} Assessment Areas
                                </Badge>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex items-center justify-center gap-4">
                                  <div className="flex flex-col items-center">
                                    <span className="text-[11px] font-semibold text-brand-teal leading-none">{data.tests.length}</span>
                                    <span className="text-[7px] text-brand-teal/60 font-semibold uppercase tracking-tight mt-1">Published</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleGrade(groupKey)}
                                  className="h-9 px-4 text-[9px] font-semibold uppercase tracking-widest text-slate-500 hover:text-brand-purple rounded-xl border border-transparent hover:border-slate-100 hover:bg-slate-50 transition-all"
                                >
                                  {isExpanded ? 'Hide Subjects' : 'View Subjects'}
                                </Button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-slate-50/30">
                                <td colSpan={5} className="px-12 py-6 border-l-4 border-brand-purple/20">
                                  <div className="space-y-2">
                                    {data.tests.map(test => (
                                      <div key={test.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-brand-purple/20 transition-all">
                                        <div className="flex items-center gap-4">
                                          <input
                                            type="checkbox"
                                            className="rounded border-slate-200 text-brand-purple focus:ring-brand-purple"
                                            checked={selectedIds.includes(test.id)}
                                            onChange={() => toggleSelect(test.id)}
                                          />
                                          <div>
                                            <p className="text-[11px] font-medium text-slate-800">{test.learningArea}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                              <span className="text-[8px] text-slate-400 font-semibold uppercase tracking-widest">{formatTestTypeLabel(test.testType || 'ASSESSMENT')}</span>
                                              <span className="w-1 h-1 rounded-full bg-slate-200" />
                                              <span className="text-[8px] text-slate-500 font-medium uppercase tracking-tight">{test.totalMarks} Marks</span>
                                              {test.weight !== 1 && (
                                                <>
                                                  <span className="w-1 h-1 rounded-full bg-slate-200" />
                                                  <span className="text-[8px] text-brand-purple font-medium uppercase tracking-tight">Weight: {test.weight}x</span>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                          <div className={`px-2 py-0.5 rounded-full text-[8px] font-semibold uppercase tracking-widest ${['Published', 'PUBLISHED'].includes(test.status) ? 'bg-brand-teal/10 text-brand-teal' : 'bg-orange-100 text-orange-600'}`}>
                                            {test.status}
                                          </div>

                                          <div className="flex items-center gap-1">
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-brand-teal" onClick={() => onNavigate('summative-results', { testId: test.id })}><Eye size={14} /></Button>
                                            {(user?.role !== 'TEACHER' || test.createdBy === user?.id) && (
                                              <>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-green-600" onClick={() => { setSelectedTest(test); setViewMode('edit'); }}><Edit size={14} /></Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDelete(test)}><Trash2 size={14} /></Button>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Database}
          title="No Summative Tests Found"
          message="Your assessment repository is currently empty. Start by creating a new summative test architecture for your classes."
          actionText="Create New Test"
          onAction={handleAdd}
        />
      )}

      <ConfirmDialog
        show={showConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText || 'Confirm'}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setShowConfirm(false)}
        confirmButtonClass={confirmConfig.title?.includes('Delete') ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-teal hover:bg-brand-teal/90'}
      />


    </div>
  );
};

export default SummativeTests;
