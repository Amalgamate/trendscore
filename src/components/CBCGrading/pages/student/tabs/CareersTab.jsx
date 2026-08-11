import React, { useState, useEffect, useCallback } from 'react';
import { Heart, Search, Filter, Plus, ChevronRight } from 'lucide-react';
import { careerAPI } from '../../../../../services/api';

export default function CareersTab({ learnerId, savedCareers, onNavigate }) {
  const [allCareers, setAllCareers] = useState([]);
  const [filteredCareers, setFilteredCareers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCluster, setSelectedCluster] = useState('');
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState(new Set());
  const [comparing, setComparing] = useState([]);
  const [showComparison, setShowComparison] = useState(false);

  // Load all careers
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    careerAPI.listCareers({ limit: 200 })
      .then((res) => {
        if (!cancelled) {
          setAllCareers(res?.data || []);
          setFilteredCareers(res?.data || []);
        }
      })
      .catch(() => {
        if (!cancelled) setFilteredCareers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Track saved careers
  useEffect(() => {
    setSavedIds(new Set(savedCareers.map(c => c.careerId)));
  }, [savedCareers]);

  // Filter careers
  useEffect(() => {
    let result = allCareers;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.cluster.toLowerCase().includes(q)
      );
    }
    if (selectedCluster) {
      result = result.filter(c => c.cluster === selectedCluster);
    }
    setFilteredCareers(result);
  }, [allCareers, searchQuery, selectedCluster]);

  // Get unique clusters
  const clusters = [...new Set(allCareers.map(c => c.cluster).filter(Boolean))];

  const toggleSave = async (career) => {
    const newSaved = new Set(savedIds);
    if (newSaved.has(career.id)) {
      // Remove
      await careerAPI.removeSavedCareer(learnerId, career.id);
      newSaved.delete(career.id);
    } else {
      // Add
      await careerAPI.saveCareer(learnerId, career.id);
      newSaved.add(career.id);
    }
    setSavedIds(newSaved);
  };

  const toggleCompare = (career) => {
    setComparing(prev => {
      if (prev.some(c => c.id === career.id)) {
        return prev.filter(c => c.id !== career.id);
      }
      if (prev.length >= 4) {
        return prev;
      }
      return [...prev, career];
    });
  };

  const CareerCard = ({ career, isSaved, isComparing }) => (
    <article className={`rounded-xl border p-4 transition-all ${isSaved ? 'border-rose-200 bg-rose-50' : 'border-gray-200 bg-white'} ${isComparing ? 'ring-2 ring-indigo-500' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{career.title}</p>
          <p className="mt-0.5 text-[11px] text-gray-500">{career.cluster}</p>
          <p className="mt-1 text-[11px] text-gray-600 line-clamp-2">{career.description}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => toggleCompare(career)}
            className={`rounded-lg p-1.5 transition-colors ${isComparing ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-indigo-50'}`}
            aria-label={isComparing ? 'Remove from comparison' : 'Add to comparison'}
          >
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            onClick={() => toggleSave(career)}
            className={`rounded-lg p-1.5 transition-colors ${isSaved ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-600 hover:bg-rose-50'}`}
            aria-label={isSaved ? 'Remove from saved' : 'Save career'}
          >
            <Heart size={14} className={isSaved ? 'fill-current' : ''} />
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {career.pathwayTags?.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full border border-[#06285a]/20 bg-[#06285a]/5 px-2 py-0.5 text-[9px] font-semibold text-[#06285a]">{tag}</span>
        ))}
      </div>
    </article>
  );

  const SavedCareersList = () => {
    if (!savedCareers.length) return null;
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
            <Heart size={11} /> Your Saved Careers
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {savedCareers.map((item) => (
            <CareerCard key={item.id} career={item.career} isSaved isComparing={comparing.some(c => c.id === item.careerId)} />
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-1" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search careers…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm"
          />
        </div>
        <select
          value={selectedCluster}
          onChange={(e) => setSelectedCluster(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm min-w-[180px]"
        >
          <option value="">All Clusters</option>
          {clusters.map((cluster) => (
            <option key={cluster} value={cluster}>{cluster}</option>
          ))}
        </select>
      </div>

      {/* Comparison Bar */}
      {comparing.length > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-black uppercase text-indigo-700">Comparing</p>
            <div className="flex -space-x-1">
              {comparing.map((c) => (
                <div key={c.id} className="w-8 h-8 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-indigo-700">{c.title.charAt(0)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowComparison(true)}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-black text-white"
            >
              Compare {comparing.length}
            </button>
            <button
              type="button"
              onClick={() => setComparing([])}
              className="text-[10px] text-indigo-700 hover:underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Saved Careers */}
      <SavedCareersList />

      {/* All Careers */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Explore All Careers</p>
          <span className="text-[10px] text-gray-400">{filteredCareers.length} careers</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredCareers.map((career) => (
            <CareerCard
              key={career.id}
              career={career}
              isSaved={savedIds.has(career.id)}
              isComparing={comparing.some(c => c.id === career.id)}
            />
          ))}
        </div>
        {filteredCareers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p className="font-semibold">No careers match your filters</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* External link to full Career Explorer */}
      <button
        type="button"
        onClick={() => onNavigate?.('student-career-explorer')}
        className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50"
      >
        <span>Open Full Career Explorer</span>
        <ChevronRight size={14} />
      </button>

      {/* Comparison Modal */}
      {showComparison && comparing.length >= 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-black">Career Comparison</h2>
              <button onClick={() => setShowComparison(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="p-3 font-bold text-gray-500">Aspect</th>
                    {comparing.map((c) => (
                      <th key={c.id} className="p-3 font-bold text-gray-900">{c.title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100"><th className="p-3 text-gray-500">Cluster</th>{comparing.map((c) => <td key={c.id} className="p-3">{c.cluster}</td>)}</tr>
                  <tr className="border-b border-gray-100"><th className="p-3 text-gray-500">Description</th>{comparing.map((c) => <td key={c.id} className="p-3">{c.description}</td>)}</tr>
                  <tr className="border-b border-gray-100"><th className="p-3 text-gray-500">Pathways</th>{comparing.map((c) => <td key={c.id} className="p-3">{c.pathwayTags?.join(', ')}</td>)}</tr>
                  <tr className="border-b border-gray-100"><th className="p-3 text-gray-500">Entry Requirements</th>{comparing.map((c) => <td key={c.id} className="p-3">{c.entryRequirements || 'Not specified'}</td>)}</tr>
                  <tr className="border-b border-gray-100"><th className="p-3 text-gray-500">Work Environment</th>{comparing.map((c) => <td key={c.id} className="p-3">{c.workEnvironment || 'Not specified'}</td>)}</tr>
                  <tr className="border-b border-gray-100"><th className="p-3 text-gray-500">Growth Outlook</th>{comparing.map((c) => <td key={c.id} className="p-3">{c.growthOutlook || 'Not specified'}</td>)}</tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}