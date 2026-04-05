import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { callFunction } from '../../lib/supabase';
import { useAdminToken } from '../../hooks/useAuth';
import { formatTime, formatDuration } from '../../lib/utils';
import type { Booking } from '../../types';

interface RejectModalProps {
  booking: Booking | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RejectModal({ booking, onClose, onSuccess }: RejectModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const adminToken = useAdminToken();

  useEffect(() => {
    setReason('');
    setError('');
  }, [booking]);

  async function handleReject() {
    if (!booking) return;
    setLoading(true);
    setError('');
    try {
      await callFunction('admin', {
        action: 'reject',
        bookingId: booking.id,
        adminNotes: reason.trim() || null,
      }, adminToken);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בדחיית השריון');
    } finally {
      setLoading(false);
    }
  }

  if (!booking) return null;

  return (
    <Modal open={!!booking} onClose={onClose} title="דחיית שריון">
      <div className="space-y-4">
        <div className="bg-red-50 rounded-lg p-4 text-sm space-y-1">
          <p><span className="font-medium">מגיש: </span>{booking.requester_name}</p>
          <p><span className="font-medium">תאריך: </span>{booking.event_date}</p>
          <p><span className="font-medium">שעה: </span>{formatTime(booking.start_time)} • {formatDuration(booking.duration_minutes)}</p>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            סיבת הדחייה <span className="text-gray-400 font-normal">(אופציונלי)</span>
          </label>
          <textarea
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
            placeholder="הסבר קצר שיישלח למגיש..."
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>ביטול</Button>
          <Button variant="danger" onClick={handleReject} loading={loading}>
            דחה שריון
          </Button>
        </div>
      </div>
    </Modal>
  );
}
