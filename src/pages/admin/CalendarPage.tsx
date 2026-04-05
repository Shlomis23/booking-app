import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminGuard } from '../../hooks/useAuth';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { toIsraelDateStr, getWeekStart, getWeekDays, DAY_NAMES_HE, MONTH_NAMES_HE, timesOverlap, isRoomBlockedOnDate, formatTime, formatDuration, statusLabel } from '../../lib/utils';
import type { Booking, Room } from '../../types';

const START_MINUTES = 7 * 60 + 30; // 7:30
const END_MINUTES = 18 * 60;        // 18:00
const SLOT_MINUTES = 30;

function generateSlots(): string[] {
  const slots: string[] = [];
  for (let m = START_MINUTES; m < END_MINUTES; m += SLOT_MINUTES) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return slots;
}
const SLOTS = generateSlots();

const ROOM_COLORS = [
  'bg-violet-100 text-blue-800 border-violet-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-pink-100 text-pink-800 border-pink-200',
];

export default function CalendarPage() {
  const ready = useAdminGuard();
  const [view, setView] = useState<'week' | 'day'>('week');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  const weekDays = getWeekDays(weekStart);

  const fetchData = useCallback(async () => {
    const start = toIsraelDateStr(weekDays[0]);
    const end = toIsraelDateStr(weekDays[6]);
    setLoading(true);
    const [{ data: r }, { data: b }] = await Promise.all([
      supabase.from('rooms').select('*').eq('is_active', true).order('name'),
      supabase.from('bookings').select('*, room:room_id(name), second_room:second_room_id(name)')
        .gte('event_date', start).lte('event_date', end)
        .in('status', ['pending', 'approved']),
    ]);
    setRooms((r ?? []) as Room[]);
    setBookings((b ?? []) as Booking[]);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => { if (ready) fetchData(); }, [ready, fetchData]);

  function getBookingsForSlot(roomId: string, dateStr: string, slot: string) {
    return bookings.filter(b =>
      (b.room_id === roomId || b.second_room_id === roomId) &&
      b.event_date === dateStr &&
      timesOverlap(b.start_time, b.duration_minutes, slot, SLOT_MINUTES),
    );
  }

  function getSlotType(room: Room, dateStr: string, slot: string): 'available' | 'blocked' | 'booked' {
    if (isRoomBlockedOnDate(room, dateStr)) return 'blocked';
    const bs = getBookingsForSlot(room.id, dateStr, slot);
    return bs.length > 0 ? 'booked' : 'available';
  }

  if (!ready) return null;

  const weekLabel = (() => {
    const s = weekDays[0], e = weekDays[6];
    return `${s.getDate()} ${MONTH_NAMES_HE[s.getMonth()]} — ${e.getDate()} ${MONTH_NAMES_HE[e.getMonth()]} ${e.getFullYear()}`;
  })();

  const displayDate = view === 'day' ? selectedDay : null;
  const displayDays = view === 'week' ? weekDays : [selectedDay];

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">לוח שנה</h1>
            <p className="text-sm text-gray-500 mt-1">{view === 'week' ? weekLabel : toIsraelDateStr(selectedDay)}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setView('week')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${view === 'week' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                שבועי
              </button>
              <button
                onClick={() => setView('day')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${view === 'day' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                יומי
              </button>
            </div>
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <button onClick={() => { setWeekStart(getWeekStart(new Date())); setSelectedDay(new Date()); }} className="text-sm text-violet-600 hover:underline px-2">היום</button>
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          </div>
        </div>

        {/* Day tabs (week view) */}
        {view === 'week' && (
          <div className="bg-white rounded-xl border border-gray-200 grid grid-cols-7">
            {weekDays.map((day, i) => {
              const ds = toIsraelDateStr(day);
              const isToday = ds === toIsraelDateStr(new Date());
              const isSelected = ds === toIsraelDateStr(selectedDay);
              return (
                <button key={i} onClick={() => { setSelectedDay(day); setView('day'); }}
                  className={`py-3 flex flex-col items-center transition-colors rounded-xl ${isSelected ? 'bg-violet-50' : 'hover:bg-gray-50'}`}>
                  <span className="text-xs text-gray-500">{DAY_NAMES_HE[day.getDay()]}</span>
                  <span className={`text-lg font-semibold mt-0.5 ${isToday ? 'text-violet-600' : 'text-gray-800'}`}>{day.getDate()}</span>
                  {isToday && <span className="w-1.5 h-1.5 bg-violet-500 rounded-full mt-0.5" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Calendar grid */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="overflow-auto max-h-[600px]">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-white z-10 border-b border-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-gray-500 font-medium w-14 text-right">שעה</th>
                    {displayDays.map((day, di) => (
                      rooms.map((room, ri) => (
                        <th key={`${di}-${ri}`} className="px-2 py-2 text-center">
                          {di === 0 && <div className="font-semibold text-gray-700" style={{ color: ROOM_COLORS[ri % ROOM_COLORS.length].split(' ')[1].replace('text-', '') }}>{room.name}</div>}
                          {view === 'week' && <div className="text-gray-400 font-normal">{DAY_NAMES_HE[day.getDay()]} {day.getDate()}</div>}
                        </th>
                      ))
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SLOTS.map(slot => (
                    <tr key={slot} className="border-b border-gray-50">
                      <td className="px-3 py-0.5 text-gray-400 whitespace-nowrap">{slot}</td>
                      {displayDays.map((day, di) => {
                        const dateStr = toIsraelDateStr(day);
                        return rooms.map((room, ri) => {
                          const type = getSlotType(room, dateStr, slot);
                          const bks = type === 'booked' ? getBookingsForSlot(room.id, dateStr, slot) : [];
                          const colorClass = ROOM_COLORS[ri % ROOM_COLORS.length];
                          return (
                            <td key={`${di}-${ri}`} className="p-0.5">
                              {type === 'blocked' ? (
                                <div className="bg-gray-100 border border-gray-200 rounded h-6" title="חסום" />
                              ) : bks.length > 0 ? (
                                <div
                                  className={`border rounded h-6 flex items-center justify-center cursor-pointer ${colorClass}`}
                                  onClick={() => setSelectedBooking(bks[0])}
                                  title={bks[0].requester_name}
                                >
                                  <span className="truncate px-1 text-xs">{bks[0].requester_name.split(' ')[0]}</span>
                                </div>
                              ) : (
                                <div className="h-6" />
                              )}
                            </td>
                          );
                        });
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Room color legend */}
        <div className="flex items-center gap-4 text-xs text-gray-600">
          {rooms.map((r, i) => (
            <div key={r.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${ROOM_COLORS[i % ROOM_COLORS.length]}`}>
              <span>{r.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Booking detail modal */}
      {selectedBooking && (
        <Modal open={!!selectedBooking} onClose={() => setSelectedBooking(null)} title="פרטי שריון">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">מגיש</dt><dd className="font-medium">{selectedBooking.requester_name}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">אימייל</dt><dd>{selectedBooking.requester_email}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">תאריך</dt><dd>{selectedBooking.event_date}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">שעה</dt><dd>{formatTime(selectedBooking.start_time)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">משך</dt><dd>{formatDuration(selectedBooking.duration_minutes)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">משתתפים</dt><dd>{selectedBooking.participant_count}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">סטטוס</dt><dd><Badge color={selectedBooking.status === 'approved' ? 'green' : 'yellow'}>{statusLabel(selectedBooking.status)}</Badge></dd></div>
            {selectedBooking.notes && <div className="flex justify-between"><dt className="text-gray-500">הערות</dt><dd>{selectedBooking.notes}</dd></div>}
          </dl>
        </Modal>
      )}
    </AdminLayout>
  );
}
