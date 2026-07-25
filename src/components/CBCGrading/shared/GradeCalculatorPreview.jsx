/**
 * Grade Calculator Preview Component
 * Shows how different marks will be graded using the current performance scale
 */

import React, { useState, useMemo } from 'react';
import { Calculator, TrendingUp, Award } from 'lucide-react';
import { percentageFromMark } from '../../../utils/grading/percentage';

const GradeCalculatorPreview = ({ ranges, totalMarks = 100 }) => {
  const [sampleMark, setSampleMark] = useState('');
  const [showExamples, setShowExamples] = useState(true);

  // Sort ranges by minPercentage descending
  const sortedRanges = useMemo(() => {
    if (!ranges) return [];
    return [...ranges].sort((a, b) => b.minPercentage - a.minPercentage);
  }, [ranges]);

  // Calculate grade for a given mark
  const calculateGradeForMark = (mark) => {
    if (!mark || mark === '' || !totalMarks) return null;
    
    const percentage = percentageFromMark(mark, totalMarks);
    
    const range = sortedRanges.find(r => 
      percentage >= r.minPercentage && percentage <= r.maxPercentage
    );
    
    return range ? {
      ...range,
      percentage: percentage.toFixed(2),
      mark: mark
    } : null;
  };

  // Generate example marks
  const exampleMarks = useMemo(() => {
    if (!sortedRanges.length) return [];
    
    return sortedRanges.map(range => {
      // Pick a mark in the middle of the range
      const midPercentage = (range.minPercentage + range.maxPercentage) / 2;
      const mark = Math.round((midPercentage / 100) * totalMarks);
      return {
        mark,
        grade: calculateGradeForMark(mark)
      };
    });
  }, [sortedRanges, totalMarks]);

  const currentGrade = sampleMark ? calculateGradeForMark(sampleMark) : null;

  if (!ranges || ranges.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <Calculator className="mx-auto text-gray-400 mb-2" size={32} />
        <p className="text-gray-600">No grading scale configured</p>
        <p className="text-sm text-gray-500 mt-1">Create a performance scale to see the preview</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Calculator Section */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="text-blue-600" size={24} />
          <h3 className="text-lg font-medium text-gray-900">Grade Calculator</h3>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Enter a mark to see how it will be graded (out of {totalMarks}):
          </label>
          <input
            type="number"
            value={sampleMark}
            onChange={(e) => setSampleMark(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-semibold"
            placeholder={`Enter mark (0-${totalMarks})`}
            min="0"
            max={totalMarks}
          />

          {currentGrade && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-gray-600">Result</p>
                  <div className="flex items-center gap-3 mt-1">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium text-xl shadow-lg"
                      style={{ backgroundColor: currentGrade.color || '#6b7280' }}
                    >
                      {currentGrade.label?.replace('Level ', '')}
                    </div>
                    <div>
                      <p className="text-xl font-medium text-gray-900">{currentGrade.label}</p>
                      <p className="text-sm text-gray-600">
                        {currentGrade.percentage}% • Score: {currentGrade.points}
                      </p>
                    </div>
                  </div>
                </div>
                <Award className="text-green-600" size={32} />
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Description:</p>
                <p className="text-sm text-gray-700">{currentGrade.description}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grade Distribution */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-gray-600" size={20} />
            <h3 className="text-lg font-medium text-gray-900">Grade Distribution</h3>
          </div>
          <button
            onClick={() => setShowExamples(!showExamples)}
            className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
          >
            {showExamples ? 'Hide' : 'Show'} Examples
          </button>
        </div>

        {/* Visual Grade Scale */}
        <div className="space-y-3">
          {sortedRanges.map((range, index) => {
            const percentage = range.maxPercentage - range.minPercentage;
            const exampleForRange = exampleMarks.find(e => e.grade?.label === range.label);
            
            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium shadow-md flex-shrink-0"
                    style={{ backgroundColor: range.color || '#6b7280' }}
                  >
                    {range.label?.replace('Level ', '')}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900">{range.label}</span>
                      <span className="text-sm text-gray-600">
                        {range.minPercentage}% - {range.maxPercentage}% 
                        <span className="text-gray-400 ml-2">
                          (Score: {range.points})
                        </span>
                      </span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: range.color || '#6b7280'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {showExamples && exampleForRange && (
                  <div className="ml-13 bg-gray-50 border-l-4 rounded-r-lg p-2 pl-3" style={{ borderColor: range.color }}>
                    <p className="text-xs text-gray-600">
                      <span className="font-semibold">Example:</span> A mark of{' '}
                      <span className="font-medium">{exampleForRange.mark}/{totalMarks}</span>{' '}
                      ({exampleForRange.grade?.percentage}%) would receive{' '}
                      <span className="font-medium">{range.label}</span>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mark Range Reference */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-blue-900 mb-2">Quick Reference:</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {sortedRanges.map((range, index) => {
              const minMark = Math.ceil((range.minPercentage / 100) * totalMarks);
              const maxMark = Math.floor((range.maxPercentage / 100) * totalMarks);
              return (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-medium"
                    style={{ backgroundColor: range.color || '#6b7280' }}
                  >
                    {range.points}
                  </div>
                  <span className="text-gray-700">
                    {minMark}-{maxMark} marks
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradeCalculatorPreview;
