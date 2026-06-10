import React, { useState, useEffect, useRef } from 'react';
import {
    User, Mail, Phone, BookOpen, GraduationCap,
    MapPin, FileText, Printer, Download,
    MessageCircle, Send, Share2, RefreshCcw, Package,
    Plus, LogOut, Key, Briefcase
} from 'lucide-react';
import IssueItemModal from '../../shared/IssueItemModal';
import ProfileHeader from '../../shared/ProfileHeader';
import ProfileLayout from '../../shared/ProfileLayout';
import api from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';
import ProfilePhotoModal from '../../shared/ProfilePhotoModal';
import ResetPasswordModal from '../../shared/ResetPasswordModal';
import AssignClassModal from '../../shared/AssignClassModal';

const TeacherProfile = ({ teacher, onBack, onEdit }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const { showSuccess, showError } = useNotifications();
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [showIssueModal, setShowIssueModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [loadingBooks, setLoadingBooks] = useState(false);
    const [assignedBooks, setAssignedBooks] = useState([]);
    const [availableBooks, setAvailableBooks] = useState([]);
    const [workload, setWorkload] = useState(null);
    const [schedules, setSchedules] = useState([]);
    const [loadingWorkload, setLoadingWorkload] = useState(false);
    const [documents, setDocuments] = useState([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (teacher?.id) {
            fetchBooks();
            fetchWorkload();
            fetchDocuments();
        }
    }, [teacher?.id]);

    const fetchWorkload = async () => {
        setLoadingWorkload(true);
        try {
            const [workloadResp, schedulesResp] = await Promise.all([
                api.classes.getTeacherWorkload(teacher.id),
                api.classes.getTeacherSchedules(teacher.id)
            ]);
            if (workloadResp.success) setWorkload(workloadResp.data);
            if (schedulesResp.success) setSchedules(schedulesResp.data);
        } catch (err) {
            console.error('Failed to fetch teacher workload/schedules:', err);
        } finally {
            setLoadingWorkload(false);
        }
    };

    const fetchDocuments = async () => {
        setLoadingDocs(true);
        try {
            const res = await api.documents.getAll({ uploadedById: teacher.id });
            if (res.success) setDocuments(res.data || []);
        } catch (error) {
            console.error('Failed to fetch docs:', error);
        } finally {
            setLoadingDocs(false);
        }
    };

    const handleUploadDoc = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('category', 'staff');
            formData.append('name', file.name);
            formData.append('userId', teacher.id); 

            const res = await api.documents.upload(formData);
            if (res.success) {
                showSuccess('Document uploaded successfully');
                fetchDocuments();
            } else {
                showError('Failed to upload document');
            }
        } catch (error) {
            console.error('Upload error:', error);
            showError('Failed to upload document');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const fetchBooks = async () => {
        setLoadingBooks(true);
        try {
            const resp = await api.books.getAll({ assignedToId: teacher.id });
            if (resp.success) {
                setAssignedBooks(resp.data);
            }
            const availableResp = await api.books.getAll({ status: 'AVAILABLE' });
            if (availableResp.success) {
                setAvailableBooks(availableResp.data);
            }
        } catch (error) {
            console.error('Failed to fetch books:', error);
        } finally {
            setLoadingBooks(false);
        }
    };

    const handleIssueBook = async (bookId) => {
        try {
            const resp = await api.books.assign(bookId, teacher.id);
            if (resp.success) {
                showSuccess(resp.message || 'Item issued successfully');
                fetchBooks();
                setShowIssueModal(false);
            }
        } catch (error) {
            showError('Failed to issue item');
        }
    };

    const handleReturnBook = async (bookId) => {
        if (!window.confirm('Are you sure the teacher has returned this item?')) return;
        try {
            const resp = await api.books.return(bookId);
            if (resp.success) {
                showSuccess('Item returned successfully');
                fetchBooks();
            }
        } catch (error) {
            showError('Failed to return item');
        }
    };

    const handleSavePhoto = async (photoData) => {
        try {
            const response = await api.teachers.uploadPhoto(teacher.id, photoData);
            if (response?.success) {
                showSuccess('Profile photo updated successfully');
                window.location.reload();
                return true;
            }
            showError(response?.error || 'Failed to update profile photo');
            return false;
        } catch (error) {
            console.error('Failed to upload photo:', error);
            showError('Failed to update profile photo');
            return false;
        }
    };

    const handleShareDocument = async (doc) => {
        if (!teacher.phone) {
            showError("Teacher has no phone number");
            return;
        }
        try {
            const msg = `Hello ${teacher.firstName}, I'm sharing this document with you: ${doc.name}. Download here: ${doc.url || '#'}`;
            const whatsappUrl = `https://wa.me/${teacher.phone.replace(/\+/g, '').replace(/\s/g, '')}?text=${encodeURIComponent(msg)}`;
            window.open(whatsappUrl, '_blank');
            showSuccess('Opening WhatsApp...');
        } catch (err) {
            showError('Failed to share document');
        }
    };

    const formatSize = (bytes) => {
        if (!bytes) return 'N/A';
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    if (!teacher) return null;

    const tabs = [
        { id: 'overview', label: 'Overview', icon: User },
        { id: 'classes', label: 'Classes & Subjects', icon: BookOpen },
        { id: 'documents', label: 'Documents', icon: FileText },
    ];

    return (
        <ProfileLayout
            title="Tutor Profile"
            onBack={onBack}
            onPrint={() => window.print()}
            secondaryAction={{
                label: "Reset Password",
                icon: Key,
                onClick: () => setShowResetModal(true),
                className: "text-purple-600 hover:bg-purple-50"
            }}
            primaryAction={{
                label: "Edit Profile",
                onClick: () => onEdit && onEdit(teacher)
            }}
        >
            <ProfileHeader
                name={`${teacher.firstName} ${teacher.lastName}`}
                avatar={teacher.profilePicture || teacher.avatar}
                avatarFallback={`${teacher.firstName?.[0]}${teacher.lastName?.[0]}`}
                status={teacher.status}
                bannerColor="brand-teal"
                badges={[
                    { text: teacher.role?.replace(/_/g, ' ') || 'Teacher', icon: Briefcase, className: "bg-brand-teal/5 text-brand-teal px-2.5 py-1 rounded-full border border-brand-teal/10 font-medium text-xs" },
                    { text: teacher.assignedClasses?.length > 0 ? teacher.assignedClasses.join(', ') : 'No Classes', icon: BookOpen },
                    { text: `ID: ${teacher.staffId || teacher.employeeNo || 'N/A'}`, className: "text-gray-400 font-medium" }
                ]}
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onPhotoClick={() => setShowPhotoModal(true)}
            />

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                        {/* Left Column */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Personal & Employment Info */}
                            <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
                                <div className="flex items-center gap-3 mb-8 pb-3 border-b border-gray-100">
                                    <div className="w-10 h-10 bg-brand-teal/10 rounded-xl flex items-center justify-center text-brand-teal">
                                        <User size={20} />
                                    </div>
                                    <h3 className="text-xl font-medium text-gray-900 tracking-tight">Personal & Employment Details</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Gender</label>
                                        <p className="text-gray-900 font-medium">{teacher.gender || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Employee Number</label>
                                        <p className="text-gray-900 font-medium">{teacher.employeeNo || teacher.staffId || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">TSC Number</label>
                                        <p className="text-gray-900 font-medium">{teacher.tscNo || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">ID Number</label>
                                        <p className="text-gray-900 font-medium">{teacher.idNumber || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Primary Subject</label>
                                        <p className="text-gray-900 font-medium">{teacher.subject || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Date of Employment</label>
                                        <p className="text-gray-900 font-medium">
                                            {teacher.dateOfEmployment ? new Date(teacher.dateOfEmployment).toLocaleDateString() : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Contact Info */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
                                <div className="flex items-center gap-3 mb-8 pb-3 border-b border-gray-100">
                                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                        <Phone size={20} />
                                    </div>
                                    <h3 className="text-xl font-medium text-gray-900 tracking-tight">Contact Information</h3>
                                </div>

                                <div className="space-y-8">
                                    <div>
                                        <label className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-2 block">Phone Number</label>
                                        <div className="flex items-center justify-between">
                                            <p className="text-gray-900 font-medium text-lg">{teacher.phone || 'N/A'}</p>
                                            {teacher.phone && (
                                                <div className="flex gap-2">
                                                    <a
                                                        href={`https://wa.me/${teacher.phone.replace(/\+/g, '').replace(/\s/g, '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition shadow-sm"
                                                        title="WhatsApp"
                                                    >
                                                        <MessageCircle size={18} />
                                                    </a>
                                                    <a
                                                        href={`sms:${teacher.phone}`}
                                                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition shadow-sm"
                                                        title="Send SMS"
                                                    >
                                                        <Send size={18} />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-2 block">Email Address</label>
                                        <div className="flex items-center justify-between">
                                            <p className="text-gray-900 font-medium truncate max-w-[200px]">{teacher.email || 'N/A'}</p>
                                            {teacher.email && (
                                                <a
                                                    href={`mailto:${teacher.email}`}
                                                    className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition"
                                                >
                                                    <Mail size={18} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-1 block">Residential Address</label>
                                        <div className="flex items-start gap-2">
                                            <MapPin size={16} className="text-gray-400 mt-0.5" />
                                            <p className="text-gray-700 font-medium leading-relaxed">{teacher.address || 'Not Provided'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* CLASSES TAB */}
                {activeTab === 'classes' && (
                    <div className="space-y-6 animate-fade-in">

                        {/* === WORKLOAD SUMMARY STATS === */}
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { label: 'Classes Assigned', value: workload?.classCount ?? teacher.assignedClasses?.length ?? 0, icon: GraduationCap, color: 'purple' },
                                { label: 'Total Students', value: workload?.totalStudents ?? 0, icon: BookOpen, color: 'blue' },
                                { label: 'Subject Schedules', value: schedules.length, icon: Briefcase, color: 'teal' }
                            ].map(stat => (
                                <div key={stat.label} className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-${stat.color === 'teal' ? 'brand-teal' : stat.color}-50 text-${stat.color === 'teal' ? 'brand-teal' : stat.color}-600`}>
                                        <stat.icon size={22} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-semibold text-gray-900">{loadingWorkload ? '—' : stat.value}</p>
                                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">{stat.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* === ASSIGNED CLASSES TABLE === */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="flex items-center justify-between p-6 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                                        <GraduationCap size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-900">Assigned Classes</h3>
                                        <p className="text-xs text-gray-400">Classes this teacher is responsible for</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowAssignModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition text-xs font-medium shadow-sm"
                                >
                                    <Plus size={14} />
                                    Assign to Class
                                </button>
                            </div>

                            {loadingWorkload ? (
                                <div className="p-12 text-center">
                                    <RefreshCcw size={24} className="animate-spin text-purple-400 mx-auto mb-3" />
                                    <p className="text-gray-400 text-sm">Loading class assignments...</p>
                                </div>
                            ) : workload?.classes?.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-[color:var(--table-border)] text-[10px] uppercase tracking-wider">
                                            <tr>
                                                <th className="px-6 py-3 text-left font-semibold text-[color:var(--table-header-fg)]">Class</th>
                                                <th className="px-6 py-3 text-left font-semibold text-[color:var(--table-header-fg)]">Grade</th>
                                                <th className="px-6 py-3 text-left font-semibold text-[color:var(--table-header-fg)]">Stream</th>
                                                <th className="px-6 py-3 text-center font-semibold text-[color:var(--table-header-fg)]">Students</th>
                                                <th className="px-6 py-3 text-center font-semibold text-[color:var(--table-header-fg)]">Capacity</th>
                                                <th className="px-6 py-3 text-center font-semibold text-[color:var(--table-header-fg)]">Utilization</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {workload.classes.map((cls, i) => (
                                                <tr key={cls.id || i} className="hover:bg-purple-50/20 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
                                                                <GraduationCap size={16} />
                                                            </div>
                                                            <span className="font-medium text-gray-900">{cls.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-semibold uppercase tracking-widest">{cls.grade?.replace('_', ' ')}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-600 font-medium">{cls.stream || '—'}</td>
                                                    <td className="px-6 py-4 text-center font-semibold text-gray-900">{cls.studentCount}</td>
                                                    <td className="px-6 py-4 text-center text-gray-500">{cls.capacity}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[80px]">
                                                                <div
                                                                    className={`h-1.5 rounded-full ${cls.utilization > 90 ? 'bg-red-500' : cls.utilization > 70 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                                                    style={{ width: `${Math.min(cls.utilization, 100)}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-medium text-gray-600">{cls.utilization}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-12 text-center bg-gray-50/50">
                                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                        <GraduationCap size={28} className="text-gray-300" />
                                    </div>
                                    <h4 className="text-gray-800 font-medium mb-1">No Classes Assigned</h4>
                                    <p className="text-gray-400 text-sm mb-4">Click "Assign to Class" to give this teacher a class.</p>
                                    <button
                                        onClick={() => setShowAssignModal(true)}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-medium hover:bg-purple-700 transition"
                                    >
                                        <Plus size={14} /> Assign to Class
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* === SUBJECT SCHEDULES TABLE === */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="flex items-center gap-3 p-6 border-b border-gray-100">
                                <div className="w-10 h-10 bg-brand-teal/10 rounded-xl flex items-center justify-center text-brand-teal">
                                    <BookOpen size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900">Subject Schedules</h3>
                                    <p className="text-xs text-gray-400">Subjects this teacher teaches across classes (from timetable)</p>
                                </div>
                            </div>

                            {loadingWorkload ? (
                                <div className="p-10 text-center">
                                    <RefreshCcw size={22} className="animate-spin text-brand-teal mx-auto mb-3" />
                                    <p className="text-gray-400 text-sm">Loading subject schedules...</p>
                                </div>
                            ) : schedules.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-[color:var(--table-border)] text-[10px] uppercase tracking-wider">
                                            <tr>
                                                <th className="px-6 py-3 text-left font-semibold text-[color:var(--table-header-fg)]">Subject</th>
                                                <th className="px-6 py-3 text-left font-semibold text-[color:var(--table-header-fg)]">Class</th>
                                                <th className="px-6 py-3 text-left font-semibold text-[color:var(--table-header-fg)]">Grade</th>
                                                <th className="px-6 py-3 text-left font-semibold text-[color:var(--table-header-fg)]">Day</th>
                                                <th className="px-6 py-3 text-left font-semibold text-[color:var(--table-header-fg)]">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {schedules.map((sched, i) => (
                                                <tr key={sched.id || i} className="hover:bg-teal-50/20 transition-colors">
                                                    <td className="px-6 py-3">
                                                        <span className="px-2.5 py-1 bg-brand-teal/10 text-brand-teal rounded-lg text-xs font-semibold">{sched.subject}</span>
                                                    </td>
                                                    <td className="px-6 py-3 font-medium text-gray-900">{sched.class?.name || '—'}</td>
                                                    <td className="px-6 py-3">
                                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-semibold uppercase">{sched.class?.grade?.replace('_', ' ') || '—'}</span>
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-600 font-medium capitalize">{sched.day?.toLowerCase()}</td>
                                                    <td className="px-6 py-3 text-gray-500 font-mono text-xs">{sched.startTime} – {sched.endTime}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-10 text-center bg-gray-50/40">
                                    <BookOpen size={32} className="text-gray-200 mx-auto mb-3" />
                                    <p className="text-gray-500 font-medium text-sm">No subject entries in the timetable yet.</p>
                                    <p className="text-gray-400 text-xs mt-1">Add entries in the class schedule to see them here.</p>
                                </div>
                            )}
                        </div>

                    </div>
                )}

                {/* DOCUMENTS TAB */}
                {activeTab === 'documents' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-brand-teal/10 rounded-xl flex items-center justify-center text-brand-teal">
                                    <FileText size={20} />
                                </div>
                                <h3 className="text-xl font-medium text-gray-900 tracking-tight">Professional Documents</h3>
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleUploadDoc} className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white border border-gray-200 text-brand-teal rounded-lg font-medium text-sm hover:bg-gray-50 transition shadow-sm">
                                Upload New
                            </button>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {documents.length > 0 ? (
                                documents.map((doc) => (
                                    <div key={doc.id} className="group p-6 flex items-center justify-between hover:bg-brand-teal/[0.02] transition">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                                <FileText size={22} />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 tracking-tight">{doc.name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest bg-gray-100 px-1.5 py-0.5 rounded">{formatSize(doc.size)}</span>
                                                    <span className="text-gray-300">•</span>
                                                    <span className="text-xs text-gray-500 font-medium">Uploaded on {new Date(doc.createdAt || doc.date || Date.now()).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleShareDocument(doc)}
                                                className="p-2.5 bg-brand-teal/10 text-brand-teal rounded-xl hover:bg-brand-teal/20 transition shadow-sm"
                                                title="Share via WhatsApp"
                                            >
                                                <Share2 size={18} />
                                            </button>
                                            <a href={doc.url} download target="_blank" rel="noopener noreferrer" className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition shadow-sm inline-flex items-center" title="Download">
                                                <Download size={18} />
                                            </a>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-16 text-center">
                                    <FileText size={48} className="text-gray-200 mx-auto mb-4" />
                                    <p className="text-gray-500 font-medium">No documents attached to this profile.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <ProfilePhotoModal
                isOpen={showPhotoModal}
                onClose={() => setShowPhotoModal(false)}
                onSave={handleSavePhoto}
                currentPhoto={teacher.profilePicture || teacher.avatar}
            />

            <ResetPasswordModal
                isOpen={showResetModal}
                onClose={() => setShowResetModal(false)}
                user={teacher}
                onResetSuccess={(msg) => showSuccess(msg)}
            />

            <IssueItemModal
                isOpen={showIssueModal}
                onClose={() => setShowIssueModal(false)}
                items={availableBooks}
                onIssue={handleIssueBook}
                teacherName={`${teacher.firstName} ${teacher.lastName}`}
            />

            <AssignClassModal
                isOpen={showAssignModal}
                onClose={() => setShowAssignModal(false)}
                teacher={teacher}
                onAssign={() => fetchWorkload()}
            />
        </ProfileLayout>
    );
};

export default TeacherProfile;
