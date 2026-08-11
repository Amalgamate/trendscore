import { PrismaClient } from '@prisma/client';

export type ValidationSeverity = 'ERROR' | 'WARNING';

export type SeniorPathwayValidationIssue = {
  code: string;
  message: string;
  field?: string;
  severity?: ValidationSeverity;
};

export type ValidateSeniorPathwaySelectionInput = {
  learnerId: string;
  schoolId?: string | null;
  selectionId?: string | null;
  pathwayId: string;
  trackId?: string | null;
  combinationRuleId?: string | null;
  compulsorySubjectIds: string[];
  optionalSubjectIds: string[];
  supportSubjectIds?: string[];
  strictSchoolOfferings?: boolean;
};

export type SeniorPathwayValidationResult = {
  valid: boolean;
  errors: SeniorPathwayValidationIssue[];
  warnings: SeniorPathwayValidationIssue[];
  normalizedSelection: {
    pathwayId: string;
    trackId: string | null;
    combinationRuleId: string | null;
    examinableSubjectIds: string[];
    supportSubjectIds: string[];
  };
};

const CORE_CODES = {
  english: 'ENG',
  kiswahili: 'KIS',
  ksl: 'KSL',
  coreMath: 'CORE_MATH',
  essentialMath: 'ESS_MATH',
  csl: 'CSL',
};

const unique = (values: string[] = []) =>
  Array.from(new Set(values.filter(Boolean).map((value) => String(value))));

const sameSet = (left: string[], right: string[]) => {
  const a = unique(left).sort();
  const b = unique(right).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
};

function pushError(errors: SeniorPathwayValidationIssue[], code: string, message: string, field?: string) {
  errors.push({ code, message, field, severity: 'ERROR' });
}

function pushWarning(warnings: SeniorPathwayValidationIssue[], code: string, message: string, field?: string) {
  warnings.push({ code, message, field, severity: 'WARNING' });
}

export async function validateSeniorPathwaySelection(
  prisma: PrismaClient,
  input: ValidateSeniorPathwaySelectionInput
): Promise<SeniorPathwayValidationResult> {
  const errors: SeniorPathwayValidationIssue[] = [];
  const warnings: SeniorPathwayValidationIssue[] = [];

  const compulsorySubjectIds = unique(input.compulsorySubjectIds);
  const optionalSubjectIds = unique(input.optionalSubjectIds);
  const supportSubjectIds = unique(input.supportSubjectIds || []);
  const examinableSubjectIds = unique([...compulsorySubjectIds, ...optionalSubjectIds]);

  const normalizedSelection = {
    pathwayId: input.pathwayId,
    trackId: input.trackId ?? null,
    combinationRuleId: input.combinationRuleId ?? null,
    examinableSubjectIds,
    supportSubjectIds,
  };

  const [learner, pathway, track, combinationRule, selectedAreas, lockedSelection] = await Promise.all([
    prisma.learner.findUnique({
      where: { id: input.learnerId },
      select: { id: true, institutionType: true },
    }),
    prisma.pathway.findUnique({ where: { id: input.pathwayId }, select: { id: true, code: true, active: true } }),
    input.trackId
      ? prisma.pathwayTrack.findUnique({
          where: { id: input.trackId },
          select: { id: true, pathwayId: true, active: true },
        })
      : Promise.resolve(null),
    input.combinationRuleId
      ? prisma.subjectCombinationRule.findUnique({
          where: { id: input.combinationRuleId },
          select: {
            id: true,
            pathwayId: true,
            trackId: true,
            active: true,
            items: { select: { officialLearningAreaId: true } },
          },
        })
      : Promise.resolve(null),
    prisma.officialLearningArea.findMany({
      where: { id: { in: unique([...examinableSubjectIds, ...supportSubjectIds]) } },
      select: { id: true, officialCode: true, officialName: true, subjectType: true, pathwayId: true, active: true },
    }),
    input.selectionId
      ? prisma.learnerPathwaySelection.findUnique({
          where: { id: input.selectionId },
          select: { id: true, locked: true, status: true },
        })
      : Promise.resolve(null),
  ]);

  if (!learner) pushError(errors, 'LEARNER_NOT_FOUND', 'Learner was not found.', 'learnerId');
  if (learner && learner.institutionType !== 'SECONDARY') {
    pushError(errors, 'INVALID_INSTITUTION_TYPE', 'Senior pathway selection is only supported for secondary learners.', 'learnerId');
  }

  if (!pathway || !pathway.active) pushError(errors, 'PATHWAY_NOT_FOUND', 'Pathway was not found or is inactive.', 'pathwayId');
  if (input.trackId && (!track || !track.active)) pushError(errors, 'TRACK_NOT_FOUND', 'Track was not found or is inactive.', 'trackId');
  if (track && track.pathwayId !== input.pathwayId) {
    pushError(errors, 'TRACK_PATHWAY_MISMATCH', 'Track does not belong to the selected pathway.', 'trackId');
  }

  if (lockedSelection?.locked || lockedSelection?.status === 'LOCKED') {
    pushError(errors, 'SELECTION_LOCKED', 'Locked pathway selections cannot be edited.', 'selectionId');
  }

  const selectedById = new Map(selectedAreas.map((area) => [area.id, area]));
  const missingIds = unique([...examinableSubjectIds, ...supportSubjectIds]).filter((id) => !selectedById.has(id));
  if (missingIds.length > 0) {
    pushError(errors, 'LEARNING_AREA_NOT_FOUND', `Unknown official learning area id(s): ${missingIds.join(', ')}`, 'subjects');
  }

  const selectedCoreCodes = compulsorySubjectIds
    .map((id) => selectedById.get(id))
    .filter(Boolean)
    .map((area) => area!.officialCode);

  const selectedOptionalAreas = optionalSubjectIds.map((id) => selectedById.get(id)).filter(Boolean);
  const selectedSupportAreas = supportSubjectIds.map((id) => selectedById.get(id)).filter(Boolean);

  if (compulsorySubjectIds.length !== 4) {
    pushError(errors, 'INVALID_CORE_COUNT', 'Exactly 4 compulsory examinable subjects are required.', 'compulsorySubjectIds');
  }
  if (!selectedCoreCodes.includes(CORE_CODES.english)) {
    pushError(errors, 'ENGLISH_REQUIRED', 'English is required.', 'compulsorySubjectIds');
  }
  if (!selectedCoreCodes.includes(CORE_CODES.kiswahili) && !selectedCoreCodes.includes(CORE_CODES.ksl)) {
    pushError(errors, 'LANGUAGE_CORE_REQUIRED', 'Either Kiswahili or Kenya Sign Language is required.', 'compulsorySubjectIds');
  }
  if (!selectedCoreCodes.includes(CORE_CODES.coreMath) && !selectedCoreCodes.includes(CORE_CODES.essentialMath)) {
    pushError(errors, 'MATH_CORE_REQUIRED', 'Either Core Mathematics or Essential Mathematics is required.', 'compulsorySubjectIds');
  }
  if (!selectedCoreCodes.includes(CORE_CODES.csl)) {
    pushError(errors, 'CSL_REQUIRED', 'Community Service Learning is required.', 'compulsorySubjectIds');
  }

  if (optionalSubjectIds.length !== 3) {
    pushError(errors, 'INVALID_OPTIONAL_COUNT', 'Exactly 3 optional examinable subjects are required.', 'optionalSubjectIds');
  }

  for (const area of [...selectedOptionalAreas, ...compulsorySubjectIds.map((id) => selectedById.get(id)).filter(Boolean)]) {
    if (!area) continue;
    if (area.subjectType === 'SUPPORT_SUBJECT' || area.subjectType === 'NON_EXAMINABLE') {
      pushError(
        errors,
        'SUPPORT_SUBJECT_NOT_EXAMINABLE',
        `${area.officialName} cannot count toward the seven examinable subjects.`,
        'subjects'
      );
    }
  }

  for (const area of selectedSupportAreas) {
    if (area?.subjectType === 'EXAMINABLE_CORE' || area?.subjectType === 'EXAMINABLE_OPTIONAL') {
      pushWarning(warnings, 'EXAMINABLE_SUBJECT_IN_SUPPORT_LIST', `${area.officialName} is examinable and should not be in support subjects.`, 'supportSubjectIds');
    }
  }

  if (!input.combinationRuleId) {
    pushError(errors, 'COMBINATION_REQUIRED', 'An approved subject combination is required.', 'combinationRuleId');
  } else if (!combinationRule || !combinationRule.active) {
    pushError(errors, 'COMBINATION_NOT_FOUND', 'Approved subject combination was not found or is inactive.', 'combinationRuleId');
  } else {
    if (combinationRule.pathwayId !== input.pathwayId) {
      pushError(errors, 'COMBINATION_PATHWAY_MISMATCH', 'Combination does not belong to the selected pathway.', 'combinationRuleId');
    }
    if (input.trackId && combinationRule.trackId !== input.trackId) {
      pushError(errors, 'COMBINATION_TRACK_MISMATCH', 'Combination does not belong to the selected track.', 'combinationRuleId');
    }
    const ruleSubjectIds = combinationRule.items.map((item) => item.officialLearningAreaId);
    if (!sameSet(ruleSubjectIds, optionalSubjectIds)) {
      pushError(errors, 'COMBINATION_NOT_APPROVED', 'Selected optional subjects do not match the approved combination.', 'optionalSubjectIds');
    }
  }

  if (input.schoolId) {
    const offeredRows = await prisma.schoolLearningAreaOffering.findMany({
      where: {
        schoolId: input.schoolId,
        active: true,
      },
      select: { officialLearningAreaId: true },
    });
    if (offeredRows.length === 0 && input.strictSchoolOfferings) {
      pushError(errors, 'SCHOOL_OFFERINGS_NOT_CONFIGURED', 'No school subject offerings are configured.', 'schoolId');
    } else if (offeredRows.length === 0) {
      pushWarning(warnings, 'SCHOOL_OFFERINGS_NOT_CONFIGURED', 'No school subject offerings are configured; offering validation was skipped.', 'schoolId');
    } else {
      const offered = new Set(offeredRows.map((row) => row.officialLearningAreaId));
      const selectedSubjectIds = [...new Set([
        ...compulsorySubjectIds,
        ...optionalSubjectIds,
        ...supportSubjectIds,
      ])];
      const missingOfferings = selectedSubjectIds.filter((id) => !offered.has(id));
      if (missingOfferings.length > 0) {
        pushError(errors, 'SUBJECT_NOT_OFFERED', `School does not offer selected subject id(s): ${missingOfferings.join(', ')}`, 'subjects');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalizedSelection,
  };
}
