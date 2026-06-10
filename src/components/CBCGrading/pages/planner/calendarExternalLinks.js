import { PRODUCT_DISPLAY_NAME } from '../../../../config/productIdentity';

/**
 * Open web flows and files so users can get reminders in Google Calendar, Apple Calendar, Outlook, etc.
 * Full two-way sync requires Google Calendar API + OAuth (separate integration).
 */

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** YYYYMMDD in local calendar for Google all-day (end date is exclusive). */
function formatGoogleDateLocal(d) {
  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  return `${y}${m}${day}`
}

/** YYYYMMDDTHHmmssZ in UTC for Google timed template. */
function formatGoogleDateTimeUtc(d) {
  const y = d.getUTCFullYear()
  const m = pad2(d.getUTCMonth() + 1)
  const day = pad2(d.getUTCDate())
  const h = pad2(d.getUTCHours())
  const min = pad2(d.getUTCMinutes())
  const s = pad2(d.getUTCSeconds())
  return `${y}${m}${day}T${h}${min}${s}Z`
}

/**
 * Google Calendar "create event" URL (opens in browser; user confirms and can set reminders there).
 * @param {{ title: string, start: Date, end: Date, allDay?: boolean, description?: string, location?: string }} p
 */
export function buildGoogleCalendarUrl({ title, start, end, allDay = false, description = '', location = '' }) {
  let datesParam
  if (allDay) {
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    const dayAfter = new Date(endDay)
    dayAfter.setDate(dayAfter.getDate() + 1)
    datesParam = `${formatGoogleDateLocal(startDay)}/${formatGoogleDateLocal(dayAfter)}`
  } else {
    datesParam = `${formatGoogleDateTimeUtc(start)}/${formatGoogleDateTimeUtc(end)}`
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'School event',
    dates: datesParam,
  })
  if (description) params.set('details', description)
  if (location) params.set('location', location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function icsEscape(text) {
  if (!text) return ''
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function formatIcsUtc(d) {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

/**
 * Minimal iCalendar (.ics) for one event — import into Google / Apple / Outlook.
 */
export function buildIcsEventContent({
  uid,
  title,
  start,
  end,
  allDay = false,
  description = '',
  location = '',
}) {
  const stamp = formatIcsUtc(new Date())
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${PRODUCT_DISPLAY_NAME}//School Planner//EN`, 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT']
  lines.push(`UID:${uid}`)
  lines.push(`DTSTAMP:${stamp}`)
  if (allDay) {
    const ds = formatGoogleDateLocal(start)
    const dayAfter = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    dayAfter.setDate(dayAfter.getDate() + 1)
    const deExclusive = formatGoogleDateLocal(dayAfter)
    lines.push(`DTSTART;VALUE=DATE:${ds}`)
    lines.push(`DTEND;VALUE=DATE:${deExclusive}`)
  } else {
    lines.push(`DTSTART:${formatIcsUtc(start)}`)
    lines.push(`DTEND:${formatIcsUtc(end)}`)
  }
  lines.push(`SUMMARY:${icsEscape(title || 'School event')}`)
  if (description) lines.push(`DESCRIPTION:${icsEscape(description)}`)
  if (location) lines.push(`LOCATION:${icsEscape(location)}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcsFile(filename, icsContent) {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
