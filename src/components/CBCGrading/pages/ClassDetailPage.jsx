/**
 * ClassDetailPage
 * Comprehensive class detail view with multiple tabs
 * Tabs: Overview, Inventory, Schedule, Facilities, Enrollments, Performance
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, BookOpen, Package, Calendar, Zap, Users, TrendingUp,
  Loader, AlertCircle, Plus, Edit, Trash2
} from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../../../components/ui';
import ClassInventoryTab from './ClassInventoryTab';
import ClassScheduleTab from './ClassScheduleTab';
import ClassFacilityTab from './ClassFacilityTab';
import usePageNavigation from '../../../hooks/usePageNavigation';
import api from '../../../services/api';
import TeacherClassAssignmentModal from '../shared/TeacherClassAssignmentModal';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../../../hooks/useAuth';
import './ClassDetailPage.css';

const TABS = {
  OVERVIEW: 'overview',
  INVENTORY: 'inventory',
  SCHEDULE: 'schedule',
  FACILITIES: 'facilities',
  ENROLLMENTS: 'enrollments',
  PERFORMANCE: 'performance'
};

// Get classId from window storage or props
const getClassId = () => {
  // If called from CBCGradingSystem with pageParams
  const stored = sessionStorage.getItem('currentClassId');
  return stored;
};

const ClassDetailPage = ({ pageParams }) => {
  const navigateTo = usePageNavigation();
  const classId = pageParams?.classId || getClassId();
  const [activeTab, setActiveTab] = useState(TABS.OVERVIEW);
  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const { showSuccess } = useNotifications();

  useEffect(() => {
    if (classId) {
      sessionStorage.setItem('currentClassId', classId);
      fetchClassDetails();
    }
  }, [classId, refreshTrigger]);

  const fetchClassDetails = async () => {
    setLoading(true);
    try {
      const response = await api.classes.getAllClassData(classId);
      setClassData(response);
    } catch (error) {
      console.error('Failed to fetch class details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const TabButton = ({ tabId, label, icon: Icon }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-all ${activeTab === tabId
        ? 'border-brand-purple text-brand-purple'
        : 'border-transparent text-gray-600 hover:text-gray-900'
        }`}
    >
      <Icon size={18} />
      {label}
    </button>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader size={32} className="animate-spin text-brand-purple" />
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="p-6">
        <Button onClick={() => navigateTo('classes')} variant="ghost">
          <ArrowLeft size={18} />
          Back
        </Button>
        <Card className="mt-4">
          <CardContent className="py-12 text-center">
            <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600">Class not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button onClick={() => navigateTo('classes')} variant="ghost" size="sm">
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-gray-900">{classData.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Grade: {classData.grade} • Stream: {classData.stream || 'A'} • Academic Year: {classData.academicYear}</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-600 font-medium uppercase">Students</p>
            <p className="text-2xl font-semibold text-blue-600 mt-1">{classData.studentCount || 0}</p>
            <p className="text-xs text-gray-500 mt-1">{classData.capacity - (classData.studentCount || 0)} Available</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden group">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-600 font-medium uppercase">Teacher</p>
            <p className="text-sm font-semibold text-amber-900 mt-1 truncate">{classData.teacher?.firstName || 'Unassigned'}</p>
            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="absolute inset-0 bg-brand-purple/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-brand-purple font-medium text-xs"
            >
              Change
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-600 font-medium uppercase">Inventory</p>
            <p className="text-2xl font-semibold text-green-600 mt-1">{classData.inventoryCount || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-600 font-medium uppercase">Schedule</p>
            <p className="text-2xl font-semibold text-purple-600 mt-1">{classData.scheduleCount || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-600 font-medium uppercase">Facilities</p>
            <p className="text-2xl font-semibold text-red-600 mt-1">{classData.facilitiesCount || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 flex overflow-x-auto bg-white rounded-t-lg">
        <TabButton tabId={TABS.OVERVIEW} label="Overview" icon={BookOpen} />
        <TabButton tabId={TABS.INVENTORY} label="Inventory" icon={Package} />
        <TabButton tabId={TABS.SCHEDULE} label="Schedule" icon={Calendar} />
        <TabButton tabId={TABS.FACILITIES} label="Facilities" icon={Zap} />
        <TabButton tabId={TABS.ENROLLMENTS} label="Enrollments" icon={Users} />
        <TabButton tabId={TABS.PERFORMANCE} label="Performance" icon={TrendingUp} />
      </div>

      {/* Tab Content */}
      <div>
        {/* OVERVIEW TAB */}
        {activeTab === TABS.OVERVIEW && (
          <OverviewTab
            classData={classData}
            onAssignTeacher={() => setIsAssignModalOpen(true)}
          />
        )}

        {/* INVENTORY TAB */}
        {activeTab === TABS.INVENTORY && classData && (
          <ClassInventoryTab
            classData={classData}
            onRefresh={handleRefresh}
          />
        )}

        {/* SCHEDULE TAB */}
        {activeTab === TABS.SCHEDULE && classData && (
          <ClassScheduleTab
            classData={classData}
            onRefresh={handleRefresh}
          />
        )}

        {/* FACILITIES TAB */}
        {activeTab === TABS.FACILITIES && classData && (
          <ClassFacilityTab
            classData={classData}
            onRefresh={handleRefresh}
          />
        )}

        {/* ENROLLMENTS TAB */}
        {activeTab === TABS.ENROLLMENTS && (
          <EnrollmentsTab classData={classData} />
        )}

        {/* PERFORMANCE TAB */}
        {activeTab === TABS.PERFORMANCE && (
          <PerformanceTab classData={classData} />
        )}
      </div>

      <TeacherClassAssignmentModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        classData={classData}
        onAssignmentComplete={fetchClassDetails}
      />
    </div>
  );
};

const OverviewTab = ({ classData, onAssignTeacher }) => (
  <Card>
    <CardHeader>
      <CardTitle>Class Overview</CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-600 uppercase">Class Name</p>
            <p className="text-lg font-medium text-gray-900 mt-1">{classData.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 uppercase">Grade</p>
            <p className="text-lg font-medium text-gray-900 mt-1">{classData.grade}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 uppercase">Stream</p>
            <p className="text-lg font-medium text-gray-900 mt-1">{classData.stream || 'A'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 uppercase">Academic Year</p>
            <p className="text-lg font-medium text-gray-900 mt-1">{classData.academicYear}</p>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-600 uppercase">Class Teachers</p>
            <div className="flex items-center justify-between">
              <p className="text-lg font-medium text-gray-900 mt-1">
                {(classData.teacherAssignments?.length
                  ? classData.teacherAssignments.map(({ teacher }) => teacher).filter(Boolean)
                  : [classData.teacher].filter(Boolean))
                  .map((teacher) => `${teacher.firstName} ${teacher.lastName}`)
                  .join(', ') || 'Unassigned'}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onAssignTeacher}
                className="text-xs h-7 border-brand-purple text-brand-purple hover:bg-brand-purple/10"
              >
                {classData.teacher || classData.teacherAssignments?.length ? 'Manage' : 'Assign'}
              </Button>
            </div>
            {classData.teacher?.phone && <p className="text-xs text-gray-500 mt-1">{classData.teacher.phone}</p>}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 uppercase">Classroom</p>
            <p className="text-lg font-medium text-gray-900 mt-1">{classData.room || 'TBD'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 uppercase">Capacity</p>
            <p className="text-lg font-medium text-gray-900 mt-1">{classData.capacity} Students</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 uppercase">Current Enrollment</p>
            <p className="text-lg font-medium text-blue-600 mt-1">{classData.studentCount || 0}</p>
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-6 border-t">
        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-xs font-medium text-blue-900">Utilization</p>
          <p className="text-xl font-semibold text-blue-600 mt-1">{Math.round(((classData.studentCount || 0) / classData.capacity) * 100)}%</p>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <p className="text-xs font-medium text-green-900">Available Seats</p>
          <p className="text-xl font-semibold text-green-600 mt-1">{classData.capacity - (classData.studentCount || 0)}</p>
        </div>
        <div className="bg-purple-50 p-3 rounded-lg">
          <p className="text-xs font-medium text-purple-900">Inventory Items</p>
          <p className="text-xl font-semibold text-purple-600 mt-1">{classData.inventoryCount || 0}</p>
        </div>
        <div className="bg-amber-50 p-3 rounded-lg">
          <p className="text-xs font-medium text-amber-900">Facilities</p>
          <p className="text-xl font-semibold text-amber-600 mt-1">{classData.facilitiesCount || 0}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const EnrollmentsTab = ({ classData }) => (
  <div className="space-y-4">
    <h3 className="text-lg font-medium">Enrolled Students ({classData.studentCount || 0})</h3>

    {classData.enrollments && classData.enrollments.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-[color:var(--table-border)]">
              <th className="text-left p-3 font-semibold text-[color:var(--table-header-fg)]">Admission No.</th>
              <th className="text-left p-3 font-semibold text-[color:var(--table-header-fg)]">Name</th>
              <th className="text-left p-3 font-semibold text-[color:var(--table-header-fg)]">Gender</th>
              <th className="text-left p-3 font-semibold text-[color:var(--table-header-fg)]">Enrolled</th>
            </tr>
          </thead>
          <tbody>
            {classData.enrollments.map(enrollment => (
              <tr key={enrollment.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{enrollment.learner?.admissionNumber}</td>
                <td className="p-3">{enrollment.learner?.firstName} {enrollment.learner?.lastName}</td>
                <td className="p-3">{enrollment.learner?.gender === 'MALE' ? '♂ Male' : '♀ Female'}</td>
                <td className="p-3 text-xs text-gray-500">{new Date(enrollment.enrolledAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Card className="border-2 border-dashed">
        <CardContent className="py-8 text-center text-gray-500">
          No students enrolled yet
        </CardContent>
      </Card>
    )}
  </div>
);

const PerformanceTab = ({ classData }) => (
  <Card>
    <CardHeader>
      <CardTitle>Class Performance Analytics</CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-xs font-medium text-blue-900 uppercase">Average Score</p>
          <p className="text-3xl font-semibold text-blue-600 mt-2">78.5%</p>
          <p className="text-xs text-blue-700 mt-1">↑ 2.3% from last term</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <p className="text-xs font-medium text-green-900 uppercase">Pass Rate</p>
          <p className="text-3xl font-semibold text-green-600 mt-2">92%</p>
          <p className="text-xs text-green-700 mt-1">{Math.round((classData.studentCount || 0) * 0.92)} of {classData.studentCount || 0} passed</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <p className="text-xs font-medium text-purple-900 uppercase">Attendance</p>
          <p className="text-3xl font-semibold text-purple-600 mt-2">94%</p>
          <p className="text-xs text-purple-700 mt-1">Average attendance rate</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default ClassDetailPage;
