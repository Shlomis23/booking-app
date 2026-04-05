import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { callFunction } from '../../lib/supabase';
import { formatDate, formatTime, formatDuration, statusLabel, statusColor, DURATION_OPTIONS, toIsraelDateStr } from '../../lib/utils';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card, { CardHeader, CardBody } from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import type { Booking, BookingChange } from '../../types';

export default function ManageBookingPage() {
  const { cancellationCode } = useParams<{ cancellationCode: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [changes, setChanges] = useState<BookingChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);

  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleDuration, setRescheduleDuration] = useState(60);
  const [rescheduleCustom, setRescheduleCustom] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleDone, setRescheduleDone] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');

  useEffect(() => {
    if (!cancellationCode) return;
    fetchBooking();
  }, [cancellationCode]);

  async function fetchBooking() {
    setLoading(true);
    const { data, error } = await supabase
      .from('bookings')
      .select('*, room:room_id(name, capacity), second_room:second_room_id(name, capacity)')
      .eq('cancellation_code', cancellationCode)
      .single();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setBooking(data as Booking);

    // Load changes
    const { data: changesData } = await supabase
      .from('booking_changes')
      .select('*')
      .eq('booking_id', data.id)
      .order('created_at', { ascending: false });

    setChanges((changesData ?? []) as BookingChange[]);
    setLoading(false);
  }

  async function handleCancel() {
    if (!cancellationCode) return;
    setCancelLoading(true);
    try {
      await callFunction('booking-manage', { action: 'cancel', cancellationCode });
      setCancelDone(true);
      setShowCancelConfirm(false);
      fetchBooking();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'שגיאה בביטול');
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleReschedule() {
    const duration = rescheduleDuration === 0 ? (parseInt(rescheduleCustom) || 0) : rescheduleDuration;
    if (!rescheduleDate || !rescheduleTime || duration <= 0) {
      setRescheduleError('יש למלא את כל השדות');
      return;
    }
    setRescheduleLoading(true);
    setRescheduleError('');
    try {
      await callFunction('booking-manage', {
        action: 'reschedule',
        cancellationCode,
        requestedDate: rescheduleDate,
        requestedStartTime: rescheduleTime + ':00',
        requestedDurationMinutes: duration,
        requesterNotes: rescheduleNotes.trim() || null,
      });
      setRescheduleDone(true);
      setShowReschedule(false);
      fetchBooking();
    } catch (err) {
      setRescheduleError(err instanceof Error ? err.message : 'שגיאה בשליחת הבקשה');
    } finally {
      setRescheduleLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900">שריון לא נמצא</h2>
        <p className="text-gray-500">הקישור אינו תקף או שהשריון לא קיים.</p>
        <Button onClick={() => navigate('/')}>חזרה לדף הבית</Button>
      </div>
    );
  }

  if (!booking) return null;

  const canAct = ['pending', 'approved'].includes(booking.status);
  const statusColors: Record<string, string> = { pending: 'yellow', approved: 'green', rejected: 'red', cancelled: 'gray' };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">ניהול שריון</h1>
          <p className="text-sm text-gray-500">מספר אסמכתא: <span className="font-mono text-xs">{booking.id.slice(0, 8)}</span></p>
        </div>
      </div>

      {cancelDone && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 text-sm font-medium">
          ✓ השריון בוטל בהצלחה. נשלח אישור לאימייל שלך.
        </div>
      )}
      {rescheduleDone && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800 text-sm font-medium">
          ✓ בקשת שינוי המועד נשלחה. נשלח אימייל לאישור בקרוב.
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">פרטי השריון</h2>
            <Badge color={(statusColors[booking.status] ?? 'gray') as 'yellow' | 'green' | 'red' | 'gray'}>
              {statusLabel(booking.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardBody>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">שם</dt><dd className="font-medium">{booking.requester_name}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">תאריך</dt><dd className="font-medium">{formatDate(booking.event_date)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">שעה</dt><dd className="font-medium">{formatTime(booking.start_time)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">משך</dt><dd className="font-medium">{formatDuration(booking.duration_minutes)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">משתתפים</dt><dd className="font-medium">{booking.participant_count}</dd></div>
            {booking.room && (
              <div className="flex justify-between">
                <dt className="text-gray-500">חדר</dt>
                <dd className="font-medium">{booking.room.name}{booking.second_room ? ` + ${booking.second_room.name}` : ''}</dd>
              </div>
            )}
            {booking.type === 'special' && !booking.room && (
              <div className="flex justify-between"><dt className="text-gray-500">סוג</dt><dd><Badge color="purple">בקשה מיוחדת</Badge></dd></div>
            )}
            {booking.notes && (
              <div className="flex justify-between"><dt className="text-gray-500">הערות</dt><dd className="text-gray-700">{booking.notes}</dd></div>
            )}
            {booking.admin_notes && (
              <div className="bg-red-50 rounded-lg p-3 mt-2">
                <p className="text-xs font-medium text-red-700">הערת הרכז:</p>
                <p className="text-sm text-red-600 mt-0.5">{booking.admin_notes}</p>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>

      {/* Action buttons */}
      {canAct && (
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setShowReschedule(true)}
          >
            בקש שינוי מועד
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => setShowCancelConfirm(true)}
          >
            בטל שריון
          </Button>
        </div>
      )}

      {/* Changes history */}
      {changes.length > 0 && (
        <Card>
          <CardHeader><h2 className="font-semibold text-gray-800">היסטוריית בקשות שינוי</h2></CardHeader>
          <CardBody className="space-y-3">
            {changes.map(c => (
              <div key={c.id} className="border border-gray-100 rounded-lg p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">בקשת שינוי מועד</span>
                  <Badge color={c.status === 'approved' ? 'green' : c.status === 'rejected' ? 'red' : 'yellow'}>
                    {statusLabel(c.status)}
                  </Badge>
                </div>
                {c.requested_date && (
                  <p className="text-gray-600">
                    מועד מבוקש: {formatDate(c.requested_date)} בשעה {formatTime(c.requested_start_time ?? '')}
                    {c.requested_duration_minutes && ` • ${formatDuration(c.requested_duration_minutes)}`}
                  </p>
                )}
                {c.admin_notes && <p className="text-red-600 text-xs">{c.admin_notes}</p>}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Cancel confirm modal */}
      <Modal open={showCancelConfirm} onClose={() => setShowCancelConfirm(false)} title="אישור ביטול שריון">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            האם אתה בטוח שברצונך לבטל את השריון בתאריך <strong>{formatDate(booking.event_date)}</strong> בשעה <strong>{formatTime(booking.start_time)}</strong>?
          </p>
          <p className="text-xs text-gray-500">הביטול יאושר אוטומטית ולא ניתן לשחזר פעולה זו.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowCancelConfirm(false)}>חזרה</Button>
            <Button variant="danger" onClick={handleCancel} loading={cancelLoading}>כן, בטל שריון</Button>
          </div>
        </div>
      </Modal>

      {/* Reschedule modal */}
      <Modal open={showReschedule} onClose={() => setShowReschedule(false)} title="בקשת שינוי מועד">
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
            <p className="font-medium">מועד נוכחי:</p>
            <p>{formatDate(booking.event_date)} בשעה {formatTime(booking.start_time)} • {formatDuration(booking.duration_minutes)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="תאריך חדש"
              type="date"
              required
              value={rescheduleDate}
              onChange={e => setRescheduleDate(e.target.value)}
              min={toIsraelDateStr(new Date())}
            />
            <Input
              label="שעה חדשה"
              type="time"
              required
              value={rescheduleTime}
              onChange={e => setRescheduleTime(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">משך חדש</label>
            <div className="grid grid-cols-3 gap-2">
              {DURATION_OPTIONS.map(opt => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setRescheduleDuration(opt.value)}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-colors ${
                    rescheduleDuration === opt.value ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {rescheduleDuration === 0 && (
              <Input type="number" placeholder="מספר דקות" value={rescheduleCustom}
                onChange={e => setRescheduleCustom(e.target.value)} min={15} className="mt-2" />
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">הערות (אופציונלי)</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
              value={rescheduleNotes}
              onChange={e => setRescheduleNotes(e.target.value)}
              placeholder="סיבה לשינוי המועד..."
            />
          </div>

          {rescheduleError && <p className="text-sm text-red-600">{rescheduleError}</p>}

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowReschedule(false)}>ביטול</Button>
            <Button onClick={handleReschedule} loading={rescheduleLoading}>שלח בקשת שינוי</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
