import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  GraduationCap,
  Loader2,
  Users,
  ArrowLeft,
  Search,
  User,
  SlidersHorizontal,
  ChevronRight,
  Eye,
  UserCheck,
} from 'lucide-react';
import api, { dashboardAPI } from '../../../../services/api';
import { EmptyState } from '@/design-system/components';
import { useRolePreview } from '../../../../contexts/RolePreviewContext';

const unwrapApiPayload = (payload) => {
  let current = payload;
  for (let i = 0; i < 3; i += 1) {
    if (
      current &&
      !Array.isArray(current) &&
      Object.prototype.hasOwnProperty.call(current, 'data') &&
      (
        current.success !== undefined ||
        Array.isArray(current.data) ||
        current.data?.enrollments ||
        current.data?.students ||
        current.data?.learners
      )
    ) {
      current = current.data;
    } else {
      break;
    }
  }
  return current;
};

const getRosterEntries = (classDetails) => {
  const candidates = [
    classDetails?.enrollments,
    classDetails?.students,
    classDetails?.learners,
    classDetails?.data?.enrollments,
    classDetails?.data?.students,
    classDetails?.data?.learners,
    Array.isArray(classDetails?.data) ? classDetails.data : null,
    Array.isArray(classDetails) ? classDetails : null,
  ];
  return candidates.find((candidate) => Array.isArray(candidate) && candidate.length > 0) ||
    candidates.find((candidate) => Array.isArray(candidate)) ||
    [];
};

const normalizeRosterStudent = (entry) => entry?.learner ?? entry?.student ?? entry;

const formatKes = (value) => `KES ${Number(value || 0).toLocaleString()}`;

const getFeeSummary = (student) => {
  const invoices = Array.isArray(student?.feeInvoices) ? student.feeInvoices : [];
  const invoicedTotal = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
  const paidTotal = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount || 0), 0);
  const invoiceBalance = invoices.reduce((sum, inv) => sum + Number(inv.balance || 0), 0);
  const balance = Number(student?.feeBalance ?? student?.balance ?? invoiceBalance ?? 0);

  let status = 'NOT_PAID';
  if (balance < 0) status = 'OVERPAID';
  else if (balance <= 0 && (paidTotal > 0 || invoicedTotal > 0)) status = 'PAID';
  else if (paidTotal > 0) status = 'PARTIAL';

  return { balance, paidTotal, invoicedTotal, status };
};

const PAYMENT_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'PAID', label: 'Paid' },
  { id: 'NOT_PAID', label: 'Not paid' },
  { id: 'PARTIAL', label: 'Partial' },
  { id: 'BALANCE', label: 'Has balance' },
  { id: 'OVERPAID', label: 'Overpaid' },
];

const parseGradeStreamFromName = (className) => {
  const normalized = String(className || '').trim().toUpperCase();
  const match = normalized.match(/GRADE[\s_]*(\d+)\s*([A-Z])?/) || normalized.match(/FORM[\s_]*(\d+)\s*([A-Z])?/);
  if (!match) return {};
  const prefix = normalized.startsWith('FORM') ? 'FORM' : 'GRADE';
  return {
    grade: `${prefix}_${match[1]}`,
    stream: match[2] || '',
  };
};

const normalizeSubjectNames = (subjects = []) => (
  Array.isArray(subjects)
    ? subjects
      .map((item) => item?.subject || item?.name || item)
      .filter(Boolean)
    : []
);

const sameClass = (classItem, classRef) => {
  if (!classItem || !classRef) return false;
  return classItem.classId === classRef.id ||
    classItem.classId === classRef.classId ||
    classItem.className === classRef.name ||
    classItem.className === classRef.className;
};

const TeacherLearnerAnalysis = ({ user, onNavigate }) => {
  const rolePreview = useRolePreview();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);

  // In-page class details navigation
  const [activePage, setActivePage] = useState('overview');
  const [selectedClass, setSelectedClass] = useState(null);
  const [classDetails, setClassDetails] = useState(null);
  const [loadingClass, setLoadingClass] = useState(false);
  const [classError, setClassError] = useState(null);

  // Class list filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('NAME_ASC');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        if (rolePreview?.isPreviewingRole) {
          if (active) setMetrics({});
          return;
        }
        const response = await dashboardAPI.getTeacherMetrics('today');
        if (!active) return;
        setMetrics(response?.data || response || {});
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Failed to load learner analysis.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [rolePreview?.isPreviewingRole]);

  const analysis = metrics?.learnerAnalysis || {};
  const stats = metrics?.stats || {};
  const classTeacherOf = stats.classTeacherOf || null;

  const classes = useMemo(() => (
    Array.isArray(analysis.classes) ? analysis.classes : []
  ), [analysis.classes]);

  const myClass = useMemo(() => {
    const matched = classes.find((classItem) => sameClass(classItem, classTeacherOf));
    if (matched) return matched;
    if (classTeacherOf) {
      return {
        classId: classTeacherOf.id,
        className: classTeacherOf.name,
        grade: classTeacherOf.grade,
        stream: classTeacherOf.stream || '',
        learnerCount: classTeacherOf.learnerCount || 0,
        subjects: [{ subject: 'Class teacher' }],
      };
    }
    return null;
  }, [classTeacherOf, classes]);

  const subjectClasses = useMemo(() => (
    classes.filter((classItem) => {
      const subjectNames = normalizeSubjectNames(classItem.subjects);
      return subjectNames.length > 0 && !(
        subjectNames.length === 1 &&
        subjectNames[0].toLowerCase() === 'class teacher' &&
        sameClass(classItem, myClass)
      );
    })
  ), [classes, myClass]);

  const loadClassPayload = async (classItem) => {
    const raw = await api.classes.getAllClassData(classItem.classId);
    let classPayload = unwrapApiPayload(raw) || {};
    const rosterEntries = getRosterEntries(classPayload);

    if (rosterEntries.length === 0 && (classItem.learnerCount || 0) > 0) {
      const parsed = parseGradeStreamFromName(classItem.className);
      const grade = classPayload.grade || classItem.grade || parsed.grade;
      const stream = classPayload.stream || classItem.stream || parsed.stream;

      if (grade) {
        const learnerResponse = await api.learners.getAll({
          grade,
          ...(stream ? { stream } : {}),
          status: 'ACTIVE',
          page: 1,
          limit: 500,
        });
        const learnerPayload = unwrapApiPayload(learnerResponse);
        const fallbackStudents = Array.isArray(learnerPayload)
          ? learnerPayload
          : getRosterEntries(learnerPayload);
        classPayload = {
          ...classPayload,
          students: fallbackStudents,
        };
      }
    }

    return classPayload;
  };

  const handleOpenClassList = async (classItem, page = 'my-class') => {
    setActivePage(page);
    setSelectedClass(classItem);
    setLoadingClass(true);
    setClassError(null);
    setClassDetails(null);
    try {
      setClassDetails(await loadClassPayload(classItem));
    } catch (err) {
      console.error('Failed to load class enrollments:', err);
      setClassError('Failed to load student list. Please try again.');
    } finally {
      setLoadingClass(false);
    }
  };

  const handleOpenSubjectsList = async () => {
    setActivePage('my-subjects');
    setSelectedClass({
      classId: 'my-subjects',
      className: 'My Subjects',
      learnerCount: subjectClasses.reduce((sum, classItem) => sum + Number(classItem.learnerCount || 0), 0),
    });
    setLoadingClass(true);
    setClassError(null);
    setClassDetails(null);
    try {
      const payloads = await Promise.all(subjectClasses.map(async (classItem) => {
        const payload = await loadClassPayload(classItem);
        return getRosterEntries(payload)
          .map(normalizeRosterStudent)
          .filter((student) => student && (student.id || student.firstName || student.lastName))
          .map((student) => ({
            ...student,
            className: classItem.className,
            taughtSubjects: normalizeSubjectNames(classItem.subjects).join(', ') || 'Assigned subject',
          }));
      }));

      setClassDetails({ students: payloads.flat() });
    } catch (err) {
      console.error('Failed to load subject learners:', err);
      setClassError('Failed to load subject student list. Please try again.');
    } finally {
      setLoadingClass(false);
    }
  };

  const handleCloseClassList = () => {
    setActivePage('overview');
    setSelectedClass(null);
    setClassDetails(null);
    setSearchTerm('');
    setGenderFilter('ALL');
    setPaymentFilter('ALL');
    setSortBy('NAME_ASC');
    setSelectedStudentIds([]);
  };

  // Client-side search, filtering and sorting
  const filteredStudents = useMemo(() => {
    // Support multiple shapes: { enrollments: [{learner: {...}}] } or { enrollments: [{...learner}] } or { students: [...] }
    const rawList = getRosterEntries(classDetails);

    if (!rawList.length) return [];

    // Each entry is either an enrollment wrapper { learner: {...}, ...} or a raw learner object
    let list = rawList
      .map(normalizeRosterStudent)
      .filter((s) => s && (s.firstName || s.lastName || s.id));

    // Filter by search term
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      list = list.filter((s) =>
        `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase().includes(query) ||
        String(s.admissionNumber || '').toLowerCase().includes(query)
      );
    }

    // Filter by gender
    if (genderFilter !== 'ALL') {
      list = list.filter((s) => String(s.gender).toUpperCase() === genderFilter);
    }

    if (paymentFilter !== 'ALL') {
      list = list.filter((s) => {
        const fee = getFeeSummary(s);
        if (paymentFilter === 'BALANCE') return fee.balance > 0;
        return fee.status === paymentFilter;
      });
    }

    // Sort list
    list.sort((a, b) => {
      const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
      const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();

      if (sortBy === 'NAME_ASC') return nameA.localeCompare(nameB);
      if (sortBy === 'NAME_DESC') return nameB.localeCompare(nameA);
      if (sortBy === 'ADM_ASC') return String(a.admissionNumber || '').localeCompare(String(b.admissionNumber || ''));
      return 0;
    });

    return list;
  }, [classDetails, searchTerm, genderFilter, paymentFilter, sortBy]);

  const selectedCount = selectedStudentIds.length;
  const allVisibleSelected = filteredStudents.length > 0 &&
    filteredStudents.every((student) => selectedStudentIds.includes(student.id));

  const toggleStudentSelection = (studentId) => {
    setSelectedStudentIds((prev) => (
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    ));
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedStudentIds((prev) => prev.filter((id) => !filteredStudents.some((student) => student.id === id)));
      return;
    }
    setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...filteredStudents.map((student) => student.id)])));
  };

  const getInitials = (firstName, lastName) => {
    const f = String(firstName || '').charAt(0).toUpperCase();
    const l = String(lastName || '').charAt(0).toUpperCase();
    return `${f}${l}` || '?';
  };

  const isSubjectTable = activePage === 'my-subjects';
  const directoryDescription = isSubjectTable
    ? 'A combined student table for the subjects and classes assigned to you.'
    : `Manage and view detailed profiles of students enrolled in ${selectedClass?.className || 'your class'}.`;

  if (loading) {
    return (
      <div className="min-h-[360px] bg-white px-4 py-12 text-center md:min-h-[420px] md:border md:border-slate-200 md:p-10">
        <Loader2 className="mx-auto mb-3 animate-spin text-indigo-600" size={32} />
        <p className="text-sm font-semibold text-slate-600 font-sans">Loading your class analysis...</p>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle size={44} />}
        title="Learner analysis unavailable"
        description={error}
        action={{ label: 'Back to Dashboard', onClick: () => onNavigate('dashboard') }}
      />
    );
  }

  return (
    <div className="space-y-6 px-3 pb-24 pt-3 md:px-0 md:pb-6 md:pt-0 font-sans">
      {/* Dynamic Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700 font-sans">My Students & Classes</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950 font-sans">
            {selectedClass ? `${selectedClass.className} Directory` : 'Class Overview'}
          </h1>
          <p className="mt-1 text-xs leading-5 text-slate-600 font-sans">
            {selectedClass
              ? directoryDescription
              : `Choose My Class or My Subjects to open a student roster table.`}
          </p>
        </div>
        {selectedClass ? (
          <button
            onClick={handleCloseClassList}
            className="flex items-center gap-2 self-start md:self-auto bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 text-xs font-black transition-colors rounded-lg font-sans"
          >
            <ArrowLeft size={14} />
            Back to Overview
          </button>
        ) : (
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 self-start md:self-auto bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 text-xs font-black transition-colors rounded-lg font-sans"
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </button>
        )}
      </div>

      {/* Main Container: Class list vs Student list */}
      {!selectedClass ? (
        <>
          {/* ── 4 Enrollment Stat Cards ───────────────────────── */}
          {(() => {
            const fmt = (v) => Number(v || 0).toLocaleString();
            const totalEnrolled = Number(stats.myStudents || analysis.totalStudents || classes.reduce((s, c) => s + Number(c.learnerCount || 0), 0) || 0);
            const activeStudents = Number(stats.activeStudents || stats.myStudents || totalEnrolled || 0);
            const boys = Number(stats.boys || analysis.boys || stats.maleCount || 0);
            const girls = Number(stats.girls || analysis.girls || stats.femaleCount || 0);
            const boysPct = totalEnrolled > 0 ? Math.round((boys / totalEnrolled) * 100) : 0;
            const girlsPct = totalEnrolled > 0 ? Math.round((girls / totalEnrolled) * 100) : 0;

            const tiles = [
              {
                id: 'total',
                label: 'Total Enrolled',
                value: fmt(totalEnrolled),
                sub: 'All students',
                icon: Users,
                accent: 'bg-blue-700',
                iconColor: 'text-white',
              },
              {
                id: 'active',
                label: 'Active Students',
                value: fmt(activeStudents),
                sub: 'Currently enrolled',
                icon: UserCheck,
                accent: 'bg-teal-700',
                iconColor: 'text-white',
              },
              {
                id: 'boys',
                label: 'Boys',
                value: fmt(boys),
                sub: `${boysPct}% of enrolment`,
                icon: User,
                accent: 'bg-indigo-700',
                iconColor: 'text-white',
              },
              {
                id: 'girls',
                label: 'Girls',
                value: fmt(girls),
                sub: `${girlsPct}% of enrolment`,
                icon: User,
                accent: 'bg-rose-600',
                iconColor: 'text-white',
              },
            ];

            return (
              <div className="grid grid-cols-2 gap-3">
                {tiles.map((tile) => (
                  <div
                    key={tile.id}
                    className={`relative overflow-hidden rounded-2xl ${tile.accent} p-4 text-white shadow-sm`}
                  >
                    {/* Background watermark icon */}
                    <div className="pointer-events-none absolute -bottom-3 -right-3 opacity-[0.12]">
                      <tile.icon size={72} />
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/70">{tile.label}</p>
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15">
                        <tile.icon size={14} className={tile.iconColor} />
                      </div>
                    </div>
                    <p className="mt-2 text-3xl font-black tracking-tight leading-none">{tile.value}</p>
                    <p className="mt-1.5 text-[11px] font-medium text-white/65">{tile.sub}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Class navigation cards ─────────────────────────── */}
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <button
              type="button"
              onClick={() => myClass && handleOpenClassList(myClass, 'my-class')}
              disabled={!myClass}
              className="group min-h-[154px] rounded-2xl border border-slate-200/90 bg-white p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all duration-150 hover:border-slate-300 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-800 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <GraduationCap size={22} />
                </div>
                <ChevronRight size={18} className="text-slate-300 transition group-hover:text-slate-900" />
              </div>
              <div className="mt-4">
                <h2 className="text-base font-bold text-slate-900">My Class</h2>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  {myClass ? `${myClass.className} student roster` : 'No class-teacher class assigned'}
                </p>
              </div>
              <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-3">
                <div>
                  <p className="text-2xl font-black text-slate-900 leading-none">{myClass?.learnerCount || 0}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">Students</p>
                </div>
                <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-700">
                  Open roster
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={handleOpenSubjectsList}
              disabled={subjectClasses.length === 0}
              className="group min-h-[154px] rounded-2xl border border-slate-200/90 bg-white p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all duration-150 hover:border-slate-300 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-800 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <BookOpen size={22} />
                </div>
                <ChevronRight size={18} className="text-slate-300 transition group-hover:text-slate-900" />
              </div>
              <div className="mt-4">
                <h2 className="text-base font-bold text-slate-900">My Subjects</h2>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Students from the classes and subjects assigned to you.
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <p className="text-2xl font-black text-slate-900 leading-none">{subjectClasses.length}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">Classes</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900 leading-none">{analysis.totalSubjects || 0}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">Subjects</p>
                </div>
              </div>
            </button>
          </div>

          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Users size={18} />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-900">Student Roster</h2>
                <p className="mt-0.5 text-xs font-medium text-slate-500 leading-relaxed">
                  Open either card above to view students in a clean roster with attendance metrics, fee records, and filters.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Class Student Directory view */
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
          {/* Directory Toolbar / Filters */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3.5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search students by name or admission no..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-slate-400 bg-white"
                />
              </div>

              {/* Sorting and Filters */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 font-semibold">
                  <SlidersHorizontal size={12} className="text-slate-400" />
                  <span className="text-[10px] text-slate-400 uppercase font-bold px-1">Sort</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="outline-none bg-transparent cursor-pointer text-slate-700 text-xs font-bold"
                  >
                    <option value="NAME_ASC">Name A - Z</option>
                    <option value="NAME_DESC">Name Z - A</option>
                    <option value="ADM_ASC">Admission No</option>
                  </select>
                </div>

                <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-1 overflow-x-auto">
                  {PAYMENT_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setPaymentFilter(filter.id)}
                      className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        paymentFilter === filter.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-1">
                  <button
                    onClick={() => setGenderFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      genderFilter === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setGenderFilter('MALE')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      genderFilter === 'MALE' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Boys
                  </button>
                  <button
                    onClick={() => setGenderFilter('FEMALE')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      genderFilter === 'FEMALE' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Girls
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-slate-500">
              <span>{filteredStudents.length} student{filteredStudents.length === 1 ? '' : 's'} shown</span>
              <span>{selectedCount} selected</span>
            </div>
          </div>

          {/* Directory Content */}
          {loadingClass ? (
            <div className="py-16 text-center">
              <Loader2 className="mx-auto mb-2 animate-spin text-slate-500" size={26} />
              <p className="text-xs font-semibold text-slate-500">Loading class roster...</p>
            </div>
          ) : classError ? (
            <div className="p-8 text-center text-rose-600 flex flex-col items-center justify-center">
              <AlertTriangle size={32} className="mb-2 text-rose-500" />
              <p className="text-xs font-semibold">{classError}</p>
              <button
                onClick={() => (isSubjectTable ? handleOpenSubjectsList() : handleOpenClassList(selectedClass, activePage))}
                className="mt-3 bg-slate-900 text-white px-4 py-2 text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
              >
                Retry
              </button>
            </div>
          ) : filteredStudents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="w-10 border border-slate-200 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        aria-label="Select all visible students"
                      />
                    </th>
                    <th className="border border-slate-200 px-3 py-2">Student</th>
                    <th className="border border-slate-200 px-3 py-2">Admission</th>
                    {isSubjectTable && <th className="border border-slate-200 px-3 py-2">Class</th>}
                    {isSubjectTable && <th className="border border-slate-200 px-3 py-2">Subjects</th>}
                    <th className="border border-slate-200 px-3 py-2">Gender</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Paid</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Balance</th>
                    <th className="border border-slate-200 px-3 py-2">Status</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
              {filteredStudents.map((student) => {
                const isMale = String(student.gender).toUpperCase() === 'MALE';
                const avatarBg = isMale ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700';
                const fee = getFeeSummary(student);
                const statusClass = fee.status === 'PAID'
                  ? 'bg-emerald-50 text-emerald-700'
                  : fee.status === 'PARTIAL'
                    ? 'bg-amber-50 text-amber-700'
                    : fee.status === 'OVERPAID'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'bg-rose-50 text-rose-700';

                return (
                  <tr
                    key={`${student.id || student.admissionNumber}-${student.className || selectedClass?.className || ''}-${student.taughtSubjects || ''}`}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="border border-slate-200 px-3 py-2 align-middle">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(student.id)}
                        onChange={() => toggleStudentSelection(student.id)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        aria-label={`Select ${student.firstName || 'student'}`}
                      />
                    </td>
                    <td className="border border-slate-200 px-3 py-2 align-middle">
                      <div className="flex items-center gap-3 min-w-[180px]">
                        <div className={`h-9 w-9 rounded-full shrink-0 flex items-center justify-center font-black text-xs ${avatarBg}`}>
                          {getInitials(student.firstName, student.lastName)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-950">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="truncate text-[11px] font-semibold text-slate-500">{student.status || 'ACTIVE'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="border border-slate-200 px-3 py-2 align-middle text-xs font-bold text-slate-700">{student.admissionNumber || 'N/A'}</td>
                    {isSubjectTable && (
                      <td className="border border-slate-200 px-3 py-2 align-middle text-xs font-bold text-slate-700">
                        {student.className || 'N/A'}
                      </td>
                    )}
                    {isSubjectTable && (
                      <td className="border border-slate-200 px-3 py-2 align-middle text-xs font-semibold text-slate-600">
                        {student.taughtSubjects || 'Assigned subject'}
                      </td>
                    )}
                    <td className="border border-slate-200 px-3 py-2 align-middle text-xs font-bold text-slate-700">{student.gender || 'N/A'}</td>
                    <td className="border border-slate-200 px-3 py-2 align-middle text-right text-xs font-black text-emerald-700">{formatKes(fee.paidTotal)}</td>
                    <td className={`border border-slate-200 px-3 py-2 align-middle text-right text-xs font-black ${fee.balance > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {formatKes(fee.balance)}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 align-middle">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${statusClass}`}>
                        {fee.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="border border-slate-200 px-3 py-2 align-middle text-right">
                      <button
                        type="button"
                        onClick={() => onNavigate('learner-profile', { learner: student })}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-black text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                      >
                        <Eye size={13} />
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500">
              <User size={36} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold">No students found matching filters.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherLearnerAnalysis;
