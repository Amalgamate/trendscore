import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, Edit2, Check, X, BookOpen, Search, Filter, RefreshCw, Layers, AlertTriangle } from 'lucide-react';
import { configAPI } from '../../../services/api';
import { useNotifications } from '../hooks/useNotifications';
import toast from 'react-hot-toast';
import HierarchicalLearningAreas from './settings/HierarchicalLearningAreas';
import { gradeStructure } from '../data/gradeStructure';
import { LEARNING_AREA_GRADES, getGradeLabel } from '../../../constants/grades';

/**
 * LearningAreasManagement
 * Upgraded management interface for Learning Areas & Strands.
 * This version is accessible to Head Teachers and Administrators.
 */
const LearningAreasManagement = () => {
  const { showSuccess, showError } = useNotifications();

  // States
  const [learningAreas, setLearningAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [deleting, setDeleting] = useState(false);

  // Modal/Form State
  const [showForm, setShowForm] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    code: '',
    gradeLevel: 'GRADE_1',
    icon: '📘',
    color: '#3b82f6'
  });

  const fetchLearningAreas = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await configAPI.getLearningAreas();
      setLearningAreas(Array.isArray(data) ? data : (data?.data || []));
    } catch (err) {
      setError('Failed to load learning areas: ' + (err.message || 'Unknown error'));
      console.error('Error fetching learning areas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLearningAreas();
  }, [fetchLearningAreas]);

  const handleSeedAreas = async () => {
    try {
      setSeeding(true);
      const result = await configAPI.seedLearningAreas();

      toast.success(`📚 Curriculum seeded! Created: ${result.created || 0}, Skipped: ${result.skipped || 0}`, {
        duration: 4000,
        position: 'top-right',
      });

      await fetchLearningAreas();
    } catch (err) {
      showError(err.message || 'Failed to seed learning areas');
    } finally {
      setSeeding(false);
    }
  };

  const handleOpenModal = (area = null) => {
    if (area) {
      setEditingArea(area);
      setFormData({
        name: area.name || '',
        description: area.description || '',
        shortName: area.shortName || '',
        gradeLevel: area.gradeLevel || 'GRADE_1',
        icon: area.icon || '📘',
        color: area.color || '#3b82f6'
      });
    } else {
      setEditingArea(null);
      setFormData({
        name: '',
        description: '',
        shortName: '',
        gradeLevel: 'GRADE_1',
        icon: '📘',
        color: '#3b82f6'
      });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.name.trim()) {
        toast.error('Name is required');
        return;
      }
      if (!formData.shortName.trim()) {
        toast.error('Short Name is required');
        return;
      }

      if (editingArea) {
        await configAPI.updateLearningArea(editingArea.id, formData);
        showSuccess('Learning area updated');
      } else {
        await configAPI.createLearningArea(formData);
        showSuccess('Learning area created');
      }

      setShowForm(false);
      fetchLearningAreas();
    } catch (err) {
      showError(err.message || 'Failed to save');
    }
  };

  const handleDelete = async (area) => {
    if (!window.confirm(`Are you sure you want to delete "${area.name}"?`)) return;
    try {
      await configAPI.deleteLearningArea(area.id);
      showSuccess('Deleted successfully');
      fetchLearningAreas();
    } catch (err) {
      showError(err.message || 'Failed to delete. Refresh the page and try again.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAreas.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedAreas.length} learning area(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeleting(true);
      const areasToDelete = learningAreas.filter(a => selectedAreas.includes(a.id));
      
      // Delete each area
      for (const area of areasToDelete) {
        await configAPI.deleteLearningArea(area.id);
      }
      
      showSuccess(`Deleted ${selectedAreas.length} learning area(s) successfully`);
      setSelectedAreas([]);
      fetchLearningAreas();
    } catch (err) {
      showError(err.message || 'Failed to delete learning areas. Refresh the page and try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-medium text-gray-800 flex items-center gap-2">
            <Layers className="text-brand-purple" />
            Learning Areas Management
          </h2>
          <p className="text-gray-500 mt-1">Configure your school's CBC curriculum structure and subjects.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Hiding seeding buttons for now
           <button
            onClick={handleSeedAreas}
            disabled={seeding || loading}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm ${seeding
              ? 'bg-gray-100 text-gray-400 cursor-wait'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
          >
            {seeding ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              <span>🌱</span>
            )}
            {seeding ? 'Seeding...' : 'Seed CBC Areas'}
          </button>
          */}

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-purple text-white rounded-xl font-medium hover:bg-brand-purple/90 transition-all shadow-md shadow-brand-purple/20"
          >
            <Plus size={18} />
            Add Learning Area
          </button>

          {selectedAreas.length > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm ${deleting
                ? 'bg-gray-100 text-gray-400 cursor-wait'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                }`}
            >
              {deleting ? (
                <RefreshCw className="animate-spin" size={18} />
              ) : (
                <Trash2 size={18} />
              )}
              Delete ({selectedAreas.length})
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-purple/20 border-t-brand-purple"></div>
            <p className="text-gray-500 mt-4 font-medium">Loading curriculum...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <div className="bg-red-50 text-red-600 p-4 rounded-xl inline-block mb-4">
              <X size={32} />
            </div>
            <h3 className="text-lg font-medium text-gray-800">{error}</h3>
            <button
              onClick={fetchLearningAreas}
              className="mt-4 px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-semibold"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="p-6">
            <HierarchicalLearningAreas
              learningAreas={learningAreas}
              gradeStructure={gradeStructure}
              onEdit={handleOpenModal}
              onDelete={handleDelete}
              selectedAreas={selectedAreas}
              onSelectionChange={setSelectedAreas}
            />
          </div>
        )}
      </div>

      {/* Manual Creation Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
              <h3 className="text-xl font-medium text-gray-800">
                {editingArea ? 'Edit Learning Area' : 'New Learning Area'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 hover:bg-gray-200 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Learning Area Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple outline-none transition"
                    placeholder="e.g. Mathematics Activities"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Short Name</label>
                  <input
                    type="text"
                    value={formData.shortName}
                    onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple outline-none transition"
                    placeholder="e.g. MATH"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
                  <select
                    value={formData.gradeLevel}
                    onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple outline-none transition"
                  >
                    {LEARNING_AREA_GRADES.map((grade) => (
                      <option key={grade.value} value={grade.value}>{grade.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Icon</label>
                  <select
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple outline-none transition"
                  >
                    <option value="📘">📘 Book</option>
                    <option value="🧮">🧮 Abacus</option>
                    <option value="🔬">🔬 Science</option>
                    <option value="🎨">🎨 Art</option>
                    <option value="🏃">🏃 Sports</option>
                    <option value="🌍">🌍 Social</option>
                    <option value="🧸">🧸 Play</option>
                    <option value="🎼">🎼 Music</option>
                    <option value="🕌">🕌 Religion</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Theme Color</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full h-10 p-1 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple outline-none transition"
                  placeholder="Describe focus areas..."
                  rows={3}
                />
              </div>

              {/* Preview */}
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3 text-center">Preview</p>
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm"
                    style={{ backgroundColor: `${formData.color}20`, color: formData.color }}
                  >
                    {formData.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 leading-tight">{formData.name || 'Subject Name'}</h4>
                    <p className="text-xs text-gray-500 font-medium">
                      <span className="text-brand-purple">{formData.shortName || 'CODE'}</span> • {getGradeLabel(formData.gradeLevel)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-brand-purple text-white rounded-xl font-medium hover:bg-brand-purple/90 transition shadow-lg shadow-brand-purple/10"
                >
                  {editingArea ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningAreasManagement;
