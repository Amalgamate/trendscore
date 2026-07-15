/**
 * LMS Dashboard Component
 * Overview dashboard for Learning Management System
 *
 * @component LMSDashboard
 */

import React, { useState, useEffect } from 'react';
import { useApi } from '../../../hooks/useApi';
import { usePermissions } from '../../../hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Loader2, TrendingUp, Users, BookOpen, Clock, Eye } from 'lucide-react';

const LMSDashboard = ({
    onNavigateTab,
    onNavigate,
    canManageEnrollments,
    canViewReports,
}) => {
    const { apiCall } = useApi();
    const { can } = usePermissions();
    const [stats, setStats] = useState(null);
    const [recentEnrollments, setRecentEnrollments] = useState([]);
    const [loading, setLoading] = useState(true);

    // When rendered inside LMSManager's tab shell, onNavigateTab + explicit
    // permission flags are passed in. When rendered directly as the
    // "Digital Learning Hub → Dashboard" route, only onNavigate is available —
    // fall back to full-page routes and compute permissions locally so the
    // Quick Actions below always go somewhere real.
    const effectiveCanManageEnrollments = canManageEnrollments ?? can('MANAGE_ENROLLMENTS');
    const effectiveCanViewReports = canViewReports ?? can('VIEW_LEARNING_REPORTS');
    const goTo = (tabKey, fullPageKey) => {
        if (onNavigateTab) onNavigateTab(tabKey);
        else onNavigate?.(fullPageKey);
    };

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            const [statsResponse, enrollmentsResponse] = await Promise.all([
                apiCall('/lms/dashboard/stats'),
                apiCall('/lms/enrollments?page=1&limit=5')
            ]);

            setStats(statsResponse?.data || {});
            setRecentEnrollments(enrollmentsResponse?.data?.enrollments || []);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            setStats({});
            setRecentEnrollments([]);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Enrollments */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Recent Enrollments
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {recentEnrollments.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">No recent enrollments</p>
                        ) : (
                            <div className="space-y-3">
                                {recentEnrollments.map((enrollment) => (
                                    <div key={enrollment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                {enrollment.learner.firstName} {enrollment.learner.lastName}
                                            </p>
                                            <p className="text-sm text-gray-600 flex items-center gap-1.5">
                                                {enrollment.course.title}
                                                {enrollment.course.grade && (
                                                    <span className="text-xs font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{enrollment.course.grade}</span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant={enrollment.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                                {enrollment.status}
                                            </Badge>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {new Date(enrollment.enrolledAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => goTo('courses', 'lms-courses')}
                        >
                            <BookOpen className="h-4 w-4 mr-2" />
                            Browse Learning Areas
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start"
                            disabled={!effectiveCanManageEnrollments}
                            title={!effectiveCanManageEnrollments ? 'You do not have permission to manage enrollments' : undefined}
                            onClick={() => effectiveCanManageEnrollments && goTo('enrollments', 'lms-enrollments')}
                        >
                            <Users className="h-4 w-4 mr-2" />
                            Manage Enrollments
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start"
                            disabled={!effectiveCanViewReports}
                            title={!effectiveCanViewReports ? 'You do not have permission to view learning reports' : undefined}
                            onClick={() => effectiveCanViewReports && goTo('reports', 'learning-analytics')}
                        >
                            <TrendingUp className="h-4 w-4 mr-2" />
                            View Reports
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => goTo('content', 'lms-content')}
                        >
                            <Eye className="h-4 w-4 mr-2" />
                            Content Library
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Learning Hub Overview */}
            <Card>
                <CardHeader>
                    <CardTitle>Learning Hub Overview</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center">
                            <div className="text-3xl font-medium text-blue-600 mb-2">
                                {stats?.totalCourses || 0}
                            </div>
                            <p className="text-gray-600">Learning Area Courses</p>
                            <p className="text-sm text-gray-500">Open for enrollment, PP1 – Grade 9</p>
                        </div>

                        <div className="text-center">
                            <div className="text-3xl font-medium text-green-600 mb-2">
                                {stats?.activeEnrollments || 0}
                            </div>
                            <p className="text-gray-600">Learners Enrolled</p>
                            <p className="text-sm text-gray-500">Across all classes this term</p>
                        </div>

                        <div className="text-center">
                            <div className="text-3xl font-medium text-purple-600 mb-2">
                                {stats?.totalContent || 0}
                            </div>
                            <p className="text-gray-600">Lesson Materials</p>
                            <p className="text-sm text-gray-500">Videos, notes, past papers &amp; more</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default LMSDashboard;