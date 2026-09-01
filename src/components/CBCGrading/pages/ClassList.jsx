/**
 * ClassList Component
 * Displays all classes in a detailed list view
 * Click to navigate to class detail page
 */

import React, { useState, useEffect } from 'react';
import { Users, GraduationCap, BookOpen, AlertCircle, Loader, Search, Filter, Plus } from 'lucide-react';
import { configAPI } from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth';
import { getCurrentSchoolId, getStoredUser } from '../../../services/schoolContext';
import usePageNavigation from '../../../hooks/usePageNavigation';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '../../../components/ui';
import TeacherClassAssignmentModal from '../shared/TeacherClassAssignmentModal';
import { useNotifications } from '../hooks/useNotifications';
import { useSchoolData } from '../../../contexts/SchoolDataContext';
import { useRefreshListener } from '../../../utils/refreshBus';

const ClassList = () => {
  const navigateTo = usePageNavigation();
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('ALL');
  const [schoolId, setSchoolId] = useState(null);
  const [selectedClassForAssignment, setSelectedClassForAssignment] = useState(null);
  const { showSuccess } = useNotifications();
  const { grades } = useSchoolData();

  useEffect(() => {
    let sid = getCurrentSchoolId();
    if (!sid) {
      const storedUser = getStoredUser();
      sid = storedUser?.schoolId || user?.schoolId;
    }
    setSchoolId(sid);

    if (sid) {
      fetchClasses(sid);
    }
  }, [user]);

  // Auto-refresh when any save in AcademicSettings fires the 'classes' event
  useRefreshListener('classes', () => {
    const sid = schoolId || getCurrentSchoolId();
    if (sid) fetchClasses(sid);
  });

  const fetchClasses = async (sid) => {
    setLoading(true);
    try {
      const response = await configAPI.getClasses(sid);
      const classesData = Array.isArray(response) ? response : response.data || [];
      setClasses(classesData);
    } catch (error) {
      console.error('Failed to fetch classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClasses = classes.filter(classItem => {
    const matchesSearch =
      classItem.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      classItem.grade?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesGrade = filterGrade === 'ALL' || classItem.grade === filterGrade;

    return matchesSearch && matchesGrade;
  });

  const getUtilizationColor = (utilization) => {
    if (utilization >= 90) return 'bg-red-100 text-red-900';
    if (utilization >= 75) return 'bg-yellow-100 text-yellow-900';
    return 'bg-green-100 text-green-900';
  };

  const getGenderSplit = (students, capacity) => {
    // Mock gender split - would come from actual data
    const male = Math.round(students * 0.52);
    const female = students - male;
    return { male, female };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Classes</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and view detailed class information</p>
        </div>
        <Button
          onClick={() => navigateTo('create-class')}
          className="bg-brand-purple hover:bg-brand-purple/90"
        >
          <Plus size={18} />
          New Class
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-2">
          <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          <Input
            placeholder="Search classes by name or grade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={filterGrade}
          onChange={(e) => setFilterGrade(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple"
        >
          <option value="ALL">All Grades</option>
          {grades.map(g => (
            <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Classes List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader size={32} className="animate-spin text-brand-purple" />
        </div>
      ) : filteredClasses.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="py-12 text-center">
            <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600">No classes found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredClasses.map(classItem => {
            const studentCount = classItem._count?.enrollments || 0;
            const { male, female } = getGenderSplit(studentCount, classItem.capacity || 40);
            const utilization = (studentCount / (classItem.capacity || 40)) * 100;
            const teacherName = classItem.teacher 
              ? `${classItem.teacher.firstName} ${classItem.teacher.lastName}` 
              : 'Unassigned';

            return (
              <Card
                key={classItem.id}
                className="hover:shadow-lg hover:border-brand-purple transition-all cursor-pointer"
                onClick={() => navigateTo('class-detail', { classId: classItem.id })}
              >
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Class Info */}
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{classItem.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">Stream: {classItem.stream || '—'}</p>
                      <p className="text-xs text-gray-400 mt-1">Academic Year: {classItem.academicYear}</p>
                    </div>

                    {/* Teacher Info */}
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-100 flex flex-col justify-between group/teacher relative">
                      <div>
                        <p className="text-xs font-medium text-amber-900 uppercase tracking-tight mb-2">Teacher</p>
                        <p className="text-sm font-medium text-gray-900">{teacherName}</p>
                        {classItem.teacher?.phone && (
                          <p className="text-xs text-gray-600 mt-2">{classItem.teacher.phone}</p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClassForAssignment(classItem);
                        }}
                        className="mt-3 text-[10px] h-6 border-amber-200 text-amber-700 hover:bg-amber-100 opacity-60 group-hover/teacher:opacity-100 transition-opacity"
                      >
                        {classItem.teacher ? 'Change' : 'Assign'}
                      </Button>
                    </div>

                    {/* Student Stats */}
                    <div className="space-y-3">
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 text-center">
                        <p className="text-xs font-medium text-blue-900 uppercase tracking-tight mb-1">Enrollment</p>
                        <p className="text-2xl font-semibold text-blue-600">{studentCount}/{classItem.capacity}</p>
                        <div className="flex justify-center gap-2 mt-2 text-xs font-medium">
                          <span className="text-blue-700">♂ {male}</span>
                          <span className="text-pink-600">♀ {female}</span>
                        </div>
                      </div>
                    </div>

                    {/* Utilization & Room */}
                    <div className="space-y-3">
                      <div className={`rounded-lg p-3 border text-center ${getUtilizationColor(utilization)}`}>
                        <p className="text-xs font-medium uppercase tracking-tight mb-1">Utilization</p>
                        <p className="text-2xl font-semibold">{Math.round(utilization)}%</p>
                        <div className="w-full bg-current bg-opacity-20 rounded-full h-1.5 mt-2">
                          <div
                            className="bg-current h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.min(utilization, 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-100 text-center">
                        <p className="text-xs font-medium text-purple-900 uppercase tracking-tight">Room</p>
                        <p className="text-sm font-semibold text-purple-900 mt-1">{classItem.room || 'TBD'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                    <Button
                      onClick={() => navigateTo('class-detail', { classId: classItem.id })}
                      variant="ghost"
                      className="text-brand-purple hover:bg-brand-purple/10"
                    >
                      View Details →
                    </Button>
                    <span className="text-xs text-gray-400">Click to expand</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <TeacherClassAssignmentModal
        isOpen={!!selectedClassForAssignment}
        onClose={() => setSelectedClassForAssignment(null)}
        classData={selectedClassForAssignment}
        onAssignmentComplete={() => fetchClasses(schoolId)}
      />
    </div>
  );
};

export default ClassList;
