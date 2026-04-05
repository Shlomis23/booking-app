import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Select from '../ui/Select';
import { supabase } from '../../lib/supabase';
import { callFunction } from '../../lib/supabase';
import { useAdminToken } from '../../hooks/useAuth';
import { isRoomAvailable, formatTime, formatDuration } from '../../lib/utils';
import type { Booking, Room } from '../../types';

interface ApproveModalProps {
  booking: Booking | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ApproveModal({ booking, onClose, onSuccess }: ApproveModalProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState('');
  const [secondRoomId, setSecondRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const adminToken = useAdminToken();

  const isSpecial = booking?.type === 'special';

  useEffect(() => {
    if (!booking) return;
    loadAvailableRooms();
    setRoomId('');
    setSecondRoomId('');
    setError('');
  }, [booking]);

  async function loadAvailableRooms() {
    if (!booking) return;
    // Load all active rooms
    const { data: allRooms } = await supabase.from('rooms').select('*').eq('is_active', true);
    // Load bookings for that date
    const { data: dayBookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('event_date', booking.event_date)
      .neq('id', booking.id)
      .in('status', ['pending', 'approved']);

    const available = (allRooms ?? []).filter(r =>
      isRoomAvailable(r as Room, booking.event_date, booking.start_time, booking.duration_minutes, (dayBookings ?? []) as Booking[])
    );
    setRooms(available as Room[]);
  }

  async function handleApprove() {
    if (!booking) return;
    if (!roomId && !isSpecial) { setError('יש לבחור חדר'); return; }
    if (isSpecial && (!roomId || !secondRoomId)) { setError('יש לבחור שני חדרים'); return; }
    if (isSpecial && roomId === secondRoomId) { setError('יש לבחור שני חדרים שונים'); return; }

    setLoading(true);
    setError('');
    try {
      await callFunction('admin', {
        action: 'approve',
        bookingId: booking.id,
        roomId: roomId || null,
        secondRoomId: isSpecial ? (secondRoomId || null) : null,
      }, adminToken);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה באישור השריון');
    } finally {
      setLoading(false);
    }
  }

  if (!booking) return null;

  const roomOptions = rooms.map(r => ({
    value: r.id,
    label: `${r.name} (${r.capacity} משתתפים)`,
  }));

  const secondRoomOptions = roomOptions.filter(r => r.value !== roomId);

  return (
    <Modal open={!!booking} onClose={onClose} title="אישור שריון">
      <div className="space-y-4">
        {/* Booking summary */}
        <div className="bg-blue-50 rounded-lg p-4 text-sm space-y-1">
          <p><span className="font-medium">מגיש: </span>{booking.requester_name}</p>
          <p><span className="font-medium">תאריך: </span>{booking.event_date}</p>
          <p><span className="font-medium">שעה: </span>{formatTime(booking.start_time)} • {formatDuration(booking.duration_minutes)}</p>
          <p><span className="font-medium">משתתפים: </span>{booking.participant_count}</p>
          {isSpecial && (
            <p className="mt-1 text-purple-700 font-medium">⚠️ בקשה מיוחדת — נדרשים שני חדרים</p>
          )}
        </div>

        {rooms.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            אין חדרים פנויים לאותו מועד ומשך.
          </div>
        ) : (
          <>
            <Select
              label={isSpecial ? 'חדר ראשון' : 'בחר חדר'}
              required
              options={roomOptions}
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              placeholder="-- בחר חדר --"
            />

            {isSpecial && (
              <Select
                label="חדר שני"
                required
                options={secondRoomOptions}
                value={secondRoomId}
                onChange={e => setSecondRoomId(e.target.value)}
                placeholder="-- בחר חדר שני --"
                disabled={!roomId}
              />
            )}
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>ביטול</Button>
          <Button
            variant="success"
            onClick={handleApprove}
            loading={loading}
            disabled={rooms.length === 0}
          >
            אשר שריון
          </Button>
        </div>
      </div>
    </Modal>
  );
}
