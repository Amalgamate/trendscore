/**
 * Hierarchical Learning Areas Component
 * Displays learning areas organized by grade with expandable strands
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, BookOpen, Edit, Trash2, Plus } from 'lucide-react';
import { getStrandsForArea } from '../../../../constants/strandsConfig';

// Canonical CBC grade order — used for sorting regardless of what classes exist
const GRADE_ORDER = [
  'CRECHE', 'PLAYGROUP', 'RECEPTION', 'TRANSITION',
  'PP1', 'PP2',
  'GRADE_1', 'GRADE_2', 'GRADE_3',
  'GRADE_4', 'GRADE_5', 'GRADE_6',
  'GRADE_7', 'GRADE_8', 'GRADE_9',
  'GRADE_10', 'GRADE_11', 'GRADE_12',
];

const HierarchicalLearningAreas = ({
  learningAreas = [],
  gradeStructure = [],
  onEdit = () => { },
  onDelete = () => { },
  onAddStrand = () => { },
  onBulkDelete = () => { },
  selectedAreas = [],
  onSelectionChange = () => { }
}) => {
  const [expandedGrades, setExpandedGrades] = useState({});
  const [expandedAreas, setExpandedAreas] = useState({});

  // Group learning areas by grade level
  const groupedByGrade = learningAreas.reduce((acc, area) => {
    const grade = area.gradeLevel || 'Other';
    if (!acc[grade]) acc[grade] = [];
    acc[grade].push(area);
    return acc;
  }, {});

  // Sort by canonical CBC grade order — independent of classes table
  const sortedGrades = Object.keys(groupedByGrade).sort((a, b) => {
    const indexA = GRADE_ORDER.indexOf(a);
    const indexB = GRADE_ORDER.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const toggleGrade = (grade) => {
    setExpandedGrades(prev => ({
      ...prev,
      [grade]: !prev[grade]
    }));
  };

  const toggleArea = (areaId) => {
    setExpandedAreas(prev => ({
      ...prev,
      [areaId]: !prev[areaId]
    }));
  };

  const toggleAreaSelection = (areaId) => {
    const newSelection = selectedAreas.includes(areaId)
      ? selectedAreas.filter(id => id !== areaId)
      : [...selectedAreas, areaId];
    onSelectionChange(newSelection);
  };

  const toggleGradeSelection = (grade) => {
    const gradeAreas = groupedByGrade[grade];
    const gradeAreaIds = gradeAreas.map(a => a.id);
    const allSelected = gradeAreaIds.every(id => selectedAreas.includes(id));

    let newSelection;
    if (allSelected) {
      newSelection = selectedAreas.filter(id => !gradeAreaIds.includes(id));
    } else {
      newSelection = gradeAreaIds;
    }
    onSelectionChange(newSelection);
  };

  return (
    <div className="space-y-4">
      {sortedGrades.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="mx-auto text-slate-300 mb-3" size={48} />
          <p className="text-slate-500 font-semibold">No learning areas added yet</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse [&_th]:border-b [&_th]:border-slate-200 [&_td]:border-b [&_td]:border-slate-100">
            <thead>
              <tr className="bg-[color:var(--table-header-bg)]">
                <th className="px-6 py-5 w-10"></th>
                <th className="px-6 py-5 text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest">Level / Learning Area</th>
                <th className="px-6 py-5 text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest text-center">Coverage</th>
                <th className="px-6 py-5 text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedGrades.map(grade => {
                const GradeCheckboxWrapper = () => {
                  const checkboxRef = useRef(null);
                  const gradeAreaIds = groupedByGrade[grade].map(a => a.id);
                  const allSelected = gradeAreaIds.length > 0 && gradeAreaIds.every(id => selectedAreas.includes(id));
                  const someSelected = gradeAreaIds.some(id => selectedAreas.includes(id));

                  useEffect(() => {
                    if (checkboxRef.current) {
                      checkboxRef.current.indeterminate = someSelected && !allSelected;
                    }
                  }, [someSelected, allSelected]);

                  return (
                    <input
                      ref={checkboxRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => toggleGradeSelection(grade)}
                      className="rounded border-slate-300 text-brand-purple focus:ring-brand-purple"
                      title="Select all in this grade"
                    />
                  );
                };

                const isGradeExpanded = expandedGrades[grade];
                const areaCount = groupedByGrade[grade].length;

                return (
                  <React.Fragment key={grade}>
                    {/* Grade Header Row */}
                    <tr
                      onClick={() => toggleGrade(grade)}
                      className={`cursor-pointer transition-all border-b border-slate-100 ${isGradeExpanded ? 'bg-slate-50/80' : 'bg-white hover:bg-slate-50/50'}`}
                    >
                      <td className="px-6 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                        <GradeCheckboxWrapper />
                      </td>
                      <td colSpan={3} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isGradeExpanded ? 'bg-brand-purple text-white' : 'bg-brand-purple/5 text-brand-purple border border-brand-purple/10'}`}>
                              <BookOpen size={16} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-900 uppercase tracking-tight leading-none">
                                {grade.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[9px] text-slate-400 font-medium uppercase tracking-widest mt-1">
                                {areaCount} Learning {areaCount === 1 ? 'Area' : 'Areas'}
                              </span>
                            </div>
                          </div>
                          <div className={`transition-transform duration-300 ${isGradeExpanded ? 'rotate-180' : ''}`}>
                            <ChevronDown className="text-slate-300" size={18} />
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Learning Areas Rows */}
                    {isGradeExpanded && groupedByGrade[grade].map((area) => {
                      const strands = getStrandsForArea(area.name);
                      const isAreaExpanded = expandedAreas[area.id];

                      return (
                        <React.Fragment key={area.id}>
                          <tr className="hover:bg-slate-50/50 transition-all group animate-in slide-in-from-top-2 duration-200">
                            <td className="px-6 py-5 border-l-4 border-brand-purple/20">
                              <input
                                type="checkbox"
                                checked={selectedAreas.includes(area.id)}
                                onChange={() => toggleAreaSelection(area.id)}
                                className="rounded border-slate-200 text-brand-purple focus:ring-brand-purple"
                              />
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 text-2xl" title={area.color}>{area.icon}</div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-slate-800 leading-tight">{area.name}</span>
                                    {area.shortName && (
                                      <span className="px-1.5 py-0.5 bg-brand-purple/5 text-brand-purple border border-brand-purple/10 text-[9px] font-semibold rounded uppercase tracking-widest">
                                        {area.shortName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-center">
                              {strands.length > 0 ? (
                                <button
                                  onClick={() => toggleArea(area.id)}
                                  className="px-3 py-1 rounded-full text-[9px] font-semibold border uppercase tracking-widest border-transparent bg-slate-100/50 text-slate-500 hover:bg-slate-200/50 transition"
                                >
                                  {strands.length} {strands.length === 1 ? 'Strand' : 'Strands'}
                                  {isAreaExpanded ? <ChevronDown size={10} className="inline ml-1 mb-[1px]" /> : <ChevronRight size={10} className="inline ml-1 mb-[1px]" />}
                                </button>
                              ) : (
                                <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">0 Strands</span>
                              )}
                            </td>
                            <td className="px-6 py-5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => onEdit(area)} className="p-1.5 text-slate-400 hover:text-brand-teal rounded transition"><Edit size={16} /></button>
                                <button onClick={() => onDelete(area)} className="p-1.5 text-slate-400 hover:text-red-600 rounded transition"><Trash2 size={16} /></button>
                              </div>
                            </td>
                          </tr>

                          {/* Strands Expansion Row */}
                          {isAreaExpanded && strands.length > 0 && (
                            <tr className="bg-slate-50/30">
                              <td colSpan={4} className="px-12 py-6 border-l-4 border-brand-purple/20">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Curriculum Strands</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {strands.map((strand, strandIndex) => (
                                    <div
                                      key={strandIndex}
                                      className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-brand-purple/20 transition-all group/strand"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-purple/40 group-hover/strand:bg-brand-purple"></div>
                                        <span className="text-[11px] font-medium text-slate-700">{strand}</span>
                                      </div>
                                      <button
                                        onClick={() => onAddStrand(area, strand)}
                                        className="w-6 h-6 rounded-md bg-slate-50 text-slate-400 hover:bg-brand-teal hover:text-white flex items-center justify-center transition-colors"
                                        title="Add assessment configuration"
                                      >
                                        <Plus size={14} />
                                      </button>
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
      )}
    </div>
  );
};

export default HierarchicalLearningAreas;
