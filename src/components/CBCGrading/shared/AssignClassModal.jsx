import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Check, AlertTriangle, BookOpen } from 'lucide-react';
import api from '../../../services/api';

const AssignClassModal = ({ isOpen, onClose, teacher, onAssign }) => {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingClasses, setFetchingClasses] = useState(false);
  const [, setFetchingWorkload] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [success, setSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [workload, setWorkload] = useState(null);
  const [attendanceLockExempt, setAttendanceLockExempt] = useState(false);

  // We intentionally only re-run when modal opens or teacher changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isOpen && teacher) {
      fetchClasses();
      fetchTeacherWorkload();
      setSelectedClassId('');
      setError(null);
      setWarning(null);
      setSuccess(false);
      setSuccessInfo(null);
      setAttendanceLockExempt(false);
    }
  }, [isOpen, teacher]);

  const fetchClasses = async () => {
    try {
      setFetchingClasses(true);
      const response = await api.classes.getAll({ active: true });
      if (response.success) {
        setClasses(response.data);
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
      setError('Failed to load classes. Please try again.');
    } finally {
      setFetchingClasses(false);
    }
  };

  const fetchTeacherWorkload = async () => {
    if (!teacher?.id) return;

    try {
      setFetchingWorkload(true);
      const response = await api.classes.getTeacherWorkload(teacher.id, {
        academicYear: 2025,
        term: 'TERM_1'
      });

      if (response.success) {
        setWorkload(response.data);
      }
    } catch (err) {
      console.error('Error fetching workload:', err);
      // Non-critical error, don't show to user
    } finally {
      setFetchingWorkload(false);
    }
  };

  const handleClassChange = (classId) => {
    setSelectedClassId(classId);
    setWarning(null);

    const warnings = [];

    // Check 1: If class already has a teacher
    const selectedClass = classes.find(c => c.id === classId);
    if (selectedClass?.teacher) {
      // logic to check if it's the SAME teacher
      if (selectedClass.teacher.id === teacher.id) {
        warnings.push(`You are already the class teacher for ${selectedClass.name}.`);
      } else {
        warnings.push(
          `This will replace ${selectedClass.teacher.firstName} ${selectedClass.teacher.lastName} ` +
          `as the class teacher for ${selectedClass.name}.`
        );
      }
    }

    // Check 2: If teacher is already assigned to other classes (Workload check)
    if (workload?.classes?.length > 0) {
      // Filter out the currently selected class if they are already assigned to it (to avoid double counting in logic, though UI handles it)
      const otherClasses = workload.classes.filter(c => c.id !== classId);
      if (otherClasses.length > 0) {
        const classNames = otherClasses.map(c => c.name).join(', ');
        warnings.push(
          `${teacher.firstName} is already assigned to ${otherClasses.length} other class(es): ${classNames}.`
        );
      }
    }

    if (warnings.length > 0) {
      setWarning(warnings);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClassId) return;

    try {
      setLoading(true);
      setError(null);

      // Use the dedicated assign teacher endpoint
      const response = await api.classes.assignTeacher(selectedClassId, teacher.id, attendanceLockExempt);

      if (response.success) {
        setSuccess(true);

        let infoMsg = `Successfully assigned to ${classes.find(c => c.id === selectedClassId)?.name}.`;
        if (response.info?.previousTeacher) {
          infoMsg += ` Replaced ${response.info.previousTeacher}.`;
        }
        setSuccessInfo(infoMsg);

        setTimeout(() => {
          if (onAssign) onAssign();
          onClose();
        }, 1500);
      } else {
        setError('Failed to assign class. Please try again.');
      }
    } catch (err) {
      console.error('Error assigning class:', err);
      setError(err.message || 'An error occurred while assigning the class.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden transform transition-all">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-blue-50">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Assign Teacher to Class</h3>
            <p className="text-xs text-gray-500 mt-0.5">Term 1, 2025</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-white/50 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Teacher Info */}
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2 font-medium">Assigning class for:</p>
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-3xl">{teacher?.avatar || '👨‍🏫'}</span>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-lg">
                  {teacher?.firstName} {teacher?.lastName}
                </p>
                <p className="text-sm text-gray-600">{teacher?.email}</p>
                {teacher?.phone && (
                  <p className="text-xs text-gray-500 mt-0.5">{teacher?.phone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Current Workload */}
          {workload && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <BookOpen size={16} />
                Current Workload
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-lg text-center border border-gray-200">
                  <p className="text-2xl font-medium text-blue-600">{workload.classCount}</p>
                  <p className="text-xs text-gray-600 mt-1">Classes</p>
                </div>
                <div className="bg-white p-3 rounded-lg text-center border border-gray-200">
                  <p className="text-2xl font-medium text-purple-600">{workload.totalStudents}</p>
                  <p className="text-xs text-gray-600 mt-1">Students</p>
                </div>
                <div className="bg-white p-3 rounded-lg text-center border border-gray-200">
                  <p className={`text-2xl font-medium ${workload.workloadLevel === 'HIGH' ? 'text-red-600' :
                    workload.workloadLevel === 'MEDIUM' ? 'text-amber-600' :
                      'text-green-600'
                    }`}>
                    {workload.workloadLevel}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Workload</p>
                </div>
              </div>
              {workload.classes && workload.classes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-600 mb-2">Currently teaching:</p>
                  <div className="flex flex-wrap gap-2">
                    {workload.classes.map(cls => (
                      <span
                        key={cls.id}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full"
                      >
                        {cls.name} ({cls.studentCount} students)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2 border border-red-200">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* Warning Message */}
          {warning && (
            <div className="mb-4 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm flex items-start gap-2 border border-amber-200">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                {Array.isArray(warning) ? warning.map((w, i) => (
                  <p key={i}>{w}</p>
                )) : <p>{warning}</p>}
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2 border border-green-200">
              <Check size={18} />
              <div>{successInfo || 'Successfully assigned to class!'}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Class to Assign
              </label>
              {fetchingClasses ? (
                <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
                  <div className="animate-pulse">Loading available classes...</div>
                </div>
              ) : (
                <>
                  <select
                    value={selectedClassId}
                    onChange={(e) => handleClassChange(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                    required
                    disabled={loading || success}
                  >
                    <option value="">-- Select a Class --</option>
                    {classes.map((cls) => {
                      const studentCount = cls._count?.enrollments || 0;
                      const utilization = cls.capacity ? Math.round((studentCount / cls.capacity) * 100) : 0;

                      return (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                          {cls.teacher ? ` (Current: ${cls.teacher.firstName} ${cls.teacher.lastName})` : ' (No Teacher)'}
                          {` - ${studentCount}/${cls.capacity} students (${utilization}%)`}
                        </option>
                      );
                    })}
                  </select>
                  {classes.length === 0 && (
                    <p className="mt-2 text-xs text-gray-500 italic">
                      No classes available for assignment.
                    </p>
                  )}
                </>
              )}
              {selectedClassId && (
                <p className="mt-2 text-xs text-gray-500">
                  <span className="text-amber-600 font-semibold">⚠️ Note:</span> This teacher will become the class teacher for the selected class.
                </p>
              )}

              {/* Attendance lock exemption toggle */}
              {selectedClassId && (
                <label className="flex items-start gap-3 mt-4 p-3 rounded-lg border border-gray-200 bg-gray-50 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors">
                  <input
                    type="checkbox"
                    checked={attendanceLockExempt}
                    onChange={e => setAttendanceLockExempt(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Exempt from attendance lock</span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      Allow this teacher to save attendance for this class after the lock time, without needing an unlock request.
                    </span>
                  </span>
                </label>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium text-sm"
                disabled={loading || success}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !selectedClassId || success}
                className={`flex items-center gap-2 px-5 py-2.5 text-white rounded-lg transition-all font-medium text-sm shadow-sm
                  ${loading || !selectedClassId || success
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:from-blue-700 hover:to-purple-700 hover:shadow-md'
                  }`}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Assign Class
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AssignClassModal;
