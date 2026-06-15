/**
 * Enrollment Manager Component
 * Manage learner enrollments in LMS courses
 *
 * @component EnrollmentManager
 */

import React, { useState, useEffect } from 'react';
import { usePermissions } from '../../../hooks/usePermissions';
import { useApi } from '../../../hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Loader2, UserPlus, Search, Users, BookOpen, UserX, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const EnrollmentManager = () => {
    const { can } = usePermissions();
    const { apiCall } = useApi();

    const [enrollments, setEnrollments] = useState([]);
    const [courses, setCourses] = useState([]);
    const [learners, setLearners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [courseFilter, setCourseFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Dialog state
    const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);

    // Form states
    const [formData, setFormData] = useState({
        courseId: '',
        learnerId: ''
    });
    const [formLoading, setFormLoading] = useState(false);

    const canManageEnrollments = can('MANAGE_ENROLLMENTS');

    useEffect(() => {
        loadEnrollments();
        loadCourses();
        loadLearners();
    }, [currentPage, searchTerm, statusFilter, courseFilter]);

    const loadEnrollments = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: '10',
                ...(searchTerm && { search: searchTerm }),
                ...(statusFilter !== 'all' && { status: statusFilter }),
                ...(courseFilter !== 'all' && { courseId: courseFilter })
            });

            const response = await apiCall(`/lms/enrollments?${params}`);
            setEnrollments(response?.data?.data || []);
            setTotalPages(response?.data?.pagination?.pages || 1);
        } catch (error) {
            console.error('Failed to load enrollments:', error);
            setEnrollments([]);
            toast.error('Failed to load enrollments');
        } finally {
            setLoading(false);
        }
    };

    const loadCourses = async () => {
        try {
            const response = await apiCall('/lms/courses?page=1&limit=100&status=PUBLISHED');
            setCourses(response?.data?.data || []);
        } catch (error) {
            console.error('Failed to load courses:', error);
            setCourses([]);
        }
    };

    const loadLearners = async () => {
        try {
            // This would typically come from a learners API endpoint
            // For now, we'll use a placeholder or fetch from existing API
            const response = await apiCall('/learners?page=1&limit=100');
            setLearners(response?.data?.data || []);
        } catch (error) {
            console.error('Failed to load learners:', error);
        }
    };

    const handleEnrollLearner = async () => {
        // Validate required fields
        if (!formData.courseId) {
            toast.error('Course selection is required');
            return;
        }
        if (!formData.learnerId) {
            toast.error('Learner selection is required');
            return;
        }

        try {
            setFormLoading(true);
            await apiCall('/lms/enrollments', 'POST', formData);
            toast.success('Learner enrolled successfully');
            setEnrollDialogOpen(false);
            resetForm();
            loadEnrollments();
        } catch (error) {
            console.error('Failed to enroll learner:', error);
            toast.error(error.response?.data?.message || 'Failed to enroll learner');
        } finally {
            setFormLoading(false);
        }
    };

    const handleUnenrollLearner = async (enrollmentId) => {
        if (!window.confirm('Are you sure you want to unenroll this learner?')) return;

        try {
            await apiCall(`/lms/enrollments/${enrollmentId}`, 'DELETE');
            toast.success('Learner unenrolled successfully');
            loadEnrollments();
        } catch (error) {
            console.error('Failed to unenroll learner:', error);
            toast.error('Failed to unenroll learner');
        }
    };

    const resetForm = () => {
        setFormData({
            courseId: '',
            learnerId: ''
        });
    };

    const getStatusBadgeVariant = (status) => {
        switch (status) {
            case 'ACTIVE': return 'default';
            case 'INACTIVE': return 'secondary';
            case 'COMPLETED': return 'outline';
            case 'DROPPED': return 'destructive';
            default: return 'secondary';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'ACTIVE': return <CheckCircle className="h-4 w-4 text-green-600" />;
            case 'INACTIVE': return <XCircle className="h-4 w-4 text-gray-600" />;
            case 'COMPLETED': return <CheckCircle className="h-4 w-4 text-blue-600" />;
            case 'DROPPED': return <XCircle className="h-4 w-4 text-red-600" />;
            default: return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Enrollment Management</h2>
                    <p className="text-gray-600">Manage learner enrollments in courses</p>
                </div>
                {canManageEnrollments && (
                    <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="flex items-center gap-2">
                                <UserPlus className="h-4 w-4" />
                                Enroll Learner
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Enroll Learner in Course</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Course *
                                    </label>
                                    <Select
                                        value={formData.courseId}
                                        onValueChange={(value) => setFormData({...formData, courseId: value})}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select course" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {courses.map((course) => (
                                                <SelectItem key={course.id} value={course.id}>
                                                    {course.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Learner *
                                    </label>
                                    <Select
                                        value={formData.learnerId}
                                        onValueChange={(value) => setFormData({...formData, learnerId: value})}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select learner" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {learners.map((learner) => (
                                                <SelectItem key={learner.id} value={learner.id}>
                                                    {learner.firstName} {learner.lastName} ({learner.admissionNumber})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setEnrollDialogOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleEnrollLearner}
                                        disabled={formLoading}
                                    >
                                        {formLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                        Enroll Learner
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-64">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search enrollments..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-32">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="INACTIVE">Inactive</SelectItem>
                                <SelectItem value="COMPLETED">Completed</SelectItem>
                                <SelectItem value="DROPPED">Dropped</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={courseFilter} onValueChange={setCourseFilter}>
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Course" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Courses</SelectItem>
                                {courses.map((course) => (
                                    <SelectItem key={course.id} value={course.id}>
                                        {course.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Enrollments List */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                        </div>
                    ) : enrollments.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No enrollments found</h3>
                            <p className="text-gray-500">Enroll learners in courses to get started.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {enrollments.map((enrollment) => (
                                <div key={enrollment.id} className="p-4 hover:bg-gray-50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(enrollment.status)}
                                                    <h3 className="text-lg font-medium text-gray-900">
                                                        {enrollment.learner.firstName} {enrollment.learner.lastName}
                                                    </h3>
                                                </div>
                                                <Badge variant={getStatusBadgeVariant(enrollment.status)}>
                                                    {enrollment.status}
                                                </Badge>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                                                <div>
                                                    <span className="font-medium">Admission Number:</span> {enrollment.learner.admissionNumber}
                                                </div>
                                                <div>
                                                    <span className="font-medium">Grade:</span> {enrollment.learner.grade}
                                                </div>
                                                <div>
                                                    <span className="font-medium">Course:</span> {enrollment.course.title}
                                                </div>
                                                <div>
                                                    <span className="font-medium">Subject:</span> {enrollment.course.subject}
                                                </div>
                                                <div>
                                                    <span className="font-medium">Enrolled:</span> {new Date(enrollment.enrolledAt).toLocaleDateString()}
                                                </div>
                                                <div>
                                                    <span className="font-medium">Enrolled by:</span> {enrollment.enrolledBy.firstName} {enrollment.enrolledBy.lastName}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm">
                                                View Progress
                                            </Button>
                                            {canManageEnrollments && enrollment.status === 'ACTIVE' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleUnenrollLearner(enrollment.id)}
                                                >
                                                    <UserX className="h-4 w-4 mr-1" />
                                                    Unenroll
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                        Page {currentPage} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
};

export default EnrollmentManager;
