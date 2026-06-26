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
  Sparkles,
} from 'lucide-react';
import api, { dashboardAPI } from '../../../../services/api';
import { EmptyState } from '@/design-system/components';

const TeacherLearnerAnalysis = ({ user, onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);

  // In-page class details navigation
  const [selectedClass, setSelectedClass] = useState(null);
  const [classDetails, setClassDetails] = useState(null);
  const [loadingClass, setLoadingClass] = useState(false);
  const [classError, setClassError] = useState(null);

  // Class list filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('NAME_ASC');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
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
  }, []);

  const analysis = metrics?.learnerAnalysis || {};
  const stats = metrics?.stats || {};
  const isClassTeacher = stats.isClassTeacher || false;
  const classTeacherOf = stats.classTeacherOf || null;

  const classes = useMemo(() => (
    Array.isArray(analysis.classes) ? analysis.classes : []
  ), [analysis.classes]);

  const handleOpenClassList = async (classItem) => {
    setSelectedClass(classItem);
    setLoadingClass(true);
    setClassError(null);
    setClassDetails(null);
    try {
      const data = await api.classes.getAllClassData(classItem.classId);
      setClassDetails(data);
    } catch (err) {
      console.error('Failed to load class enrollments:', err);
      setClassError('Failed to load student list. Please try again.');
    } finally {
      setLoadingClass(false);
    }
  };

  const handleCloseClassList = () => {
    setSelectedClass(null);
    setClassDetails(null);
    setSearchTerm('');
    setGenderFilter('ALL');
    setSortBy('NAME_ASC');
  };

  // Client-side search, filtering and sorting
  const filteredStudents = useMemo(() => {
    if (!classDetails?.enrollments) return [];

    let list = classDetails.enrollments.map((e) => e.learner).filter(Boolean);

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
  }, [classDetails, searchTerm, genderFilter, sortBy]);

  const getInitials = (firstName, lastName) => {
    const f = String(firstName || '').charAt(0).toUpperCase();
    const l = String(lastName || '').charAt(0).toUpperCase();
    return `${f}${l}` || '?';
  };

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
              ? `Manage and view detailed profiles of students enrolled in ${selectedClass.className}.`
              : `View statistics, assignments, and roster information for your classes.`}
          </p>
        </div>
        {selectedClass && (
          <button
            onClick={handleCloseClassList}
            className="flex items-center gap-2 self-start md:self-auto bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 text-xs font-black transition-colors rounded-lg font-sans"
          >
            <ArrowLeft size={14} />
            Back to Classes
          </button>
        )}
      </div>

      {/* Main Container: Class list vs Student list */}
      {!selectedClass ? (
        <>
          {/* Metrics summary widgets */}
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-slate-200/80 rounded-xl bg-white p-4 shadow-sm transition-all hover:shadow-md">
              <Users className="mb-2 text-indigo-600" size={24} />
              <p className="text-2xl font-black text-slate-950">{analysis.totalLearners || 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Learners Taught</p>
            </div>
            <div className="border border-slate-200/80 rounded-xl bg-white p-4 shadow-sm transition-all hover:shadow-md">
              <GraduationCap className="mb-2 text-emerald-600" size={24} />
              <p className="text-2xl font-black text-slate-950">{analysis.totalClasses || 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Classes Assigned</p>
            </div>
            <div className="border border-slate-200/80 rounded-xl bg-white p-4 shadow-sm transition-all hover:shadow-md">
              <BookOpen className="mb-2 text-amber-600" size={24} />
              <p className="text-2xl font-black text-slate-950">{analysis.totalSubjects || 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Subjects Taught</p>
            </div>
          </div>

          {/* Classes Grid */}
          <div className="space-y-4">
            <h2 className="text-sm font-black text-slate-950 uppercase tracking-wider">Assigned Classes</h2>

            {classes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classes.map((classItem) => {
                  const isSupervisor = isClassTeacher && classTeacherOf &&
                    (classItem.classId === classTeacherOf.id || classItem.className === classTeacherOf.name);

                  return (
                    <div
                      key={classItem.classId}
                      className={`group border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 ${
                        isSupervisor ? 'border-indigo-400 bg-gradient-to-br from-indigo-50/20 to-white' : 'border-slate-200/80'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="p-4 border-b border-slate-100 flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-slate-950 truncate max-w-[150px]">
                              {classItem.className}
                            </h3>
                            {isSupervisor && (
                              <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                                <Sparkles size={8} /> Supervisor
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {classItem.room ? `Room ${classItem.room}` : 'No Room Allocated'}
                          </p>
                        </div>
                        <div className="h-10 w-10 shrink-0 bg-slate-100 group-hover:bg-indigo-50 transition-colors flex items-center justify-center rounded-lg text-slate-700 group-hover:text-indigo-600 font-bold text-sm">
                          {classItem.className.match(/\d+/) ? `G${classItem.className.match(/\d+/)[0]}` : 'C'}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-semibold">Total Students:</span>
                          <span className="text-slate-900 font-black flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded">
                            <Users size={12} /> {classItem.learnerCount || 0}
                          </span>
                        </div>

                        {/* Subject chips */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-black uppercase text-slate-400">Taught Subjects</span>
                          <div className="flex flex-wrap gap-1">
                            {classItem.subjects && classItem.subjects.length > 0 ? (
                              classItem.subjects.map((sub, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md"
                                >
                                  {sub.subject}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400 italic">No assigned subjects</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="p-3 bg-slate-50/50 border-t border-slate-100">
                        <button
                          onClick={() => handleOpenClassList(classItem)}
                          className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-slate-700 px-3 py-2 text-xs font-black transition-all rounded-lg"
                        >
                          View Students List
                          <ChevronRight size={14} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6">
                <EmptyState
                  icon={<Users size={44} />}
                  title="No assigned learners found"
                  description="Learners appear here after the teacher is assigned as a class teacher or subject teacher on the timetable."
                />
              </div>
            )}
          </div>
        </>
      ) : (
        /* Class Student Directory view */
        <div className="border border-slate-200/80 rounded-xl bg-white shadow-sm overflow-hidden">
          {/* Directory Toolbar / Filters */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search students by name or admission no..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              {/* Sorting and Filters */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1.5 font-semibold">
                  <SlidersHorizontal size={12} className="text-slate-400" />
                  <span className="text-[10px] text-slate-500 uppercase font-black px-1">Sort</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="outline-none bg-transparent cursor-pointer text-slate-700"
                  >
                    <option value="NAME_ASC">Name A - Z</option>
                    <option value="NAME_DESC">Name Z - A</option>
                    <option value="ADM_ASC">Admission No</option>
                  </select>
                </div>

                <div className="flex bg-white border border-slate-200 rounded-lg p-1 gap-1">
                  <button
                    onClick={() => setGenderFilter('ALL')}
                    className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-colors ${
                      genderFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setGenderFilter('MALE')}
                    className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-colors ${
                      genderFilter === 'MALE' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Boys ♂
                  </button>
                  <button
                    onClick={() => setGenderFilter('FEMALE')}
                    className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-colors ${
                      genderFilter === 'FEMALE' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Girls ♀
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Directory Content */}
          {loadingClass ? (
            <div className="py-16 text-center">
              <Loader2 className="mx-auto mb-2 animate-spin text-indigo-600" size={28} />
              <p className="text-xs font-semibold text-slate-500">Loading class roster...</p>
            </div>
          ) : classError ? (
            <div className="p-8 text-center text-red-600 flex flex-col items-center justify-center">
              <AlertTriangle size={36} className="mb-2" />
              <p className="text-xs font-semibold">{classError}</p>
              <button
                onClick={() => handleOpenClassList(selectedClass)}
                className="mt-3 bg-indigo-600 text-white px-4 py-1.5 text-xs font-black rounded-lg hover:bg-indigo-700"
              >
                Retry
              </button>
            </div>
          ) : filteredStudents.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {filteredStudents.map((student) => {
                const isMale = String(student.gender).toUpperCase() === 'MALE';
                const avatarBg = isMale ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700';

                return (
                  <div
                    key={student.id}
                    onClick={() => onNavigate('learner-profile', { learner: student })}
                    className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className={`h-10 w-10 rounded-full shrink-0 flex items-center justify-center font-black text-xs ${avatarBg}`}>
                        {getInitials(student.firstName, student.lastName)}
                      </div>

                      {/* Name / Adm details */}
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-slate-950 group-hover:text-indigo-600 transition-colors truncate">
                          {student.firstName} {student.lastName}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Adm: <span className="font-semibold text-slate-700">{student.admissionNumber || 'N/A'}</span>
                          <span className="mx-2">•</span>
                          Gender: <span className="font-semibold text-slate-700">{student.gender || 'N/A'}</span>
                        </p>
                      </div>
                    </div>

                    {/* View detailed profile */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 group-hover:text-indigo-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                        View Profile
                      </span>
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center border border-slate-200/80 bg-white group-hover:border-indigo-300 text-slate-400 group-hover:text-indigo-600 transition-all shadow-sm">
                        <Eye size={14} />
                      </div>
                    </div>
                  </div>
                );
              })}
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
