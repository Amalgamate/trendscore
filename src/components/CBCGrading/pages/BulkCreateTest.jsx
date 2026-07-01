import React, { useState, useEffect } from 'react';
import {
    ArrowLeft, CheckCircle, Loader, Database, RefreshCw,
    GraduationCap, Zap
} from 'lucide-react';
import { DatePicker } from '../../ui/date-picker';
import { assessmentAPI, gradingAPI, configAPI } from '../../../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../ui/button';
import { CANONICAL_TEST_TYPE_OPTIONS, normalizeTestType } from '../utils/testType';

const PRIMARY_GRADE_GROUPS = [
    { id: 'early_years', name: 'Early Years', grades: ['PLAYGROUP', 'PP1', 'PP2'] },
    { id: 'lower_primary', name: 'Lower Primary', grades: ['GRADE_1', 'GRADE_2', 'GRADE_3'] },
    { id: 'upper_primary', name: 'Upper Primary', grades: ['GRADE_4', 'GRADE_5', 'GRADE_6'] },
    { id: 'junior_school', name: 'Junior School', grades: ['GRADE_7', 'GRADE_8', 'GRADE_9'] },
];

const SECONDARY_GRADE_GROUPS = [
    { id: 'senior_secondary', name: 'Senior School', grades: ['GRADE10', 'GRADE11', 'GRADE12'] },
];

const TERMS = [
    { value: 'TERM_1', label: 'Term 1' },
    { value: 'TERM_2', label: 'Term 2' },
    { value: 'TERM_3', label: 'Term 3' },
];

const toCanonicalGrade = (grade) => {
    const raw = String(grade || '').trim().toUpperCase();
    if (!raw) return '';
    const compact = raw.replace(/\s+/g, '_');
    const match = compact.match(/^GRADE_?(\d+)$/);
    if (match) return `GRADE_${match[1]}`;
    return compact;
};

const normalizeLearningAreaKey = (value) =>
    String(value || '').toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '').trim();

const uniqueSortedNames = (items = []) => [
    ...new Map(
        items
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .map((item) => [normalizeLearningAreaKey(item), item])
    ).values()
].sort((a, b) => a.localeCompare(b));

const BulkCreateTest = ({ onBack, onSuccess }) => {
    const { user } = useAuth();
    const { showSuccess, showError } = useNotifications();
    const isSecondaryPortal = String(user?.institutionType || '').toUpperCase() === 'SECONDARY';
    const gradeGroups = isSecondaryPortal ? SECONDARY_GRADE_GROUPS : PRIMARY_GRADE_GROUPS;
    const allGrades = gradeGroups.flatMap(g => g.grades);
    const [saving, setSaving] = useState(false);
    const [loadingScales, setLoadingScales] = useState(false);
    const [scales, setScales] = useState([]);

    const [formData, setFormData] = useState({
        title: '',
        testType: 'OPENER',
        term: 'TERM_1',
        academicYear: new Date().getFullYear().toString(),
        testDate: new Date().toISOString().split('T')[0],
        totalMarks: '100',
        passMarks: '50',
        duration: '60',
        scaleGroupId: '',
        weight: '1.0',
        status: 'PUBLISHED',
    });

    const [selectedGrades, setSelectedGrades] = useState([]);
    const [areaCountsByGrade, setAreaCountsByGrade] = useState({});

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        let cancelled = false;
        const loadAreaCounts = async () => {
            if (selectedGrades.length === 0) {
                setAreaCountsByGrade({});
                return;
            }
            const entries = await Promise.all(selectedGrades.map(async (grade) => {
                try {
                    const resp = await configAPI.getLearningAreas({ gradeLevel: toCanonicalGrade(grade) }, { fresh: true });
                    const rows = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
                    return [grade, uniqueSortedNames(rows.map((row) => row?.name)).length];
                } catch {
                    return [grade, 0];
                }
            }));
            if (!cancelled) setAreaCountsByGrade(Object.fromEntries(entries));
        };
        loadAreaCounts();
        return () => { cancelled = true; };
    }, [selectedGrades]);

    const loadData = async () => {
        setLoadingScales(true);
        try {
            const res = await gradingAPI.getSystems();
            setScales(res?.data || res || []);
        } catch (err) {
            console.error('Error loading scales:', err);
        } finally {
            setLoadingScales(false);
        }
    };

    const handleGradeToggle = (grade) => {
        setSelectedGrades(prev =>
            prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]
        );
    };

    const handleSelectGroup = (groupGrades) => {
        const allSelected = groupGrades.every(g => selectedGrades.includes(g));
        if (allSelected) {
            setSelectedGrades(prev => prev.filter(g => !groupGrades.includes(g)));
        } else {
            setSelectedGrades(prev => Array.from(new Set([...prev, ...groupGrades])));
        }
    };

    const handleSelectAll = () => {
        setSelectedGrades(selectedGrades.length === allGrades.length ? [] : [...allGrades]);
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        if (!formData.title.trim()) { showError('Please enter a series name'); return; }
        if (selectedGrades.length === 0) { showError('Please select at least one grade level'); return; }

        setSaving(true);
        let totalCreated = 0;
        let hasError = false;

        try {
            const areasByGrade = new Map();
            for (const grade of selectedGrades) {
                try {
                    const resp = await configAPI.getLearningAreas({ gradeLevel: toCanonicalGrade(grade) }, { fresh: true });
                    const rows = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
                    const names = uniqueSortedNames(rows.map((r) => r?.name));
                    areasByGrade.set(grade, names);
                } catch {
                    areasByGrade.set(grade, []);
                }
            }

            for (const grade of selectedGrades) {
                const learningAreas = areasByGrade.get(grade) || [];
                if (!learningAreas || learningAreas.length === 0) continue;

                const payload = {
                    title: formData.title,
                    testType: normalizeTestType(formData.testType) || 'ASSESSMENT',
                    term: formData.term,
                    academicYear: formData.academicYear,
                    testDate: formData.testDate,
                    totalMarks: formData.totalMarks,
                    passMarks: formData.passMarks,
                    duration: formData.duration,
                    weight: formData.weight,
                    scaleGroupId: formData.scaleGroupId || undefined,
                    status: 'PUBLISHED',
                    grade,
                    learningAreas,
                };

                try {
                    const response = await assessmentAPI.bulkCreateTests(payload);
                    if (response.success) {
                        totalCreated += response.data?.length ?? learningAreas.length;
                    } else {
                        console.warn(`Failed for grade ${grade}:`, response.message);
                        hasError = true;
                    }
                } catch (gradeErr) {
                    console.error(`Error creating tests for ${grade}:`, gradeErr.message);
                    hasError = true;
                }
            }

            if (totalCreated > 0) {
                const msg = `✅ Successfully created ${totalCreated} test${totalCreated !== 1 ? 's' : ''}!`;
                onSuccess && onSuccess(msg);
            } else {
                showError(hasError ? 'Some grades failed. Check console for details.' : 'No tests were created.');
            }
        } catch (err) {
            showError('Failed to create tests: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const formatGrade = (g) =>
        /^GRADE(10|11|12)$/.test(String(g))
            ? `Grade ${String(g).replace('GRADE', '')}`
            : g.replace('GRADE_', 'Grade ').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    const totalTests = selectedGrades.reduce((sum, grade) => sum + (areaCountsByGrade[grade] || 0), 0);

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-20">
            {/* Sticky Header */}
            <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-3 shadow-sm">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBack}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h1 className="text-base font-medium text-slate-900 leading-none">Bulk Create Tests</h1>
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5 uppercase tracking-wider">Assessment Series Generator</p>
                        </div>
                    </div>
                    <Button
                        onClick={handleSubmit}
                        disabled={saving || !formData.title.trim() || selectedGrades.length === 0}
                        className="bg-brand-teal hover:bg-brand-teal/90 text-white px-6 rounded-lg font-medium text-sm disabled:opacity-50"
                    >
                        {saving ? (
                            <><Loader className="animate-spin mr-2" size={14} /> Generating...</>
                        ) : (
                            <><Zap size={14} className="mr-2" /> Create {totalTests > 0 ? `${totalTests} Tests` : 'Tests'}</>
                        )}
                    </Button>
                </div>
            </div>

            {/* Form Body */}
            <div className="max-w-2xl mx-auto px-6 py-8">
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">

                    {/* Series Name */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">Series Name *</label>
                        <input
                            type="text"
                            placeholder="e.g., 2026 Term 1 Opening Assessments"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full h-11 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-sm font-medium text-slate-700"
                        />
                        <p className="text-[10px] text-slate-400">Used as a prefix for all generated tests.</p>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Assessment Type + Term */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">Assessment Type</label>
                            <select
                                value={formData.testType}
                                onChange={(e) => setFormData({ ...formData, testType: e.target.value })}
                                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none appearance-none text-sm font-medium text-slate-700"
                            >
                                {CANONICAL_TEST_TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">Term</label>
                            <select
                                value={formData.term}
                                onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none appearance-none text-sm font-medium text-slate-700"
                            >
                                {TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Academic Year + Test Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">Academic Year</label>
                            <input
                                type="number"
                                value={formData.academicYear}
                                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-sm font-medium text-slate-700"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">Test Date</label>
                            <DatePicker
                                value={formData.testDate}
                                onChange={(val) => setFormData({ ...formData, testDate: val })}
                                className="w-full border-slate-200"
                            />
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Marks + Duration */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">Total Marks</label>
                            <input
                                type="number"
                                value={formData.totalMarks}
                                onChange={(e) => setFormData({ ...formData, totalMarks: e.target.value })}
                                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-sm font-medium text-slate-700"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">Pass Mark</label>
                            <input
                                type="number"
                                value={formData.passMarks}
                                onChange={(e) => setFormData({ ...formData, passMarks: e.target.value })}
                                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-sm font-medium text-slate-700"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">Duration (min)</label>
                            <input
                                type="number"
                                value={formData.duration}
                                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-sm font-medium text-slate-700"
                            />
                        </div>
                    </div>

                    {/* Performance Scale */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">Performance Scale</label>
                            {user?.role === 'SUPER_ADMIN' && (
                                <button
                                    type="button"
                                    onClick={() => window.dispatchEvent(new CustomEvent('pageNavigate', {
                                        detail: { page: 'settings-academic', params: { tab: 'performance-levels' } }
                                    }))}
                                    className="text-[10px] font-medium text-brand-purple hover:underline"
                                >
                                    Manage in Settings
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <select
                                value={formData.scaleGroupId}
                                onChange={(e) => setFormData({ ...formData, scaleGroupId: e.target.value })}
                                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none appearance-none text-sm font-medium text-slate-700"
                                disabled={loadingScales}
                            >
                                <option value="">Default (auto per grade)</option>
                            </select>
                            <div className="absolute right-3 top-3 pointer-events-none text-brand-purple opacity-40">
                                {loadingScales ? <RefreshCw className="animate-spin" size={16} /> : <Database size={16} />}
                            </div>
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Grade Selection */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest">
                                <GraduationCap size={12} className="inline mr-1.5 mb-0.5" />
                                Target Grade Levels *
                            </label>
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="text-[10px] font-medium text-brand-purple hover:underline uppercase tracking-wider"
                            >
                                {selectedGrades.length === allGrades.length ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>

                        {gradeGroups.map(group => (
                            <div key={group.id} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{group.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleSelectGroup(group.grades)}
                                        className="text-[10px] font-medium text-slate-400 hover:text-brand-purple transition uppercase tracking-wider"
                                    >
                                        {group.grades.every(g => selectedGrades.includes(g)) ? 'Clear' : 'Select Group'}
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {group.grades.map(grade => {
                                        const isSelected = selectedGrades.includes(grade);
                                        return (
                                            <button
                                                key={grade}
                                                type="button"
                                                onClick={() => handleGradeToggle(grade)}
                                                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-xs font-medium transition-all text-left ${
                                                    isSelected
                                                        ? 'bg-brand-purple/5 border-brand-purple text-brand-purple'
                                                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                                }`}
                                            >
                                                <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                                                    isSelected ? 'bg-brand-purple border-brand-purple' : 'border-slate-300'
                                                }`}>
                                                    {isSelected && <CheckCircle size={9} className="text-white" />}
                                                </div>
                                                {formatGrade(grade)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {selectedGrades.length > 0 && (
                            <p className="text-[10px] text-slate-400 italic pt-1">
                                {selectedGrades.length} grade{selectedGrades.length > 1 ? 's' : ''} selected — will generate <strong className="text-brand-teal">{totalTests} tests</strong> in total.
                            </p>
                        )}
                    </div>

                </form>
            </div>
        </div>
    );
};

export default BulkCreateTest;
