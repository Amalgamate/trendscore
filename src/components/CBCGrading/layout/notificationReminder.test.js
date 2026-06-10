import {
  buildReminderSignature,
  getReminderDelay,
  INITIAL_REMINDER_DELAY_MS,
  REPEAT_REMINDER_DELAY_MS,
  MIN_UNREAD_FOR_REMINDER,
  shouldScheduleReminder,
  shouldSuppressReminderForSignature
} from './notificationReminder';

describe('notification reminder timing', () => {
  it('does not schedule when unread is below threshold', () => {
    expect(shouldScheduleReminder({ unreadCount: MIN_UNREAD_FOR_REMINDER - 1 })).toBe(false);
    expect(
      getReminderDelay({
        unreadCount: 1,
        sessionStartedAt: 0,
        lastReminderAt: null,
        now: INITIAL_REMINDER_DELAY_MS
      })
    ).toBeNull();
  });

  it('schedules first reminder 5 minutes after session start', () => {
    expect(
      getReminderDelay({
        unreadCount: 3,
        sessionStartedAt: 0,
        lastReminderAt: null,
        now: 60 * 1000
      })
    ).toBe(INITIAL_REMINDER_DELAY_MS - 60 * 1000);
  });

  it('shows first reminder immediately after 5 minutes elapsed', () => {
    expect(
      getReminderDelay({
        unreadCount: 2,
        sessionStartedAt: 0,
        lastReminderAt: null,
        now: INITIAL_REMINDER_DELAY_MS + 1000
      })
    ).toBe(0);
  });

  it('schedules repeat reminder every 2 hours after last reminder', () => {
    const now = 10 * 60 * 60 * 1000;
    const lastReminderAt = now - (30 * 60 * 1000);

    expect(
      getReminderDelay({
        unreadCount: 4,
        sessionStartedAt: 0,
        lastReminderAt,
        now
      })
    ).toBe(REPEAT_REMINDER_DELAY_MS - 30 * 60 * 1000);
  });

  it('shows repeat reminder immediately when 2 hours already passed', () => {
    const now = 12 * 60 * 60 * 1000;
    const lastReminderAt = now - REPEAT_REMINDER_DELAY_MS - 1000;

    expect(
      getReminderDelay({
        unreadCount: 5,
        sessionStartedAt: 0,
        lastReminderAt,
        now
      })
    ).toBe(0);
  });

  it('builds a stable unread signature from local and system notifications', () => {
    expect(
      buildReminderSignature({
        notificationItems: [{ key: 'notice-9' }, { key: 'birthday-2-13' }],
        systemNotifications: [{ id: 'b' }, { id: 'a' }]
      })
    ).toBe('birthday-2-13|notice-9|system-a|system-b');
  });

  it('suppresses reminders only for the same dismissed unread set', () => {
    expect(
      shouldSuppressReminderForSignature({
        dismissedSignature: 'notice-9|system-a',
        unreadReminderSignature: 'notice-9|system-a'
      })
    ).toBe(true);

    expect(
      shouldSuppressReminderForSignature({
        dismissedSignature: 'notice-9|system-a',
        unreadReminderSignature: 'notice-9|system-a|system-b'
      })
    ).toBe(false);
  });
});
