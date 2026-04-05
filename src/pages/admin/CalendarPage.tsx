import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminGuard } from '../../hooks/useAuth';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { toIsraelDateStr, getWeekStart, getWeekDays, DAY_NAMES_HE, MONTH_NAMES_HE, timesOverlap, isRoomBlockedOnDate, formatTime, formatDuration, statusLabel } from '../../lib/utils';
import type { Booking, Room } from '../../types';

const START_MINUTES = 7 * 60 + 30;
const END_MINUTES = 18 * 60;
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
  'bg-violet-100 text-violet-800 border-violet-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-pink-100 text-pink-800 border-pink-200',
];

export default function CalendarPage() {
  const ready = useAdminGuard();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedDateStr = toIsraelDateStr(selectedDay);

  const fetchData = useCallback(async () => {
    const weekStart = getWeekStart(selectedDay);
    const weekDays = getWeekDays(weekStart);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateStr]);

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
    return getBookingsForSlot(room.id, dateStr, slot).length > 0 ? 'booked' : 'available';
  }

  function prevDay() {
    const d = new Date(selectedDay);
    d.setDate(d.getDate() - 1);
    setSelectedDay(d);
  }

  function nextDay() {
    const d = new Date(selectedDay);
    d.setDate(d.getDate() + 1);
    setSelectedDay(d);
  }

  function goToday() {
    setSelectedDay(new Date());
  }

  function handleDateInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value) {
      setSelectedDay(new Date(e.target.value + 'T12:00:00'));
    }
  }

  if (!ready) return null;

  const dayLabel = `${DAY_NAMES_HE[selectedDay.getDay()]} ${selectedDay.getDate()} ${MONTH_NAMES_HE[selectedDay.getMonth()]} ${selectedDay.getFullYear()}`;
  const isToday = selectedDateStr === toIsraelDateStr(new Date());

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">לוח שנה</h1>
            <p className="text-sm text-gray-500 mt-1">{dayLabel}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Date picker */}
            <input
              type="date"
              value={selectedDateStr}
              onChange={handleDateInput}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <button onClick={nextDay} className="p-2 hover:bg-violet-50 rounded-xl transition-colors text-gray-500 hover:text-violet-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={goToday}
                className={`text-sm px-3 py-1.5 rounded-xl font-medium transition-colors ${
                  isToday ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                }`}
              >
                היום
              </button>
              <button onClick={prevDay} className="p-2 hover:bg-violet-50 rounded-xl transition-colors text-gray-500 hover:text-violet-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="overflow-auto max-h-[65vh]">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-white z-10 border-b border-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-gray-500 font-medium w-14 text-right">שעה</th>
                    {rooms.map((room, ri) => (
                      <th key={room.id} className="px-2 py-2 text-center">
                        <div className={`font-semibold text-xs px-2 py-1 rounded-lg ${ROOM_COLORS[ri % ROOM_COLORS.length]}`}>
                          {room.name}
                        </div>
                        <div className="text-gray-400 font-normal mt-0.5">{room.capacity} מקומות</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SLOTS.map(slot => (
                    <tr key={slot} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-0.5 text-gray-400 whitespace-nowrap font-medium">{slot}</td>
                      {rooms.map((room, ri) => {
                        const type = getSlotType(room, selectedDateStr, slot);
                        const bks = type === 'booked' ? getBookingsForSlot(room.id, selectedDateStr, slot) : [];
                        const colorClass = ROOM_COLORS[ri % ROOM_COLORS.length];
                        return (
                          <td key={room.id} className="p-0.5">
                            {type === 'blocked' ? (
                              <div className="bg-gray-100 border border-gray-200 rounded h-7" title="חסום" />
                            ) : bks.length > 0 ? (
                              <div
                                className={`border rounded h-7 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity ${colorClass}`}
                                onClick={() => setSelectedBooking(bks[0])}
                                title={bks[0].requester_name}
                              >
                                <span className="truncate px-1 text-xs font-medium">{bks[0].requester_name.split(' ')[0]}</span>
                              </div>
                            ) : (
                              <div className="h-7" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Room color legend */}
        {rooms.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap text-xs">
            {rooms.map((r, i) => (
              <div key={r.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-medium ${ROOM_COLORS[i % ROOM_COLORS.length]}`}>
                {r.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking detail modal */}
      {selectedBooking && (
        <Modal open={!!selectedBooking} onClose={() => setSelectedBooking(null)} title="פרטי שריון">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">מגיש</dt><dd className="font-medium">{selectedBooking.requester_name}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">אימייל</dt><dd>{selectedBooking.requester_email}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">מטרת הפגישה</dt><dd>{selectedBooking.meeting_purpose}</dd></div>
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
