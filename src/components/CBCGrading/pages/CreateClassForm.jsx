import React, { useState, useEffect } from 'react';
import { ArrowLeft, AlertCircle, Loader, Layers, ArrowRight } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '../../../components/ui';
import { useSchoolData } from '../../../contexts/SchoolDataContext';
import { useAuth } from '../../../hooks/useAuth';
import { getCurrentSchoolId, getStoredUser } from '../../../services/schoolContext';
import usePageNavigation from '../../../hooks/usePageNavigation';
import api, { configAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const CreateClassForm = () => {
  const navigateTo = usePageNavigation();
  const { user } = useAuth();
  const { grades } = useSchoolData();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [streams, setStreams] = useState([]);
  const [schoolId, setSchoolId] = useState(null);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    grade: grades.length > 0 ? grades[0] : 'GRADE_1',
    stream: '',
    branchId: '',
    teacherId: '',
    capacity: 40,
    room: '',
    academicYear: new Date().getFullYear(),
    term: 'TERM_1'
  });

  useEffect(() => {
    let sid = getCurrentSchoolId();
    if (!sid) {
      const storedUser = getStoredUser();
      sid = storedUser?.schoolId || user?.schoolId;
    }
    setSchoolId(sid);

    if (sid) {
      fetchInitialData(sid);
    }
  }, [user]);

  const fetchInitialData = async (sid) => {
    setInitialLoading(true);
    try {
      // Fetch teachers for this school
      const teachersResponse = await api.teachers.getAll({ schoolId: sid });
      setTeachers(Array.isArray(teachersResponse) ? teachersResponse : teachersResponse?.data || []);

      // Fetch branches for this school
      const branchesResponse = await api.admin.getBranches(sid);
      const branchesData = Array.isArray(branchesResponse) ? branchesResponse : branchesResponse?.data || [];
      setBranches(branchesData);

      // Fetch configured streams for this school
      const streamsResponse = await configAPI.getStreamConfigs();
      const streamsData = Array.isArray(streamsResponse)
        ? streamsResponse
        : streamsResponse?.data || [];
      setStreams(streamsData);

      // Set defaults
      setFormData(prev => ({
        ...prev,
        ...(branchesData.length === 1 ? { branchId: branchesData[0].id } : {}),
        stream: streamsData.length > 0 ? streamsData[0].name : ''
      }));
    } catch (error) {
      console.error('Error fetching initial data:', error);
      setError('Failed to load form data');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'capacity' || name === 'academicYear' ? parseInt(value) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate required fields
      if (!formData.grade || !formData.branchId) {
        throw new Error('Please fill in all required fields');
      }

      if (streams.length === 0) {
        throw new Error('Please configure at least one stream in Academic Settings before creating a class.');
      }

      // Auto-generate name if not provided
      const finalName = formData.name || `${formData.grade.replace(/_/g, ' ')} ${formData.stream}`.trim();

      // Call API to create class
      await api.classes.create({
        ...formData,
        name: finalName
      });

      toast.success('Class created successfully!');
      navigateTo('classes');
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to create class';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button onClick={() => navigateTo('classes')} variant="ghost" size="sm">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Create New Class</h1>
          <p className="text-sm text-gray-500 mt-1">Add a new class to your school. Class code will be auto-generated.</p>
        </div>
      </div>

      {/* No Streams Warning Dialog */}
      {!initialLoading && streams.length === 0 && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-700 mt-0.5">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-amber-900">No Streams Configured</h3>
              <p className="text-sm text-amber-800 mt-1">
                Your school does not have any streams configured yet (e.g. Blue, Green). Classes require a stream so learners can be grouped and enrolled correctly.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              onClick={() => navigateTo('academic-settings')}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-2"
            >
              Configure Streams in Academic Settings <ArrowRight size={14} className="ml-1" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigateTo('classes')}
              className="text-xs px-3 py-2 border-amber-300 text-amber-800 hover:bg-amber-100"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Class Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Error</p>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Grade & Stream */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grade *
                </label>
                <select
                  name="grade"
                  value={formData.grade}
                  onChange={handleChange}
                  required
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stream *
                </label>
                <select
                  name="stream"
                  value={formData.stream}
                  onChange={handleChange}
                  required
                  disabled={streams.length === 0}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
                >
                  {streams.length === 0 ? (
                    <option value="">No streams created yet</option>
                  ) : (
                    streams.map(s => (
                      <option key={s.id || s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))
                  )}
                </select>
                {streams.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Please create streams first.</p>
                )}
              </div>
            </div>

            {/* Class Name & Room */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Class Name (Optional)
                </label>
                <Input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Grade 5 Alpha"
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Leave blank to auto-generate</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Room/Location
                </label>
                <Input
                  type="text"
                  name="room"
                  value={formData.room}
                  onChange={handleChange}
                  placeholder="e.g., Room 301"
                  className="w-full"
                />
              </div>
            </div>

            {/* Branch & Capacity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Branch/Campus *
                </label>
                <select
                  name="branchId"
                  value={formData.branchId}
                  onChange={handleChange}
                  required
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacity
                </label>
                <Input
                  type="number"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleChange}
                  min="1"
                  max="100"
                  className="w-full"
                />
              </div>
            </div>

            {/* Teacher Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Class Teacher (Optional)
              </label>
              <select
                name="teacherId"
                value={formData.teacherId}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
              >
                <option value="">-- Assign Later --</option>
                {teachers.map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.firstName} {teacher.lastName}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Can be assigned or changed later</p>
            </div>

            {/* Academic Context */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Academic Year
                </label>
                <Input
                  type="number"
                  name="academicYear"
                  value={formData.academicYear}
                  onChange={handleChange}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Term
                </label>
                <select
                  name="term"
                  value={formData.term}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                >
                  <option value="TERM_1">Term 1</option>
                  <option value="TERM_2">Term 2</option>
                  <option value="TERM_3">Term 3</option>
                </select>
              </div>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Class Code:</strong> Will be auto-generated by the system (e.g., CLS-00001)
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigateTo('classes')}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-brand-purple hover:bg-brand-purple/90"
              >
                {loading ? (
                  <>
                    <Loader size={18} className="animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create Class'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateClassForm;
