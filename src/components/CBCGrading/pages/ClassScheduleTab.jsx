/**
 * ClassScheduleTab
 * Manages class schedules and timetables
 */

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, AlertCircle, Clock, BookOpen, User, MapPin, MessageSquarePlus } from 'lucide-react';
import { Button, Card, CardContent, Dialog, DialogContent, DialogHeader, DialogTitle, Badge } from '../../../components/ui';
import api from '../../../services/api';
import { usePermissions } from '../../../hooks/usePermissions';
import './ClassScheduleTab.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_SLOTS = [
  '08:00', '08:45', '09:30', '10:15', '11:00', '11:45', '12:30', '13:15', '14:00', '14:45', '15:30'
];

const ClassScheduleTab = ({ classData, onRefresh }) => {
  const { can } = usePermissions();
  const canEditTimetable = can('EDIT_TIMETABLE');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [viewType, setViewType] = useState('table'); // 'table' or 'grid'
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestData, setRequestData] = useState({
    day: 'Monday',
    startTime: '08:00',
    endTime: '08:45',
    learningAreaId: '',
    reason: ''
  });
  const [formData, setFormData] = useState({
    subject: '',
    day: 'Monday',
    startTime: '08:00',
    endTime: '08:45',
    room: '',
    teacherId: '',
    learningAreaId: '',
    semester: 'TERM_1',
    academicYear: new Date().getFullYear().toString()
  });

  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [eligibleTeachers, setEligibleTeachers] = useState([]);
  const [loadingEligible, setLoadingEligible] = useState(false);

  // Fetch subjects for this grade
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const resp = await api.config.getLearningAreas();
        // Since grade can be mapped differently, we filter by what fits or just show all for now
        // Ideally we filter by classData.grade
        const filtered = resp.data?.filter(s => s.gradeLevel === classData.grade) || [];
        setAvailableSubjects(filtered.length > 0 ? filtered : resp.data || []);
      } catch (err) {
        console.error('Failed to fetch subjects', err);
      }
    };
    fetchSubjects();
  }, [classData.grade]);

  // Fetch eligible teachers when subject changes
  useEffect(() => {
    const fetchEligible = async () => {
      if (!formData.learningAreaId) {
        setEligibleTeachers([]);
        return;
      }
      setLoadingEligible(true);
      try {
        const resp = await api.subjectAssignments.getEligibleTeachers(formData.learningAreaId, classData.grade);
        setEligibleTeachers(resp.data || []);
      } catch (err) {
        console.error('Failed to fetch eligible teachers', err);
      } finally {
        setLoadingEligible(false);
      }
    };
    fetchEligible();
  }, [formData.learningAreaId, classData.grade]);

  const handleAddClick = () => {
    setEditingSchedule(null);
    setFormData({
      subject: '',
      day: 'Monday',
      startTime: '08:00',
      endTime: '08:45',
      room: '',
      teacherId: '',
      learningAreaId: '',
      semester: 'TERM_1',
      academicYear: new Date().getFullYear().toString()
    });
    setShowAddForm(true);
  };

  const handleEmptySlotClick = (day, startTime) => {
    const slotIndex = TIME_SLOTS.indexOf(startTime);
    setEditingSchedule(null);
    setFormData({
      subject: '',
      day,
      startTime,
      endTime: TIME_SLOTS[slotIndex + 1] || startTime,
      room: '',
      teacherId: '',
      learningAreaId: '',
      semester: 'TERM_1',
      academicYear: new Date().getFullYear().toString()
    });
    setShowAddForm(true);
  };

  const handleEditClick = (schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      subject: schedule.subject,
      day: schedule.day,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      room: schedule.room || '',
      teacherId: schedule.teacherId || '',
      learningAreaId: schedule.learningAreaId || '',
      semester: schedule.semester,
      academicYear: schedule.academicYear
    });
    setShowAddForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingSchedule) {
        await api.classes.updateSchedule(classData.id, editingSchedule.id, formData);
      } else {
        await api.classes.addSchedule(classData.id, formData);
      }
      setShowAddForm(false);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to save schedule:', error);
      alert(error.message || 'Failed to save schedule');
    }
  };

  const handleDelete = async (scheduleId) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      try {
        await api.classes.deleteSchedule(classData.id, scheduleId);
        onRefresh?.();
      } catch (error) {
        console.error('Failed to delete schedule:', error);
      }
    }
  };

  const handleRequestClick = (prefill = {}) => {
    setRequestData({
      day: prefill.day || 'Monday',
      startTime: prefill.startTime || '08:00',
      endTime: prefill.endTime || '08:45',
      learningAreaId: prefill.learningAreaId || '',
      reason: ''
    });
    setShowRequestForm(true);
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setSubmittingRequest(true);
    try {
      await api.timetable.createChangeRequest({
        classId: classData.id,
        day: requestData.day,
        startTime: requestData.startTime,
        endTime: requestData.endTime,
        learningAreaId: requestData.learningAreaId || null,
        reason: requestData.reason
      });
      setShowRequestForm(false);
      alert('Change request submitted. An administrator will review it.');
    } catch (error) {
      console.error('Failed to submit change request:', error);
      alert(error.message || 'Failed to submit change request');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const schedules = classData.schedules || [];

  // Generate weekly grid view
  const WeeklyGrid = () => {
    const grid = {};

    DAYS.forEach(day => {
      grid[day] = TIME_SLOTS.map(time => {
        const schedule = schedules.find(
          s => s.day === day && s.startTime === time
        );
        return schedule;
      });
    });

    return (
      <div className="overflow-x-auto">
        <div className="grid gap-2" style={{ gridTemplateColumns: `80px repeat(${DAYS.length}, 1fr)` }}>
          {/* Header */}
          <div className="font-medium p-2 bg-gray-100"></div>
          {DAYS.map(day => (
            <div key={day} className="font-medium p-2 bg-gray-100 text-center text-sm">
              {day.substr(0, 3)}
            </div>
          ))}

          {/* Time slots */}
          {TIME_SLOTS.map(time => (
            <React.Fragment key={time}>
              <div className="font-medium p-2 bg-gray-50 text-xs">{time}</div>
              {DAYS.map(day => {
                const schedule = schedules.find(
                  s => s.day === day && s.startTime === time
                );
                return (
                  <div
                    key={`${day}-${time}`}
                    className="p-2 border border-gray-100 min-h-[60px] hover:bg-purple-50 transition-colors cursor-pointer group/cell relative"
                    onClick={() => {
                      if (canEditTimetable) {
                        if (schedule) handleEditClick(schedule);
                        else handleEmptySlotClick(day, time);
                      } else {
                        handleRequestClick({
                          day,
                          startTime: time,
                          endTime: TIME_SLOTS[TIME_SLOTS.indexOf(time) + 1] || time,
                          learningAreaId: schedule?.learningAreaId || ''
                        });
                      }
                    }}
                  >
                    {schedule ? (
                      <div className="bg-white border-l-4 border-purple-500 rounded shadow-sm p-1.5 text-[10px] h-full flex flex-col justify-between">
                        <div>
                          <p className="font-medium text-gray-900 truncate">{schedule.subject}</p>
                          <div className="flex items-center gap-1 text-gray-500 mt-1 uppercase tracking-tighter text-[8px]">
                            <User size={8} />
                            <span className="truncate">
                              {schedule.teacher ? `${schedule.teacher.firstName} ${schedule.teacher.lastName}` : 'No Tutor'}
                            </span>
                          </div>
                        </div>
                        {schedule.room && (
                          <div className="flex items-center gap-1 text-purple-600 mt-0.5 text-[8px]">
                            <MapPin size={8} />
                            <span className="truncate">{schedule.room}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-[10px] font-medium text-gray-300 opacity-70 transition-opacity group-hover/cell:text-purple-600 group-hover/cell:opacity-100">
                        <Plus size={14} />
                        <span>{canEditTimetable ? 'Add lesson' : 'Request'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  // Table view
  const TableView = () => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-[color:var(--table-border)]">
            <th className="text-left p-3 font-semibold text-[color:var(--table-header-fg)]">Subject</th>
            <th className="text-left p-3 font-semibold text-[color:var(--table-header-fg)]">Day</th>
            <th className="text-left p-3 font-semibold text-[color:var(--table-header-fg)]">Time</th>
            <th className="text-left p-3 font-semibold text-[color:var(--table-header-fg)]">Room</th>
            <th className="text-left p-3 font-semibold text-[color:var(--table-header-fg)]">Teacher</th>
            <th className="text-right p-3 font-semibold text-[color:var(--table-header-fg)]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map(schedule => (
            <tr key={schedule.id} className="border-b hover:bg-gray-50/50 transition-colors group">
              <td className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
                    <BookOpen size={16} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{schedule.subject}</h4>
                    {schedule.learningArea && <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{schedule.learningArea.shortName}</p>}
                  </div>
                </div>
              </td>
              <td className="p-4">
                <Badge variant="outline" className="font-medium text-gray-700 bg-white shadow-sm border-gray-200">
                  {schedule.day}
                </Badge>
              </td>
              <td className="p-4">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                  <Clock size={14} className="text-gray-400" />
                  {schedule.startTime} - {schedule.endTime}
                </div>
              </td>
              <td className="p-4">
                {schedule.room ? (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <MapPin size={14} className="text-purple-400" />
                    {schedule.room}
                  </div>
                ) : <span className="text-gray-300 text-sm">—</span>}
              </td>
              <td className="p-4">
                {schedule.teacher ? (
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-medium text-indigo-600">
                      {schedule.teacher.firstName?.charAt(0)}{schedule.teacher.lastName?.charAt(0)}
                    </div>
                    <div className="text-sm font-medium text-gray-800">
                      {schedule.teacher.firstName} {schedule.teacher.lastName}
                    </div>
                  </div>
                ) : (
                  <span className="text-amber-500 text-xs italic flex items-center gap-1 font-medium">
                    <AlertCircle size={12} />
                    Unassigned
                  </span>
                )}
              </td>
              <td className="p-4 text-right space-x-2">
                {canEditTimetable ? (
                  <>
                    <button
                      onClick={() => handleEditClick(schedule)}
                      className="p-2 hover:bg-blue-100 rounded text-blue-600 transition"
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(schedule.id)}
                      className="p-2 hover:bg-red-100 rounded text-red-600 transition"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleRequestClick({
                      day: schedule.day,
                      startTime: schedule.startTime,
                      endTime: schedule.endTime,
                      learningAreaId: schedule.learningAreaId || ''
                    })}
                    className="p-2 hover:bg-purple-100 rounded text-purple-600 transition"
                    title="Request a change to this lesson"
                  >
                    <MessageSquarePlus size={16} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Class Schedule</h3>
          <p className="text-sm text-gray-500 mt-1">{schedules.length} lessons scheduled</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 bg-gray-100 p-1 rounded">
            <button
              onClick={() => setViewType('table')}
              className={`px-3 py-1 rounded text-sm font-medium transition ${viewType === 'table'
                ? 'bg-white shadow'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewType('grid')}
              className={`px-3 py-1 rounded text-sm font-medium transition ${viewType === 'grid'
                ? 'bg-white shadow'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Grid
            </button>
          </div>
          {canEditTimetable ? (
            <Button
              onClick={handleAddClick}
              className="bg-purple-600 hover:bg-purple-700"
              size="sm"
            >
              <Plus size={16} />
              Add Schedule
            </Button>
          ) : (
            <Button
              onClick={() => handleRequestClick()}
              className="bg-purple-600 hover:bg-purple-700"
              size="sm"
            >
              <MessageSquarePlus size={16} />
              Request Change
            </Button>
          )}
        </div>
      </div>

      {/* Schedule Content */}
      {schedules.length > 0 ? (
        <div className="border rounded-lg overflow-hidden bg-white">
          {viewType === 'table' ? <TableView /> : <WeeklyGrid />}
        </div>
      ) : (
        <Card className="border-2 border-dashed">
          <CardContent className="py-12 text-center">
            <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 font-semibold">No schedules created yet</p>
            <p className="text-sm text-gray-500 mt-1">Create a schedule to organize class lessons</p>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      {showAddForm && (
        <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingSchedule ? 'Edit Schedule' : 'Add Schedule'}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Subject */}
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase">Subject *</label>
                <select
                  value={formData.learningAreaId}
                  onChange={(e) => {
                    const areaId = e.target.value;
                    const area = availableSubjects.find(s => s.id === areaId);
                    setFormData({
                      ...formData,
                      learningAreaId: areaId,
                      subject: area ? area.name : formData.subject
                    });
                  }}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Select Subject</option>
                  {availableSubjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.shortName})</option>
                  ))}
                </select>
              </div>

              {/* Day & Time Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase">Day *</label>
                  <select
                    value={formData.day}
                    onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase">Room</label>
                  <input
                    type="text"
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Room"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase">Start Time *</label>
                  <select
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    {TIME_SLOTS.map(time => <option key={time} value={time}>{time}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase">End Time *</label>
                  <select
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    {TIME_SLOTS.map(time => <option key={time} value={time}>{time}</option>)}
                  </select>
                </div>
              </div>

              {/* Teacher */}
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase flex justify-between">
                  <span>Assigned Teacher (Tutor) *</span>
                  {loadingEligible && <span className="text-purple-600 animate-pulse text-[10px]">Checking assignments...</span>}
                </label>
                <select
                  value={formData.teacherId}
                  onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                  disabled={loadingEligible || !formData.learningAreaId}
                >
                  <option value="">Select Assigned Tutor</option>
                  {eligibleTeachers.map(t => (
                    <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                  ))}
                  {!loadingEligible && formData.learningAreaId && eligibleTeachers.length === 0 && (
                    <option value="" disabled className="text-red-500">No tutors assigned to this subject</option>
                  )}
                </select>
                {formData.learningAreaId && eligibleTeachers.length === 0 && !loadingEligible && (
                  <p className="mt-1 text-[10px] text-amber-600 font-medium">
                    Please assign tutors to this subject in <span className="underline">Academic Settings &gt; Subject Allocation</span>
                  </p>
                )}
              </div>

              {/* Semester */}
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase">Term</label>
                <select
                  value={formData.semester}
                  onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="TERM_1">Term 1</option>
                  <option value="TERM_2">Term 2</option>
                  <option value="TERM_3">Term 3</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {editingSchedule ? 'Update Schedule' : 'Add Schedule'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Change Request Dialog (teachers/tutors without edit rights) */}
      {showRequestForm && (
        <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request Schedule Change</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-gray-500 -mt-2">
              Submitted requests are reviewed by an administrator before any change is applied.
            </p>
            <form onSubmit={handleRequestSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase">Subject</label>
                <select
                  value={requestData.learningAreaId}
                  onChange={(e) => setRequestData({ ...requestData, learningAreaId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">No subject preference</option>
                  {availableSubjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.shortName})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase">Day *</label>
                  <select
                    value={requestData.day}
                    onChange={(e) => setRequestData({ ...requestData, day: e.target.value })}
                    className="w-full mt-1 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase">Start *</label>
                  <select
                    value={requestData.startTime}
                    onChange={(e) => setRequestData({ ...requestData, startTime: e.target.value })}
                    className="w-full mt-1 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    {TIME_SLOTS.map(time => <option key={time} value={time}>{time}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase">End *</label>
                  <select
                    value={requestData.endTime}
                    onChange={(e) => setRequestData({ ...requestData, endTime: e.target.value })}
                    className="w-full mt-1 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    {TIME_SLOTS.map(time => <option key={time} value={time}>{time}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase">Reason *</label>
                <textarea
                  value={requestData.reason}
                  onChange={(e) => setRequestData({ ...requestData, reason: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                  placeholder="Explain why this change is needed"
                  required
                  minLength={5}
                />
              </div>
              <div className="flex gap-2 pt-4 border-t">
                <Button type="button" onClick={() => setShowRequestForm(false)} variant="ghost">
                  Cancel
                </Button>
                <Button type="submit" className="bg-purple-600 hover:bg-purple-700" disabled={submittingRequest}>
                  {submittingRequest ? 'Submitting…' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ClassScheduleTab;
