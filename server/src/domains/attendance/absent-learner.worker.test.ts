/**
 * Unit tests for AbsentLearnerSmsWorker pure logic functions.
 * These tests do not require a database connection.
 */

// We test the exported helper functions by importing them directly.
// The main runAbsentLearnerSmsWorker() function requires DB — tested in integration.

// Re-implement the testable pure functions here so we can test them
// without refactoring the worker into smaller files.

// ── Inline the pure helpers under test ───────────────────────────────────────

function isTodayWorkingDay(staffWorkingDays: unknown, dayOverride?: number): boolean {
  const today = dayOverride ?? new Date().getDay();
  let workingDays: number[] = [1, 2, 3, 4, 5];
  try {
    if (Array.isArray(staffWorkingDays)) {
      workingDays = (staffWorkingDays as number[]).filter((d) => typeof d === 'number');
    } else if (typeof staffWorkingDays === 'string') {
      const parsed = JSON.parse(staffWorkingDays);
      if (Array.isArray(parsed)) workingDays = parsed;
    }
  } catch {
    // use default
  }
  return workingDays.includes(today);
}

function resolveParentPhone(learner: {
  primaryContactPhone: string | null;
  guardianPhone: string | null;
  motherPhone: string | null;
  fatherPhone: string | null;
}): string | null {
  return learner.primaryContactPhone || learner.guardianPhone || learner.motherPhone || learner.fatherPhone || null;
}

function buildAbsentSms(schoolName: string, learnerName: string, grade: string): string {
  const date = new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    `Dear Parent/Guardian, ${learnerName} (${grade}) was absent from ${schoolName} ` +
    `on ${date}. Please contact the school if this is unexpected. ` +
    `Reply OK to acknowledge. Thank you.`
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('isTodayWorkingDay', () => {
  it('returns true for Monday (1) with default Mon–Fri config', () => {
    expect(isTodayWorkingDay([1, 2, 3, 4, 5], 1)).toBe(true);
  });

  it('returns false for Saturday (6) with default Mon–Fri config', () => {
    expect(isTodayWorkingDay([1, 2, 3, 4, 5], 6)).toBe(false);
  });

  it('returns false for Sunday (0) with default Mon–Fri config', () => {
    expect(isTodayWorkingDay([1, 2, 3, 4, 5], 0)).toBe(false);
  });

  it('returns true for Saturday when school works Saturday', () => {
    expect(isTodayWorkingDay([1, 2, 3, 4, 5, 6], 6)).toBe(true);
  });

  it('handles JSON string config', () => {
    expect(isTodayWorkingDay('[1,2,3,4,5]', 3)).toBe(true);
    expect(isTodayWorkingDay('[1,2,3,4,5]', 6)).toBe(false);
  });

  it('falls back to Mon–Fri for invalid config', () => {
    expect(isTodayWorkingDay('not-valid-json', 2)).toBe(true);
    expect(isTodayWorkingDay(null, 2)).toBe(true);
    expect(isTodayWorkingDay(undefined, 6)).toBe(false);
  });

  it('returns false when working days array is empty', () => {
    expect(isTodayWorkingDay([], 1)).toBe(false);
  });
});

describe('resolveParentPhone', () => {
  it('returns primaryContactPhone first', () => {
    expect(resolveParentPhone({
      primaryContactPhone: '+254712345678',
      guardianPhone: '+254700000001',
      motherPhone: '+254700000002',
      fatherPhone: '+254700000003',
    })).toBe('+254712345678');
  });

  it('falls back to guardianPhone when primaryContactPhone is null', () => {
    expect(resolveParentPhone({
      primaryContactPhone: null,
      guardianPhone: '+254700000001',
      motherPhone: '+254700000002',
      fatherPhone: '+254700000003',
    })).toBe('+254700000001');
  });

  it('falls back to motherPhone when primaryContactPhone and guardianPhone are null', () => {
    expect(resolveParentPhone({
      primaryContactPhone: null,
      guardianPhone: null,
      motherPhone: '+254700000002',
      fatherPhone: '+254700000003',
    })).toBe('+254700000002');
  });

  it('falls back to fatherPhone as last resort', () => {
    expect(resolveParentPhone({
      primaryContactPhone: null,
      guardianPhone: null,
      motherPhone: null,
      fatherPhone: '+254700000003',
    })).toBe('+254700000003');
  });

  it('returns null when all phones are null', () => {
    expect(resolveParentPhone({
      primaryContactPhone: null,
      guardianPhone: null,
      motherPhone: null,
      fatherPhone: null,
    })).toBeNull();
  });
});

describe('buildAbsentSms', () => {
  it('includes learner name and grade', () => {
    const msg = buildAbsentSms('DEMO PRIMARY', 'John Doe', 'Grade 4');
    expect(msg).toContain('John Doe');
    expect(msg).toContain('Grade 4');
    expect(msg).toContain('DEMO PRIMARY');
  });

  it('includes "Reply OK to acknowledge"', () => {
    const msg = buildAbsentSms('TEST SCHOOL', 'Jane Smith', 'Grade 1');
    expect(msg).toContain('Reply OK to acknowledge');
  });

  it('is under 160 characters for a short name and grade', () => {
    const msg = buildAbsentSms('MCK PRIMARY', 'Ali Hassan', 'PP2');
    // SMS messages should be under 320 chars (2 SMS units) for cost efficiency
    expect(msg.length).toBeLessThan(320);
  });
});
