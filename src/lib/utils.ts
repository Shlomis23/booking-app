import type { Booking, Room } from '../types';

export const TZ = 'Asia/Jerusalem';

/** Format a date string to Hebrew locale */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: TZ,
  });
}

/** Format HH:MM:SS → HH:MM */
export function formatTime(timeStr: string): string {
  return timeStr?.slice(0, 5) ?? '';
}

/** Format duration in minutes to Hebrew */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} דקות`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} שעות ו-${m} דקות` : `${h} שעות`;
}

/** Get YYYY-MM-DD for a Date object in Israel TZ */
export function toIsraelDateStr(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: TZ }); // en-CA gives YYYY-MM-DD
}

/** Add minutes to a HH:MM time string, returns HH:MM */
export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMins = h * 60 + m + minutes;
  const newH = Math.floor(totalMins / 60) % 24;
  const newM = totalMins % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/** Check if two time ranges overlap */
export function timesOverlap(
  start1: string, dur1: number,
  start2: string, dur2: number,
): boolean {
  const toMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const s1 = toMins(start1), e1 = s1 + dur1;
  const s2 = toMins(start2), e2 = s2 + dur2;
  return s1 < e2 && e1 > s2;
}

/** Check if a date falls within any of the room's blocked ranges */
export function isRoomBlockedOnDate(room: Room, dateStr: string): boolean {
  return room.blocked_dates.some(bd => dateStr >= bd.from && dateStr <= bd.to);
}

/** Check if a room is available for a given date/time/duration */
export function isRoomAvailable(
  room: Room,
  dateStr: string,
  startTime: string,
  durationMinutes: number,
  bookings: Booking[],
): boolean {
  if (!room.is_active) return false;
  if (isRoomBlockedOnDate(room, dateStr)) return false;

  const conflicting = bookings.filter(b =>
    (b.room_id === room.id || b.second_room_id === room.id) &&
    b.event_date === dateStr &&
    ['pending', 'approved'].includes(b.status) &&
    timesOverlap(b.start_time, b.duration_minutes, startTime, durationMinutes),
  );

  return conflicting.length === 0;
}

/** Status label in Hebrew */
export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'ממתין לאישור',
    approved: 'מאושר',
    rejected: 'נדחה',
    cancelled: 'בוטל',
  };
  return map[status] ?? status;
}

/** Status color classes */
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-600',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

/** Get week start (Sunday) for a given date */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // Sunday = 0
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get array of 7 dates for a week starting at weekStart */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
}

/** Duration options in Hebrew */
export const DURATION_OPTIONS = [
  { label: '30 דקות', value: 30 },
  { label: 'שעה', value: 60 },
  { label: 'שעה וחצי', value: 90 },
  { label: 'שעתיים', value: 120 },
  { label: '3 שעות', value: 180 },
  { label: 'מותאם אישית', value: 0 },
];

/** Day names in Hebrew */
export const DAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/** Month names in Hebrew */
export const MONTH_NAMES_HE = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
];
