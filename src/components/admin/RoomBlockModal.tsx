import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { callFunction } from '../../lib/supabase';
import { useAdminToken } from '../../hooks/useAuth';
import type { Room } from '../../types';

interface RoomBlockModalProps {
  room: Room | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RoomBlockModal({ room, onClose, onSuccess }: RoomBlockModalProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const adminToken = useAdminToken();

  async function handleAdd() {
    if (!room) return;
    if (!from || !to) { setError('יש להזין תאריך התחלה וסיום'); return; }
    if (from > to) { setError('תאריך ההתחלה חייב להיות לפני תאריך הסיום'); return; }
    setLoading(true);
    setError('');
    try {
      await callFunction('admin', {
        action: 'add_block',
        roomId: room.id,
        from,
        to,
        reason: reason.trim(),
      }, adminToken);
      setFrom(''); setTo(''); setReason('');
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בהוספת חסימה');
    } finally {
      setLoading(false);
    }
  }

  if (!room) return null;

  return (
    <Modal open={!!room} onClose={onClose} title={`חסימת תאריכים — ${room.name}`}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">הוסף טווח תאריכים שבהם החדר לא יהיה זמין לשריון.</p>

        {/* Existing blocks */}
        {room.blocked_dates.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">חסימות קיימות:</p>
            {room.blocked_dates.map((bd, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <span>{bd.from} — {bd.to} {bd.reason ? `(${bd.reason})` : ''}</span>
                <RemoveBlockButton roomId={room.id} index={idx} onSuccess={onSuccess} adminToken={adminToken} />
              </div>
            ))}
          </div>
        )}

        <div className="border-t pt-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">הוסף חסימה חדשה:</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="מתאריך" type="date" value={from} onChange={e => setFrom(e.target.value)} required />
            <Input label="עד תאריך" type="date" value={to} onChange={e => setTo(e.target.value)} required />
          </div>
          <Input
            label="סיבה"
            placeholder="לדוג׳: תחזוקה"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>סגור</Button>
          <Button onClick={handleAdd} loading={loading}>הוסף חסימה</Button>
        </div>
      </div>
    </Modal>
  );
}

function RemoveBlockButton({ roomId, index, onSuccess, adminToken }: {
  roomId: string; index: number; onSuccess: () => void; adminToken: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    setLoading(true);
    try {
      await callFunction('admin', { action: 'remove_block', roomId, index }, adminToken);
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRemove}
      disabled={loading}
      className="text-red-500 hover:text-red-700 text-xs font-medium disabled:opacity-50"
    >
      הסר
    </button>
  );
}
