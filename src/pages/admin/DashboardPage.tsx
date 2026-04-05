import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminGuard } from '../../hooks/useAuth';
import AdminLayout from '../../components/layout/AdminLayout';
import ApproveModal from '../../components/admin/ApproveModal';
import RejectModal from '../../components/admin/RejectModal';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card, { CardHeader, CardBody } from '../../components/ui/Card';
import { formatDate, formatTime, formatDuration, toIsraelDateStr } from '../../lib/utils';
import type { Booking } from '../../types';

interface Stats {
  pending: number;
  todayApproved: number;
  totalActive: number;
}

export default function DashboardPage() {
  const ready = useAdminGuard();
  const [pending, setPending] = useState<Booking[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, todayApproved: 0, totalActive: 0 });
  const [loading, setLoading] = useState(true);
  const [approveBooking, setApproveBooking] = useState<Booking | null>(null);
  const [rejectBooking, setRejectBooking] = useState<Booking | null>(null);

  const fetchData = useCallback(async () => {
    const today = toIsraelDateStr(new Date());

    const [{ data: pendingData }, { count: pendingCount }, { count: todayCount }, { count: activeCount }] =
      await Promise.all([
        supabase.from('bookings').select('*').eq('status', 'pending').order('created_at', { ascending: true }),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('event_date', today).eq('status', 'approved'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).in('status', ['pending', 'approved']),
      ]);

    setPending((pendingData ?? []) as Booking[]);
    setStats({
      pending: pendingCount ?? 0,
      todayApproved: todayCount ?? 0,
      totalActive: activeCount ?? 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => { if (ready) fetchData(); }, [ready, fetchData]);

  // Realtime
  useEffect(() => {
    if (!ready) return;
    const ch = supabase.channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ready, fetchData]);

  if (!ready) return null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">לוח בקרה</h1>
          <p className="text-sm text-gray-500 mt-1">סקירה כללית וניהול בקשות ממתינות</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="ממתינים לאישור" value={stats.pending} color="yellow" icon="⏳" />
          <StatCard label="שריונות היום" value={stats.todayApproved} color="blue" icon="📅" />
          <StatCard label="שריונות פעילים" value={stats.totalActive} color="green" icon="✅" />
        </div>

        {/* Pending bookings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">בקשות ממתינות לאישור</h2>
              {stats.pending > 0 && (
                <Badge color="yellow">{stats.pending} בקשות</Badge>
              )}
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
              </div>
            ) : pending.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <p className="text-4xl mb-2">🎉</p>
                <p className="font-medium">אין בקשות ממתינות</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pending.map(booking => (
                  <PendingBookingRow
                    key={booking.id}
                    booking={booking}
                    onApprove={() => setApproveBooking(booking)}
                    onReject={() => setRejectBooking(booking)}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <ApproveModal
        booking={approveBooking}
        onClose={() => setApproveBooking(null)}
        onSuccess={fetchData}
      />
      <RejectModal
        booking={rejectBooking}
        onClose={() => setRejectBooking(null)}
        onSuccess={fetchData}
      />
    </AdminLayout>
  );
}

function StatCard({ label, value, color, icon }: {
  label: string; value: number; color: string; icon: string;
}) {
  const bg: Record<string, string> = {
    yellow: 'bg-yellow-50 border-yellow-200',
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
  };
  const text: Record<string, string> = {
    yellow: 'text-yellow-700',
    blue: 'text-blue-700',
    green: 'text-green-700',
  };
  return (
    <div className={`rounded-xl border p-5 ${bg[color]}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-3xl font-bold ${text[color]}`}>{value}</div>
      <div className={`text-sm font-medium mt-0.5 ${text[color]} opacity-80`}>{label}</div>
    </div>
  );
}

function PendingBookingRow({ booking, onApprove, onReject }: {
  booking: Booking; onApprove: () => void; onReject: () => void;
}) {
  return (
    <div className="px-5 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-gray-900">{booking.requester_name}</span>
          {booking.type === 'special' && (
            <Badge color="purple">בקשה מיוחדת</Badge>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-0.5">{booking.requester_email}</p>
        <p className="text-sm text-gray-700">
          {formatDate(booking.event_date)} | {formatTime(booking.start_time)} | {formatDuration(booking.duration_minutes)} | {booking.participant_count} משתתפים
        </p>
        {booking.notes && (
          <p className="text-xs text-gray-500 mt-1 italic">"{booking.notes}"</p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="success" onClick={onApprove}>אשר</Button>
        <Button size="sm" variant="danger" onClick={onReject}>דחה</Button>
      </div>
    </div>
  );
}
