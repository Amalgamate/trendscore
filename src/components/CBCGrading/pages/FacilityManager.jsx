/**
 * Facility Manager Component
 * Manage school facilities including classes, streams, and rooms
 * Accessible to Head Teachers and Admins
 */

import React, { useState, useEffect } from 'react';
import {
  Plus, Edit, Trash2, X, Save, Loader, AlertCircle, CheckCircle,
  BookOpen, Users, Grid, Search, RefreshCw, Eye, MoreVertical, Copy
} from 'lucide-react';
import { configAPI, facilityAPI } from '../../../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { getCurrentSchoolId, getStoredUser } from '../../../services/schoolContext';
import { useSchoolData } from '../../../contexts/SchoolDataContext';
import api from '../../../services/api';
import Toast from '../shared/Toast';
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../../components/ui';

const FacilityManager = () => {
  const { grades } = useSchoolData();
  const {
    showSuccess,
    showError,
    showToast,
    toastMessage,
    toastType,
    hideNotification
  } = useNotifications();

  // State
  const [classes, setClasses] = useState([]);
  const [streams, setStreams] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [schoolId, setSchoolId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [activeTab, setActiveTab] = useState('classes'); // classes, streams, create-class, create-stream
  const [seedingClasses, setSeedingClasses] = useState(false);
  const [seedingStreams, setSeedingStreams] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    capacity: 40,
    stream: 'A',
    grade: grades.length > 0 ? grades[0] : 'GRADE_1',
    teacherId: '',
    branchId: '',
    description: ''
  });

  // Handle Seeding Classes
  const handleSeedClasses = async () => {
    if (!schoolId) return;
    try {
      setSeedingClasses(true);
      const result = await configAPI.seedClasses(schoolId);
      showSuccess(`✏️ Classes seeded! Created: ${result.created || 0}, Skipped: ${result.skipped || 0}`);
      await fetchInitialData(schoolId);
    } catch (error) {
      console.error('Error seeding classes:', error);
      showError(error?.message || 'Failed to seed classes');
    } finally {
      setSeedingClasses(false);
    }
  };

  // Handle Seeding Streams
  const handleSeedStreams = async () => {
    if (!schoolId) return;
    try {
      setSeedingStreams(true);
      const result = await configAPI.seedStreams(schoolId);
      showSuccess(`🌊 Streams seeded! Created: ${result.created || 0}, Skipped: ${result.skipped || 0}`);
      await fetchInitialData(schoolId);
    } catch (error) {
      console.error('Error seeding streams:', error);
      showError(error?.message || 'Failed to seed streams');
    } finally {
      setSeedingStreams(false);
    }
  };

  const [streamFormData, setStreamFormData] = useState({
    name: '',
    active: true
  });
  const [editingStreamId, setEditingStreamId] = useState(null);
  const [deleteConfirmStream, setDeleteConfirmStream] = useState(null);

  // Initialize
  useEffect(() => {
    // Single-tenant mode: the backend resolves school from JWT,
    // so we use a non-null sentinel to bypass the schoolId guard.
    const SINGLETON = 'default';
    setSchoolId(SINGLETON);
    const user = getStoredUser();
    const initialBranchId = user?.branchId || null;
    setSelectedBranchId(initialBranchId);
    fetchInitialData(SINGLETON, initialBranchId);
  }, []);

  // Fetch all initial data — schoolId param ignored (single-tenant, backend resolves from JWT)
  const fetchInitialData = async (sid, bid = selectedBranchId) => {
    try {
      setLoading(true);
      console.log('📝 Fetching initial data for school:', sid);

      // Fetch classes
      const classesResponse = await configAPI.getClasses();
      console.log('✅ Classes fetched:', classesResponse.data);
      setClasses(classesResponse.data || []);

      // Branches not used in single-tenant mode
      setBranches([]);

      // Fetch streams
      try {
        const streamsResponse = await configAPI.getStreamConfigs();
        console.log('✅ Streams fetched', streamsResponse);
        const streamsData = Array.isArray(streamsResponse) ? streamsResponse : (streamsResponse.data || []);
        setStreams(streamsData);
      } catch (err) {
        console.error('⚠️ Failed to fetch streams:', err);
        setStreams([]);
      }

      // Fetch teachers (no parameters - backend filters by authenticated user's school)
      try {
        const teachersResponse = await api.teachers.getAll();
        console.log('✅ Teachers fetched:', teachersResponse);
        const teachersList = teachersResponse?.data || teachersResponse || [];
        console.log('📊 Setting teachers list with', teachersList.length, 'teachers');
        setTeachers(teachersList);
      } catch (err) {
        console.error('⚠️ Failed to fetch teachers:', err);
        setTeachers([]);
      }
    } catch (error) {
      console.error('❌ Failed to fetch initial data:', error);
      showError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Save stream
  const handleSaveStream = async () => {
    if (!streamFormData.name.trim()) {
      showError('Stream name is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: streamFormData.name,
        schoolId: schoolId,
        id: editingStreamId || undefined,
        active: editingStreamId ? streamFormData.active : true
      };

      console.log('Saving stream config with payload:', payload);

      await configAPI.upsertStreamConfig(payload);

      showSuccess(editingStreamId ? 'Stream updated!' : 'Stream created!');

      if (schoolId) {
        await fetchInitialData(schoolId, selectedBranchId);
      }

      resetStreamForm();
      setActiveTab('streams');
    } catch (error) {
      console.error('Error saving stream:', error);
      console.error('Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
        stack: error?.stack
      });

      if (error?.message?.includes('already exists')) {
        showError('Stream name already exists');
      } else if (error?.response?.status === 403) {
        showError('You do not have permission to perform this action.');
      } else if (error?.response?.status === 401 || error?.message?.includes('Unauthorized')) {
        showError('Your session is no longer valid. Please sign in again.');
      } else {
        showError(error?.response?.data?.error?.message || error?.message || 'Failed to save stream. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Edit stream
  const handleEditStream = (stream) => {
    setStreamFormData({
      name: stream.name || '',
      active: stream.active !== false
    });
    setEditingStreamId(stream.id);
    setActiveTab('create-stream');
  };

  // Delete stream
  const handleDeleteStream = async (id) => {
    try {
      setSubmitting(true);
      await configAPI.deleteStreamConfig(id);
      showSuccess('Stream deleted!');

      if (schoolId) {
        await fetchInitialData(schoolId, selectedBranchId);
      }
      setDeleteConfirmStream(null);
    } catch (error) {
      console.error('Error deleting stream:', error);
      showError('Failed to delete stream');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset stream form
  const resetStreamForm = () => {
    setStreamFormData({
      name: '',
      active: true
    });
    setEditingStreamId(null);
  };

  // Handle form input
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Validate form
  const validateForm = () => {
    if (!formData.name.trim()) {
      showError('Class name is required');
      return false;
    }
    if (!formData.code.trim()) {
      showError('Class code is required');
      return false;
    }
    if (formData.capacity < 1) {
      showError('Capacity must be at least 1');
      return false;
    }
    return true;
  };

  // Save class
  const handleSaveClass = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        code: formData.code,
        capacity: parseInt(formData.capacity) || 40,
        stream: formData.stream,
        grade: formData.grade,
        teacherId: formData.teacherId || undefined,
        branchId: formData.branchId || undefined,
        schoolId,
        ...(editingId && { id: editingId })
      };

      console.log('Saving class with payload:', payload);

      const response = await configAPI.upsertClass(payload);

      showSuccess(editingId ? 'Class updated successfully!' : 'Class created successfully!');

      // Refresh list
      if (schoolId) {
        await fetchInitialData(schoolId);
      }

      // Reset form
      resetForm();
      setActiveTab('classes');
    } catch (error) {
      console.error('Error saving class:', error);
      showError(error?.response?.data?.error?.message || error?.message || 'Failed to save class');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit class
  const handleEditClass = (classItem) => {
    setFormData({
      name: classItem.name || '',
      code: classItem.code || '',
      capacity: classItem.capacity || 40,
      stream: classItem.stream || 'A',
      grade: classItem.grade || (grades.length > 0 ? grades[0] : 'GRADE_1'),
      teacherId: classItem.teacherId || '',
      branchId: classItem.branchId || '',
      description: classItem.description || ''
    });
    setEditingId(classItem.id);
    setActiveTab('create-class');
  };

  // Delete class
  const handleDeleteClass = async (id) => {
    try {
      setSubmitting(true);
      await configAPI.deleteClass(id);
      showSuccess('Class deleted successfully!');

      if (schoolId) {
        await fetchInitialData(schoolId);
      }
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting class:', error);
      showError('Failed to delete class');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      capacity: 40,
      stream: 'A',
      grade: grades.length > 0 ? grades[0] : 'GRADE_1',
      teacherId: '',
      branchId: '',
      description: ''
    });
    setEditingId(null);
    setShowForm(false);
    setActiveTab('classes');
  };


  // Filter classes
  const filteredClasses = classes.filter(item =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!schoolId) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="pt-12 text-center">
          <AlertCircle size={32} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600">Unable to determine school. Please refresh the page.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <div>
          <h2 className="text-2xl font-medium text-gray-800 flex items-center gap-2">
            <Grid className="text-brand-purple" />
            Facility Management
          </h2>
          <p className="text-gray-500 mt-1">Manage classes, streams, and school facilities</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              if (schoolId) {
                fetchInitialData(schoolId);
              }
            }}
            disabled={loading}
            variant="outline"
            className="h-10 border-gray-200"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>

          <Button
            onClick={handleSeedClasses}
            disabled={seedingClasses || loading}
            variant="outline"
            className="h-10 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
          >
            {seedingClasses ? <RefreshCw className="animate-spin" size={16} /> : <span>🌱</span>}
            {seedingClasses ? 'Seeding...' : 'Seed Classes'}
          </Button>

          <Button
            onClick={handleSeedStreams}
            disabled={seedingStreams || loading}
            variant="outline"
            className="h-10 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
          >
            {seedingStreams ? <RefreshCw className="animate-spin" size={16} /> : <span>🌊</span>}
            {seedingStreams ? 'Seeding...' : 'Seed Streams'}
          </Button>

          {(activeTab === 'classes') && (
            <Button
              onClick={() => {
                resetForm();
                setActiveTab('create-class');
              }}
              className="h-10 bg-brand-purple text-white hover:bg-brand-purple/90"
            >
              <Plus size={16} />
              New Class
            </Button>
          )}
          {(activeTab === 'streams') && (
            <Button
              onClick={() => {
                resetStreamForm();
                setActiveTab('create-stream');
              }}
              className="h-10 bg-brand-purple text-white hover:bg-brand-purple/90"
            >
              <Plus size={16} />
              New Stream
            </Button>
          )}
        </div>
      </div>

      {/* Branch Selector using Tabs (Visible only on Streams tab and if multiple branches exist) */}
      {/* Branch Selector for Classes */}
      {activeTab === 'classes' && branches.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {branches.map(branch => (
            <button
              key={branch.id}
              onClick={() => {
                setSelectedBranchId(branch.id);
                fetchInitialData(schoolId, branch.id);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${selectedBranchId === branch.id
                ? 'bg-brand-purple text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {branch.name}
            </button>
          ))}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('classes')}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'classes'
            ? 'border-brand-purple text-brand-purple'
            : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
        >
          Classes ({filteredClasses.length})
        </button>
        <button
          onClick={() => setActiveTab('streams')}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'streams'
            ? 'border-brand-purple text-brand-purple'
            : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
        >
          Streams ({streams.length})
        </button>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'classes' ? (
          // Classes List View
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Loading State */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader size={32} className="animate-spin text-brand-purple" />
              </div>
            ) : filteredClasses.length === 0 ? (
              // Empty State
              <Card className="border-2 border-dashed text-center py-12">
                <CardContent>
                  <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Classes Yet</h3>
                  <p className="text-gray-600 mb-4">Create your first class to get started</p>
                  <Button
                    onClick={() => {
                      resetForm();
                      setActiveTab('create-class');
                    }}
                  >
                    <Plus size={16} />
                    Create First Class
                  </Button>
                </CardContent>
              </Card>
            ) : (
              // Classes Table View
              <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[color:var(--table-border)]">
                      <th className="p-4 font-semibold text-[color:var(--table-header-fg)] text-sm">Class Name</th>
                      <th className="p-4 font-semibold text-[color:var(--table-header-fg)] text-sm">Grade</th>
                      <th className="p-4 font-semibold text-[color:var(--table-header-fg)] text-sm">Stream</th>
                      <th className="p-4 font-semibold text-[color:var(--table-header-fg)] text-sm">Teacher</th>
                      <th className="p-4 font-semibold text-[color:var(--table-header-fg)] text-sm text-center">Capacity</th>
                      <th className="p-4 font-semibold text-[color:var(--table-header-fg)] text-sm">Status</th>
                      <th className="p-4 font-semibold text-[color:var(--table-header-fg)] text-sm text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredClasses.map(classItem => {
                      const teacher = teachers.find(t => t.id === classItem.teacherId);
                      return (
                        <tr key={classItem.id} className="hover:bg-blue-50/30 transition-colors group">
                          <td className="p-4">
                            <p className="font-medium text-gray-900">{classItem.name}</p>
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{classItem.code}</p>
                          </td>
                          <td className="p-4 text-sm text-gray-600 font-medium">{classItem.grade}</td>
                          <td className="p-4 text-sm text-gray-600 font-medium">{classItem.stream || '-'}</td>
                          <td className="p-4">
                            {teacher ? (
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-medium">
                                  {teacher.firstName?.[0]}{teacher.lastName?.[0]}
                                </div>
                                <span className="text-sm font-semibold text-gray-700">
                                  {teacher.firstName} {teacher.lastName}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-gray-400 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-sm font-medium text-gray-700">{classItem.capacity}</span>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classItem.active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {classItem.active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEditClass(classItem)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="Edit Class"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(classItem.id)}
                                className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Remove Class"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'streams' ? (
          // Streams List View
          <div className="space-y-4">
            {/* Streams Table */}
            {streams.length === 0 ? (
              <Card className="border-2 border-dashed text-center py-12">
                <CardContent>
                  <Grid size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Streams Yet</h3>
                  <p className="text-gray-600 mb-4">Create your first stream to get started</p>
                  <Button
                    onClick={() => {
                      resetStreamForm();
                      setActiveTab('create-stream');
                    }}
                  >
                    <Plus size={16} />
                    Create First Stream
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead className="border-b border-[color:var(--table-border)]">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-[color:var(--table-header-fg)]">Stream Name</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-[color:var(--table-header-fg)]">Status</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-[color:var(--table-header-fg)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {streams.map(stream => (
                      <tr key={stream.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-900">{stream.name}</p>
                        </td>
                        <td className="px-6 py-4">
                          {stream.active ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              onClick={() => handleEditStream(stream)}
                              variant="outline"
                              size="sm"
                            >
                              <Edit size={14} />
                            </Button>
                            <Button
                              onClick={() => setDeleteConfirmStream(stream.id)}
                              variant="outline"
                              size="sm"
                              className="text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'create-class' ? (
          // Create/Edit Class Form
          <div className="max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>{editingId ? 'Edit Class' : 'Create New Class'}</CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Class Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Class Name *</Label>
                  <Input
                    id="name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Grade 5 Alpha"
                  />
                  <p className="text-xs text-gray-500">Descriptive name for the class</p>
                </div>

                {/* Class Code */}
                <div className="space-y-2">
                  <Label htmlFor="code">Class Code *</Label>
                  <Input
                    id="code"
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    placeholder="e.g., G5A"
                  />
                  <p className="text-xs text-gray-500">Unique identifier for the class</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Grade */}
                  <div className="space-y-2">
                    <Label htmlFor="grade">Grade *</Label>
                    <select
                      id="grade"
                      name="grade"
                      value={formData.grade}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                    >
                      <option value="">Select Grade</option>
                      {grades.map(grade => (
                        <option key={grade} value={grade}>
                          {grade.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Stream */}
                  <div className="space-y-2">
                    <Label htmlFor="stream">Stream *</Label>
                    <select
                      id="stream"
                      name="stream"
                      value={formData.stream}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                    >
                      <option value="">Select Stream</option>
                      {streams.length > 0 ? (
                        streams.map(s => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))
                      ) : (
                        <option disabled>No streams available</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Capacity */}
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Student Capacity *</Label>
                    <Input
                      id="capacity"
                      type="number"
                      name="capacity"
                      value={formData.capacity}
                      onChange={handleInputChange}
                      min="1"
                    />
                  </div>

                  {/* Teacher */}
                  <div className="space-y-2">
                    <Label htmlFor="teacherId">Class Teacher</Label>
                    <select
                      id="teacherId"
                      name="teacherId"
                      value={formData.teacherId}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                    >
                      <option value="">Assign Teacher (Optional)</option>
                      {teachers.length > 0 ? (
                        teachers.map(teacher => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.firstName} {teacher.lastName}
                          </option>
                        ))
                      ) : (
                        <option disabled>No teachers available</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Branch */}
                {branches.length > 1 && (
                  <div className="space-y-2">
                    <Label htmlFor="branchId">Branch</Label>
                    <select
                      id="branchId"
                      name="branchId"
                      value={formData.branchId}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                    >
                      <option value="">Select Branch</option>
                      {branches.map(branch => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Additional information about this class..."
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    onClick={resetForm}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveClass}
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        {editingId ? 'Update Class' : 'Create Class'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : activeTab === 'create-stream' ? (
          // Create/Edit Stream Form
          <div className="max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>{editingStreamId ? 'Edit Stream' : 'Create New Stream'}</CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Stream Name */}
                <div className="space-y-2">
                  <Label htmlFor="stream-name">Stream Name *</Label>
                  <Input
                    id="stream-name"
                    type="text"
                    value={streamFormData.name}
                    onChange={(e) => setStreamFormData({ ...streamFormData, name: e.target.value })}
                    placeholder="e.g., A, B, C, Alpha, Blue"
                  />
                  <p className="text-xs text-gray-500">Name or code for this stream</p>
                </div>

                {/* Active Status */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="stream-active"
                    checked={streamFormData.active}
                    onChange={(e) => setStreamFormData({ ...streamFormData, active: e.target.checked })}
                    className="w-4 h-4 text-brand-purple rounded focus:ring-2 focus:ring-brand-purple border-gray-300"
                  />
                  <Label htmlFor="stream-active" className="font-normal">Active Stream</Label>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    onClick={() => {
                      resetStreamForm();
                      setActiveTab('streams');
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveStream}
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        {editingStreamId ? 'Update Stream' : 'Create Stream'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>

      {/* Delete Class Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle size={20} className="text-rose-600" />
              Delete Class
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this class? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDeleteClass(deleteConfirm)}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Stream Confirmation Dialog */}
      <Dialog open={!!deleteConfirmStream} onOpenChange={(open) => !open && setDeleteConfirmStream(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle size={20} className="text-rose-600" />
              Delete Stream
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this stream? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmStream(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDeleteStream(deleteConfirmStream)}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notifications */}
      <Toast
        show={showToast}
        message={toastMessage}
        type={toastType}
        onClose={hideNotification}
      />
    </div>
  );
};

export default FacilityManager;
