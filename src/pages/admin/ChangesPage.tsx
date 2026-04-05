import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { callFunction } from '../../lib/supabase';
import { useAdminGuard, useAdminToken } from '../../hooks/useAuth';
import AdminLayout from '../../components/layout/AdminLayout';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { formatDate, formatTime, formatDuration, statusLabel } from '../../lib/utils';
import type { BookingChange } from '../../types';

export default function ChangesPage() {
  const ready = useAdminGuard();
  const adminToken = useAdminToken();
  const [changes, setChanges] = useState<BookingChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<BookingChange | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('booking_changes')
      .select(`
        *,
        booking:booking_id(
          id, requester_name, requester_email, event_date, start_time,
          duration_minutes, participant_count, room:room_id(name), status
        )
      `)
      .order('created_at', { ascending: true });
    setChanges((data ?? []) as BookingChange[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (ready) fetchData(); }, [ready, fetchData]);

  async function handleApprove(change: BookingChange) {
    setActionLoading(true);
    try {
      await callFunction('admin', { action: 'approve_change', changeId: change.id }, adminToken);
      fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectTarget) return;
    setActionLoading(true);
    try {
      await callFunction('admin', {
        action: 'reject_change',
        changeId: rejectTarget.id,
        adminNotes: rejectNotes.trim() || null,
      }, adminToken);
      setRejectTarget(null);
      setRejectNotes('');
      fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setActionLoading(false);
    }
  }

  if (!ready) return null;

  const pending = changes.filter(c => c.status === 'pending');
  const historical = changes.filter(c => c.status !== 'pending');

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">בקשות שינוי מועד</h1>
          <p className="text-sm text-gray-500 mt-1">אישור ודחיית בקשות לשינוי מועד שריון</p>
        </div>

        {loading ? (
          <div className="flex justify-center h-48 items-center">
            <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Pending */}
            <section>
              <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                ממתינות לאישור
                {pending.length > 0 && <Badge color="yellow">{pending.length}</Badge>}
              </h2>
              {pending.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-gray-400">
                  <p className="text-3xl mb-2">✓</p>
                  <p>אין בקשות ממתינות</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map(c => (
                    <ChangeCard
                      key={c.id}
                      change={c}
                      onApprove={() => handleApprove(c)}
                      onReject={() => { setRejectTarget(c); setRejectNotes(''); }}
                      actionLoading={actionLoading}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Historical */}
            {historical.length > 0 && (
              <section>
                <h2 className="font-semibold text-gray-700 mb-3">היסטוריה</h2>
                <div className="space-y-2">
                  {historical.map(c => (
                    <ChangeCard key={c.id} change={c} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Reject modal */}
      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="דחיית בקשת שינוי מועד">
        {rejectTarget && (
          <div className="space-y-4">
            <div className="bg-red-50 rounded-lg p-3 text-sm">
              <p><strong>מגיש:</strong> {rejectTarget.booking?.requester_name}</p>
              <p><strong>מועד מבוקש:</strong> {formatDate(rejectTarget.requested_date ?? '')} בשעה {formatTime(rejectTarget.requested_start_time ?? '')}</p>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                סיבת הדחייה <span className="text-gray-400 font-normal">(אופציונלי)</span>
              </label>
              <textarea
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                rows={3}
                value={rejectNotes}
                onChange={e => setRejectNotes(e.target.value)}
                placeholder="הסבר קצר..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setRejectTarget(null)}>ביטול</Button>
              <Button variant="danger" onClick={handleReject} loading={actionLoading}>דחה בקשה</Button>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}

function ChangeCard({ change, onApprove, onReject, actionLoading }: {
  change: BookingChange;
  onApprove?: () => void;
  onReject?: () => void;
  actionLoading?: boolean;
}) {
  const booking = change.booking;
  const isPending = change.status === 'pending';

  return (
    <div className={`bg-white rounded-xl border p-5 ${isPending ? 'border-yellow-200' : 'border-gray-200'}`}>
      <div className="flex items-start gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{booking?.requester_name}</span>
            <span className="text-gray-400 text-sm">{booking?.requester_email}</span>
            <Badge color={change.status === 'approved' ? 'green' : change.status === 'rejected' ? 'red' : 'yellow'}>
              {statusLabel(change.status)}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">מועד מקורי</p>
              <p className="font-medium">{formatDate(booking?.event_date ?? '')}</p>
              <p className="text-gray-600">{formatTime(booking?.start_time ?? '')} • {formatDuration(booking?.duration_minutes ?? 0)}</p>
              {booking?.room && <p className="text-gray-500 text-xs mt-0.5">{(booking.room as {name: string}).name}</p>}
            </div>
            <div className="bg-violet-50 rounded-lg p-3">
              <p className="text-xs font-medium text-violet-600 mb-1">מועד מבוקש</p>
              <p className="font-medium">{formatDate(change.requested_date ?? '')}</p>
              <p className="text-gray-600">{formatTime(change.requested_start_time ?? '')} • {formatDuration(change.requested_duration_minutes ?? 0)}</p>
            </div>
          </div>

          {change.requester_notes && (
            <p className="text-sm text-gray-600 italic">"{change.requester_notes}"</p>
          )}
          {change.admin_notes && (
            <p className="text-sm text-red-600">{change.admin_notes}</p>
          )}
        </div>

        {isPending && onApprove && onReject && (
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="success" onClick={onApprove} loading={actionLoading}>אשר</Button>
            <Button size="sm" variant="danger" onClick={onReject} loading={actionLoading}>דחה</Button>
          </div>
        )}
      </div>
    </div>
  );
}
