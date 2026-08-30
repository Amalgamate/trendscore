import prisma from '../config/database';

type FeeAdjustment = {
  feeTypeId: string;
  code?: string;
  name?: string;
  mode?: string;
  value?: number | string;
  included?: boolean;
  source?: string;
  standardAmount?: number | string;
};

const TERM_INDEX: Record<string, number> = { TERM_1: 1, TERM_2: 2, TERM_3: 3 };

const periodRank = (term: string, academicYear: number) =>
  Number(academicYear) * 3 + (TERM_INDEX[String(term)] || 0);

const money = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

async function resolveConfiguredTransportAmount(
  learnerId: string,
  feeStructureItems: any[],
  client: any
) {
  const structureTransportItem = feeStructureItems.find((item) => item.feeType?.code === 'TRANSPORT');
  if (structureTransportItem) return Number(structureTransportItem.amount || 0);
  const assignment = await client.transportAssignment.findFirst({
    where: { passengerId: learnerId, archived: false },
    include: { route: true },
  });
  return assignment?.route ? Number(assignment.route.amount || 0) : 0;
}

export function applyFeeAdjustment(standardAmount: number, adjustment?: FeeAdjustment, fullExemption = false) {
  const standard = money(Math.max(0, Number(standardAmount) || 0));
  if (fullExemption || adjustment?.included === false) {
    return { studentAmount: 0, sponsorAmount: 0, adjustmentAmount: standard };
  }

  const mode = String(adjustment?.mode || 'STANDARD').toUpperCase();
  const value = Math.max(0, Number(adjustment?.value) || 0);
  let studentAmount = standard;
  let sponsorAmount = 0;

  switch (mode) {
    case 'EXEMPT':
    case 'EXCLUDE':
      studentAmount = 0;
      break;
    case 'FIXED_STUDENT_AMOUNT':
      studentAmount = value;
      break;
    case 'PERCENT_DISCOUNT':
      studentAmount = standard * (1 - clamp(value, 0, 100) / 100);
      break;
    case 'FIXED_DISCOUNT':
      studentAmount = Math.max(0, standard - value);
      break;
    case 'SPONSOR_FULL':
      sponsorAmount = standard;
      studentAmount = 0;
      break;
    case 'SPONSOR_FIXED':
      sponsorAmount = clamp(value, 0, standard);
      studentAmount = standard - sponsorAmount;
      break;
    case 'SPONSOR_PERCENT':
      sponsorAmount = standard * clamp(value, 0, 100) / 100;
      studentAmount = standard - sponsorAmount;
      break;
    case 'CUSTOM_AMOUNT':
      studentAmount = value;
      break;
    default:
      break;
  }

  studentAmount = money(studentAmount);
  sponsorAmount = money(sponsorAmount);
  return {
    studentAmount,
    sponsorAmount,
    adjustmentAmount: money(standard - studentAmount - sponsorAmount),
  };
}

export async function getApprovedLearnerFeeConfiguration(
  learnerId: string,
  term: string,
  academicYear: number,
  client: any = prisma
) {
  const configurations = await client.learnerFeeConfiguration.findMany({
    where: { learnerId, status: 'APPROVED' },
    orderBy: [{ approvedAt: 'desc' }, { updatedAt: 'desc' }],
  });
  const target = periodRank(term, academicYear);
  return configurations.find((configuration: any) => {
    const start = periodRank(configuration.startTerm, configuration.startAcademicYear);
    const end = configuration.endTerm && configuration.endAcademicYear
      ? periodRank(configuration.endTerm, configuration.endAcademicYear)
      : Number.POSITIVE_INFINITY;
    return target >= start && target <= end;
  }) || null;
}

export async function calculateLearnerInvoice(input: {
  learner: any;
  feeStructure: any;
  term: string;
  academicYear: number;
  includeTransport?: boolean;
  carryForwardAmount?: number;
  client?: any;
  configuration?: any;
}) {
  const client = input.client || prisma;
  let configuration = input.configuration || await getApprovedLearnerFeeConfiguration(
    input.learner.id,
    input.term,
    input.academicYear,
    client
  );
  if (!configuration && input.learner.isScholarshipStudent) {
    configuration = {
      id: null,
      name: 'Legacy scholarship',
      fullExemption: input.learner.scholarshipType === 'FULL',
      legacyStudentTotal: input.learner.scholarshipType === 'PARTIAL'
        ? Number(input.learner.scholarshipAmount || 0)
        : null,
      scholarshipType: input.learner.scholarshipType === 'FULL' ? 'FULL' : 'NONE',
      scholarshipAmount: null,
      adjustments: [],
    };
  }

  // ── Normalise scholarship type ──────────────────────────────────────────
  // scholarshipType drives top-level behaviour and takes precedence over the
  // legacy fullExemption boolean so both new and old records work correctly.
  const scholarshipType: string = String(configuration?.scholarshipType || 'NONE').toUpperCase();
  const isFullScholarship  = scholarshipType === 'FULL'  || !!configuration?.fullExemption;
  const isHalfScholarship  = scholarshipType === 'HALF';
  const isPartialAmount    = scholarshipType === 'PARTIAL_AMOUNT';
  const partialCap: number | null = isPartialAmount
    ? Math.max(0, Number(configuration?.scholarshipAmount ?? 0))
    : null;

  const adjustments = Array.isArray(configuration?.adjustments)
    ? configuration.adjustments as FeeAdjustment[]
    : [];
  const adjustmentMap = new Map(adjustments.map((item) => [item.feeTypeId, item]));
  const adjustmentCodeMap = new Map(adjustments.map((item) => [String(item.code || '').toUpperCase(), item]));
  const allItems = input.feeStructure?.feeItems || [];
  const nonTransportItems = allItems.filter((item: any) => item.feeType?.code !== 'TRANSPORT');

  const lineItems = nonTransportItems.map((item: any) => {
    const standardAmount = Number(item.amount || 0);
    const code = item.feeType?.code || null;
    const adjustment = adjustmentMap.get(item.feeTypeId) || adjustmentCodeMap.get(String(code || '').toUpperCase());

    // Full scholarship → every item is zeroed out
    if (isFullScholarship) {
      return {
        feeTypeId: item.feeTypeId,
        code,
        name: item.feeType?.name || 'Fee item',
        standardAmount: money(standardAmount),
        mode: 'SCHOLARSHIP_FULL',
        value: 0,
        studentAmount: 0,
        sponsorAmount: 0,
        adjustmentAmount: money(standardAmount),
      };
    }

    // Half scholarship → 50 % discount on every item (ignores per-item adjustments)
    if (isHalfScholarship) {
      const half = money(standardAmount * 0.5);
      return {
        feeTypeId: item.feeTypeId,
        code,
        name: item.feeType?.name || 'Fee item',
        standardAmount: money(standardAmount),
        mode: 'SCHOLARSHIP_HALF',
        value: half,
        studentAmount: half,
        sponsorAmount: 0,
        adjustmentAmount: money(standardAmount - half),
      };
    }

    // Partial-amount / standard → apply per-item adjustments as normal
    // (the cap is enforced after all items are computed, below)
    const amounts = applyFeeAdjustment(standardAmount, adjustment, false);
    return {
      feeTypeId: item.feeTypeId,
      code,
      name: item.feeType?.name || 'Fee item',
      standardAmount: money(standardAmount),
      mode: adjustment?.mode || 'STANDARD',
      value: Number(adjustment?.value || 0),
      ...amounts,
    };
  });

  const existingKeys = new Set(lineItems.flatMap((item: any) => [item.feeTypeId, item.code].filter(Boolean)));

  // Custom add-on adjustments are skipped for blanket scholarship types — they
  // would be meaningless when every item is already zeroed or halved.
  if (!isFullScholarship && !isHalfScholarship) {
    const customAdjustments = adjustments.filter((item) => {
      const code = String(item.code || item.feeTypeId || '').toUpperCase();
      if (code === 'TRANSPORT') return false;
      if (!item.included || existingKeys.has(item.feeTypeId) || existingKeys.has(code)) return false;
      return item.source === 'custom' || !allItems.some((feeItem: any) =>
        feeItem.feeTypeId === item.feeTypeId || String(feeItem.feeType?.code || '').toUpperCase() === code
      );
    });

    customAdjustments.forEach((item) => {
      const standardAmount = Number(item.standardAmount || item.value || 0);
      const amounts = applyFeeAdjustment(standardAmount, { ...item, mode: 'CUSTOM_AMOUNT' }, false);
      lineItems.push({
        feeTypeId: item.feeTypeId || item.code || item.name || 'CUSTOM_FEE',
        code: item.code || item.feeTypeId || 'CUSTOM',
        name: item.name || item.code || 'Custom fee item',
        standardAmount: money(standardAmount),
        mode: 'CUSTOM_AMOUNT',
        value: Number(item.value || 0),
        ...amounts,
      });
    });
  }

  // ── Transport ────────────────────────────────────────────────────────────
  const transportAdjustment = adjustmentMap.get('TRANSPORT') || adjustmentCodeMap.get('TRANSPORT');
  const includeTransport = input.includeTransport ?? (!!input.learner.isTransportStudent || !!transportAdjustment?.included);
  let transportAmount = 0;
  if (includeTransport && !isFullScholarship) {
    const rawTransport = transportAdjustment?.included
      ? money(Number(transportAdjustment.value || transportAdjustment.standardAmount || 0))
      : money(await resolveConfiguredTransportAmount(input.learner.id, allItems, client));

    if (isHalfScholarship) {
      // Half scholarship halves transport too
      transportAmount = money(rawTransport * 0.5);
      lineItems.push({
        feeTypeId: 'TRANSPORT',
        code: 'TRANSPORT',
        name: 'Transport',
        standardAmount: rawTransport,
        mode: 'SCHOLARSHIP_HALF',
        value: transportAmount,
        studentAmount: transportAmount,
        sponsorAmount: 0,
        adjustmentAmount: money(rawTransport - transportAmount),
      });
    } else {
      transportAmount = rawTransport;
      lineItems.push({
        feeTypeId: 'TRANSPORT',
        code: 'TRANSPORT',
        name: 'Transport',
        standardAmount: transportAmount,
        mode: 'STANDARD',
        value: 0,
        studentAmount: transportAmount,
        sponsorAmount: 0,
        adjustmentAmount: 0,
      });
    }
  }

  // ── Legacy partial scholarship cap (backward compat) ─────────────────────
  if (configuration?.legacyStudentTotal !== null && configuration?.legacyStudentTotal !== undefined) {
    let reduction = Math.max(
      0,
      lineItems.reduce((sum: number, item: any) => sum + item.studentAmount, 0)
        - Number(configuration.legacyStudentTotal)
    );
    for (let index = lineItems.length - 1; index >= 0 && reduction > 0; index--) {
      const reducible = Math.min(lineItems[index].studentAmount, reduction);
      lineItems[index].studentAmount = money(lineItems[index].studentAmount - reducible);
      lineItems[index].adjustmentAmount = money(lineItems[index].adjustmentAmount + reducible);
      lineItems[index].mode = 'LEGACY_PARTIAL_SCHOLARSHIP';
      reduction = money(reduction - reducible);
    }
  }

  // ── PARTIAL_AMOUNT scholarship cap ───────────────────────────────────────
  // Cap the total the student pays to scholarshipAmount, distributing the
  // reduction from the bottom of the item list upward (same pattern as legacy).
  if (isPartialAmount && partialCap !== null) {
    const currentTotal = money(lineItems.reduce((sum: number, item: any) => sum + item.studentAmount, 0));
    let reduction = Math.max(0, currentTotal - partialCap);
    for (let index = lineItems.length - 1; index >= 0 && reduction > 0; index--) {
      const reducible = Math.min(lineItems[index].studentAmount, reduction);
      lineItems[index].studentAmount = money(lineItems[index].studentAmount - reducible);
      lineItems[index].adjustmentAmount = money(lineItems[index].adjustmentAmount + reducible);
      lineItems[index].mode = 'SCHOLARSHIP_PARTIAL';
      reduction = money(reduction - reducible);
    }
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const grossAmount = money(lineItems.reduce((sum: number, item: any) => sum + item.standardAmount, 0));
  const sponsorAmount = money(lineItems.reduce((sum: number, item: any) => sum + item.sponsorAmount, 0));
  const adjustmentAmount = money(lineItems.reduce((sum: number, item: any) => sum + item.adjustmentAmount, 0));
  const studentAmount = money(lineItems.reduce((sum: number, item: any) => sum + item.studentAmount, 0));
  const carryForwardAmount = money(Number(input.carryForwardAmount || 0));
  const totalAmount = money(studentAmount + carryForwardAmount);

  return {
    grossAmount,
    adjustmentAmount,
    sponsorAmount,
    studentAmount,
    carryForwardAmount,
    totalAmount,
    transportAmount,
    feeConfigurationId: configuration?.id || null,
    calculationSnapshot: {
      version: 1,
      calculatedAt: new Date().toISOString(),
      feeStructureId: input.feeStructure.id,
      feeStructureName: input.feeStructure.name,
      configurationId: configuration?.id || null,
      configurationName: configuration?.name || null,
      sponsorName: configuration?.sponsorName || null,
      sponsorReference: configuration?.sponsorReference || null,
      fullExemption: isFullScholarship,
      scholarshipType,
      scholarshipAmount: partialCap,
      lineItems,
      totals: { grossAmount, adjustmentAmount, sponsorAmount, studentAmount, carryForwardAmount, totalAmount },
    },
  };
}
