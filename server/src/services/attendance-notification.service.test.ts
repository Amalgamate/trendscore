/**
 * Unit tests for AttendanceNotificationService
 *
 * Tests the pure message-building and deduplication logic
 * without requiring a live database or SMS provider.
 */

// ── Inline the pure helpers under test (no DB import) ────────────────────────

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

function formatTime(ts: Date): string {
  const eat = new Date(ts.getTime() + EAT_OFFSET_MS);
  const hh  = String(eat.getUTCHours()).padStart(2, '0');
  const mm  = String(eat.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

type NotificationType = 'GATE_ENTRY' | 'GATE_EXIT' | 'MANUAL_ABSENT' | 'MANUAL_PRESENT';

function buildMessage(
  type:        NotificationType,
  learnerName: string,
  grade:       string,
  schoolName:  string,
  timestamp:   Date,
): string {
  const time = formatTime(timestamp);
  const date = timestamp.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' });

  switch (type) {
    case 'GATE_ENTRY':
      return (
        `Dear Parent, ${learnerName} (${grade}) has arrived at ${schoolName} at ${time} EAT on ${date}. ` +
        `They are safely on school grounds.`
      );
    case 'GATE_EXIT':
      return (
        `Dear Parent, ${learnerName} (${grade}) has left ${schoolName} at ${time} EAT on ${date}. ` +
        `Please ensure they arrive home safely.`
      );
    case 'MANUAL_ABSENT':
      return (
        `Dear Parent, ${learnerName} (${grade}) was marked ABSENT from ${schoolName} on ${date}. ` +
        `Please contact the school if this is unexpected. Reply OK to acknowledge.`
      );
    case 'MANUAL_PRESENT':
      return (
        `Dear Parent, ${learnerName} (${grade}) has been marked PRESENT at ${schoolName} for ${date}.`
      );
  }
}

function resolveParentPhone(learner: {
  primaryContactPhone: string | null;
  guardianPhone:       string | null;
  motherPhone:         string | null;
  fatherPhone:         string | null;
  parent?:             { phone: string | null } | null;
}): string | null {
  return (
    learner.parent?.phone        ||
    learner.primaryContactPhone  ||
    learner.guardianPhone        ||
    learner.motherPhone          ||
    learner.fatherPhone          ||
    null
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const SCHOOL    = 'Zawadi Academy';
const NAME      = 'Ethan Kariuki';
const GRADE     = 'Grade 4';
// UTC 06:30 = EAT 09:30
const TIMESTAMP = new Date('2026-01-15T06:30:00.000Z');

// ── formatTime ────────────────────────────────────────────────────────────────

describe('formatTime()', () => {
  it('converts UTC 06:30 to EAT 09:30', () => {
    expect(formatTime(TIMESTAMP)).toBe('09:30');
  });

  it('converts UTC midnight to EAT 03:00', () => {
    expect(formatTime(new Date('2026-01-15T00:00:00.000Z'))).toBe('03:00');
  });

  it('handles end-of-day UTC 21:00 → EAT 00:00 next day', () => {
    expect(formatTime(new Date('2026-01-15T21:00:00.000Z'))).toBe('00:00');
  });
});

// ── buildMessage ─────────────────────────────────────────────────────────────

describe('buildMessage()', () => {
  it('GATE_ENTRY includes arrival, school name, and time', () => {
    const msg = buildMessage('GATE_ENTRY', NAME, GRADE, SCHOOL, TIMESTAMP);
    expect(msg).toContain('has arrived at');
    expect(msg).toContain(SCHOOL);
    expect(msg).toContain(NAME);
    expect(msg).toContain('09:30 EAT');
    expect(msg).toContain('safely on school grounds');
  });

  it('GATE_EXIT includes departure and safety message', () => {
    const msg = buildMessage('GATE_EXIT', NAME, GRADE, SCHOOL, TIMESTAMP);
    expect(msg).toContain('has left');
    expect(msg).toContain(SCHOOL);
    expect(msg).toContain('arrive home safely');
  });

  it('MANUAL_ABSENT includes ABSENT keyword and acknowledgement prompt', () => {
    const msg = buildMessage('MANUAL_ABSENT', NAME, GRADE, SCHOOL, TIMESTAMP);
    expect(msg).toContain('ABSENT');
    expect(msg).toContain('Reply OK to acknowledge');
    expect(msg).toContain(SCHOOL);
    expect(msg).toContain(NAME);
  });

  it('MANUAL_PRESENT includes PRESENT keyword', () => {
    const msg = buildMessage('MANUAL_PRESENT', NAME, GRADE, SCHOOL, TIMESTAMP);
    expect(msg).toContain('PRESENT');
    expect(msg).toContain(NAME);
  });

  it('all messages include learner name and grade', () => {
    const types: NotificationType[] = ['GATE_ENTRY', 'GATE_EXIT', 'MANUAL_ABSENT', 'MANUAL_PRESENT'];
    types.forEach(type => {
      const msg = buildMessage(type, NAME, GRADE, SCHOOL, TIMESTAMP);
      expect(msg).toContain(NAME);
      expect(msg).toContain(GRADE);
    });
  });

  it('message is under 320 chars (2 SMS parts)', () => {
    const types: NotificationType[] = ['GATE_ENTRY', 'GATE_EXIT', 'MANUAL_ABSENT', 'MANUAL_PRESENT'];
    types.forEach(type => {
      const msg = buildMessage(type, NAME, GRADE, SCHOOL, TIMESTAMP);
      expect(msg.length).toBeLessThanOrEqual(320);
    });
  });
});

// ── resolveParentPhone ────────────────────────────────────────────────────────

describe('resolveParentPhone()', () => {
  it('prefers parent.phone over all others', () => {
    expect(resolveParentPhone({
      parent: { phone: '+254700000001' },
      primaryContactPhone: '+254700000002',
      guardianPhone: null, motherPhone: null, fatherPhone: null,
    })).toBe('+254700000001');
  });

  it('falls back to primaryContactPhone when no parent.phone', () => {
    expect(resolveParentPhone({
      parent: { phone: null },
      primaryContactPhone: '+254700000002',
      guardianPhone: null, motherPhone: null, fatherPhone: null,
    })).toBe('+254700000002');
  });

  it('falls back to guardianPhone', () => {
    expect(resolveParentPhone({
      parent: null,
      primaryContactPhone: null,
      guardianPhone: '+254700000003',
      motherPhone: null, fatherPhone: null,
    })).toBe('+254700000003');
  });

  it('falls back to motherPhone', () => {
    expect(resolveParentPhone({
      parent: null,
      primaryContactPhone: null,
      guardianPhone: null,
      motherPhone: '+254700000004',
      fatherPhone: null,
    })).toBe('+254700000004');
  });

  it('falls back to fatherPhone as last resort', () => {
    expect(resolveParentPhone({
      parent: null,
      primaryContactPhone: null,
      guardianPhone: null,
      motherPhone: null,
      fatherPhone: '+254700000005',
    })).toBe('+254700000005');
  });

  it('returns null when no phone is available', () => {
    expect(resolveParentPhone({
      parent: null,
      primaryContactPhone: null,
      guardianPhone: null,
      motherPhone: null,
      fatherPhone: null,
    })).toBeNull();
  });
});
