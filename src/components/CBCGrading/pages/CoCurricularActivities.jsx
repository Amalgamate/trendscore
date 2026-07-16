/**
 * Co-Curricular Activities Form
 * Track learner participation in sports, arts, clubs, etc.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Save, User, Trophy, Edit2, Trash2, Award } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import api from '../../../services/api';
import SmartLearnerSearch from '../shared/SmartLearnerSearch';
import { getCurrentAcademicYear } from '../utils/academicYear';

const CoCurricularActivities = ({ learners }) => {
  const { showSuccess, showError } = useNotifications();

  // Form state
  const [selectedLearnerId, setSelectedLearnerId] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('TERM_1');
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const [activities, setActivities] = useState([]);

  // New activity state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    activityName: '',
    activityType: 'Sports',
    performance: 'ME1',
    achievements: '',
    remarks: ''
  });

  const terms = [
    { value: 'TERM_1', label: 'Term 1' },
    { value: 'TERM_2', label: 'Term 2' },
    { value: 'TERM_3', label: 'Term 3' }
  ];

  const activityTypes = [
    { value: 'Sports', icon: '⚽', color: 'blue' },
    { value: 'Arts', icon: '🎨', color: 'purple' },
    { value: 'Music', icon: '🎵', color: 'pink' },
    { value: 'Drama', icon: '🎭', color: 'indigo' },
    { value: 'Clubs', icon: '👥', color: 'green' },
    { value: 'Leadership', icon: '👑', color: 'yellow' },
    { value: 'Community Service', icon: '🤝', color: 'red' },
    { value: 'Other', icon: '📋', color: 'gray' }
  ];

  const ratings = [
    { value: 'EE1', label: 'Outstanding', color: 'green' },
    { value: 'EE2', label: 'Excellent', color: 'green' },
    { value: 'ME1', label: 'Very Good', color: 'blue' },
    { value: 'ME2', label: 'Good', color: 'blue' },
    { value: 'AE1', label: 'Satisfactory', color: 'yellow' },
    { value: 'AE2', label: 'Fair', color: 'yellow' },
    { value: 'BE1', label: 'Needs Improvement', color: 'red' },
    { value: 'BE2', label: 'Poor', color: 'red' }
  ];

  const selectedLearner = learners?.find(l => l.id === selectedLearnerId);

  const loadActivities = useCallback(async () => {
    try {
      const response = await api.cbc.getCoCurricular(selectedLearnerId, {
        term: selectedTerm,
        academicYear
      });

      if (response.success) {
        setActivities(response.data || []);
      }
    } catch (error) {
      console.log('No activities found');
      setActivities([]);
    }
  }, [selectedLearnerId, selectedTerm, academicYear]);

  // Load activities when learner/term changes
  useEffect(() => {
    if (selectedLearnerId && selectedTerm) {
      loadActivities();
    }
  }, [selectedLearnerId, selectedTerm, academicYear, loadActivities]);

  const handleSave = async () => {
    if (!selectedLearnerId) {
      showError('Please select a learner');
      return;
    }

    if (!formData.activityName.trim()) {
      showError('Activity name is required');
      return;
    }

    try {
      if (editingId) {
        // Update existing
        const response = await api.cbc.updateCoCurricular(editingId, {
          ...formData,
          term: selectedTerm,
          academicYear
        });
        
        if (response.success) {
          showSuccess('Activity updated successfully!');
          loadActivities();
          resetForm();
        }
      } else {
        // Create new
        const response = await api.cbc.createCoCurricular({
          learnerId: selectedLearnerId,
          term: selectedTerm,
          academicYear,
          ...formData
        });

        if (response.success) {
          showSuccess('Activity added successfully!');
          loadActivities();
          resetForm();
        }
      }
    } catch (error) {
      showError(error.message || 'Failed to save activity');
    }
  };

  const handleEdit = (activity) => {
    setFormData({
      activityName: activity.activityName,
      activityType: activity.activityType,
      performance: activity.performance,
      achievements: activity.achievements || '',
      remarks: activity.remarks || ''
    });
    setEditingId(activity.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this activity?')) return;

    try {
      const response = await api.cbc.deleteCoCurricular(id);
      if (response.success) {
        showSuccess('Activity deleted successfully');
        loadActivities();
      }
    } catch (error) {
      showError('Failed to delete activity');
    }
  };

  const resetForm = () => {
    setFormData({
      activityName: '',
      activityType: 'Sports',
      performance: 'ME1',
      achievements: '',
      remarks: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const getRatingColor = (rating) => {
    if (rating.startsWith('EE')) return 'bg-green-100 text-green-800 border-green-300';
    if (rating.startsWith('ME')) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (rating.startsWith('AE')) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (rating.startsWith('BE')) return 'bg-red-100 text-red-800 border-red-300';
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getTypeIcon = (type) => {
    return activityTypes.find(t => t.value === type)?.icon || '📋';
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
          <Trophy size={22} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight leading-none">Co-Curricular Activities</h2>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mt-1">Participation & achievement</p>
        </div>
      </div>

      {/* Selection Panel */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <User size={20} />
          Select Learner & Term
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Learner</label>
            <SmartLearnerSearch
              learners={learners?.filter(l => l.status === 'ACTIVE' || l.status === 'Active') || []}
              selectedLearnerId={selectedLearnerId}
              onSelect={setSelectedLearnerId}
              placeholder="Search by name, adm no..."
              compact
              inputClassName="h-12 bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Term</label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              {terms.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Academic Year</label>
            <input
              type="number"
              value={academicYear}
              onChange={(e) => setAcademicYear(parseInt(e.target.value))}
              className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {selectedLearner && (
        <>
          {/* Learner Info + Add Button */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-orange-600 text-white rounded-xl w-11 h-11 flex items-center justify-center font-semibold text-sm">
                  {selectedLearner.firstName[0]}{selectedLearner.lastName[0]}
                </div>
                <div>
                  <h3 className="font-medium text-lg text-gray-800">
                    {selectedLearner.firstName} {selectedLearner.lastName}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {selectedLearner.admissionNumber} • {activities.length} activit{activities.length === 1 ? 'y' : 'ies'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowForm(!showForm)}
                className="h-10 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center gap-2 text-sm font-semibold"
              >
                <Plus size={20} />
                Add Activity
              </button>
            </div>
          </div>

          {/* Add/Edit Form */}
          {showForm && (
            <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6 border border-orange-200">
              <h3 className="font-medium text-lg mb-4 text-gray-800">
                {editingId ? 'Edit Activity' : 'Add New Activity'}
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Activity Name *</label>
                  <input
                    type="text"
                    value={formData.activityName}
                    onChange={(e) => setFormData({...formData, activityName: e.target.value})}
                    placeholder="e.g., Football, Drama Club, Choir"
                    className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Activity Type *</label>
                  <select
                    value={formData.activityType}
                    onChange={(e) => setFormData({...formData, activityType: e.target.value})}
                    className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500"
                  >
                    {activityTypes.map(t => (
                      <option key={t.value} value={t.value}>
                        {t.icon} {t.value}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Performance *</label>
                  <select
                    value={formData.performance}
                    onChange={(e) => setFormData({...formData, performance: e.target.value})}
                    className={`w-full h-12 px-4 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500 font-semibold ${getRatingColor(formData.performance)}`}
                  >
                    {ratings.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Achievements</label>
                  <input
                    type="text"
                    value={formData.achievements}
                    onChange={(e) => setFormData({...formData, achievements: e.target.value})}
                    placeholder="e.g., Won inter-school competition"
                    className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Remarks</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                  placeholder="Additional observations..."
                  rows={3}
                  className="w-full min-h-24 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center gap-2 font-semibold"
                >
                  <Save size={18} />
                  {editingId ? 'Update' : 'Save'} Activity
                </button>
                <button
                  onClick={resetForm}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Activities List */}
          <div className="space-y-4">
            {activities.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-12 text-center">
                <Award className="mx-auto text-gray-400 mb-4" size={64} />
                <h3 className="text-xl font-medium text-gray-800 mb-2">No Activities Yet</h3>
                <p className="text-gray-600 mb-4">Click "Add Activity" to record this learner's participation</p>
              </div>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200 hover:border-orange-300 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">{getTypeIcon(activity.activityType)}</span>
                        <div>
                          <h4 className="font-medium text-lg text-gray-800">{activity.activityName}</h4>
                          <p className="text-sm text-gray-600">{activity.activityType}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-600 mb-1">Performance</p>
                          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border-2 ${getRatingColor(activity.performance)}`}>
                            {ratings.find(r => r.value === activity.performance)?.label || activity.performance}
                          </span>
                        </div>

                        {activity.achievements && (
                          <div>
                            <p className="text-sm font-semibold text-gray-600 mb-1">Achievements</p>
                            <p className="text-sm text-gray-800">{activity.achievements}</p>
                          </div>
                        )}
                      </div>

                      {activity.remarks && (
                        <div className="mt-3">
                          <p className="text-sm font-semibold text-gray-600 mb-1">Remarks</p>
                          <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{activity.remarks}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(activity)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(activity.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Empty State */}
      {!selectedLearnerId && (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <Trophy className="mx-auto text-gray-400 mb-4" size={64} />
          <h3 className="text-xl font-medium text-gray-800 mb-2">Select a Learner</h3>
          <p className="text-gray-600">Choose a learner from the dropdown above to manage their activities</p>
        </div>
      )}
    </div>
  );
};

export default CoCurricularActivities;
