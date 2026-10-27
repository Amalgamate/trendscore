import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Plus, Trash2, Users, Pencil, X } from 'lucide-react';
import axiosInstance from '../../../../services/api/axiosConfig';
import { usePermissions } from '../../../../hooks/usePermissions';
import { useAuth } from '../../../../hooks/useAuth';

const initialAssignment = { teacherId: '', dutyDate: '', role: '', notes: '' };
const extractApiErrorMessage = (e, fallback) => (
  e?.response?.data?.error?.message
  || e?.response?.data?.message
  || e?.message
  || fallback
);

export default function DutyRosterPage() {
  const { user } = useAuth();
  const { isAnyRole } = usePermissions();
  const canManageRosters = isAnyRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER']);
  const canDeleteRosters = isAnyRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rosters, setRosters] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState({
    title: '',
    frequency: 'DAILY',
    startDate: '',
    endDate: '',
    reminderEnabled: true,
    isActive: true
  });
  const [assignment, setAssignment] = useState(initialAssignment);
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState('');
  const [editingRosterId, setEditingRosterId] = useState(null);

  const teacherNameById = useMemo(() => {
    const map = new Map();
    teachers.forEach((t) => map.set(t.id, `${t.firstName} ${t.lastName}`));
    return map;
  }, [teachers]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [rosterRes, teacherRes] = await Promise.all([
        axiosInstance.get('/duty-rosters'),
        axiosInstance.get('/duty-rosters/teachers')
      ]);
      setRosters(rosterRes.data?.data || []);
      setTeachers(teacherRes.data?.data || []);
    } catch (e) {
      setError(extractApiErrorMessage(e, 'Failed to load duty roster data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addAssignment = () => {
    if (!assignment.teacherId || !assignment.dutyDate) return;
    setAssignments((prev) => [...prev, assignment]);
    setAssignment(initialAssignment);
  };

  const removeAssignment = (index) => {
    setAssignments((prev) => prev.filter((_, i) => i !== index));
  };

  const createRoster = async () => {
    if (!form.title || !form.startDate) {
      setError('Title and start date are required');
      return;
    }
    if (assignments.length === 0) {
      setError('Add at least one duty assignment');
      return;
    }
    if (form.endDate && form.endDate < form.startDate) {
      setError('End date must be on or after the start date');
      return;
    }
    if (assignments.some((a) => a.dutyDate < form.startDate || (form.endDate && a.dutyDate > form.endDate))) {
      setError('Every duty assignment must fall within the roster date range');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        endDate: form.endDate || null,
        assignments: assignments.map((a) => ({
          teacherId: a.teacherId,
          dutyDate: a.dutyDate,
          role: a.role || undefined,
          notes: a.notes || undefined
        }))
      };
      if (editingRosterId) {
        await axiosInstance.put(`/duty-rosters/${editingRosterId}`, payload);
      } else {
        await axiosInstance.post('/duty-rosters', payload);
      }
      setForm({
        title: '',
        frequency: 'DAILY',
        startDate: '',
        endDate: '',
        reminderEnabled: true,
        isActive: true
      });
      setAssignments([]);
      setEditingRosterId(null);
      await loadData();
    } catch (e) {
      setError(extractApiErrorMessage(e, 'Failed to create duty roster'));
    } finally {
      setSaving(false);
    }
  };

  const editRoster = (roster) => {
    setEditingRosterId(roster.id);
    setForm({
      title: roster.title || '',
      frequency: roster.frequency || 'DAILY',
      startDate: roster.startDate ? new Date(roster.startDate).toISOString().slice(0, 10) : '',
      endDate: roster.endDate ? new Date(roster.endDate).toISOString().slice(0, 10) : '',
      reminderEnabled: roster.reminderEnabled ?? true,
      isActive: roster.isActive ?? true,
    });
    setAssignments((roster.assignments || []).map((item) => ({
      teacherId: item.teacherId,
      dutyDate: new Date(item.dutyDate).toISOString().slice(0, 10),
      role: item.role || '',
      notes: item.notes || '',
    })));
    setAssignment(initialAssignment);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingRosterId(null);
    setForm({ title: '', frequency: 'DAILY', startDate: '', endDate: '', reminderEnabled: true, isActive: true });
    setAssignments([]);
    setAssignment(initialAssignment);
    setError('');
  };

  const canEditRoster = (roster) => (
    canManageRosters && (canDeleteRosters || roster.createdById === user?.id)
  );

  const deleteRoster = async (id) => {
    const ok = window.confirm('Delete this duty roster?');
    if (!ok) return;
    try {
      await axiosInstance.delete(`/duty-rosters/${id}`);
      await loadData();
    } catch (e) {
      setError(extractApiErrorMessage(e, 'Failed to delete roster'));
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <Calendar size={18} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Duty Roster</h2>
            <p className="text-sm text-gray-500">Create a roster, add each duty date, and send reminders for saved assignments.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <input className="px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Roster title"
            value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          <select className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            value={form.frequency} onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value }))}>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
          </select>
          <input type="date" className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
          <input type="date" className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.reminderEnabled}
              onChange={(e) => setForm((p) => ({ ...p, reminderEnabled: e.target.checked }))} />
            Enable reminders
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
            Active roster
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-500">Frequency labels the roster. Add each duty date below; reminders use the saved assignment dates.</p>

        <div className="mt-5 border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Users size={16} /> Assign Teachers
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              value={assignment.teacherId}
              onChange={(e) => setAssignment((p) => ({ ...p, teacherId: e.target.value }))}>
              <option value="">Select teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
              ))}
            </select>
            <input type="date" className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              value={assignment.dutyDate}
              onChange={(e) => setAssignment((p) => ({ ...p, dutyDate: e.target.value }))} />
            <input className="px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Role (optional)"
              value={assignment.role}
              onChange={(e) => setAssignment((p) => ({ ...p, role: e.target.value }))} />
            <button type="button" onClick={addAssignment}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
              <Plus size={16} /> Add
            </button>
          </div>

          {assignments.length > 0 && (
            <div className="mt-3 rounded-xl border border-gray-200 divide-y">
              {assignments.map((a, idx) => (
                <div key={`${a.teacherId}-${a.dutyDate}-${idx}`} className="px-3 py-2 flex items-center justify-between">
                  <div className="text-sm text-gray-800">
                    {teacherNameById.get(a.teacherId) || a.teacherId} • {a.dutyDate}{a.role ? ` • ${a.role}` : ''}
                  </div>
                  <button onClick={() => removeAssignment(idx)} className="text-red-600 hover:text-red-700">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
            <button onClick={createRoster} disabled={saving || !canManageRosters}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60">
            {saving ? 'Saving...' : editingRosterId ? 'Save Duty Roster' : 'Create Duty Roster'}
          </button>
          {editingRosterId && <button type="button" onClick={cancelEdit} className="ml-2 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"><X size={14} /> Cancel edit</button>}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-3">Existing Duty Rosters</h3>
        {loading ? (
          <p className="text-sm text-gray-500">Loading rosters...</p>
        ) : rosters.length === 0 ? (
          <p className="text-sm text-gray-500">No duty rosters yet.</p>
        ) : (
          <div className="space-y-3">
            {rosters.map((r) => (
              <div key={r.id} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{r.title}</p>
                    <p className="text-xs text-gray-500">
                      {r.frequency} • {r.isActive ? 'Active' : 'Inactive'} • {r.assignments?.length || 0} assignment(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEditRoster(r) && <button type="button" onClick={() => editRoster(r)} className="rounded p-1 text-blue-600 hover:bg-blue-50" aria-label={`Edit ${r.title}`}><Pencil size={16} /></button>}
                    {canDeleteRosters && <button type="button" onClick={() => deleteRoster(r.id)} className="rounded p-1 text-red-600 hover:bg-red-50" aria-label={`Delete ${r.title}`}><Trash2 size={16} /></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
