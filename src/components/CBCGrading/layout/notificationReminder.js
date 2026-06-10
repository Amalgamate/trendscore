export const INITIAL_REMINDER_DELAY_MS = 5 * 60 * 1000;
export const REPEAT_REMINDER_DELAY_MS = 2 * 60 * 60 * 1000;
export const MIN_UNREAD_FOR_REMINDER = 2;

export const getReminderDelay = ({
  unreadCount,
  sessionStartedAt,
  lastReminderAt,
  now = Date.now()
}) => {
  if (unreadCount < MIN_UNREAD_FOR_REMINDER) return null;

  if (!lastReminderAt) {
    const elapsedInSession = Math.max(0, now - sessionStartedAt);
    return Math.max(0, INITIAL_REMINDER_DELAY_MS - elapsedInSession);
  }

  const elapsedSinceLastReminder = Math.max(0, now - lastReminderAt);
  return Math.max(0, REPEAT_REMINDER_DELAY_MS - elapsedSinceLastReminder);
};

export const shouldScheduleReminder = ({ unreadCount }) => unreadCount >= MIN_UNREAD_FOR_REMINDER;

export const buildReminderSignature = ({ notificationItems = [], systemNotifications = [] }) => [
  ...notificationItems.map((item) => item.key),
  ...systemNotifications.map((item) => `system-${item.id}`)
].sort().join('|');

export const shouldSuppressReminderForSignature = ({
  dismissedSignature,
  unreadReminderSignature
}) => Boolean(dismissedSignature && dismissedSignature === unreadReminderSignature);
