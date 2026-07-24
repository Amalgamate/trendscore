/**
 * LMS Manager Component
 * Main component for Learning Management System functionality
 *
 * @component LMSManager
 */

import React, { useState, useEffect } from 'react';
import { usePermissions } from '../../../hooks/usePermissions';
import { useApi } from '../../../hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Loader2, BookOpen, Users, BarChart3, Plus, Video, FileText, Headphones } from 'lucide-react';
import CourseManager from './CourseManager';
import ContentLibrary from './ContentLibrary';
import EnrollmentManager from './EnrollmentManager';
import ProgressReports from './ProgressReports';
import LearningAnalyticsPage from './lms/analytics/LearningAnalyticsPage';

const LMSManager = ({ currentPage = 'lms-courses' }) => {
    const { can } = usePermissions();
    const { apiCall } = useApi();
    
    // Map currentPage to tab name
    const pageToTabMap = {
        'lms-courses': 'courses',
        'lms-content': 'content',
        'lms-enrollments': 'enrollments',
        'lms-progress': 'progress',
        'lms-reports': 'reports'
    };
    
    const [activeTab, setActiveTab] = useState(pageToTabMap[currentPage] || 'dashboard');
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [createCourseOpen, setCreateCourseOpen] = useState(false);

    useEffect(() => {
        // Update active tab when currentPage changes
        setActiveTab(pageToTabMap[currentPage] || 'dashboard');
    }, [currentPage]);

    useEffect(() => {
        loadDashboardStats();
    }, []);

    const loadDashboardStats = async () => {
        try {
            const response = await apiCall('/lms/dashboard/stats');
            setStats(response?.data?.data || null);
        } catch (error) {
            console.error('Failed to load LMS dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const canAccessLMS = can('ACCESS_LMS');
    const canCreateCourses = can('CREATE_COURSES');
    const canManageEnrollments = can('MANAGE_ENROLLMENTS');
    const canViewReports = can('VIEW_LEARNING_REPORTS');

    if (!canAccessLMS) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
                    <p className="text-gray-500">You don't have permission to access the Learning Management System.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-medium text-gray-900">Digital Learning Hub</h1>
                    <p className="text-gray-600">Learning Area courses, lesson materials and learner progress across PP1 – Grade 9</p>
                </div>
                {canCreateCourses && (
                    <Button
                        onClick={() => { setActiveTab('courses'); setCreateCourseOpen(true); }}
                        className="flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Create Course
                    </Button>
                )}
            </div>

            {/* Quick Stats */}
            {loading ? (
                <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <BookOpen className="h-8 w-8 text-blue-600" />
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Learning Area Courses</p>
                                    <p className="text-2xl font-medium text-gray-900">{stats.totalCourses}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <Users className="h-8 w-8 text-green-600" />
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Learners Enrolled</p>
                                    <p className="text-2xl font-medium text-gray-900">{stats.activeEnrollments}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <Video className="h-8 w-8 text-purple-600" />
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Lesson Materials</p>
                                    <p className="text-2xl font-medium text-gray-900">{stats.totalContent}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <BarChart3 className="h-8 w-8 text-orange-600" />
                                <div>
                                    <p className="text-sm font-medium text-gray-600">All-Time Enrollments</p>
                                    <p className="text-2xl font-medium text-gray-900">{stats.totalEnrollments}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Main Content Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                    <TabsTrigger value="courses">Courses</TabsTrigger>
                    <TabsTrigger value="content">Content Library</TabsTrigger>
                    {canManageEnrollments && <TabsTrigger value="enrollments">Enrollments</TabsTrigger>}
                    {canViewReports && <TabsTrigger value="reports">Reports</TabsTrigger>}
                </TabsList>

                <TabsContent value="dashboard" className="mt-6">
                    <LearningAnalyticsPage />
                </TabsContent>

                <TabsContent value="courses" className="mt-6">
                    <CourseManager createDialogOpen={createCourseOpen} setCreateDialogOpen={setCreateCourseOpen} />
                </TabsContent>

                <TabsContent value="content" className="mt-6">
                    <ContentLibrary />
                </TabsContent>

                {canManageEnrollments && (
                    <TabsContent value="enrollments" className="mt-6">
                        <EnrollmentManager />
                    </TabsContent>
                )}

                {canViewReports && (
                    <TabsContent value="reports" className="mt-6">
                        <ProgressReports />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
};

export default LMSManager;
