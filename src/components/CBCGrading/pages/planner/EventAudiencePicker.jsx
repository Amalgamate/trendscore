/**
 * EventAudiencePicker
 *
 * Who an event is for, and which classes it reaches.
 *   audience: empty = everyone, otherwise any of STAFF, TEACHERS, PARENTS, STUDENTS, DRIVERS
 *   classIds: empty = whole school; only applies to parents and students
 *
 * Classes exist once per term, so they are grouped by grade and stream and one
 * id is stored per group. The server matches families on grade and stream, so
 * the event keeps reaching the same classes in later terms.
 */

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../../services/api';
import { usePermissions } from '../../../../hooks/usePermissions';

const AUDIENCES = [
  { id: 'STAFF', label: 'All staff', hint: 'Every staff member, teachers included' },
  { id: 'TEACHERS', label: 'Teachers', hint: 'Teaching staff only' },
  { id: 'PARENTS', label: 'Parents', hint: 'Parents and guardians' },
  { id: 'STUDENTS', label: 'Students', hint: 'Student accounts' },
  { id: 'DRIVERS', label: 'Drivers', hint: 'Transport staff' },
];

const TERM_ORDER = { TERM_1: 1, TERM_2: 2, TERM_3: 3 };
const reachesFamilies = (audience) =>
  audience.length === 0 || audience.includes('PARENTS') || audience.includes('STUDENTS');

const groupKey = (c) => `${c.grade}|${c.stream || ''}`;
const naturalSort = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/** Playgroup, PP1, PP2, then Grade 1 upwards. */
const gradeRank = (grade) => {
  const g = String(grade || '').toUpperCase();
  if (g === 'PLAYGROUP') return -3;
  if (g === 'PP1') return -2;
  if (g === 'PP2') return -1;
  const m = /^GRADE_?(\d+)$/.exec(g);
  return m ? Number(m[1]) : 999;
};

const formatGrade = (grade) => {
  const s = String(grade || '');
  const m = /^GRADE_?(\d+)$/i.exec(s);
  if (m) return `Grade ${m[1]}`;
  if (/^playgroup$/i.test(s)) return 'Playgroup';
  return s.replace(/_/g, ' ');
};

function chip(active) {
  return `px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${
    active
      ? 'bg-blue-600 text-white border-blue-600'
      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
  }`;
}

export default function EventAudiencePicker({ audience = [], classIds = [], onChange }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const { isAnyRole } = usePermissions();
  const canManageClasses = isAnyRole(['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER']);

  // Always ask for a fresh list, so a class added a minute ago is not hidden by the cache.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.config.getClasses({ fresh: true });
        const list = res?.data ?? res ?? [];
        if (!cancelled) setClasses(Array.isArray(list) ? list : []);
      } catch (error) {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // One entry per grade + stream. The newest class row is the one stored.
  const { groups, latestYear } = useMemo(() => {
    const map = new Map();
    classes.forEach((c) => {
      const key = groupKey(c);
      const entry = map.get(key) || { key, label: c.name || `${c.grade} ${c.stream || ''}`.trim(), ids: [], rep: c };
      entry.ids.push(c.id);
      const newer =
        (c.academicYear || 0) > (entry.rep.academicYear || 0) ||
        ((c.academicYear || 0) === (entry.rep.academicYear || 0) &&
          (TERM_ORDER[c.term] || 0) > (TERM_ORDER[entry.rep.term] || 0));
      if (newer) {
        entry.rep = c;
        entry.label = c.name || entry.label;
      }
      map.set(key, entry);
    });
    const latest = Math.max(0, ...classes.map((c) => c.academicYear || 0));
    const list = Array.from(map.values())
      // Older classes stay listed only while an event still points at them, so they can be unticked.
      .filter((g) => (g.rep.academicYear || 0) === latest || g.ids.some((id) => classIds.includes(id)))
      .map((g) => ({ ...g, older: (g.rep.academicYear || 0) < latest }))
      .sort(
        (a, b) =>
          gradeRank(a.rep.grade) - gradeRank(b.rep.grade) ||
          naturalSort(a.rep.grade || '', b.rep.grade || '') ||
          naturalSort(a.rep.stream || '', b.rep.stream || ''),
      );
    return { groups: list, latestYear: latest };
  }, [classes, classIds]);

  // Group the grid under one heading per grade.
  const grades = useMemo(() => {
    const byGrade = new Map();
    groups.forEach((g) => {
      const list = byGrade.get(g.rep.grade) || [];
      list.push(g);
      byGrade.set(g.rep.grade, list);
    });
    return Array.from(byGrade.entries()).map(([grade, items]) => ({ grade, items }));
  }, [groups]);

  const isEveryone = audience.length === 0;
  const canTargetClasses = reachesFamilies(audience);

  const emit = (nextAudience, nextClassIds) => {
    // Class targeting is meaningless once families are excluded.
    onChange({
      audience: nextAudience,
      classIds: reachesFamilies(nextAudience) ? nextClassIds : [],
    });
  };

  const toggleAudience = (id) => {
    const next = audience.includes(id) ? audience.filter((a) => a !== id) : [...audience, id];
    emit(next, classIds);
  };

  const isSelected = (group) => group.ids.some((id) => classIds.includes(id));
  const selectedGroups = groups.filter(isSelected);

  const toggleGroup = (group) => {
    const stripped = classIds.filter((id) => !group.ids.includes(id));
    emit(audience, isSelected(group) ? stripped : [...stripped, group.rep.id]);
  };

  // Select or clear every stream of one grade in a single click.
  const toggleGrade = (items) => {
    const allSelected = items.every(isSelected);
    const itemIds = items.flatMap((g) => g.ids);
    const stripped = classIds.filter((id) => !itemIds.includes(id));
    emit(audience, allSelected ? stripped : [...stripped, ...items.map((g) => g.rep.id)]);
  };

  const summary = (() => {
    const who = isEveryone
      ? 'Everyone'
      : AUDIENCES.filter((a) => audience.includes(a.id)).map((a) => a.label.toLowerCase()).join(', ');
    if (!canTargetClasses || classIds.length === 0) return `${who}${canTargetClasses ? ', all classes' : ''}`;
    const names = selectedGroups.map((g) => g.label);
    return `${who}, ${names.length ? names.join(', ') : `${classIds.length} selected class${classIds.length === 1 ? '' : 'es'}`}`;
  })();

  const emptyMessage = canManageClasses
    ? 'No classes are set up yet. Add them under Classes. Until then, this date goes to the whole school.'
    : 'No classes are set up yet. Ask an admin to add them. Until then, this date goes to the whole school.';

  return (
    <div className="flex flex-col gap-3 p-3.5 bg-slate-50 border rounded-2xl mt-2">
      <div>
        <span className="font-bold text-sm text-slate-800">Who is this for?</span>
        <p className="text-[10px] text-slate-400 mt-0.5">Only the people you choose will see this date.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Audience">
        <button type="button" className={chip(isEveryone)} aria-pressed={isEveryone} onClick={() => emit([], [])}>
          Everyone
        </button>
        {AUDIENCES.map((a) => (
          <button
            key={a.id}
            type="button"
            title={a.hint}
            className={chip(audience.includes(a.id))}
            aria-pressed={audience.includes(a.id)}
            onClick={() => toggleAudience(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {canTargetClasses && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Classes</span>
            {classIds.length > 0 && (
              <button type="button" className="text-[11px] font-bold text-blue-600 hover:underline" onClick={() => emit(audience, [])}>
                Clear, whole school
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-xs text-slate-400" role="status">Loading classes…</p>
          ) : loadFailed ? (
            <p className="text-xs text-rose-600">Classes could not be loaded. The date will go to the whole school.</p>
          ) : groups.length === 0 ? (
            <p className="text-xs text-slate-400">{emptyMessage}</p>
          ) : (
            <div className="flex flex-col gap-3 max-h-48 overflow-y-auto pr-1">
              {grades.map(({ grade, items }) => {
                const allSelected = items.every(isSelected);
                return (
                  <div key={grade} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                        {formatGrade(grade)}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          className="text-[11px] font-bold text-blue-600 hover:underline"
                          onClick={() => toggleGrade(items)}
                        >
                          {allSelected ? 'Clear grade' : 'Whole grade'}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {items.map((g) => {
                        const checked = isSelected(g);
                        return (
                          <label
                            key={g.key}
                            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer ${
                              checked ? 'bg-blue-50 border-blue-300 text-blue-800 font-bold' : 'bg-white border-slate-200 text-slate-600'
                            }`}
                            title={g.older ? `Last used in ${g.rep.academicYear}, not in ${latestYear}` : undefined}
                          >
                            <input type="checkbox" checked={checked} onChange={() => toggleGroup(g)} />
                            <span className="truncate">{g.label}</span>
                            {g.older && <span className="text-[9px] uppercase text-amber-600 shrink-0">older</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-slate-400">
            Leave all unticked to reach every class. Class choices apply to parents and students only.
          </p>
        </div>
      )}

      <p className="text-xs font-semibold text-slate-600 border-t pt-3">Visible to: {summary}</p>
    </div>
  );
}
