import { create } from 'zustand';

interface PathwayRecommendation {
  id: string;
  learnerId: string;
  predictedPathway: string;
  confidence: number;
  clusterScores: Record<string, number>;
  careerSuggestions: string[];
  growthTips: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface PathwaySelection {
  id: string;
  learnerId: string;
  pathwayId: string;
  trackId: string;
  combinationRuleId: string;
  subjects: string[];
  status: string;
  submittedAt?: string;
  approvedAt?: string;
  lockedAt?: string;
}

interface DecisionPlan {
  id: string;
  learnerId: string;
  status: 'DRAFT' | 'SUBMITTED' | 'PARENT_REVIEWED' | 'COUNSELLOR_REVIEWED' | 'APPROVED' | 'LOCKED';
  studentStatement: string;
  parentFeedback?: string;
  counsellorFeedback?: string;
  submissions: Array<{
    id: string;
    role: string;
    status: string;
    snapshot: any;
    createdAt: string;
  }>;
  actionPlan?: {
    items: Array<{
      id: string;
      title: string;
      status: string;
      assignedToRole: string;
      priority: string;
      dueDate?: string;
    }>;
  };
  createdAt: string;
  updatedAt: string;
}

interface SchoolPreference {
  id: string;
  learnerId: string;
  schoolId: string;
  rank: number;
  role: 'LEARNER' | 'PARENT' | 'COUNSELLOR';
  note?: string;
  createdAt: string;
  school?: {
    id: string;
    name: string;
    code: string;
    county: string;
    classification: string;
  };
}

interface CareerItem {
  id: string;
  learnerId: string;
  careerId: string;
  career?: {
    id: string;
    title: string;
    description: string;
    pathwayTags: string[];
    cluster: string;
  };
  savedAt: string;
}

interface PathwayProfile {
  id: string;
  learnerId: string;
  interestAreas: string[];
  strengthAreas: string[];
  activities: string[];
  aspirations: string;
  learningPreference: string;
  confidenceAreas: string[];
  updatedAt: string;
}

interface SchoolMatch {
  schoolId: string;
  school: {
    id: string;
    name: string;
    code: string;
    county: string;
    classification: string;
    pathwayCodes: string[];
    trackCodes: string[];
    combinationCodes: string[];
  };
  fitScore: number;
  bucket: 'DREAM' | 'TARGET' | 'SAFE' | 'LOCAL';
  breakdown: {
    academic: number;
    geographic: number;
    pathway: number;
    capacity: number;
  };
  rank?: number;
}

interface PathwayStoreState {
  // Core data
  learnerId: string | null;
  recommendation: PathwayRecommendation | null;
  selection: PathwaySelection | null;
  decisionPlan: DecisionPlan | null;
  profile: PathwayProfile | null;
  schoolPreferences: SchoolPreference[];
  savedCareers: CareerItem[];
  schoolMatches: SchoolMatch[];

  // UI state
  activeTab: string;
  stage: 'junior' | 'senior';
  mode: 'student' | 'parent';

  // Loading states
  isLoading: boolean;
  loadingStates: Record<string, boolean>;

  // Actions
  setLearnerId: (id: string) => void;
  setStage: (stage: 'junior' | 'senior') => void;
  setMode: (mode: 'student' | 'parent') => void;
  setActiveTab: (tab: string) => void;
  setRecommendation: (rec: PathwayRecommendation | null) => void;
  setSelection: (sel: PathwaySelection | null) => void;
  setDecisionPlan: (plan: DecisionPlan | null) => void;
  setProfile: (profile: PathwayProfile | null) => void;
  setSchoolPreferences: (prefs: SchoolPreference[]) => void;
  setSavedCareers: (careers: CareerItem[]) => void;
  setSchoolMatches: (matches: SchoolMatch[]) => void;
  addSchoolPreference: (pref: SchoolPreference) => void;
  removeSchoolPreference: (id: string) => void;
  addSavedCareer: (career: CareerItem) => void;
  removeSavedCareer: (id: string) => void;
  setLoading: (key: string, loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  learnerId: null,
  recommendation: null,
  selection: null,
  decisionPlan: null,
  profile: null,
  schoolPreferences: [],
  savedCareers: [],
  schoolMatches: [],
  activeTab: 'recommendation',
  stage: 'junior' as 'junior' | 'senior',
  mode: 'student' as 'student' | 'parent',
  isLoading: false,
  loadingStates: {},
};

export const usePathwayStore = create<PathwayStoreState>((set, get) => ({
  ...initialState,

  setLearnerId: (learnerId) => set({ learnerId }),
  setStage: (stage) => set({ stage }),
  setMode: (mode) => set({ mode }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setRecommendation: (recommendation) => set({ recommendation }),
  setSelection: (selection) => set({ selection }),
  setDecisionPlan: (decisionPlan) => set({ decisionPlan }),
  setProfile: (profile) => set({ profile }),
  setSchoolPreferences: (schoolPreferences) => set({ schoolPreferences }),
  setSavedCareers: (savedCareers) => set({ savedCareers }),
  setSchoolMatches: (schoolMatches) => set({ schoolMatches }),

  addSchoolPreference: (pref) => set((state) => ({
    schoolPreferences: [...state.schoolPreferences, pref].sort((a, b) => a.rank - b.rank)
  })),

  removeSchoolPreference: (id) => set((state) => ({
    schoolPreferences: state.schoolPreferences.filter((p) => p.id !== id)
  })),

  addSavedCareer: (career) => set((state) => ({
    savedCareers: [...state.savedCareers, career]
  })),

  removeSavedCareer: (id) => set((state) => ({
    savedCareers: state.savedCareers.filter((c) => c.id !== id)
  })),

  setLoading: (key, loading) => set((state) => ({
    loadingStates: { ...state.loadingStates, [key]: loading },
    isLoading: loading || Object.values({ ...state.loadingStates, [key]: loading }).some(Boolean)
  })),

  reset: () => set(initialState),
}));