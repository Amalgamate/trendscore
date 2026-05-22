/**
 * PathwaysWizard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Redesigned Pathways tab for the Learner Profile.
 *
 * Layout (no vertical scroll):
 *   ┌──────────────────────────────┬──────────────────────────────────────────┐
 *   │  LEFT: Multi-step wizard     │  RIGHT: Live Pathway Slip + Compliance   │
 *   │  Step 1 – Pick Pathway       │                                          │
 *   │  Step 2 – Core subjects      │  Preview updates as wizard progresses    │
 *   │  Step 3 – Electives by cat.  │  Compliance check below the slip         │
 *   │  Step 4 – Review & Save      │                                          │
 *   └──────────────────────────────┴──────────────────────────────────────────┘
 *
 * Drop-in replacement: receives the same props that LearnerProfile already
 * passes to the pathways section. No external state needed – all contained.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  Lock,
  RefreshCw,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react';
import api from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';
import { drawStandardHeader, getSchoolBranding, hexToRgb } from '../../../../utils/brandingUtils';

// ─── tiny helpers ────────────────────────────────────────────────────────────

const normalizeGrade = (v) =>
  String(v || '')
    .trim()
    .toUpperCase()
    .replace(/^GRADE_(\d+)$/, 'GRADE$1');

const gradeLabel = (v) =>
  String(v || '').replace('GRADE', 'Grade ').replace('_', ' ').trim();

const pathwayColor = {
  STEM: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    dot: 'bg-blue-500',
    activeBg: 'bg-blue-600',
  },
  SOCIAL_SCIENCES: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
    activeBg: 'bg-amber-500',
  },
  ARTS_SPORTS: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    activeBg: 'bg-emerald-600',
  },
};

const catColorPalette = [
  { pill: 'bg-violet-100 border-violet-200 text-violet-800', dot: 'bg-violet-500', badge: 'bg-violet-600' },
  { pill: 'bg-cyan-100 border-cyan-200 text-cyan-800', dot: 'bg-cyan-500', badge: 'bg-cyan-600' },
  { pill: 'bg-rose-100 border-rose-200 text-rose-800', dot: 'bg-rose-500', badge: 'bg-rose-600' },
  { pill: 'bg-orange-100 border-orange-200 text-orange-800', dot: 'bg-orange-500', badge: 'bg-orange-600' },
  { pill: 'bg-teal-100 border-teal-200 text-teal-800', dot: 'bg-teal-500', badge: 'bg-teal-600' },
];

const STEPS = [
  { id: 1, label: 'Pathway' },
  { id: 2, label: 'Core' },
  { id: 3, label: 'Electives' },
  { id: 4, label: 'Review' },
];

const getOfficialAreaCode = (area) =>
  String(area?.code || area?.officialLearningArea?.code || '').toUpperCase();

const getOfficialAreaName = (area) =>
  area?.name || area?.officialLearningArea?.name || 'Unnamed subject';

// ─── component ───────────────────────────────────────────────────────────────

const PathwaysWizard = ({ learner, brandingSettings }) => {
  const { showSuccess, showError } = useNotifications();

  // raw data
  const [pathwayCatalog, setPathwayCatalog] = useState([]);
  const [pathwayCategories, setPathwayCategories] = useState([]);
  const [pathwaySubjects, setPathwaySubjects] = useState([]);
  const [officialCatalog, setOfficialCatalog] = useState(null);
  const [officialCombinations, setOfficialCombinations] = useState([]);

  // selection state
  const [selectedPathwayCode, setSelectedPathwayCode] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(new Set());
  const [selectedOfficialCombinationId, setSelectedOfficialCombinationId] = useState('');

  // ui state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subjectSelectionLocked, setSubjectSelectionLocked] = useState(false);
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // ── derived ────────────────────────────────────────────────────────────────

  const learnerGrade = normalizeGrade(learner?.grade);

  const corePathwayId = useMemo(
    () => pathwayCatalog.find((p) => p.code === 'CORE')?.id || null,
    [pathwayCatalog]
  );

  const isCoreSubject = useCallback(
    (row) =>
      Boolean(row?.isCore) ||
      (corePathwayId && row?.pathwayId === corePathwayId) ||
      String(row?.pathway || '').toUpperCase() === 'CORE',
    [corePathwayId]
  );

  const selectedPathway = useMemo(
    () => pathwayCatalog.find((p) => p.code === selectedPathwayCode) || null,
    [pathwayCatalog, selectedPathwayCode]
  );

  const selectedOfficialPathway = useMemo(
    () =>
      officialCatalog?.pathways?.find((p) => p.code === selectedPathwayCode) ||
      null,
    [officialCatalog, selectedPathwayCode]
  );

  const selectedOfficialCombination = useMemo(
    () =>
      officialCombinations.find((combo) => combo.id === selectedOfficialCombinationId) ||
      null,
    [officialCombinations, selectedOfficialCombinationId]
  );

  const officialCoreSubjects = useMemo(() => {
    const core = officialCatalog?.coreSubjects || [];
    const findByCode = (code) =>
      core.find((area) => getOfficialAreaCode(area) === code);
    const mathCode = selectedPathwayCode === 'STEM' ? 'CORE_MATH' : 'ESS_MATH';
    return [
      findByCode('ENG'),
      findByCode('KIS') || findByCode('KSL'),
      findByCode(mathCode),
      findByCode('CSL'),
    ].filter(Boolean);
  }, [officialCatalog, selectedPathwayCode]);

  const officialSupportSubjects = useMemo(() => {
    const support = officialCatalog?.supportSubjects || [];
    return support.filter((area) =>
      ['PE', 'ICT'].includes(getOfficialAreaCode(area))
    );
  }, [officialCatalog]);

  const officialSelectedAreas = useMemo(() => {
    if (!selectedOfficialCombination) return [];
    const optional = (selectedOfficialCombination.items || [])
      .map((item) => item.officialLearningArea)
      .filter(Boolean);
    return [...officialCoreSubjects, ...optional, ...officialSupportSubjects];
  }, [selectedOfficialCombination, officialCoreSubjects, officialSupportSubjects]);

  const officialModeAvailable = officialCombinations.length > 0;
  const officialSelectionReady =
    officialModeAvailable &&
    Boolean(selectedOfficialPathway?.id && selectedOfficialCombination?.id) &&
    officialCoreSubjects.length === 4;

  const categoryById = useMemo(
    () => new Map(pathwayCategories.map((c) => [c.id, c])),
    [pathwayCategories]
  );

  const categoryIdSet = useMemo(
    () => new Set(pathwayCategories.map((c) => c.id)),
    [pathwayCategories]
  );

  const resolveCategoryLabel = useCallback(
    (row) => {
      if (isCoreSubject(row)) return 'Core';
      const byId = row?.categoryId ? categoryById.get(row.categoryId) : null;
      if (byId?.name) return byId.name;
      const txt = String(row?.category || '').trim();
      if (txt && txt !== selectedPathwayCode) return txt;
      return 'Pathway Subjects';
    },
    [isCoreSubject, categoryById, selectedPathwayCode]
  );

  // grade-scoped + deduplicated subjects
  const canonicalSubjects = useMemo(() => {
    const gradeRows = pathwaySubjects.filter((row) => {
      if (!learnerGrade) return true;
      return normalizeGrade(row?.gradeLevel) === learnerGrade;
    });

    const scope = gradeRows.length > 0 ? gradeRows : pathwaySubjects;

    const visible = scope.filter((row) => {
      if (isCoreSubject(row)) return true;
      if (selectedPathwayCode) {
        const selectedId = selectedPathway?.id;
        if (row?.categoryId && categoryIdSet.has(row.categoryId)) return true;
        if (selectedId && row?.pathwayId === selectedId) return true;
        if (
          String(row?.pathway || '').toUpperCase() ===
          String(selectedPathwayCode).toUpperCase()
        )
          return true;
      }
      return false;
    });

    const map = new Map();
    visible.forEach((row) => {
      const key = `${String(row?.name || '').trim().toLowerCase()}::${resolveCategoryLabel(row).toLowerCase()}`;
      const score =
        (normalizeGrade(row?.gradeLevel) === learnerGrade ? 4 : 0) +
        (row?.categoryId ? 2 : 0) +
        (row?.pathwayId ? 1 : 0);
      const prev = map.get(key);
      if (!prev || score > prev.score) map.set(key, { row, score });
    });

    return Array.from(map.values())
      .map((x) => x.row)
      .sort(
        (a, b) =>
          Number(isCoreSubject(b)) - Number(isCoreSubject(a)) ||
          String(a.name).localeCompare(String(b.name))
      );
  }, [
    pathwaySubjects,
    learnerGrade,
    isCoreSubject,
    selectedPathwayCode,
    selectedPathway,
    categoryIdSet,
    resolveCategoryLabel,
  ]);

  const coreSubjects = useMemo(
    () => canonicalSubjects.filter((r) => isCoreSubject(r)),
    [canonicalSubjects, isCoreSubject]
  );

  const electiveSubjects = useMemo(
    () => canonicalSubjects.filter((r) => !isCoreSubject(r)),
    [canonicalSubjects, isCoreSubject]
  );

  // group electives by category
  const electivesByCategory = useMemo(() => {
    const map = new Map();
    electiveSubjects.forEach((row) => {
      const label = resolveCategoryLabel(row);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(row);
    });
    return Array.from(map.entries()).map(([label, rows], idx) => ({
      label,
      rows,
      colors: catColorPalette[idx % catColorPalette.length],
      category: pathwayCategories.find(
        (c) => c.name === label || c.code === label
      ) || null,
    }));
  }, [electiveSubjects, resolveCategoryLabel, pathwayCategories]);

  // compliance
  const countByCategory = useMemo(() => {
    const selectedAreas = Array.from(selectedSubjectIds)
      .map((id) => canonicalSubjects.find((r) => r.id === id))
      .filter(Boolean);
    return selectedAreas.reduce((acc, row) => {
      const key = row.categoryId || 'UNMAPPED';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [selectedSubjectIds, canonicalSubjects]);

  const complianceIssues = useMemo(() => {
    const issues = [];
    const selectedCoreCount = Array.from(selectedSubjectIds).filter((id) => {
      const r = canonicalSubjects.find((s) => s.id === id);
      return r && isCoreSubject(r);
    }).length;

    if (selectedPathwayCode && selectedCoreCount === 0 && coreSubjects.length > 0) {
      issues.push({ cat: 'Core', msg: 'Core subjects are required.', severity: 'error' });
    }

    pathwayCategories.forEach((cat) => {
      const picked = countByCategory[cat.id] || 0;
      const min = Number(cat.minSelect || 0);
      const max = cat.maxSelect == null ? null : Number(cat.maxSelect);
      if (picked < min)
        issues.push({
          cat: cat.name,
          msg: `Select at least ${min} (have ${picked})`,
          severity: 'error',
        });
      if (max != null && picked > max)
        issues.push({
          cat: cat.name,
          msg: `Max ${max} allowed (have ${picked})`,
          severity: 'warning',
        });
    });
    return issues;
  }, [
    selectedSubjectIds,
    selectedPathwayCode,
    canonicalSubjects,
    isCoreSubject,
    coreSubjects,
    pathwayCategories,
    countByCategory,
  ]);

  const isValid = complianceIssues.length === 0 && !!selectedPathwayCode;
  const canSaveSelection = officialModeAvailable ? officialSelectionReady : isValid;

  const selectedAreas = useMemo(
    () =>
      Array.from(selectedSubjectIds)
        .map((id) => canonicalSubjects.find((r) => r.id === id))
        .filter(Boolean)
        .sort(
          (a, b) =>
            Number(isCoreSubject(b)) - Number(isCoreSubject(a)) ||
            String(a.name).localeCompare(String(b.name))
        ),
    [selectedSubjectIds, canonicalSubjects, isCoreSubject]
  );

  const displaySelectedAreas = useMemo(() => {
    if (!selectedOfficialCombination) {
      return selectedAreas.map((row) => ({
        ...row,
        displayCategory: isCoreSubject(row) ? 'Core' : resolveCategoryLabel(row),
      }));
    }

    const optionalIds = new Set(
      (selectedOfficialCombination.items || [])
        .map((item) => item.officialLearningArea?.id)
        .filter(Boolean)
    );
    const supportIds = new Set(officialSupportSubjects.map((area) => area.id));

    return officialSelectedAreas.map((area) => ({
      id: area.id,
      name: area.name,
      displayCategory: optionalIds.has(area.id)
        ? 'Combination'
        : supportIds.has(area.id)
        ? 'Support'
        : 'Core',
    }));
  }, [
    selectedOfficialCombination,
    selectedAreas,
    isCoreSubject,
    resolveCategoryLabel,
    officialSelectedAreas,
    officialSupportSubjects,
  ]);

  // ── data loading ───────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      if (!learner?.id) return;
      setLoading(true);
      try {
        const [pathwaysRes, learnerPathwayRes, learningAreasRes] =
          await Promise.all([
            api.pathways.listPathways(),
            api.pathways.getLearnerPathwayProfile(learner.id),
            api
              .getLearningAreas({
                institutionType: 'SECONDARY',
                gradeLevel: learner.grade,
              })
              .catch(() => null),
          ]);

        const pathways = pathwaysRes?.data || [];
        const profile = learnerPathwayRes?.data || null;
        setSubjectSelectionLocked(Boolean(profile?.subjectSelectionLocked));
        let areaRows = learningAreasRes?.data || [];
        if (!Array.isArray(areaRows) || areaRows.length === 0) {
          const fb = await api
            .getLearningAreas({ institutionType: 'SECONDARY' })
            .catch(() => null);
          areaRows = fb?.data || [];
        }

        setPathwayCatalog(pathways);
        setPathwaySubjects(Array.isArray(areaRows) ? areaRows : []);

        const [officialCatalogRes, officialSelectionRes] = await Promise.all([
          api.seniorPathways.getCatalog().catch(() => null),
          api.seniorPathways.getLearnerSelection(learner.id).catch(() => null),
        ]);
        const officialData = officialCatalogRes?.data || null;
        const officialSelection = officialSelectionRes?.data || null;
        setOfficialCatalog(officialData);
        if (officialSelection?.combinationRule?.id) {
          setSelectedOfficialCombinationId(officialSelection.combinationRule.id);
        }

        const pathwayCode = profile?.pathway?.code || '';
        if (pathwayCode) {
          setSelectedPathwayCode(pathwayCode);
          const [catRes] = await Promise.all([
            api.pathways.getPathwayCategories(pathwayCode),
          ]);
          setPathwayCategories(catRes?.data?.categories || []);
          setStep(3);
        }

        const activeSelections = profile?.subjectSelections || [];
        const coreRows = (Array.isArray(areaRows) ? areaRows : []).filter(
          (row) =>
            Boolean(row.isCore) ||
            (pathways.find((p) => p.code === 'CORE')?.id &&
              row.pathwayId === pathways.find((p) => p.code === 'CORE')?.id)
        );
        const ids = new Set([
          ...activeSelections
            .map((s) => s?.learningArea?.id)
            .filter(Boolean),
          ...coreRows.map((r) => r.id),
        ]);
        setSelectedSubjectIds(ids);
      } catch (e) {
        showError(e?.message || 'Failed to load pathway data');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learner?.id]);

  useEffect(() => {
    let cancelled = false;
    const loadCombinations = async () => {
      if (!selectedOfficialPathway?.id) {
        setOfficialCombinations([]);
        setSelectedOfficialCombinationId('');
        return;
      }
      const res = await api.seniorPathways
        .getCombinations({ pathwayId: selectedOfficialPathway.id })
        .catch(() => null);
      if (cancelled) return;
      const combos = Array.isArray(res?.data) ? res.data : [];
      setOfficialCombinations(combos);
      setSelectedOfficialCombinationId((current) =>
        combos.some((combo) => combo.id === current) ? current : ''
      );
    };
    loadCombinations();
    return () => {
      cancelled = true;
    };
  }, [selectedOfficialPathway?.id]);

  // auto-select cores when pathway changes
  useEffect(() => {
    if (coreSubjects.length > 0) {
      setSelectedSubjectIds((prev) => {
        const next = new Set(prev);
        coreSubjects.forEach((r) => next.add(r.id));
        return next;
      });
    }
  }, [coreSubjects]);

  // ── actions ────────────────────────────────────────────────────────────────

  const handlePathwaySelect = async (code) => {
    if (subjectSelectionLocked) return;
    if (code === selectedPathwayCode) return;
    setSaving(true);
    try {
      await api.pathways.setLearnerPathway(learner.id, code);
      const [catRes, areasRes] = await Promise.all([
        api.pathways.getPathwayCategories(code),
        api
          .getLearningAreas({
            institutionType: 'SECONDARY',
            gradeLevel: learner.grade,
          })
          .catch(() => null),
      ]);
      let areaRows = areasRes?.data || [];
      if (!Array.isArray(areaRows) || areaRows.length === 0) {
        const fb = await api
          .getLearningAreas({ institutionType: 'SECONDARY' })
          .catch(() => null);
        areaRows = fb?.data || [];
      }
      setPathwayCategories(catRes?.data?.categories || []);
      setPathwaySubjects(Array.isArray(areaRows) ? areaRows : []);
      setSelectedPathwayCode(code);
      setSelectedSubjectIds(new Set());
      setSelectedOfficialCombinationId('');
      showSuccess('Pathway updated');
      setStep(2);
    } catch (e) {
      showError(e?.message || 'Failed to set pathway');
    } finally {
      setSaving(false);
    }
  };

  const toggleSubject = (id) => {
    if (subjectSelectionLocked) return;
    const row = canonicalSubjects.find((r) => r.id === id);
    if (isCoreSubject(row)) return;
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const applySuggestedCombo = (mode) => {
    if (subjectSelectionLocked) return;
    const next = new Set(coreSubjects.map((r) => r.id));
    const electives = canonicalSubjects.filter((r) => !isCoreSubject(r));
    if (mode === 'MIN') {
      pathwayCategories.forEach((cat) => {
        const min = Number(cat.minSelect || 0);
        if (min <= 0) return;
        electives
          .filter((r) => r.categoryId === cat.id)
          .sort((a, b) => String(a.name).localeCompare(String(b.name)))
          .slice(0, min)
          .forEach((r) => next.add(r.id));
      });
    } else if (mode === 'PURE') {
      const pureCat = pathwayCategories.find((c) =>
        String(c.name || '').toLowerCase().includes('pure')
      );
      if (pureCat) {
        electives
          .filter((r) => r.categoryId === pureCat.id)
          .sort((a, b) => String(a.name).localeCompare(String(b.name)))
          .slice(0, Math.max(2, Number(pureCat.minSelect || 0)))
          .forEach((r) => next.add(r.id));
      }
    }
    setSelectedSubjectIds(next);
  };

  const buildOfficialSelectionPayload = () => {
    if (!officialSelectionReady) return null;
    const optionalSubjectIds = (selectedOfficialCombination.items || [])
      .map((item) => item.officialLearningArea?.id)
      .filter(Boolean);
    return {
      learnerId: learner.id,
      pathwayId: selectedOfficialPathway.id,
      trackId: selectedOfficialCombination.trackId || selectedOfficialCombination.track?.id,
      combinationRuleId: selectedOfficialCombination.id,
      compulsorySubjectIds: officialCoreSubjects.map((area) => area.id),
      optionalSubjectIds,
      supportSubjectIds: officialSupportSubjects.map((area) => area.id),
    };
  };

  const handleSave = async () => {
    if (subjectSelectionLocked) {
      showError('Subject selection is locked after pathway approval.');
      return;
    }
    if (!canSaveSelection) {
      showError('Fix compliance issues before saving.');
      return;
    }
    setSaving(true);
    try {
      const officialPayload = buildOfficialSelectionPayload();
      if (officialPayload) {
        await api.seniorPathways.saveSelection(officialPayload);
        showSuccess('Official pathway combination saved successfully!');
        return;
      }

      const coreIds = coreSubjects.map((r) => r.id);
      const allIds = Array.from(
        new Set([...Array.from(selectedSubjectIds), ...coreIds])
      );
      const validSet = new Set(canonicalSubjects.map((r) => r.id));
      const selections = allIds
        .filter((id) => validSet.has(id))
        .map((learningAreaId) => ({ learningAreaId, active: true }));
      await api.pathways.setLearnerSubjects(learner.id, selections);
      showSuccess('Subject selection saved successfully!');
    } catch (e) {
      if (String(e?.message || '').toLowerCase().includes('locked')) {
        setSubjectSelectionLocked(true);
      }
      showError(e?.message || 'Failed to save subjects');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      if (displaySelectedAreas.length === 0) {
        showError('No selected subjects to export.');
        return;
      }
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

      const rows = displaySelectedAreas
        .slice()
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
        .map((row, idx) => ({
          no: idx + 1,
          subject: row.name,
          category: row.displayCategory || 'Subject',
        }));

      const fallbackBranding = getSchoolBranding();
      const resolvedBranding = {
        name: brandingSettings?.schoolName || fallbackBranding.name,
        phone: brandingSettings?.phone || fallbackBranding.phone,
        email: brandingSettings?.email || fallbackBranding.email,
        address: brandingSettings?.address || fallbackBranding.address,
        motto: brandingSettings?.motto || fallbackBranding.motto,
        logo: brandingSettings?.logoUrl || fallbackBranding.logo,
        brandColor: brandingSettings?.brandColor || fallbackBranding.brandColor,
      };

      const pageWidth = 210;
      const margin = 12;
      const usableWidth = pageWidth - margin * 2;
      const col1 = 14;
      const col3 = 34;
      const col2 = usableWidth - col1 - col3;
      let y = await drawStandardHeader(doc, resolvedBranding, {
        type: 'PATHWAY SLIP',
        ref: `${selectedPathwayCode || 'N/A'}-${new Date().toISOString().slice(0, 10)}`,
      });

      const accent = hexToRgb(resolvedBranding.brandColor || '#1a3668');
      doc.setDrawColor(accent.r, accent.g, accent.b);
      doc.setLineWidth(0.9);
      doc.line(margin, y - 2, pageWidth - margin, y - 2);
      doc.setTextColor(31, 41, 55);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Student Pathway Selection Slip', margin, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(`Learner: ${`${learner?.firstName || ''} ${learner?.lastName || ''}`.trim() || 'Learner'}`, margin, y + 10);
      doc.text(`Admission No: ${learner?.admissionNumber || 'N/A'}`, margin + 78, y + 10);
      doc.text(`Grade: ${gradeLabel(learner?.grade)}    Pathway: ${selectedPathwayCode || 'N/A'}`, margin, y + 15);
      y += 20;

      doc.setTextColor(80, 80, 80);
      doc.setFontSize(8);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
      if (resolvedBranding.motto) {
        doc.text(`Motto: ${resolvedBranding.motto}`, pageWidth - margin, y, { align: 'right' });
      }
      y += 5;

      const drawHeader = () => {
        doc.setDrawColor(210, 210, 210);
        doc.setFillColor(245, 247, 250);
        doc.rect(margin, y, usableWidth, 8, 'FD');
        doc.setTextColor(31, 41, 55);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('#', margin + 2.5, y + 5.5);
        doc.text('SUBJECT', margin + col1 + 2, y + 5.5);
        doc.text('CATEGORY', margin + col1 + col2 + 2, y + 5.5);
        y += 8;
      };

      const drawRow = (row) => {
        const subjectLines = doc.splitTextToSize(String(row.subject || ''), col2 - 4);
        const rowHeight = Math.max(7, subjectLines.length * 4 + 2);

        if (y + rowHeight > 285) {
          doc.addPage();
          y = 14;
          drawHeader();
        }

        doc.setDrawColor(230, 230, 230);
        doc.rect(margin, y, usableWidth, rowHeight);
        doc.line(margin + col1, y, margin + col1, y + rowHeight);
        doc.line(margin + col1 + col2, y, margin + col1 + col2, y + rowHeight);

        doc.setTextColor(31, 41, 55);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(String(row.no), margin + 2.5, y + 4.8);
        doc.text(subjectLines, margin + col1 + 2, y + 4.8);
        doc.text(String(row.category || ''), margin + col1 + col2 + 2, y + 4.8);

        y += rowHeight;
      };

      drawHeader();
      rows.forEach(drawRow);

      const pageCount = doc.getNumberOfPages();
      const footerY = 292;
      for (let p = 1; p <= pageCount; p += 1) {
        doc.setPage(p);
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
        doc.setFontSize(8);
        doc.setTextColor(110, 110, 110);
        doc.text(`${resolvedBranding.name} • Official School Document`, margin, footerY);
        doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, footerY, { align: 'right' });
      }

      doc.save(`Pathway_${learner?.firstName || 'Learner'}_${selectedPathwayCode || 'Pathway'}.pdf`);
      showSuccess('PDF downloaded');
    } catch {
      showError('PDF generation failed');
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Pathway Slip');
      const name = `${learner?.firstName || ''} ${learner?.lastName || ''}`.trim();
      ws.addRow(['Pathway Selection Slip']);
      ws.addRow(['Learner', name]);
      ws.addRow(['Adm No', learner?.admissionNumber || 'N/A']);
      ws.addRow(['Grade', gradeLabel(learner?.grade)]);
      ws.addRow(['Pathway', selectedPathwayCode]);
      if (selectedOfficialCombination) {
        ws.addRow(['Track', selectedOfficialCombination.track?.name || 'N/A']);
        ws.addRow(['Official Combination', selectedOfficialCombination.name]);
      }
      ws.addRow(['Generated', new Date().toLocaleString()]);
      ws.addRow([]);
      ws.addRow(['#', 'Subject', 'Category']);
      displaySelectedAreas.forEach((row, i) =>
        ws.addRow([i + 1, row.name, row.displayCategory || 'Subject'])
      );
      ws.getRow(1).font = { bold: true, size: 13 };
      ws.getRow(8).font = { bold: true };
      ws.columns = [{ width: 6 }, { width: 36 }, { width: 18 }];
      const buf = await wb.xlsx.writeBuffer();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(
        new Blob([buf], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      );
      a.download = `Pathway_${learner?.firstName}_${selectedPathwayCode}.xlsx`;
      a.click();
      showSuccess('Excel downloaded');
    } catch {
      showError('Excel generation failed');
    }
  };

  // ── render helpers ─────────────────────────────────────────────────────────

  const visiblePathways = useMemo(
    () => pathwayCatalog.filter((p) => p.code && p.code !== 'CORE'),
    [pathwayCatalog]
  );

  const activeCategory = electivesByCategory[activeCategoryIdx] || null;

  const filteredElectives = useMemo(() => {
    if (!activeCategory) return [];
    return activeCategory.rows.filter((r) =>
      !searchTerm ||
      String(r.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [activeCategory, searchTerm]);

  const stepComplete = {
    1: !!selectedPathwayCode,
    2: coreSubjects.length === 0 || coreSubjects.every((r) => selectedSubjectIds.has(r.id)),
    3: electivesByCategory.every((g) => {
      const cat = g.category;
      if (!cat) return true;
      const picked = countByCategory[cat.id] || 0;
      return picked >= Number(cat.minSelect || 0);
    }),
    4: isValid,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading pathway data…</p>
        </div>
      </div>
    );
  }

  // ── main render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-0 h-[calc(100vh-260px)] min-h-[560px] overflow-hidden rounded-xl border border-gray-200 bg-white">

      {/* ════════════════════════════════════════════════════════════════════
          LEFT PANEL – Wizard
      ════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col w-[54%] min-w-0 border-r border-gray-200">
        {subjectSelectionLocked && (
          <div className="mx-5 mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            Subject selection is locked after pathway approval.
          </div>
        )}

        {/* ── Step indicator ── */}
        <div className="flex items-center px-5 pt-5 pb-4 border-b border-gray-100 gap-0 shrink-0">
          {STEPS.map((s, idx) => {
            const done = stepComplete[s.id] && s.id < step;
            const active = s.id === step;
            return (
              <React.Fragment key={s.id}>
                <button
                  type="button"
                  onClick={() => s.id <= step && setStep(s.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    active
                      ? 'bg-brand-purple text-white shadow-sm'
                      : done
                      ? 'bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200'
                      : 'text-gray-400 cursor-default'
                  }`}
                >
                  {done ? (
                    <Check size={11} strokeWidth={3} />
                  ) : (
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                      active ? 'border-white/50 text-white' : 'border-gray-300 text-gray-400'
                    }`}>
                      {s.id}
                    </span>
                  )}
                  {s.label}
                </button>
                {idx < STEPS.length - 1 && (
                  <ChevronRight size={14} className="text-gray-300 mx-1 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ── Step content (scrollable within the panel) ── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* ─────────────────── STEP 1: Pick Pathway ─────────────────── */}
          {step === 1 && (
            <div className="p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">Choose a Pathway</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select the senior school pathway for {learner?.firstName || 'this learner'} · {gradeLabel(learner?.grade)}
                </p>
              </div>

              {visiblePathways.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  No pathways found. Please seed the catalog first from the Pathways Hub.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {visiblePathways.map((p) => {
                    const colors = pathwayColor[p.code] || pathwayColor.STEM;
                    const active = selectedPathwayCode === p.code;
                    return (
                      <button
                        key={p.id || p.code}
                        type="button"
                        disabled={saving || subjectSelectionLocked}
                        onClick={() => handlePathwaySelect(p.code)}
                        className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                          active
                            ? `${colors.border} ${colors.bg} ring-2 ring-offset-1 ring-opacity-30`
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full mt-0.5 shrink-0 ${active ? colors.dot : 'bg-gray-300'}`} />
                            <div>
                              <p className={`text-sm font-bold ${active ? colors.text : 'text-gray-800'}`}>
                                {p.name || p.code}
                              </p>
                              {p.description && (
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>
                              )}
                            </div>
                          </div>
                          {active && (
                            <span className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold text-white ${colors.activeBg}`}>
                              <Check size={10} strokeWidth={3} /> Selected
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedPathwayCode && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-purple text-white text-sm font-semibold hover:bg-brand-purple/90 transition"
                  >
                    Continue to Core Subjects
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────── STEP 2: Core Subjects ─────────────────── */}
          {step === 2 && (
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Core Subjects</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    These are compulsory — automatically selected for all learners.
                  </p>
                </div>
                <span className="shrink-0 px-2 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs font-semibold text-gray-600">
                  {coreSubjects.length} subjects
                </span>
              </div>

              {coreSubjects.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  No core subjects mapped for grade {gradeLabel(learner?.grade)}.
                  This may be a seeding issue — check the Subject Catalog.
                </div>
              ) : (
                <div className="space-y-2">
                  {coreSubjects.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200"
                    >
                      <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                        <Lock size={10} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{row.name}</p>
                        <p className="text-[11px] text-gray-500">Core · Required</p>
                      </div>
                      <Check size={14} className="text-emerald-600 shrink-0" strokeWidth={3} />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => { setStep(3); setActiveCategoryIdx(0); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-purple text-white text-sm font-semibold hover:bg-brand-purple/90 transition"
                >
                  Continue to Electives
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────── STEP 3: Electives ─────────────────── */}
          {step === 3 && (
            <div className="flex flex-col h-full">
              {/* category tabs */}
              <div className="px-5 pt-4 pb-0 shrink-0">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      {officialModeAvailable ? 'Approved Subject Combinations' : 'Elective Subjects'}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {officialModeAvailable
                        ? 'Choose one official CBE combination. The system will save the approved combination, not a loose min/max pick.'
                        : 'Pick subjects from each category as per the rules.'}
                    </p>
                  </div>
                  {!officialModeAvailable && (
                    <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    title="Apply minimum rules pack"
                    onClick={() => applySuggestedCombo('MIN')}
                    disabled={subjectSelectionLocked}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-purple text-white text-[11px] font-bold hover:bg-brand-purple/90 transition"
                  >
                      <Sparkles size={11} /> Min Pack
                    </button>
                  <button
                    type="button"
                    title="Apply pure sciences pack"
                    onClick={() => applySuggestedCombo('PURE')}
                    disabled={subjectSelectionLocked}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-bold text-gray-700 hover:bg-gray-50 transition"
                  >
                      Pure Sci
                    </button>
                    </div>
                  )}
                </div>

                {officialModeAvailable && (
                  <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-blue-700" />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-900">
                          Official combination mode
                        </p>
                        <p className="mt-1 text-xs text-blue-800">
                          Core subjects are added automatically: {officialCoreSubjects.map(getOfficialAreaName).join(', ') || 'pending catalog setup'}.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {officialModeAvailable && (
                  <div className="max-h-[52vh] overflow-y-auto pr-1 space-y-2 pb-3">
                    {officialCombinations.map((combo) => {
                      const selected = selectedOfficialCombinationId === combo.id;
                      const subjects = (combo.items || [])
                        .map((item) => item.officialLearningArea)
                        .filter(Boolean);
                      return (
                        <button
                          key={combo.id}
                          type="button"
                          onClick={() => setSelectedOfficialCombinationId(combo.id)}
                          disabled={subjectSelectionLocked}
                          className={`w-full text-left rounded-xl border p-3 transition ${
                            selected
                              ? 'border-brand-purple bg-brand-purple/5 ring-2 ring-brand-purple/20'
                              : 'border-gray-200 bg-white hover:border-brand-purple/40 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                              selected ? 'border-brand-purple bg-brand-purple text-white' : 'border-gray-300 bg-white'
                            }`}>
                              {selected && <Check size={11} strokeWidth={3} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-bold text-gray-900">{combo.name}</p>
                                {combo.track?.name && (
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                                    {combo.track.name}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {subjects.map((area) => (
                                  <span
                                    key={area.id}
                                    className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700"
                                  >
                                    {area.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* category tab bar */}
                {!officialModeAvailable && (
                <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                  {electivesByCategory.map((g, idx) => {
                    const cat = g.category;
                    const picked = cat ? (countByCategory[cat.id] || 0) : 0;
                    const min = cat ? Number(cat.minSelect || 0) : 0;
                    const max = cat?.maxSelect == null ? null : Number(cat.maxSelect);
                    const ok = picked >= min && (max == null || picked <= max);
                    const active = activeCategoryIdx === idx;
                    return (
                      <button
                        key={g.label}
                        type="button"
                        onClick={() => { setActiveCategoryIdx(idx); setSearchTerm(''); }}
                        className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                          active
                            ? `${g.colors.pill} border-2`
                            : ok && picked > 0
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${active ? g.colors.dot : ok && picked > 0 ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        {g.label}
                        {cat && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            !ok
                              ? 'bg-amber-200 text-amber-800'
                              : 'bg-white/70 text-gray-700'
                          }`}>
                            {picked}/{min === 0 ? (max ?? '∞') : min}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                )}
              </div>

              {/* search + subject list */}
              {!officialModeAvailable && (
              <div className="px-5 pt-3 flex-1 overflow-y-auto min-h-0 pb-4">
                {activeCategory && (
                  <>
                    <div className="mb-3 flex items-center gap-2">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={`Search in ${activeCategory.label}…`}
                        className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:border-brand-purple/50 focus:bg-white transition"
                      />
                      {activeCategory.category && (
                        <div className={`shrink-0 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${activeCategory.colors.pill}`}>
                          min {activeCategory.category.minSelect ?? 0}
                          {activeCategory.category.maxSelect != null ? ` · max ${activeCategory.category.maxSelect}` : ''}
                        </div>
                      )}
                    </div>

                    {activeCategory.category?.description && (
                      <p className="text-xs text-gray-500 mb-3 italic">{activeCategory.category.description}</p>
                    )}

                    <div className="space-y-2">
                      {filteredElectives.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">No subjects match.</p>
                      ) : (
                        filteredElectives.map((row) => {
                          const checked = selectedSubjectIds.has(row.id);
                          const cat = activeCategory.category;
                          const picked = cat ? (countByCategory[cat.id] || 0) : 0;
                          const max = cat?.maxSelect == null ? null : Number(cat.maxSelect);
                          const atMax = !checked && max != null && picked >= max;
                          return (
                            <label
                              key={row.id}
                              className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                                checked
                                  ? `${activeCategory.colors.pill} border-2`
                                  : atMax
                                  ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                                  : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={atMax || subjectSelectionLocked}
                                onChange={() => toggleSubject(row.id)}
                                className="sr-only"
                              />
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                                checked
                                  ? `${activeCategory.colors.badge} border-transparent`
                                  : 'border-gray-300 bg-white'
                              }`}>
                                {checked && <Check size={11} className="text-white" strokeWidth={3} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{row.name}</p>
                              </div>
                              {checked && (
                                <span className={`shrink-0 w-5 h-5 rounded-full ${activeCategory.colors.badge} flex items-center justify-center`}>
                                  <Check size={10} className="text-white" strokeWidth={3} />
                                </span>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
                {electivesByCategory.length === 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    No elective categories found for this pathway yet.
                  </div>
                )}
              </div>
              )}

              {/* nav */}
              <div className="px-5 pb-4 pt-2 border-t border-gray-100 shrink-0">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-purple text-white text-sm font-semibold hover:bg-brand-purple/90 transition"
                  >
                    Review Selection
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────── STEP 4: Review & Save ─────────────────── */}
          {step === 4 && (
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Review &amp; Confirm</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Verify the selection below before saving.
                  </p>
                </div>
                <span className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                  canSaveSelection ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {canSaveSelection ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  {canSaveSelection ? 'Valid Combination' : 'Needs Attention'}
                </span>
              </div>

              {selectedOfficialCombination && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-900">
                    Official CBE Combination
                  </p>
                  <p className="mt-1 text-sm font-bold text-gray-900">
                    {selectedOfficialCombination.name}
                  </p>
                  {selectedOfficialCombination.track?.name && (
                    <p className="mt-0.5 text-xs font-semibold text-blue-800">
                      Track: {selectedOfficialCombination.track.name}
                    </p>
                  )}
                  <div className="mt-3 grid gap-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Compulsory</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {officialCoreSubjects.map((area) => (
                          <span key={area.id} className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-gray-700">
                            {area.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Combination Subjects</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {(selectedOfficialCombination.items || []).map((item) => (
                          <span key={item.officialLearningArea?.id || item.id} className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-gray-700">
                            {item.officialLearningArea?.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    {officialSupportSubjects.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Support / Non-examinable</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {officialSupportSubjects.map((area) => (
                            <span key={area.id} className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-gray-700">
                              {area.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* summary cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-center">
                  <p className="text-xl font-bold text-brand-purple">
                    {selectedOfficialCombination ? officialSelectedAreas.length : selectedAreas.length}
                  </p>
                  <p className="text-[11px] text-gray-500 font-medium mt-0.5">Total</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                  <p className="text-xl font-bold text-slate-700">
                    {selectedOfficialCombination ? officialCoreSubjects.length : selectedAreas.filter((r) => isCoreSubject(r)).length}
                  </p>
                  <p className="text-[11px] text-gray-500 font-medium mt-0.5">Core</p>
                </div>
                <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3 text-center">
                  <p className="text-xl font-bold text-indigo-700">
                    {selectedOfficialCombination
                      ? (selectedOfficialCombination.items || []).length
                      : selectedAreas.filter((r) => !isCoreSubject(r)).length}
                  </p>
                  <p className="text-[11px] text-gray-500 font-medium mt-0.5">Electives</p>
                </div>
              </div>

              {/* per-category breakdown */}
              {!selectedOfficialCombination && (
              <div className="space-y-2">
                {electivesByCategory.map((g, idx) => {
                  const cat = g.category;
                  const picked = cat ? (countByCategory[cat.id] || 0) : 0;
                  const min = cat ? Number(cat.minSelect || 0) : 0;
                  const max = cat?.maxSelect == null ? null : Number(cat.maxSelect);
                  const ok = picked >= min && (max == null || picked <= max);
                  return (
                    <div key={g.label} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${g.colors.dot}`} />
                      <p className="flex-1 text-sm text-gray-700 truncate">{g.label}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {picked} / {min === 0 ? (max ?? '∞') : min} min
                      </span>
                      {ok
                        ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        : <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                      }
                    </div>
                  );
                })}
              </div>
              )}

              {/* errors */}
              {complianceIssues.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
                  {complianceIssues.map((issue, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-amber-800">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-600" />
                      <span><strong>{issue.cat}:</strong> {issue.msg}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSaveSelection || saving || subjectSelectionLocked}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-purple text-white text-sm font-semibold hover:bg-brand-purple/90 disabled:opacity-50 transition"
                >
                  {saving ? (
                    <><RefreshCw size={14} className="animate-spin" /> Saving…</>
                  ) : (
                    <><Check size={14} /> Save Selection</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          RIGHT PANEL – Live Preview Slip + Compliance
      ════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col w-[46%] min-w-0 bg-gray-50/60">

        {/* header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Live Preview</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">Pathway Selection Slip</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={displaySelectedAreas.length === 0}
              title="Download Excel"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition"
            >
              <Download size={12} /> XLS
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={displaySelectedAreas.length === 0}
              title="Download PDF"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-purple text-white text-xs font-semibold hover:bg-brand-purple/90 disabled:opacity-40 transition"
            >
              <Download size={12} /> PDF
            </button>
          </div>
        </div>

        {/* slip + compliance – scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-4">

          {/* ── Pathway Slip ── */}
          <div
            id="pw-slip-preview"
            className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm"
          >
            {/* slip header */}
            <div className="px-4 py-3 bg-gradient-to-r from-gray-900 to-gray-700">
              <p className="text-xs font-bold text-white/90 uppercase tracking-widest">Pathway Selection Slip</p>
              <p className="text-sm font-semibold text-white mt-0.5">
                {`${learner?.firstName || ''} ${learner?.lastName || ''}`.trim() || '—'}
              </p>
              <p className="text-[11px] text-white/60 mt-0.5">
                {gradeLabel(learner?.grade)} · {selectedPathwayCode || 'No pathway'}
                {learner?.admissionNumber ? ` · ${learner.admissionNumber}` : ''}
              </p>
            </div>

            {displaySelectedAreas.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-2 text-gray-400">
                <BookOpen size={28} className="opacity-30" />
                <p className="text-xs">No subjects selected yet.</p>
              </div>
            ) : (
              <div className="max-h-[380px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 border-b border-gray-200 w-12">#</th>
                      <th className="text-left px-4 py-2 border-b border-gray-200">Subject</th>
                      <th className="text-left px-4 py-2 border-b border-gray-200 w-28">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displaySelectedAreas.map((row, i) => (
                      <tr key={row.id} className="odd:bg-white even:bg-gray-50">
                        <td className="px-4 py-2 border-b border-gray-100">{i + 1}</td>
                        <td className="px-4 py-2 border-b border-gray-100">{row.name}</td>
                        <td className="px-4 py-2 border-b border-gray-100">{row.displayCategory || 'Subject'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* slip footer */}
            {displaySelectedAreas.length > 0 && (
              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <p className="text-[10px] text-gray-400">
                  Generated {new Date().toLocaleString()}
                </p>
                <p className="text-[10px] text-gray-400 font-medium">
                  {displaySelectedAreas.length} subject{displaySelectedAreas.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>

          {/* ── Live Compliance Check ── */}
          <div className="rounded-xl border bg-white overflow-hidden">
            <div className={`px-4 py-3 flex items-center gap-2 ${
              canSaveSelection && selectedPathwayCode
                ? 'bg-emerald-50 border-b border-emerald-100'
                : selectedPathwayCode
                ? 'bg-amber-50 border-b border-amber-100'
                : 'bg-gray-50 border-b border-gray-100'
            }`}>
              {canSaveSelection && selectedPathwayCode ? (
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              ) : selectedPathwayCode ? (
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
              ) : (
                <Zap size={15} className="text-gray-400 shrink-0" />
              )}
              <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">
                Compliance Check
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {/* core row */}
              {selectedPathwayCode && (
                <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <p className="text-sm text-gray-700">Core Subjects</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${
                      (selectedOfficialCombination ? officialCoreSubjects.length > 0 : coreSubjects.length > 0)
                        ? 'text-emerald-600'
                        : 'text-gray-400'
                    }`}>
                      {selectedOfficialCombination
                        ? officialCoreSubjects.length
                        : selectedAreas.filter((r) => isCoreSubject(r)).length} selected
                    </span>
                    {(selectedOfficialCombination ? officialCoreSubjects.length > 0 : coreSubjects.length > 0)
                      ? <CheckCircle2 size={14} className="text-emerald-500" />
                      : <XCircle size={14} className="text-gray-300" />
                    }
                  </div>
                </div>
              )}

              {selectedOfficialCombination && (
                <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-gray-700">Official Combination</p>
                    <p className="text-[11px] text-gray-500">
                      {selectedOfficialCombination.track?.name || 'Track'} · {selectedOfficialCombination.name}
                    </p>
                  </div>
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                </div>
              )}

              {/* category compliance rows */}
              {!selectedOfficialCombination && pathwayCategories.map((cat) => {
                const picked = countByCategory[cat.id] || 0;
                const min = Number(cat.minSelect || 0);
                const max = cat.maxSelect == null ? null : Number(cat.maxSelect);
                const ok = picked >= min && (max == null || picked <= max);
                const under = picked < min;
                const over = max != null && picked > max;
                return (
                  <div key={cat.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <p className="text-sm text-gray-700 truncate">{cat.name}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-bold ${
                        ok ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                        {picked} selected
                        {min > 0 ? ` (min ${min}` : ' (min 0'}
                        {max != null ? `, max ${max})` : ')'}
                      </span>
                      {ok
                        ? <CheckCircle2 size={14} className="text-emerald-500" />
                        : under
                        ? <AlertTriangle size={14} className="text-amber-500" />
                        : over
                        ? <XCircle size={14} className="text-red-500" />
                        : null
                      }
                    </div>
                  </div>
                );
              })}

              {/* overall verdict */}
              {selectedPathwayCode && (
                <div className={`px-4 py-3 ${
                  canSaveSelection
                    ? 'bg-emerald-50'
                    : 'bg-amber-50'
                }`}>
                  <p className={`text-xs font-semibold ${
                    canSaveSelection ? 'text-emerald-800' : 'text-amber-800'
                  }`}>
                    {canSaveSelection
                      ? selectedOfficialCombination
                        ? '✓ Official CBE combination is valid.'
                        : '✓ Subject combination is valid.'
                      : selectedOfficialCombination
                      ? 'Official combination is incomplete. Confirm compulsory subjects are available in the catalog.'
                      : `${complianceIssues.length} issue${complianceIssues.length > 1 ? 's' : ''} to resolve before saving.`
                    }
                  </p>
                  {!selectedOfficialCombination && complianceIssues.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {complianceIssues.map((issue, i) => (
                        <li key={i} className="text-[11px] text-amber-700">
                          · {issue.cat}: {issue.msg}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {!selectedPathwayCode && (
                <div className="px-4 py-4 text-center">
                  <p className="text-xs text-gray-400">Select a pathway to see compliance rules.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default PathwaysWizard;
