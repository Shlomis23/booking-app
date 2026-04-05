import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { callFunction } from '../../lib/supabase';
import { useAdminGuard, useAdminToken } from '../../hooks/useAuth';
import AdminLayout from '../../components/layout/AdminLayout';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { formatDate, formatTime, formatDuration, statusLabel, statusColor } from '../../lib/utils';
import type { Booking, Room } from '../../types';

export default function BookingsPage() {
  const ready = useAdminGuard();
  const adminToken = useAdminToken();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelNotes, setCancelNotes] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRoom, setFilterRoom] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('bookings')
      .select('*, room:room_id(name), second_room:second_room_id(name)')
      .order('event_date', { ascending: false });

    if (filterStatus) query = query.eq('status', filterStatus);
    if (filterRoom) query = query.or(`room_id.eq.${filterRoom},second_room_id.eq.${filterRoom}`);
    if (filterDateFrom) query = query.gte('event_date', filterDateFrom);
    if (filterDateTo) query = query.lte('event_date', filterDateTo);

    const { data } = await query;
    setBookings((data ?? []) as Booking[]);
    setLoading(false);
  }, [filterStatus, filterRoom, filterDateFrom, filterDateTo]);

  useEffect(() => {
    if (!ready) return;
    supabase.from('rooms').select('*').then(({ data }) => setRooms((data ?? []) as Room[]));
  }, [ready]);

  useEffect(() => { if (ready) fetchData(); }, [ready, fetchData]);

  async function handleAdminCancel() {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await callFunction('admin', { action: 'cancel', bookingId: cancelTarget.id, adminNotes: cancelNotes.trim() || null }, adminToken);
      setCancelTarget(null);
      setCancelNotes('');
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'שגיאה בביטול');
    } finally {
      setCancelLoading(false);
    }
  }

  if (!ready) return null;

  const statusBadgeColor = (s: string) => {
    const map: Record<string, 'yellow' | 'green' | 'red' | 'gray'> = {
      pending: 'yellow', approved: 'green', rejected: 'red', cancelled: 'gray',
    };
    return map[s] ?? 'gray';
  };

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">כל השריונות</h1>
          <p className="text-sm text-gray-500 mt-1">רשימה מלאה של כל בקשות השריון</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-4 gap-3">
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">כל הסטטוסים</option>
            <option value="pending">ממתין לאישור</option>
            <option value="approved">מאושר</option>
            <option value="rejected">נדחה</option>
            <option value="cancelled">בוטל</option>
          </select>

          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filterRoom}
            onChange={e => setFilterRoom(e.target.value)}
          >
            <option value="">כל החדרים</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          <input
            type="date"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            placeholder="מתאריך"
          />
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            placeholder="עד תאריך"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="py-16 text-center text-gray-400">אין שריונות להצגה</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-600">מגיש</th>
                    <th className="px-4 py-3 font-medium text-gray-600">תאריך</th>
                    <th className="px-4 py-3 font-medium text-gray-600">שעה</th>
                    <th className="px-4 py-3 font-medium text-gray-600">משך</th>
                    <th className="px-4 py-3 font-medium text-gray-600">חדר</th>
                    <th className="px-4 py-3 font-medium text-gray-600">משתתפים</th>
                    <th className="px-4 py-3 font-medium text-gray-600">סטטוס</th>
                    <th className="px-4 py-3 font-medium text-gray-600">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bookings.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{b.requester_name}</div>
                        <div className="text-xs text-gray-500">{b.requester_email}</div>
                        {b.type === 'special' && <Badge color="purple" className="mt-0.5">מיוחד</Badge>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{b.event_date}</td>
                      <td className="px-4 py-3 text-gray-700">{formatTime(b.start_time)}</td>
                      <td className="px-4 py-3 text-gray-700">{formatDuration(b.duration_minutes)}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {b.room?.name ?? (b.type === 'special' ? '(טרם הוקצה)' : '—')}
                        {b.second_room && ` + ${b.second_room.name}`}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{b.participant_count}</td>
                      <td className="px-4 py-3">
                        <Badge color={statusBadgeColor(b.status)}>{statusLabel(b.status)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {b.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setCancelTarget(b)}
                          >
                            בטל
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Cancel confirm modal */}
      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="ביטול שריון">
        {cancelTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              האם לבטל את השריון של <strong>{cancelTarget.requester_name}</strong> בתאריך <strong>{formatDate(cancelTarget.event_date)}</strong>?
            </p>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">סיבת הביטול (אופציונלי)</label>
              <textarea
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                placeholder="הסבר למגיש מדוע השריון בוטל..."
                value={cancelNotes}
                onChange={e => setCancelNotes(e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-500">ישלח אימייל אישור ביטול למגיש.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => { setCancelTarget(null); setCancelNotes(''); }}>חזרה</Button>
              <Button variant="danger" onClick={handleAdminCancel} loading={cancelLoading}>כן, בטל</Button>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
