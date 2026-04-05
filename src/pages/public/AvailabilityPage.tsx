import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { toIsraelDateStr, getWeekStart, getWeekDays, DAY_NAMES_HE, MONTH_NAMES_HE, timesOverlap, isRoomBlockedOnDate } from '../../lib/utils';
import type { Room, Booking } from '../../types';

const START_MINUTES = 7 * 60 + 30;
const END_MINUTES = 18 * 60;
const SLOT_MINUTES = 30;

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let m = START_MINUTES; m < END_MINUTES; m += SLOT_MINUTES) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

type SlotStatus = 'available' | 'booked' | 'blocked' | 'past';

function getSlotStatus(room: Room, dateStr: string, timeSlot: string, bookings: Booking[]): SlotStatus {
  const now = new Date();
  const slotDate = new Date(`${dateStr}T${timeSlot}:00`);
  if (slotDate < now) return 'past';
  if (isRoomBlockedOnDate(room, dateStr)) return 'blocked';
  const hasBooking = bookings.some(b =>
    (b.room_id === room.id || b.second_room_id === room.id) &&
    b.event_date === dateStr &&
    ['pending', 'approved'].includes(b.status) &&
    timesOverlap(b.start_time, b.duration_minutes, timeSlot, SLOT_MINUTES),
  );
  return hasBooking ? 'booked' : 'available';
}

const slotClasses: Record<SlotStatus, string> = {
  available: 'bg-emerald-50 hover:bg-emerald-100 cursor-pointer border-emerald-200 text-emerald-700',
  booked:    'bg-rose-50 border-rose-200 cursor-not-allowed text-rose-500',
  blocked:   'bg-gray-100 border-gray-200 cursor-not-allowed text-gray-400',
  past:      'bg-gray-50 border-gray-100 cursor-not-allowed opacity-40',
};

const slotLabel: Record<SlotStatus, string> = {
  available: 'פנוי',
  booked:    'תפוס',
  blocked:   'חסום',
  past:      '',
};

export default function AvailabilityPage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  const weekDays = getWeekDays(weekStart);
  const selectedDateStr = toIsraelDateStr(selectedDay);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const weekEndStr = toIsraelDateStr(weekDays[6]);
    const weekStartStr = toIsraelDateStr(weekDays[0]);

    const [{ data: roomsData }, { data: bookingsData }] = await Promise.all([
      supabase.from('rooms').select('*').eq('is_active', true).order('name'),
      supabase.from('bookings').select('*')
        .gte('event_date', weekStartStr)
        .lte('event_date', weekEndStr)
        .in('status', ['pending', 'approved']),
    ]);

    setRooms((roomsData ?? []) as Room[]);
    setBookings((bookingsData ?? []) as Booking[]);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase.channel('bookings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  function handleSlotClick(timeSlot: string) {
    navigate(`/book?date=${selectedDateStr}&time=${timeSlot}`);
  }

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
    setSelectedDay(d);
  }

  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
    setSelectedDay(d);
  }

  function goToday() {
    const today = new Date();
    setWeekStart(getWeekStart(today));
    setSelectedDay(today);
  }

  const weekLabel = (() => {
    const s = weekDays[0]; const e = weekDays[6];
    return `${s.getDate()} ${MONTH_NAMES_HE[s.getMonth()]} — ${e.getDate()} ${MONTH_NAMES_HE[e.getMonth()]} ${e.getFullYear()}`;
  })();

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-l from-violet-500 to-indigo-500 rounded-2xl p-5 sm:p-6 shadow-lg shadow-indigo-100">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">לוח זמינות חדרים</h1>
            <p className="text-white/70 text-sm">בחר תאריך, בחן זמינות ושלח בקשת שריון — אחראי החדרים יאשר ויקצה חדר</p>
          </div>
          <button
            onClick={() => navigate('/book')}
            className="bg-white text-violet-700 font-semibold px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all text-sm w-full sm:w-auto text-center"
          >
            + הזמן חדר
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-white/80 text-xs border-t border-white/20 pt-3">
          <span>1. בחר תאריך ושעה</span>
          <span className="text-white/40">›</span>
          <span>2. הגש בקשת שריון</span>
          <span className="text-white/40">›</span>
          <span>3. קבל אישור במייל</span>
        </div>
      </div>

      {/* Week navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Week header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button onClick={nextWeek} className="p-2 hover:bg-violet-50 rounded-xl transition-colors text-gray-500 hover:text-violet-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-700 text-sm">{weekLabel}</span>
            <button
              onClick={goToday}
              className="text-xs bg-violet-100 text-violet-700 px-3 py-1 rounded-full hover:bg-violet-200 transition-colors font-medium"
            >
              היום
            </button>
          </div>
          <button onClick={prevWeek} className="p-2 hover:bg-violet-50 rounded-xl transition-colors text-gray-500 hover:text-violet-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Day tabs */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {weekDays.map((day, i) => {
            const dateStr = toIsraelDateStr(day);
            const isSelected = dateStr === selectedDateStr;
            const isToday = dateStr === toIsraelDateStr(new Date());
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(day)}
                className={`py-3 flex flex-col items-center transition-all border-b-2 ${
                  isSelected
                    ? 'border-violet-600 text-violet-700'
                    : 'border-transparent hover:bg-violet-50 text-gray-500 hover:text-violet-600'
                }`}
              >
                <span className="text-xs font-medium">{DAY_NAMES_HE[day.getDay()]}</span>
                <span className={`text-lg font-bold mt-0.5 ${
                  isSelected ? 'text-violet-700' : isToday ? 'text-violet-500' : ''
                }`}>
                  {day.getDate()}
                </span>
                {isSelected && <span className="w-1.5 h-1.5 bg-violet-600 rounded-full mt-0.5" />}
              </button>
            );
          })}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-violet-400 border-t-transparent rounded-full" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="p-12 text-center text-gray-400">אין חדרים פעילים</div>
        ) : (
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                <tr>
                  <th className="py-2 px-3 text-gray-400 font-medium border-b border-gray-100 w-16 text-right">שעה</th>
                  {rooms.map(room => (
                    <th key={room.id} className="py-2 px-2 border-b border-gray-100 text-center">
                      <div className="font-bold text-gray-700">{room.name}</div>
                      <div className="text-gray-400 font-normal">{room.capacity} מקומות</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map(slot => (
                  <tr key={slot} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-1 px-3 text-gray-400 font-medium whitespace-nowrap">{slot}</td>
                    {rooms.map(room => {
                      const status = getSlotStatus(room, selectedDateStr, slot, bookings);
                      return (
                        <td key={room.id} className="p-1">
                          <div
                            className={`slot-cell border rounded-lg text-center py-1 text-xs font-semibold ${slotClasses[status]}`}
                            onClick={() => status === 'available' && handleSlotClick(slot)}
                            title={status === 'booked' ? 'תפוס' : status === 'blocked' ? 'חסום' : 'לחץ להזמנה'}
                          >
                            {slotLabel[status]}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Click hint */}
        {rooms.length > 0 && !loading && (
          <div className="px-4 py-2 bg-violet-50 border-t border-violet-100 text-xs text-violet-600 text-center">
            לחץ על תא <span className="font-semibold">פנוי</span> כדי להתחיל הזמנה
          </div>
        )}

        {/* Legend */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-5 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded" /> פנוי
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-rose-100 border border-rose-300 rounded" /> תפוס
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded" /> חסום
          </div>
        </div>
      </div>
    </div>
  );
}
