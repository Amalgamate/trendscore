import React, { useState, useEffect } from 'react';
import { X, User, Search, CheckCircle, Loader, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, Input, Badge } from '../../ui';
import api from '../../../services/api';
import { useNotifications } from '../hooks/useNotifications';

const AssignTeacherModal = ({ isOpen, onClose, classData, onAssignmentComplete }) => {
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTeacherId, setSelectedTeacherId] = useState(null);
    const { showSuccess, showError } = useNotifications();

    useEffect(() => {
        if (isOpen) {
            fetchTeachers();
            setSelectedTeacherId(classData?.teacherId || classData?.teacher?.id || null);
        }
    }, [isOpen, classData]);

    const fetchTeachers = async () => {
        setLoading(true);
        try {
            const resp = await api.teachers.getAll();
            setTeachers(resp.data || []);
        } catch (error) {
            console.error('Failed to fetch teachers:', error);
            showError('Failed to load teachers');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await api.classes.assignTeacher(classData.id, selectedTeacherId);
            showSuccess('Teacher assigned successfully!');
            if (onAssignmentComplete) onAssignmentComplete();
            onClose();
        } catch (error) {
            console.error('Assignment error:', error);
            showError(error.message || 'Failed to assign teacher');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredTeachers = teachers.filter(t =>
        `${t.firstName} ${t.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.teacherId?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isCurrentSelected = (classData?.teacherId || classData?.teacher?.id) === selectedTeacherId;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader className="bg-brand-purple text-white px-6 py-4 -m-6 mb-4 rounded-t-lg">
                    <DialogTitle className="text-xl font-medium flex items-center gap-2">
                        <User size={24} />
                        Assign Teacher
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Class</p>
                        <p className="font-medium text-gray-800">{classData?.name || `${classData?.grade} ${classData?.stream}`}</p>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <Input
                            placeholder="Search teacher by name or ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                                <Loader className="animate-spin mb-2" size={24} />
                                <p className="text-sm">Loading teachers...</p>
                            </div>
                        ) : filteredTeachers.length > 0 ? (
                            filteredTeachers.map(teacher => {
                                const isSelected = selectedTeacherId === teacher.id;
                                const isCurrent = (classData?.teacherId || classData?.teacher?.id) === teacher.id;

                                return (
                                    <div
                                        key={teacher.id}
                                        onClick={() => setSelectedTeacherId(teacher.id)}
                                        className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${isSelected
                                            ? 'border-brand-purple bg-brand-purple/5 shadow-sm'
                                            : 'border-gray-100 hover:border-gray-200 bg-white'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm ${isSelected ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {teacher.firstName?.charAt(0)}{teacher.lastName?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className={`font-medium text-sm ${isSelected ? 'text-brand-purple' : 'text-gray-800'}`}>
                                                    {teacher.firstName} {teacher.lastName}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs text-gray-500">{teacher.teacherId}</p>
                                                    {isCurrent && (
                                                        <Badge variant="outline" className="text-[10px] h-4 py-0 border-brand-teal text-brand-teal">
                                                            Current
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <CheckCircle className="text-brand-purple" size={20} />
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                <AlertCircle className="mx-auto text-gray-400 mb-2" size={32} />
                                <p className="text-gray-500 font-medium">No teachers found</p>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 pt-0">
                    <Button variant="outline" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || !selectedTeacherId}
                        className="bg-brand-purple hover:bg-brand-purple/90 text-white font-medium gap-2"
                    >
                        {submitting ? <Loader className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                        {isCurrentSelected ? 'Apply Assignment' : 'Assign Teacher'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AssignTeacherModal;
