import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Check, AlertTriangle, BookOpen, User, Search, Loader, GraduationCap } from 'lucide-react';
import api from '../../../services/api';
import { Button, Input, Card, CardContent, Badge } from '../../../components/ui';

/**
 * TeacherClassAssignmentModal
 * Unified modal for assigning teachers to classes OR classes to teachers.
 * 
 * Mode 'TEACHER_CENTRIC': Provide a teacher, pick a class.
 * Mode 'CLASS_CENTRIC': Provide a class, pick a teacher.
 */
const TeacherClassAssignmentModal = ({
    isOpen,
    onClose,
    teacher = null,     // For TEACHER_CENTRIC mode
    classData = null,   // For CLASS_CENTRIC mode
    onAssignmentComplete
}) => {
    const mode = teacher ? 'TEACHER_CENTRIC' : 'CLASS_CENTRIC';

    const [classes, setClasses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [warning, setWarning] = useState(null);
    const [success, setSuccess] = useState(false);
    const [workload, setWorkload] = useState(null);
    const [attendanceLockExempt, setAttendanceLockExempt] = useState(false);

    useEffect(() => {
        if (isOpen) {
            resetState();
            if (mode === 'TEACHER_CENTRIC') {
                fetchClasses();
                fetchTeacherWorkload();
            } else {
                fetchTeachers();
            }
        }
    }, [isOpen, teacher?.id, classData?.id]);

    const resetState = () => {
        setSelectedId('');
        setSearchTerm('');
        setError(null);
        setWarning(null);
        setSuccess(false);
        setWorkload(null);
        setAttendanceLockExempt(false);
    };

    const fetchClasses = async () => {
        try {
            setLoading(true);
            const response = await api.classes.getAll({ active: true });
            // Support both wrapped and unwrapped response formats
            const data = response.data || response;
            setClasses(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error fetching classes:', err);
            setError('Failed to load classes.');
        } finally {
            setLoading(false);
        }
    };

    const fetchTeachers = async () => {
        try {
            setLoading(true);
            const response = await api.teachers.getAll();
            const data = response.data || response;
            setTeachers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error fetching teachers:', err);
            setError('Failed to load teachers.');
        } finally {
            setLoading(false);
        }
    };

    const fetchTeacherWorkload = async () => {
        const tId = teacher?.id;
        if (!tId) return;

        try {
            const response = await api.classes.getTeacherWorkload(tId, {
                academicYear: 2026, // Default to current academic context
                term: 'TERM_1'
            });
            if (response.success || response.data) {
                setWorkload(response.data || response);
            }
        } catch (err) {
            console.error('Error fetching workload:', err);
        }
    };

    const handleSelectionChange = (id) => {
        setSelectedId(id);
        setWarning(null);

        if (mode === 'TEACHER_CENTRIC') {
            const selectedClass = classes.find(c => c.id === id);
            if (selectedClass?.teacher) {
                if (selectedClass.teacher.id === teacher.id) {
                    setWarning([`This teacher is already assigned to ${selectedClass.name}.`]);
                } else {
                    setWarning([`This will replace ${selectedClass.teacher.firstName} ${selectedClass.teacher.lastName} as the class teacher.`]);
                }
            }
        } else {
            // CLASS_CENTRIC warnings
            if (id === classData?.teacherId || id === classData?.teacher?.id) {
                setWarning(['This teacher is already assigned to this class.']);
            }
        }
    };

    const handleSubmit = async () => {
        if (!selectedId) return;

        const classId = mode === 'TEACHER_CENTRIC' ? selectedId : classData.id;
        const teacherId = mode === 'TEACHER_CENTRIC' ? teacher.id : selectedId;

        try {
            setSubmitting(true);
            setError(null);

            const response = await api.classes.assignTeacher(classId, teacherId, attendanceLockExempt);

            if (response.success || response.id) {
                setSuccess(true);
                setTimeout(() => {
                    if (onAssignmentComplete) onAssignmentComplete();
                    onClose();
                }, 1500);
            } else {
                setError('Failed to assign. Please try again.');
            }
        } catch (err) {
            console.error('Assignment error:', err);
            setError(err.message || 'An error occurred during assignment.');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredItems = mode === 'TEACHER_CENTRIC'
        ? classes.filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.grade?.toLowerCase().includes(searchTerm.toLowerCase()))
        : teachers.filter(t => `${t.firstName} ${t.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) || t.teacherId?.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <Card className="w-full max-w-xl shadow-2xl overflow-hidden border-none animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-brand-purple p-6 text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                            {mode === 'TEACHER_CENTRIC' ? <BookOpen size={24} /> : <User size={24} />}
                            {mode === 'TEACHER_CENTRIC' ? 'Assign Class to Teacher' : 'Assign Teacher to Class'}
                        </h3>
                        <p className="text-xs text-brand-purple-light opacity-80 mt-1 uppercase tracking-widest font-medium">
                            Teacher-Class Management
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                    {/* Source Info (The static part) */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">
                            {mode === 'TEACHER_CENTRIC' ? 'Assigning for Teacher' : 'Assigning for Class'}
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-brand-purple/10 text-brand-purple flex items-center justify-center font-semibold text-lg">
                                {mode === 'TEACHER_CENTRIC'
                                    ? (teacher?.firstName?.charAt(0) || 'T')
                                    : (classData?.name?.charAt(0) || 'C')}
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 leading-tight">
                                    {mode === 'TEACHER_CENTRIC'
                                        ? `${teacher?.firstName} ${teacher?.lastName}`
                                        : classData?.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {mode === 'TEACHER_CENTRIC' ? teacher?.email : `Grade ${classData?.grade} • ${classData?.stream}`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Workload Stats (Only for Teacher Centric or when teacher is selected) */}
                    {workload && mode === 'TEACHER_CENTRIC' && (
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-center">
                                <p className="text-sm font-medium text-blue-900 leading-none">{workload.totalStudents || 0}</p>
                                <p className="text-[10px] text-blue-600 mt-1 font-medium">Students</p>
                            </div>
                            <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100 text-center">
                                <p className="text-sm font-medium text-purple-900 leading-none">{workload.classes?.length || 0}</p>
                                <p className="text-[10px] text-purple-600 mt-1 font-medium">Classes</p>
                            </div>
                            <div className="bg-teal-50/50 p-3 rounded-xl border border-teal-100 text-center">
                                <p className="text-sm font-medium text-teal-900 leading-none">Healthy</p>
                                <p className="text-[10px] text-teal-600 mt-1 font-medium">Workload</p>
                            </div>
                        </div>
                    )}

                    {/* Feedback Messages */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs font-medium rounded-lg flex items-center gap-2">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    {warning && warning.map((w, i) => (
                        <div key={i} className="p-3 bg-amber-50 border border-amber-100 text-amber-700 text-xs font-medium rounded-lg flex items-center gap-2">
                            <AlertTriangle size={16} /> {w}
                        </div>
                    ))}

                    {success && (
                        <div className="p-3 bg-green-50 border border-green-100 text-green-700 text-xs font-medium rounded-lg flex items-center gap-2">
                            <Check size={16} /> Assignment successful!
                        </div>
                    )}

                    {/* Selection Area */}
                    <div className="space-y-3">
                        <p className="text-sm font-semibold text-gray-800">
                            {mode === 'TEACHER_CENTRIC' ? 'Select Class' : 'Select Teacher'}
                        </p>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                            <Input
                                placeholder={mode === 'TEACHER_CENTRIC' ? "Search classes..." : "Search teachers..."}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 h-11 bg-gray-50 border-gray-200 focus:bg-white transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <Loader className="animate-spin text-brand-purple" size={32} />
                                </div>
                            ) : filteredItems.length > 0 ? (
                                filteredItems.map(item => {
                                    const isSelected = selectedId === item.id;
                                    const isCurrent = mode === 'TEACHER_CENTRIC'
                                        ? item.teacherId === teacher?.id
                                        : item.id === classData?.teacherId || item.id === classData?.teacher?.id;

                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => handleSelectionChange(item.id)}
                                            className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between group 
                                                ${isSelected
                                                    ? 'border-brand-purple bg-brand-purple/5 shadow-sm'
                                                    : 'border-transparent bg-white hover:bg-gray-50'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-medium 
                                                    ${isSelected ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                    {mode === 'TEACHER_CENTRIC' ? 'C' : (item.firstName?.charAt(0) || 'T')}
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-medium ${isSelected ? 'text-brand-purple' : 'text-gray-900'}`}>
                                                        {mode === 'TEACHER_CENTRIC' ? item.name : `${item.firstName} ${item.lastName}`}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-tight">
                                                            {mode === 'TEACHER_CENTRIC' ? `Grade ${item.grade} • ${item.stream}` : item.teacherId || item.staffId}
                                                        </p>
                                                        {isCurrent && (
                                                            <Badge className="bg-brand-teal/10 text-brand-teal border-none text-[8px] h-4 py-0">Current</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="w-5 h-5 rounded-full bg-brand-purple text-white flex items-center justify-center">
                                                    <Check size={12} strokeWidth={4} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="py-8 text-center text-gray-400 text-sm border-2 border-dashed rounded-xl">
                                    No results found
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 pt-0 border-t border-gray-100 bg-white mt-auto">
                    {/* Attendance lock exemption toggle — shown once a selection is made */}
                    {selectedId && (
                        <label className="flex items-start gap-3 mb-4 p-3 rounded-lg border border-gray-200 bg-gray-50 cursor-pointer hover:bg-brand-purple/5 hover:border-brand-purple/30 transition-colors">
                            <input
                                type="checkbox"
                                checked={attendanceLockExempt}
                                onChange={e => setAttendanceLockExempt(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-purple focus:ring-brand-purple cursor-pointer"
                            />
                            <span className="text-sm text-gray-700">
                                <span className="font-semibold text-gray-900">Exempt from attendance lock</span>
                                <span className="block text-xs text-gray-500 mt-0.5">
                                    Allow this teacher to save attendance after the lock time without needing an unlock request.
                                </span>
                            </span>
                        </label>
                    )}
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={onClose} disabled={submitting} className="font-medium text-gray-500">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!selectedId || submitting || success}
                            className="bg-brand-purple hover:bg-brand-purple/90 text-white font-semibold min-w-[140px]"
                        >
                            {submitting ? (
                                <Loader className="animate-spin mr-2" size={18} />
                            ) : (
                                <Save className="mr-2" size={18} />
                            )}
                            {success ? 'Assigned!' : 'Save Assignment'}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default TeacherClassAssignmentModal;
