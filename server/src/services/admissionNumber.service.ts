import prisma from '../config/database';

/**
 * Generates a unique, human-readable admission number
 * 
 * Format depends on school's admissionFormatType:
 * - NO_BRANCH:           ADM-{YEAR}-{SEQUENCE}
 * - BRANCH_PREFIX_START: {BRANCH_CODE}-ADM-{YEAR}-{SEQUENCE}
 * - BRANCH_PREFIX_MIDDLE: ADM-{BRANCH_CODE}-{YEAR}-{SEQUENCE}
 * - BRANCH_PREFIX_END:   ADM-{YEAR}-{SEQUENCE}-{BRANCH_CODE}
 */
export async function generateAdmissionNumber(
  branchCode: string = 'MC',
  academicYear: number = new Date().getFullYear()
): Promise<string> {
  try {
    const admissionNumber = await prisma.$transaction(async (tx) => {
      const settings = await getAdmissionSettings(tx);
      if (settings.mode === 'MANUAL') {
        throw new Error('Admission numbering is set to MANUAL. Provide admission number explicitly.');
      }
      return await findNextAvailableAdmissionNumber(tx, settings, {
        branchCode,
        academicYear,
        persistSequence: true
      });
    });

    return admissionNumber;
  } catch (error) {
    console.error('✗ Error generating admission number:', error);
    throw error;
  }
}

export async function getCurrentSequenceValue(academicYear: number): Promise<number | null> {
  const settings = await getAdmissionSettings(prisma);
  const sequenceYear = settings.resetRule === 'YEARLY' ? academicYear : 0;
  const sequence = await prisma.admissionSequence.findUnique({ where: { academicYear: sequenceYear } });
  return sequence ? sequence.currentValue : null;
}

export async function getNextAdmissionNumberPreview(
  branchCode: string = 'MC',
  academicYear: number = new Date().getFullYear()
): Promise<string | null> {
  const settings = await getAdmissionSettings(prisma);
  return await findNextAvailableAdmissionNumber(prisma, settings, {
    branchCode,
    academicYear,
    persistSequence: false
  });
}

export async function resetSequence(academicYear: number, newValue: number = 0): Promise<void> {
  const settings = await getAdmissionSettings(prisma);
  const sequenceYear = settings.resetRule === 'YEARLY' ? academicYear : 0;
  await prisma.admissionSequence.upsert({
    where: { academicYear: sequenceYear },
    update: { currentValue: newValue },
    create: { academicYear: sequenceYear, currentValue: newValue }
  });
}

export function extractSequenceNumber(
  admissionNumber: string,
  formatType: string = 'BRANCH_PREFIX_START',
  separator: string = '-'
): number | null {
  const escapedSeparator = separator === '.' ? '\\.' : separator;
  let pattern: RegExp;

  switch (formatType) {
    case 'NO_BRANCH':
      pattern = new RegExp(`^ADM${escapedSeparator}\\d{4}${escapedSeparator}(\\d{3})$`);
      break;
    case 'BRANCH_PREFIX_START':
      pattern = new RegExp(`^[A-Z0-9]+${escapedSeparator}ADM${escapedSeparator}\\d{4}${escapedSeparator}(\\d{3})$`);
      break;
    case 'BRANCH_PREFIX_MIDDLE':
      pattern = new RegExp(`^ADM${escapedSeparator}[A-Z0-9]+${escapedSeparator}\\d{4}${escapedSeparator}(\\d{3})$`);
      break;
    case 'BRANCH_PREFIX_END':
      pattern = new RegExp(`^ADM${escapedSeparator}\\d{4}${escapedSeparator}(\\d{3})${escapedSeparator}[A-Z0-9]+$`);
      break;
    default:
      return null;
  }

  const match = admissionNumber.match(pattern);
  return match ? parseInt(match[1], 10) : null;
}

type AdmissionSettings = {
  mode: 'AUTO' | 'MANUAL';
  pattern: string;
  width: number;
  startNumber: number;
  resetRule: 'NEVER' | 'YEARLY';
};

async function getAdmissionSettings(db: any): Promise<AdmissionSettings> {
  const school = await db.school.findFirst({
    where: { archived: false },
    orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      admissionNumberMode: true,
      admissionPattern: true,
      admissionSequenceWidth: true,
      admissionStartNumber: true,
      admissionResetRule: true
    }
  });

  return {
    mode: school?.admissionNumberMode || 'AUTO',
    pattern: school?.admissionPattern || 'ADM-{YEAR}-{SEQ}',
    width: Math.max(1, Number(school?.admissionSequenceWidth || 4)),
    startNumber: Math.max(1, Number(school?.admissionStartNumber || 1000)),
    resetRule: school?.admissionResetRule || 'YEARLY'
  };
}

function formatAdmissionNumber(
  settings: AdmissionSettings,
  value: number,
  academicYear: number,
  branchCode: string
): string {
  const seq = String(value).padStart(settings.width, '0');
  if (!settings.pattern || settings.pattern.trim() === '') return seq;
  return settings.pattern
    .replace(/\{YEAR\}/g, String(academicYear))
    .replace(/\{SEQ\}/g, seq)
    .replace(/\{BRANCH\}/g, String(branchCode || '').toUpperCase());
}

async function findNextAvailableAdmissionNumber(
  db: any,
  settings: AdmissionSettings,
  options: { branchCode: string; academicYear: number; persistSequence: boolean }
): Promise<string> {
  const sequenceYear = settings.resetRule === 'YEARLY' ? options.academicYear : 0;
  const sequence = await db.admissionSequence.upsert({
    where: { academicYear: sequenceYear },
    create: { academicYear: sequenceYear, currentValue: 0 },
    update: {}
  });

  let nextValue = sequence.currentValue > 0 ? sequence.currentValue + 1 : settings.startNumber;

  while (true) {
    const candidate = formatAdmissionNumber(settings, nextValue, options.academicYear, options.branchCode);
    const exists = await db.learner.findUnique({ where: { admissionNumber: candidate } });
    if (!exists) {
      if (options.persistSequence) {
        await db.admissionSequence.update({
          where: { id: sequence.id },
          data: { currentValue: nextValue }
        });
      }
      return candidate;
    }
    nextValue += 1;
  }
}

/**
 * normalizeAdmissionNumber
 * -----------------------
 * Resolves any admission number format variation to a canonical DB record.
 *
 * Handles the two populations that co-exist in JRN/zawadi:
 *  - Legacy short numerics:   "1100", "969"
 *  - Auto-generated prefixed: "ADM-2026-1100", "ADM-2026-0969"
 *
 * Strategy (in order):
 *  1. Exact match on the raw value (fastest, covers 99% of cases)
 *  2. If the raw value is purely numeric, try endsWith match (file has "1100", DB has "ADM-2026-1100")
 *  3. If the raw value has a prefix, extract trailing digits and try exact numeric match
 *     (file has "ADM-2026-1100", DB has "1100")
 *
 * Returns the matched Learner row, or null if no match.
 *
 * @param admNo  - raw value from spreadsheet / API input
 * @param db     - optional Prisma client (defaults to the module-level prisma instance)
 */
export async function resolveAdmissionNumber(
  admNo: string,
  db: any = prisma
): Promise<{ id: string; admissionNumber: string } | null> {
  const raw = String(admNo || '').trim();
  if (!raw) return null;

  // 1. Exact match
  const exact = await db.learner.findUnique({
    where: { admissionNumber: raw },
    select: { id: true, admissionNumber: true }
  });
  if (exact) return exact;

  // 2. Raw is pure digits → try suffix match (legacy short → prefixed DB)
  if (/^\d+$/.test(raw)) {
    const hits = await db.learner.findMany({
      where: { admissionNumber: { endsWith: `-${raw}` } },
      select: { id: true, admissionNumber: true },
      take: 2
    });
    if (hits.length === 1) return hits[0];
    // If multiple hit (unlikely but possible with sequential numbering edge-case),
    // prefer the one that ends with exactly the numeric part with a dash separator.
    if (hits.length > 1) return hits[0];
  }

  // 3. Raw has a prefix → extract trailing numeric part and try exact numeric match
  const numericSuffix = raw.replace(/^.*?(\d+)$/, '$1');
  if (numericSuffix && numericSuffix !== raw) {
    const numHit = await db.learner.findUnique({
      where: { admissionNumber: numericSuffix },
      select: { id: true, admissionNumber: true }
    });
    if (numHit) return numHit;
  }

  return null;
}

/**
 * Convenience wrapper: given a list of raw admission numbers from an import file,
 * returns a Map<rawAdmNo → Learner> resolving all format variants in one pass.
 *
 * Uses bulk DB queries to avoid N+1.
 */
export async function buildLearnerMapFromAdmNos(
  rawAdmNos: string[],
  db: any = prisma
): Promise<Map<string, { id: string; admissionNumber: string; grade: string; firstName: string; lastName: string }>> {
  const unique = Array.from(new Set(rawAdmNos.map(a => String(a || '').trim()).filter(Boolean)));
  if (!unique.length) return new Map();

  // Separate into pure-numeric and prefixed groups
  const pureNumeric = unique.filter(a => /^\d+$/.test(a));
  const prefixed    = unique.filter(a => !/^\d+$/.test(a));

  // Collect all candidate admission numbers to fetch in one query
  const exactCandidates = new Set<string>(unique);

  // For pure-numeric values, also query their prefixed variants via endsWith
  // For prefixed values, also query the trailing numeric form
  for (const a of pureNumeric) {
    // will be resolved via endsWith below — no extra candidates needed
  }
  for (const a of prefixed) {
    const numPart = a.replace(/^.*?(\d+)$/, '$1');
    if (numPart && numPart !== a) exactCandidates.add(numPart);
  }

  // Fetch all exact candidates in one round-trip
  const exactHits = await db.learner.findMany({
    where: { admissionNumber: { in: Array.from(exactCandidates) } },
    select: { id: true, admissionNumber: true, grade: true, firstName: true, lastName: true }
  });

  // Build a lookup by admissionNumber
  const byAdmNo = new Map<string, any>(exactHits.map((l: any) => [l.admissionNumber, l]));

  // For pure-numeric values not matched exactly, try endsWith
  const unresolved = pureNumeric.filter(a => !byAdmNo.has(a));
  if (unresolved.length) {
    const suffixHits = await db.learner.findMany({
      where: {
        OR: unresolved.map(a => ({ admissionNumber: { endsWith: `-${a}` } }))
      },
      select: { id: true, admissionNumber: true, grade: true, firstName: true, lastName: true }
    });
    for (const l of suffixHits) {
      // Find which raw admNo this learner maps to
      const numPart = l.admissionNumber.replace(/^.*?(\d+)$/, '$1');
      if (numPart && unresolved.includes(numPart) && !byAdmNo.has(numPart)) {
        byAdmNo.set(numPart, l);
      }
    }
  }

  // Build the final map: rawAdmNo → learner
  const result = new Map<string, any>();
  for (const raw of unique) {
    const learner = byAdmNo.get(raw)
      ?? byAdmNo.get(raw.replace(/^.*?(\d+)$/, '$1'))
      ?? null;
    if (learner) result.set(raw, learner);
  }
  return result;
}
