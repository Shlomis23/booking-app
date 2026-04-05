import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { callFunction } from '../../lib/supabase';
import { isRoomAvailable, DURATION_OPTIONS, toIsraelDateStr } from '../../lib/utils';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Card, { CardHeader, CardBody } from '../../components/ui/Card';
import type { Room, Booking } from '../../types';

function isOrgEmail(_email: string) {
  return true;
}

interface FormState {
  requesterName: string;
  requesterEmail: string;
  eventDate: string;
  startTime: string;
  durationMinutes: number;
  customDuration: string;
  participantCount: string;
  meetingPurpose: string;
  notes: string;
}

export default function BookingFormPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [form, setForm] = useState<FormState>({
    requesterName: '',
    requesterEmail: '',
    eventDate: params.get('date') ?? toIsraelDateStr(new Date()),
    startTime: params.get('time') ?? '09:00',
    durationMinutes: 60,
    customDuration: '',
    participantCount: '',
    meetingPurpose: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [rooms, setRooms] = useState<Room[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [isSpecial, setIsSpecial] = useState(false);
  const [forceSpecial, setForceSpecial] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bookingCode, setBookingCode] = useState('');

  const durationValue = form.durationMinutes === 0
    ? (parseInt(form.customDuration) || 0)
    : form.durationMinutes;

  // Load all active rooms
  useEffect(() => {
    supabase.from('rooms').select('*').eq('is_active', true).then(({ data }) => {
      setRooms((data ?? []) as Room[]);
    });
  }, []);

  // Load bookings for selected date
  useEffect(() => {
    if (!form.eventDate) return;
    supabase
      .from('bookings')
      .select('*')
      .eq('event_date', form.eventDate)
      .in('status', ['pending', 'approved'])
      .then(({ data }) => setAllBookings((data ?? []) as Booking[]));
  }, [form.eventDate]);

  // Recalculate available rooms when form changes
  useEffect(() => {
    const count = parseInt(form.participantCount) || 0;
    if (count <= 0 || !form.eventDate || !form.startTime || durationValue <= 0) {
      setAvailableRooms([]);
      setForceSpecial(false);
      setIsSpecial(false);
      return;
    }

    const suitable = rooms.filter(r => r.capacity >= count);
    const available = suitable.filter(r =>
      isRoomAvailable(r, form.eventDate, form.startTime, durationValue, allBookings)
    );

    if (suitable.length === 0) {
      // No room has enough capacity — force special
      setForceSpecial(true);
      setIsSpecial(true);
    } else {
      setForceSpecial(false);
    }

    setAvailableRooms(available);
  }, [form.participantCount, form.eventDate, form.startTime, durationValue, rooms, allBookings]);

  function set(field: keyof FormState, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.requesterName.trim()) errs.requesterName = 'שדה חובה';
    if (!form.requesterEmail.trim()) errs.requesterEmail = 'שדה חובה';
    else if (!isOrgEmail(form.requesterEmail)) errs.requesterEmail = 'יש להשתמש באימייל ארגוני (לא Gmail / Yahoo וכד׳)';
    if (!form.eventDate) errs.eventDate = 'שדה חובה';
    if (!form.startTime) errs.startTime = 'שדה חובה';
    if (!form.participantCount || parseInt(form.participantCount) <= 0) errs.participantCount = 'שדה חובה';
    if (!form.meetingPurpose.trim()) errs.meetingPurpose = 'שדה חובה';
    if (durationValue <= 0) errs.customDuration = 'יש להזין משך תקין';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await callFunction('create-booking', {
        requesterName: form.requesterName.trim(),
        requesterEmail: form.requesterEmail.trim().toLowerCase(),
        eventDate: form.eventDate,
        startTime: form.startTime + ':00',
        durationMinutes: durationValue,
        participantCount: parseInt(form.participantCount),
        meetingPurpose: form.meetingPurpose.trim(),
        notes: form.notes.trim() || null,
        isSpecial: isSpecial || forceSpecial,
      });
      if (result?.cancellationCode) setBookingCode(result.cancellationCode);
      setSubmitted(true);
    } catch (err) {
      setErrors({ requesterEmail: err instanceof Error ? err.message : 'שגיאה בשמירת הבקשה' });
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto py-10 space-y-5">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">הבקשה התקבלה!</h2>
          <p className="text-gray-500 text-sm">נשלח אליך אימייל עם פרטי הבקשה.<br />הבקשה ממתינה לאישור הרכז.</p>
        </div>

        {bookingCode && (
          <div className="bg-violet-50 border-2 border-dashed border-violet-300 rounded-2xl p-6 text-center">
            <p className="text-sm text-gray-500 mb-2">מספר ההזמנה שלך</p>
            <p className="text-4xl font-bold text-violet-700 tracking-widest font-mono">{bookingCode}</p>
            <p className="text-xs text-gray-400 mt-3">שמור מספר זה — תצטרך אותו כדי לעקוב אחר הבקשה, לשנות מועד או לבטל</p>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">מה קורה עכשיו?</p>
          <ol className="space-y-1 text-amber-700 list-decimal list-inside">
            <li>הרכז יקבל הודעה על בקשתך</li>
            <li>לאחר בדיקה יאשר ויקצה חדר — או ייצור קשר</li>
            <li>תקבל אימייל עם אישור סופי</li>
          </ol>
        </div>

        <div className="flex gap-3">
          <Button onClick={() => navigate('/')} className="flex-1">חזרה ללוח זמינות</Button>
          <Button variant="secondary" onClick={() => { setSubmitted(false); setBookingCode(''); setForm(f => ({ ...f, requesterName: '', requesterEmail: '', notes: '' })); }} className="flex-1">
            הגש בקשה נוספת
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">הזמנת חדר הדרכה</h1>
        <p className="text-gray-500 text-sm mt-1">מלא את הפרטים ושלח בקשת שריון. הבקשה תועבר לאישור הרכז.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardHeader><h2 className="font-semibold text-gray-800">פרטי המגיש</h2></CardHeader>
          <CardBody className="space-y-4">
            <Input
              label="שם מלא"
              required
              value={form.requesterName}
              onChange={e => set('requesterName', e.target.value)}
              error={errors.requesterName}
              placeholder="ישראל ישראלי"
            />
            <Input
              label="אימייל ארגוני"
              type="email"
              required
              value={form.requesterEmail}
              onChange={e => set('requesterEmail', e.target.value)}
              error={errors.requesterEmail}
              placeholder="name@company.co.il"
              hint=""
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="font-semibold text-gray-800">פרטי האירוע</h2></CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="תאריך"
                type="date"
                required
                value={form.eventDate}
                onChange={e => set('eventDate', e.target.value)}
                error={errors.eventDate}
                min={toIsraelDateStr(new Date())}
              />
              <Input
                label="שעת התחלה"
                type="time"
                required
                value={form.startTime}
                onChange={e => set('startTime', e.target.value)}
                error={errors.startTime}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                משך האירוע <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DURATION_OPTIONS.map(opt => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => set('durationMinutes', opt.value)}
                    className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      form.durationMinutes === opt.value
                        ? 'bg-violet-600 border-violet-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-violet-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {form.durationMinutes === 0 && (
                <Input
                  type="number"
                  placeholder="מספר דקות"
                  value={form.customDuration}
                  onChange={e => set('customDuration', e.target.value)}
                  error={errors.customDuration}
                  min={15}
                  className="mt-2"
                />
              )}
            </div>

            <Input
              label="מספר משתתפים"
              type="number"
              required
              min={1}
              value={form.participantCount}
              onChange={e => set('participantCount', e.target.value)}
              error={errors.participantCount}
              placeholder="כמה משתתפים?"
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                מטרת הפגישה <span className="text-red-500">*</span>
              </label>
              <textarea
                className={`block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none ${errors.meetingPurpose ? 'border-red-400' : 'border-gray-300'}`}
                rows={2}
                placeholder="תאר בקצרה את מטרת הפגישה..."
                value={form.meetingPurpose}
                onChange={e => set('meetingPurpose', e.target.value)}
              />
              {errors.meetingPurpose && <p className="text-xs text-red-600">{errors.meetingPurpose}</p>}
            </div>

            {/* Capacity / special booking logic */}
            {form.participantCount && parseInt(form.participantCount) > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                {forceSpecial ? (
                  <div className="text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="font-semibold">⚠️ מספר המשתתפים חורג מקיבולת כל החדרים הקיימים.</p>
                    <p className="mt-1 text-xs">הבקשה תוגש כבקשה מיוחדת — הרכז יקצה שני חדרים בהתאם.</p>
                  </div>
                ) : availableRooms.length > 0 ? (
                  <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="font-semibold">✓ נמצאו {availableRooms.length} חדרים מתאימים ופנויים:</p>
                    <ul className="mt-1 space-y-0.5">
                      {availableRooms.map(r => (
                        <li key={r.id} className="text-xs">• {r.name} ({r.capacity} מקומות)</li>
                      ))}
                    </ul>
                    <p className="text-xs mt-1.5 text-green-600">הרכז יקצה חדר ספציפי בעת האישור.</p>
                  </div>
                ) : (
                  durationValue > 0 && form.eventDate && form.startTime && (
                    <div className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="font-semibold">אין חדרים פנויים בתאריך ובשעה שנבחרו.</p>
                      <p className="text-xs mt-1">ניתן לנסות מועד אחר.</p>
                    </div>
                  )
                )}

                {!forceSpecial && availableRooms.length > 0 && (
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      checked={isSpecial}
                      onChange={e => setIsSpecial(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span>אני זקוק/ה ליותר מחדר אחד (בקשה מיוחדת)</span>
                  </label>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">הערות (אופציונלי)</label>
              <textarea
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                rows={3}
                placeholder="פרטים נוספים על האירוע..."
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>
          </CardBody>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" loading={loading} size="lg" className="flex-1">
            שלח בקשת שריון
          </Button>
          <Button type="button" variant="secondary" size="lg" onClick={() => navigate('/')}>
            ביטול
          </Button>
        </div>
      </form>
    </div>
  );
}
