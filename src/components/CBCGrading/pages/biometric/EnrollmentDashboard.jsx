import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Search, 
  UserMinus, 
  Fingerprint, 
  Loader2, 
  ChevronRight,
  UserCircle,
  GraduationCap,
  Briefcase
} from 'lucide-react';
import { learnerAPI } from '../../../../services/api/learner.api';
import { userAPI } from '../../../../services/api/user.api';
import EnrollmentModal from './EnrollmentModal';
import { useAuth } from '../../../../hooks/useAuth';
import { getSelectedInstitutionType } from '../../../../services/schoolContext';

const EnrollmentDashboard = () => {
  const { user } = useAuth();
  const selectedInstitutionType = String(getSelectedInstitutionType() || user?.institutionType || '').toUpperCase();
  const isSecondaryPortal = selectedInstitutionType === 'SECONDARY' || selectedInstitutionType === 'HIGH_SCHOOL';
  const isSecondaryGrade = (gradeValue) => {
    const g = String(gradeValue || '').trim().toUpperCase().replace(/\s+/g, '_');
    return g.startsWith('FORM') || ['GRADE_10', 'GRADE_11', 'GRADE_12', 'GRADE10', 'GRADE11', 'GRADE12'].includes(g);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState('LEARNER'); // 'LEARNER' or 'STAFF'
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSearch = useCallback(async () => {
    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery.length === 1) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      let data = [];
      if (activeType === 'LEARNER') {
        const learners = await learnerAPI.getAll({
          ...(normalizedQuery ? { search: normalizedQuery } : {}),
          limit: 50,
        });
        const rows = Array.isArray(learners?.data) ? learners.data : (Array.isArray(learners) ? learners : []);
        data = rows.filter((learner) => {
          const learnerIsSecondary = isSecondaryGrade(learner?.grade);
          return isSecondaryPortal ? learnerIsSecondary : !learnerIsSecondary;
        });
      } else {
        const users = await userAPI.getAll({
          ...(normalizedQuery ? { search: normalizedQuery } : {}),
          limit: 50,
        });
        const rows = Array.isArray(users?.data) ? users.data : (Array.isArray(users) ? users : []);
        data = rows.filter(u => u.role !== 'PARENT' && u.role !== 'SUPER_ADMIN');
      }
      
      // For each result, we should ideally know if they are enrolled.
      // For now, we'll fetch status when a person is selected or show a placeholder.
      setResults(data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [activeType, isSecondaryPortal, searchQuery]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      handleSearch();
    }, searchQuery ? 500 : 0);

    return () => clearTimeout(delayDebounceFn);
  }, [handleSearch, searchQuery]);

  const openEnrollment = (person) => {
    setSelectedPerson(person);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Search & Toggle Section */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit">
            <button 
              onClick={() => setActiveType('LEARNER')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all ${
                activeType === 'LEARNER' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <GraduationCap size={16} />
              Learners
            </button>
            <button 
              onClick={() => setActiveType('STAFF')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all ${
                activeType === 'STAFF' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Briefcase size={16} />
              Staff
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder={`Search ${activeType.toLowerCase()}s by name or ID...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium"
            />
          </div>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-slate-300">
            <Loader2 size={40} className="text-indigo-600 animate-spin mb-4" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Scanning Database...</p>
          </div>
        ) : results.length > 0 ? (
          results.map((person) => (
            <div 
              key={person.id}
              className="bg-white p-6 rounded-3xl border border-slate-200 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                  {person.photoUrl ? (
                    <img src={person.photoUrl} alt="" className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    <UserCircle size={32} />
                  )}
                </div>
                <div className="px-3 py-1 rounded-full bg-slate-100 text-[9px] font-semibold uppercase tracking-widest text-slate-500">
                  {person.admissionNumber || person.employeeCode || 'ID: ' + person.id.split('-')[0]}
                </div>
              </div>

              <h3 className="text-lg font-semibold text-slate-900 leading-tight mb-1">
                {person.firstName} {person.lastName}
              </h3>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-6">
                {activeType === 'LEARNER' ? `Grade: ${person.grade}` : `Role: ${person.role}`}
              </p>

              <button 
                onClick={() => openEnrollment(person)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold uppercase tracking-widest group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm group-hover:shadow-lg group-hover:shadow-indigo-600/20"
              >
                <Fingerprint size={16} />
                Check enrollment
                <ChevronRight size={14} className="ml-auto" />
              </button>
            </div>
          ))
        ) : searchQuery ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200">
            <UserMinus size={48} className="text-slate-200 mb-4" />
            <h4 className="text-slate-900 font-semibold uppercase tracking-tight">No Entities Found</h4>
            <p className="text-xs text-slate-400 font-medium">Verify your search query and try again.</p>
          </div>
        ) : (
          <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white/50 rounded-3xl border border-dashed border-slate-200">
            <Users size={48} className="text-slate-200 mb-4" />
            <h4 className="text-slate-400 font-semibold uppercase tracking-widest">Search Entry Required</h4>
            <p className="text-[10px] text-slate-300 font-semibold uppercase tracking-widest mt-2 italic">Initiate queries to begin enrollment cycle</p>
          </div>
        )}
      </div>

      {isModalOpen && selectedPerson && (
        <EnrollmentModal 
          person={selectedPerson} 
          type={activeType} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}
    </div>
  );
};

export default EnrollmentDashboard;
