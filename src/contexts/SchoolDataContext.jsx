import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { GRADES } from '../constants/grades';
import { getCurrentAcademicYear, getDynamicAcademicYears } from '../components/CBCGrading/utils/academicYear';
import { useRefreshListener } from '../utils/refreshBus';
import { useAuth } from '../hooks/useAuth';
import { useBootstrapStore } from '../store/useBootstrapStore';
import axiosInstance from '../services/api/axiosConfig';

const SchoolDataContext = createContext();
const ROLES_WITH_CLASS_ACCESS = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
  'HEAD_OF_CURRICULUM',
  'TEACHER',
  'ACCOUNTANT',
  'RECEPTIONIST',
  'LIBRARIAN',
  'NURSE',
  'SECURITY',
  'DRIVER',
  'COOK',
  'CLEANER',
  'GROUNDSKEEPER',
  'IT_SUPPORT',
]);

const sortGrades = (gradeArray) => {
  if (!gradeArray || gradeArray.length === 0) return [];
  const gradeOrderMap = new Map(GRADES?.map((g, index) => [g.value || g, index]) || []);
  return [...gradeArray].sort((a, b) => {
    const ia = gradeOrderMap.has(a) ? gradeOrderMap.get(a) : 999;
    const ib = gradeOrderMap.has(b) ? gradeOrderMap.get(b) : 999;
    return ia !== ib ? ia - ib : a.localeCompare(b);
  });
};

export const SchoolDataProvider = ({ children }) => {
  const { user } = useAuth();

  // Read pre-loaded classes + streams from the bootstrap store
  const bootstrapClasses = useBootstrapStore(s => s.classes);
  const bootstrapStreams  = useBootstrapStore(s => s.streams);
  const bootstrapReady   = useBootstrapStore(s => s.ready);

  const [classes, setClasses] = useState(bootstrapClasses ?? []);
  const [streams, setStreams]  = useState(bootstrapStreams  ?? []);
  const [grades,  setGrades]  = useState([]);
  const [termConfigs, setTermConfigs] = useState([]);
  const [loading, setLoading] = useState(!bootstrapReady);
  const [error,   setError]   = useState(null);

  // Derive grades whenever classes change
  useEffect(() => {
    const institutionType = user?.institutionType || 'PRIMARY_CBC';
    const isSenior = institutionType === 'SECONDARY';

    const fallback = isSenior
      ? ['GRADE_10', 'GRADE_11', 'GRADE_12']
      : ['PLAYGROUP','PP1','PP2','GRADE_1','GRADE_2','GRADE_3','GRADE_4',
         'GRADE_5','GRADE_6','GRADE_7','GRADE_8','GRADE_9'];

    const activeGrades = classes.map(c => c.grade);
    const combined = [...new Set([...fallback, ...activeGrades])].filter(Boolean);
    setGrades(sortGrades(combined));
  }, [classes, user?.institutionType]);

  // Derive dynamic global academic years
  const academicYears = useMemo(() => {
    const yearsFromClasses = classes.map(c => c.academicYear).filter(Boolean);
    const yearsFromTerms = (termConfigs || []).map(t => t.academicYear).filter(Boolean);
    return getDynamicAcademicYears({
      minPast: 5,
      minFuture: 8,
      extraYears: [...yearsFromClasses, ...yearsFromTerms],
      order: 'asc'
    });
  }, [classes, termConfigs]);

  const currentAcademicYear = useMemo(() => {
    const activeTerm = (termConfigs || []).find(t => t.isActive);
    return activeTerm?.academicYear || getCurrentAcademicYear();
  }, [termConfigs]);

  // When the bootstrap store delivers data, sync it here
  useEffect(() => {
    if (bootstrapClasses !== null) {
      setClasses(bootstrapClasses);
      setLoading(false);
    }
  }, [bootstrapClasses]);

  useEffect(() => {
    if (bootstrapStreams !== null) {
      setStreams(bootstrapStreams.filter(s => !s.archived && s.active !== false));
    }
  }, [bootstrapStreams]);

  // Fallback: if bootstrap never ran (e.g. user landed here without splashscreen),
  // fetch classes + streams + terms directly. No artificial delay needed on local.
  const fetchSchoolData = useCallback(async () => {
    if (!ROLES_WITH_CLASS_ACCESS.has(user?.role)) {
      setClasses([]); setGrades([]); setStreams([]); setTermConfigs([]);
      setLoading(false); return;
    }
    if (!user) return;

    try {
      setLoading(true); setError(null);
      const [classesRes, streamsRes, termsRes] = await Promise.all([
        axiosInstance.get('/classes'),
        axiosInstance.get('/facility/streams').catch(() => ({ data: { data: [] } })),
        axiosInstance.get('/config/term').catch(() => ({ data: { data: [] } })),
      ]);
      const fetchedClasses = classesRes.data?.data ?? [];
      const rawStreams = Array.isArray(streamsRes.data)
        ? streamsRes.data
        : (streamsRes.data?.data ?? []);
      const rawTerms = Array.isArray(termsRes.data?.data)
        ? termsRes.data.data
        : (Array.isArray(termsRes.data) ? termsRes.data : []);

      setClasses(fetchedClasses);
      setStreams(rawStreams.filter(s => !s.archived && s.active !== false));
      setTermConfigs(rawTerms);
    } catch (err) {
      console.error('SchoolDataContext fetch error:', err);
      setError(err.message || 'Failed to fetch school data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Only run the fallback fetch if bootstrap data never arrived
  useEffect(() => {
    if (!user) return;
    if (!ROLES_WITH_CLASS_ACCESS.has(user.role)) {
      setClasses([]); setGrades([]); setStreams([]); setTermConfigs([]);
      setLoading(false); return;
    }

    // If bootstrap is ready but datasets are empty, recover with a direct fetch.
    const hasAnyBootstrapSchoolData =
      (Array.isArray(bootstrapClasses) && bootstrapClasses.length > 0) ||
      (Array.isArray(bootstrapStreams) && bootstrapStreams.length > 0);

    if (bootstrapReady && hasAnyBootstrapSchoolData) return;

    fetchSchoolData();
  }, [bootstrapReady, user, fetchSchoolData, bootstrapClasses, bootstrapStreams]);

  useRefreshListener('classes', fetchSchoolData);
  useRefreshListener('streams', fetchSchoolData);
  useRefreshListener('terms', fetchSchoolData);

  const value = useMemo(() => ({
    classes, grades, streams, academicYears, currentAcademicYear, termConfigs, loading, error,
    refreshSchoolData: fetchSchoolData,
  }), [classes, grades, streams, academicYears, currentAcademicYear, termConfigs, loading, error, fetchSchoolData]);

  return (
    <SchoolDataContext.Provider value={value}>
      {children}
    </SchoolDataContext.Provider>
  );
};

export const useSchoolData = () => {
  const context = useContext(SchoolDataContext);
  if (context === undefined) {
    throw new Error('useSchoolData must be used within a SchoolDataProvider');
  }
  return context;
};
