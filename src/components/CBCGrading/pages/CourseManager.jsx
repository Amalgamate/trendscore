/**
 * Course Manager Component
 * Manage LMS courses - create, edit, delete, and view courses
 *
 * @component CourseManager
 */

import React, { useState, useEffect } from 'react';
import { usePermissions } from '../../../hooks/usePermissions';
import { useApi } from '../../../hooks/useApi';
import { configAPI } from '../../../services/api/config.api';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Textarea } from '../../ui/textarea';
import { Loader2, Plus, Edit, Trash2, Search, BookOpen, Users, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';

const CourseManager = ({ createDialogOpen: externalOpen, setCreateDialogOpen: setExternalOpen } = {}) => {
    const { can } = usePermissions();
    const { apiCall } = useApi();

    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [gradeFilter, setGradeFilter] = useState('all');
    const [subjectFilter, setSubjectFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Dynamic data
    const [learningAreas, setLearningAreas] = useState([]);
    const [grades, setGrades] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);

    // Dialog states
    const [internalOpen, setInternalOpen] = useState(false);
    const createDialogOpen = externalOpen !== undefined ? externalOpen : internalOpen;
    const setCreateDialogOpen = setExternalOpen || setInternalOpen;
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState(null);

    // Form states
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        subject: '',
        grade: '',
        category: '',
        status: 'DRAFT'
    });
    const [formLoading, setFormLoading] = useState(false);

    const canCreateCourses = can('CREATE_COURSES');
    const canEditCourses = can('EDIT_COURSES');
    const canDeleteCourses = can('DELETE_COURSES');

    useEffect(() => {
        loadDynamicData();
    }, []);

    useEffect(() => {
        loadCourses();
    }, [currentPage, searchTerm, statusFilter, gradeFilter, subjectFilter]);

    const loadDynamicData = async () => {
        try {
            setDataLoading(true);
            console.log('Loading dynamic data...');
            const [learningAreasResponse, gradesResponse] = await Promise.all([
                configAPI.getLearningAreas(),
                configAPI.getGrades()
            ]);

            console.log('Learning areas response:', learningAreasResponse);
            console.log('Grades response:', gradesResponse);

            setLearningAreas(learningAreasResponse?.data || []);
            setGrades(gradesResponse?.data || []);
            console.log('Set learning areas:', learningAreasResponse?.data || []);
            console.log('Set grades:', gradesResponse?.data || []);
        } catch (error) {
            console.error('Failed to load dynamic data:', error);
            setLearningAreas([]);
            setGrades([]);
        } finally {
            setDataLoading(false);
        }
    };

    const loadCourses = async () => {
        try {
            setLoading(true);
            console.log('Loading courses...');
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: '10',
                ...(searchTerm && { search: searchTerm }),
                ...(statusFilter !== 'all' && { status: statusFilter }),
                ...(gradeFilter !== 'all' && { grade: gradeFilter }),
                ...(subjectFilter !== 'all' && { subject: subjectFilter })
            });

            console.log('Courses API call:', `/lms/courses?${params}`);
            const response = await apiCall(`/lms/courses?${params}`);
            console.log('Courses response:', response);
            // Backend returns { success, data: [...], pagination }
            setCourses(response?.data?.data || []);
            setTotalPages(response?.data?.pagination?.pages || 1);
            console.log('Set courses:', response?.data?.data || []);
        } catch (error) {
            console.error('Failed to load courses:', error);
            setCourses([]);
            toast.error('Failed to load courses');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCourse = async () => {
        // Validate required fields
        if (!formData.title.trim()) {
            toast.error('Course title is required');
            return;
        }
        if (!formData.subject) {
            toast.error('Subject selection is required');
            return;
        }
        if (!formData.grade) {
            toast.error('Grade selection is required');
            return;
        }
        if (!formData.category.trim()) {
            toast.error('Category is required');
            return;
        }

        try {
            setFormLoading(true);
            await apiCall('/lms/courses', 'POST', formData);
            toast.success('Course created successfully');
            setCreateDialogOpen(false);
            resetForm();
            loadCourses();
        } catch (error) {
            console.error('Failed to create course:', error);
            toast.error('Failed to create course');
        } finally {
            setFormLoading(false);
        }
    };

    const handleEditCourse = async () => {
        // Validate required fields
        if (!formData.title.trim()) {
            toast.error('Course title is required');
            return;
        }
        if (!formData.subject) {
            toast.error('Subject selection is required');
            return;
        }
        if (!formData.grade) {
            toast.error('Grade selection is required');
            return;
        }
        if (!formData.category.trim()) {
            toast.error('Category is required');
            return;
        }

        try {
            setFormLoading(true);
            await apiCall(`/lms/courses/${selectedCourse.id}`, 'PUT', formData);
            toast.success('Course updated successfully');
            setEditDialogOpen(false);
            resetForm();
            loadCourses();
        } catch (error) {
            console.error('Failed to update course:', error);
            toast.error('Failed to update course');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteCourse = async (courseId) => {
        if (!window.confirm('Are you sure you want to delete this course?')) return;

        try {
            await apiCall(`/lms/courses/${courseId}`, 'DELETE');
            toast.success('Course deleted successfully');
            loadCourses();
        } catch (error) {
            console.error('Failed to delete course:', error);
            toast.error('Failed to delete course');
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            subject: '',
            grade: '',
            category: '',
            status: 'DRAFT'
        });
        setSelectedCourse(null);
    };

    const openEditDialog = (course) => {
        setSelectedCourse(course);
        setFormData({
            title: course.title,
            description: course.description || '',
            subject: course.subject,
            grade: course.grade,
            category: course.category,
            status: course.status
        });
        setEditDialogOpen(true);
    };

    const getStatusBadgeVariant = (status) => {
        switch (status) {
            case 'PUBLISHED': return 'default';
            case 'DRAFT': return 'secondary';
            case 'ARCHIVED': return 'outline';
            default: return 'secondary';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Course Management</h2>
                    <p className="text-gray-600">Create and manage learning courses</p>
                </div>
            </div>

            {/* Create Course Dialog */}
            {canCreateCourses && (
                    <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <span className="hidden" />  
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Create New Course</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Title *
                                    </label>
                                    <Input
                                        value={formData.title}
                                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                                        placeholder="Course title"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <Textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                                        placeholder="Course description"
                                        rows={3}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Subject *
                                        </label>
                                        <Select
                                            value={formData.subject}
                                            onValueChange={(value) => setFormData({...formData, subject: value})}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select subject" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {learningAreas.map((area) => (
                                                    <SelectItem key={area.id} value={area.name}>
                                                        {area.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Grade *
                                        </label>
                                        <Select
                                            value={formData.grade}
                                            onValueChange={(value) => setFormData({...formData, grade: value})}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select grade" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {grades.map((grade) => (
                                                    <SelectItem key={grade.id} value={grade.name}>
                                                        {grade.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Category *
                                        </label>
                                        <Input
                                            value={formData.category}
                                            onChange={(e) => setFormData({...formData, category: e.target.value})}
                                            placeholder="e.g., Core Subject"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Status
                                        </label>
                                        <Select
                                            value={formData.status}
                                            onValueChange={(value) => setFormData({...formData, status: value})}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="DRAFT">Draft</SelectItem>
                                                <SelectItem value="PUBLISHED">Published</SelectItem>
                                                <SelectItem value="ARCHIVED">Archived</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setCreateDialogOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleCreateCourse}
                                        disabled={formLoading}
                                    >
                                        {formLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                        Create Course
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-64">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search courses..."
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
                                <SelectItem value="DRAFT">Draft</SelectItem>
                                <SelectItem value="PUBLISHED">Published</SelectItem>
                                <SelectItem value="ARCHIVED">Archived</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={gradeFilter} onValueChange={setGradeFilter}>
                            <SelectTrigger className="w-32">
                                <SelectValue placeholder="Grade" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Grades</SelectItem>
                                <SelectItem value="Grade 10">Grade 10</SelectItem>
                                <SelectItem value="Grade 11">Grade 11</SelectItem>
                                <SelectItem value="Grade 12">Grade 12</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Courses List */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                        </div>
                    ) : courses.length === 0 ? (
                        <div className="text-center py-12">
                            <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
                            <p className="text-gray-500">Get started by creating your first course.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {courses.map((course) => (
                                <div key={course.id} className="p-4 hover:bg-gray-50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-medium text-gray-900">
                                                    {course.title}
                                                </h3>
                                                <Badge variant={getStatusBadgeVariant(course.status)}>
                                                    {course.status}
                                                </Badge>
                                            </div>
                                            <p className="text-gray-600 mb-2">{course.description}</p>
                                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                                <span>{course.subject}</span>
                                                <span>{course.grade}</span>
                                                <span>{course.category}</span>
                                                <span className="flex items-center gap-1">
                                                    <Users className="h-4 w-4" />
                                                    {course._count.enrollments} enrolled
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <BookOpen className="h-4 w-4" />
                                                    {course._count.content} items
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            {canEditCourses && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openEditDialog(course)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {canDeleteCourses && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDeleteCourse(course.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
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

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Course</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Title *
                            </label>
                            <Input
                                value={formData.title}
                                onChange={(e) => setFormData({...formData, title: e.target.value})}
                                placeholder="Course title"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                placeholder="Course description"
                                rows={3}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Subject *
                                </label>
                                <Select
                                    value={formData.subject}
                                    onValueChange={(value) => setFormData({...formData, subject: value})}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select subject" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {learningAreas.map((area) => (
                                            <SelectItem key={area.id} value={area.name}>
                                                {area.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Grade *
                                </label>
                                <Select
                                    value={formData.grade}
                                    onValueChange={(value) => setFormData({...formData, grade: value})}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select grade" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {grades.map((grade) => (
                                            <SelectItem key={grade.id} value={grade.name}>
                                                {grade.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Category *
                                </label>
                                <Input
                                    value={formData.category}
                                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                                    placeholder="e.g., Core Subject"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Status
                                </label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(value) => setFormData({...formData, status: value})}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DRAFT">Draft</SelectItem>
                                        <SelectItem value="PUBLISHED">Published</SelectItem>
                                        <SelectItem value="ARCHIVED">Archived</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setEditDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleEditCourse}
                                disabled={formLoading}
                            >
                                {formLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                Update Course
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CourseManager;
