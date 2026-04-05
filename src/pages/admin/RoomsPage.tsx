import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { callFunction } from '../../lib/supabase';
import { useAdminGuard, useAdminToken } from '../../hooks/useAuth';
import AdminLayout from '../../components/layout/AdminLayout';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import RoomBlockModal from '../../components/admin/RoomBlockModal';
import Badge from '../../components/ui/Badge';
import type { Room } from '../../types';

interface RoomForm {
  name: string;
  capacity: string;
  description: string;
}

const emptyForm: RoomForm = { name: '', capacity: '', description: '' };

export default function RoomsPage() {
  const ready = useAdminGuard();
  const adminToken = useAdminToken();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [blockRoom, setBlockRoom] = useState<Room | null>(null);
  const [form, setForm] = useState<RoomForm>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchRooms = useCallback(async () => {
    const { data } = await supabase.from('rooms').select('*').order('name');
    setRooms((data ?? []) as Room[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (ready) fetchRooms(); }, [ready, fetchRooms]);

  function openCreate() {
    setEditRoom(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(room: Room) {
    setEditRoom(room);
    setForm({ name: room.name, capacity: String(room.capacity), description: room.description ?? '' });
    setFormError('');
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.capacity) {
      setFormError('שם וקיבולת הם שדות חובה');
      return;
    }
    setFormLoading(true);
    setFormError('');
    try {
      if (editRoom) {
        await callFunction('admin', {
          action: 'update_room',
          roomId: editRoom.id,
          name: form.name.trim(),
          capacity: parseInt(form.capacity),
          description: form.description.trim() || null,
        }, adminToken);
      } else {
        await callFunction('admin', {
          action: 'create_room',
          name: form.name.trim(),
          capacity: parseInt(form.capacity),
          description: form.description.trim() || null,
        }, adminToken);
      }
      setShowForm(false);
      fetchRooms();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'שגיאה בשמירה');
    } finally {
      setFormLoading(false);
    }
  }

  async function toggleActive(room: Room) {
    try {
      await callFunction('admin', {
        action: 'update_room',
        roomId: room.id,
        isActive: !room.is_active,
      }, adminToken);
      fetchRooms();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'שגיאה');
    }
  }

  if (!ready) return null;

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ניהול חדרים</h1>
            <p className="text-sm text-gray-500 mt-1">הוסף, ערוך וחסום חדרי הדרכה</p>
          </div>
          <Button onClick={openCreate}>+ חדר חדש</Button>
        </div>

        {loading ? (
          <div className="flex justify-center h-48 items-center">
            <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid gap-4">
            {rooms.map(room => (
              <div key={room.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 text-lg">{room.name}</h3>
                      {!room.is_active && <Badge color="red">לא פעיל</Badge>}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">
                      קיבולת: <strong>{room.capacity}</strong> משתתפים
                    </p>
                    {room.description && <p className="text-sm text-gray-500 mt-1">{room.description}</p>}

                    {/* Blocked dates */}
                    {room.blocked_dates.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">תאריכים חסומים</p>
                        <div className="flex flex-wrap gap-1">
                          {room.blocked_dates.map((bd, idx) => (
                            <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {bd.from} — {bd.to}{bd.reason ? ` (${bd.reason})` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(room)}>עריכה</Button>
                    <Button size="sm" variant="secondary" onClick={() => setBlockRoom(room)}>חסימת תאריכים</Button>
                    <Button
                      size="sm"
                      variant={room.is_active ? 'ghost' : 'secondary'}
                      onClick={() => toggleActive(room)}
                      className={room.is_active ? 'text-red-600 hover:bg-red-50' : ''}
                    >
                      {room.is_active ? 'הפסק פעילות' : 'הפעל'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editRoom ? `עריכת חדר — ${editRoom.name}` : 'הוספת חדר חדש'}
      >
        <div className="space-y-4">
          <Input
            label="שם החדר"
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="חדר הדרכה א"
          />
          <Input
            label="קיבולת"
            type="number"
            required
            min={1}
            value={form.capacity}
            onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
            placeholder="20"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">תיאור (אופציונלי)</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="תיאור קצר של החדר..."
            />
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowForm(false)}>ביטול</Button>
            <Button onClick={handleSave} loading={formLoading}>
              {editRoom ? 'שמור שינויים' : 'הוסף חדר'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Block dates modal */}
      <RoomBlockModal
        room={blockRoom}
        onClose={() => setBlockRoom(null)}
        onSuccess={() => { fetchRooms(); setBlockRoom(null); }}
      />
    </AdminLayout>
  );
}
