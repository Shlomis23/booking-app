import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { toIsraelDateStr, getWeekStart, getWeekDays, DAY_NAMES_HE, MONTH_NAMES_HE, timesOverlap, isRoomBlockedOnDate } from '../../lib/utils';
import Button from '../../components/ui/Button';
import type { Room, Booking } from '../../types';

const START_MINUTES = 7 * 60 + 30; // 7:30
const END_MINUTES = 18 * 60;        // 18:00
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

function getSlotStatus(
  room: Room, dateStr: string, timeSlot: string, bookings: Booking[],
): SlotStatus {
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
  available: 'bg-green-50 hover:bg-green-100 cursor-pointer border-green-200',
  booked:    'bg-red-100 border-red-200 cursor-not-allowed',
  blocked:   'bg-gray-200 border-gray-300 cursor-not-allowed',
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

  // Realtime subscription
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
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-l from-blue-600 to-blue-700 rounded-xl p-6 text-white flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">לוח זמינות חדרים</h1>
          <p className="text-blue-100 text-sm">בחר תאריך וצפה בזמינות כל החדרים</p>
        </div>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => navigate('/book')}
          className="bg-white text-blue-700 border-0 hover:bg-blue-50 font-semibold"
        >
          + הזמן חדר
        </Button>
      </div>

      {/* Week navigation */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button onClick={prevWeek} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-800 text-sm">{weekLabel}</span>
            <button onClick={goToday} className="text-xs text-blue-600 hover:underline">היום</button>
          </div>
          <button onClick={nextWeek} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                className={`py-3 flex flex-col items-center transition-colors ${
                  isSelected ? 'bg-blue-600 text-white' : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className="text-xs opacity-75">{DAY_NAMES_HE[day.getDay()]}</span>
                <span className={`text-lg font-semibold mt-0.5 ${isToday && !isSelected ? 'text-blue-600' : ''}`}>
                  {day.getDate()}
                </span>
                {isToday && !isSelected && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-0.5" />}
              </button>
            );
          })}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="p-12 text-center text-gray-400">אין חדרים פעילים</div>
        ) : (
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr>
                  <th className="py-2 px-3 text-gray-500 font-medium border-b border-gray-100 w-16 text-right">שעה</th>
                  {rooms.map(room => (
                    <th key={room.id} className="py-2 px-2 border-b border-gray-100 text-center">
                      <div className="font-semibold text-gray-800">{room.name}</div>
                      <div className="text-gray-400 font-normal">{room.capacity} מקומות</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map(slot => (
                  <tr key={slot} className="border-b border-gray-50">
                    <td className="py-1 px-3 text-gray-500 font-medium whitespace-nowrap">{slot}</td>
                    {rooms.map(room => {
                      const status = getSlotStatus(room, selectedDateStr, slot, bookings);
                      return (
                        <td key={room.id} className="p-1">
                          <div
                            className={`slot-cell border rounded text-center py-1 text-xs font-medium ${slotClasses[status]}`}
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

        {/* Legend */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-100 border border-green-300 rounded" /> פנוי</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-100 border border-red-300 rounded" /> תפוס</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-200 border border-gray-300 rounded" /> חסום</div>
        </div>
      </div>
    </div>
  );
}
