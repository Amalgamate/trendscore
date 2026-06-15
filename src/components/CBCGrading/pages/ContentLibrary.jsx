/**
 * Content Library Component
 * Manage LMS content - upload and organize videos, audio, PDFs, and other materials
 *
 * @component ContentLibrary
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
import { Textarea } from '../../ui/textarea';
import { Loader2, Upload, Search, Video, FileText, Headphones, Link, Trash2, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';

const ContentLibrary = () => {
    const { can } = usePermissions();
    const { apiCall } = useApi();

    const [content, setContent] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [courseFilter, setCourseFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Dialog state
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

    // Form states
    const [formData, setFormData] = useState({
        courseId: '',
        title: '',
        description: '',
        type: 'VIDEO',
        url: '',
        duration: '',
        order: ''
    });
    const [formLoading, setFormLoading] = useState(false);

    const canUploadContent = can('UPLOAD_CONTENT');

    useEffect(() => {
        loadContent();
        loadCourses();
    }, [currentPage, searchTerm, typeFilter, courseFilter]);

    const loadContent = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: '12',
                ...(searchTerm && { search: searchTerm }),
                ...(typeFilter !== 'all' && { type: typeFilter }),
                ...(courseFilter !== 'all' && { courseId: courseFilter })
            });

            const response = await apiCall(`/lms/content?${params}`);
            setContent(response?.data?.data || []);
            setTotalPages(response?.data?.pagination?.pages || 1);
        } catch (error) {
            console.error('Failed to load content:', error);
            setContent([]);
            toast.error('Failed to load content');
        } finally {
            setLoading(false);
        }
    };

    const loadCourses = async () => {
        try {
            const response = await apiCall('/lms/courses?page=1&limit=100');
            setCourses(response?.data?.data || []);
        } catch (error) {
            console.error('Failed to load courses:', error);
            setCourses([]);
        }
    };

    const handleUploadContent = async () => {
        // Validate required fields
        if (!formData.courseId) {
            toast.error('Course selection is required');
            return;
        }
        if (!formData.title.trim()) {
            toast.error('Content title is required');
            return;
        }
        if (!formData.type) {
            toast.error('Content type is required');
            return;
        }
        if (!formData.url.trim()) {
            toast.error('Content URL is required');
            return;
        }

        try {
            setFormLoading(true);
            const uploadData = {
                ...formData,
                duration: formData.duration ? parseInt(formData.duration) : undefined,
                order: formData.order ? parseInt(formData.order) : undefined
            };

            await apiCall('/lms/content', 'POST', uploadData);
            toast.success('Content uploaded successfully');
            setUploadDialogOpen(false);
            resetForm();
            loadContent();
        } catch (error) {
            console.error('Failed to upload content:', error);
            toast.error('Failed to upload content');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteContent = async (contentId) => {
        if (!window.confirm('Are you sure you want to delete this content?')) return;

        try {
            await apiCall(`/lms/content/${contentId}`, 'DELETE');
            toast.success('Content deleted successfully');
            loadContent();
        } catch (error) {
            console.error('Failed to delete content:', error);
            toast.error('Failed to delete content');
        }
    };

    const resetForm = () => {
        setFormData({
            courseId: '',
            title: '',
            description: '',
            type: 'VIDEO',
            url: '',
            duration: '',
            order: ''
        });
    };

    const getContentTypeIcon = (type) => {
        switch (type) {
            case 'VIDEO': return <Video className="h-5 w-5 text-blue-600" />;
            case 'AUDIO': return <Headphones className="h-5 w-5 text-green-600" />;
            case 'PDF': return <FileText className="h-5 w-5 text-red-600" />;
            case 'DOCUMENT': return <FileText className="h-5 w-5 text-gray-600" />;
            case 'LINK': return <Link className="h-5 w-5 text-purple-600" />;
            default: return <FileText className="h-5 w-5 text-gray-600" />;
        }
    };

    const getContentTypeBadgeVariant = (type) => {
        switch (type) {
            case 'VIDEO': return 'default';
            case 'AUDIO': return 'secondary';
            case 'PDF': return 'destructive';
            case 'DOCUMENT': return 'outline';
            case 'LINK': return 'secondary';
            default: return 'outline';
        }
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '';
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Content Library</h2>
                    <p className="text-gray-600">Manage multimedia content for courses</p>
                </div>
                {canUploadContent && (
                    <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="flex items-center gap-2">
                                <Upload className="h-4 w-4" />
                                Upload Content
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Upload Content</DialogTitle>
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
                                        Title *
                                    </label>
                                    <Input
                                        value={formData.title}
                                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                                        placeholder="Content title"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <Textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                                        placeholder="Content description"
                                        rows={2}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Type *
                                        </label>
                                        <Select
                                            value={formData.type}
                                            onValueChange={(value) => setFormData({...formData, type: value})}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="VIDEO">Video</SelectItem>
                                                <SelectItem value="AUDIO">Audio</SelectItem>
                                                <SelectItem value="PDF">PDF</SelectItem>
                                                <SelectItem value="DOCUMENT">Document</SelectItem>
                                                <SelectItem value="LINK">Link</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Duration (seconds)
                                        </label>
                                        <Input
                                            type="number"
                                            value={formData.duration}
                                            onChange={(e) => setFormData({...formData, duration: e.target.value})}
                                            placeholder="3600"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        URL *
                                    </label>
                                    <Input
                                        value={formData.url}
                                        onChange={(e) => setFormData({...formData, url: e.target.value})}
                                        placeholder="https://example.com/content"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Order
                                    </label>
                                    <Input
                                        type="number"
                                        value={formData.order}
                                        onChange={(e) => setFormData({...formData, order: e.target.value})}
                                        placeholder="1"
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setUploadDialogOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleUploadContent}
                                        disabled={formLoading}
                                    >
                                        {formLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                        Upload Content
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
                                    placeholder="Search content..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-32">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="VIDEO">Video</SelectItem>
                                <SelectItem value="AUDIO">Audio</SelectItem>
                                <SelectItem value="PDF">PDF</SelectItem>
                                <SelectItem value="DOCUMENT">Document</SelectItem>
                                <SelectItem value="LINK">Link</SelectItem>
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

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="p-4">
                                <div className="h-32 bg-gray-200 rounded mb-4"></div>
                                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded"></div>
                            </CardContent>
                        </Card>
                    ))
                ) : content.length === 0 ? (
                    <div className="col-span-full text-center py-12">
                        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No content found</h3>
                        <p className="text-gray-500">Upload your first content item to get started.</p>
                    </div>
                ) : (
                    content.map((item) => (
                        <Card key={item.id} className="hover:shadow-lg transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        {getContentTypeIcon(item.type)}
                                        <Badge variant={getContentTypeBadgeVariant(item.type)} className="text-xs">
                                            {item.type}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="sm">
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        {canUploadContent && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteContent(item.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
                                    {item.title}
                                </h3>

                                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                    {item.description || 'No description'}
                                </p>

                                <div className="space-y-1 text-xs text-gray-500">
                                    <p>Course: {item.course.title}</p>
                                    {item.duration && (
                                        <p>Duration: {formatDuration(item.duration)}</p>
                                    )}
                                    {item.fileSize && (
                                        <p>Size: {formatFileSize(item.fileSize)}</p>
                                    )}
                                    <p>Order: {item.order}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

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

export default ContentLibrary;
