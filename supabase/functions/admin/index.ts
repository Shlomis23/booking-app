import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  sendBookingApproved,
  sendBookingRejected,
  sendCancellationConfirmed,
  sendCancellationAdmin,
  sendRescheduleApproved,
  sendRescheduleRejected,
} from '../_shared/email.ts';

function validateToken(req: Request): boolean {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  try {
    const token = authHeader.slice(7);
    const decoded = atob(token);
    return decoded === Deno.env.get('ADMIN_PASSWORD');
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const body = await req.json();
    const { action } = body;

    // ── Login ───────────────────────────────────────────────────
    if (action === 'login') {
      const { password } = body;
      if (password === Deno.env.get('ADMIN_PASSWORD')) {
        const token = btoa(password);
        return json({ success: true, token });
      }
      return json({ error: 'סיסמה שגויה' }, 401);
    }

    // All other actions require auth
    if (!validateToken(req)) {
      return json({ error: 'אין הרשאה' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const appUrl = Deno.env.get('APP_URL') || 'https://localhost:5173';
    const adminEmail = Deno.env.get('ADMIN_EMAIL')!;
    const fromEmail = Deno.env.get('ADMIN_FROM_EMAIL')!;

    // ── Approve booking ─────────────────────────────────────────
    if (action === 'approve') {
      const { bookingId, roomId, secondRoomId } = body;

      const { data: booking, error: fetchErr } = await supabase
        .from('bookings')
        .select(`*, room:room_id(name), second_room:second_room_id(name)`)
        .eq('id', bookingId)
        .single();

      if (fetchErr || !booking) return json({ error: 'שריון לא נמצא' }, 404);

      const { error: updateErr } = await supabase
        .from('bookings')
        .update({
          status: 'approved',
          room_id: roomId || null,
          second_room_id: secondRoomId || null,
        })
        .eq('id', bookingId);

      if (updateErr) throw updateErr;

      // Fetch room names
      let roomName: string | undefined;
      let secondRoomName: string | undefined;
      if (roomId) {
        const { data: r } = await supabase.from('rooms').select('name').eq('id', roomId).single();
        roomName = r?.name;
      }
      if (secondRoomId) {
        const { data: r } = await supabase.from('rooms').select('name').eq('id', secondRoomId).single();
        secondRoomName = r?.name;
      }

      await sendBookingApproved({
        id: booking.id,
        requesterName: booking.requester_name,
        requesterEmail: booking.requester_email,
        eventDate: booking.event_date,
        startTime: booking.start_time,
        durationMinutes: booking.duration_minutes,
        participantCount: booking.participant_count,
        roomName,
        secondRoomName,
        cancellationCode: booking.cancellation_code,
        isSpecial: booking.type === 'special',
        adminEmail,
        fromEmail,
        appUrl,
      });

      return json({ success: true });
    }

    // ── Reject booking ──────────────────────────────────────────
    if (action === 'reject') {
      const { bookingId, adminNotes } = body;

      const { data: booking, error: fetchErr } = await supabase
        .from('bookings')
        .select()
        .eq('id', bookingId)
        .single();

      if (fetchErr || !booking) return json({ error: 'שריון לא נמצא' }, 404);

      const { error: updateErr } = await supabase
        .from('bookings')
        .update({ status: 'rejected', admin_notes: adminNotes || null })
        .eq('id', bookingId);

      if (updateErr) throw updateErr;

      await sendBookingRejected({
        id: booking.id,
        requesterName: booking.requester_name,
        requesterEmail: booking.requester_email,
        eventDate: booking.event_date,
        startTime: booking.start_time,
        durationMinutes: booking.duration_minutes,
        participantCount: booking.participant_count,
        cancellationCode: booking.cancellation_code,
        reason: adminNotes,
        adminEmail,
        fromEmail,
        appUrl,
      });

      return json({ success: true });
    }

    // ── Admin cancel booking ────────────────────────────────────
    if (action === 'cancel') {
      const { bookingId, adminNotes } = body;

      const { data: booking, error: fetchErr } = await supabase
        .from('bookings')
        .select(`*, room:room_id(name), second_room:second_room_id(name)`)
        .eq('id', bookingId)
        .single();

      if (fetchErr || !booking) return json({ error: 'שריון לא נמצא' }, 404);

      const { error: updateErr } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', admin_notes: adminNotes || null })
        .eq('id', bookingId);

      if (updateErr) throw updateErr;

      const info = {
        id: booking.id,
        requesterName: booking.requester_name,
        requesterEmail: booking.requester_email,
        eventDate: booking.event_date,
        startTime: booking.start_time,
        durationMinutes: booking.duration_minutes,
        participantCount: booking.participant_count,
        roomName: booking.room?.name,
        secondRoomName: booking.second_room?.name,
        cancellationCode: booking.cancellation_code,
        isSpecial: booking.type === 'special',
        adminNotes: adminNotes || undefined,
        adminEmail,
        fromEmail,
        appUrl,
      };

      await Promise.all([
        sendCancellationConfirmed(info),
        sendCancellationAdmin(info),
      ]);

      return json({ success: true });
    }

    // ── Approve reschedule change ───────────────────────────────
    if (action === 'approve_change') {
      const { changeId } = body;

      const { data: change, error: fetchErr } = await supabase
        .from('booking_changes')
        .select(`*, booking:booking_id(*)`)
        .eq('id', changeId)
        .single();

      if (fetchErr || !change) return json({ error: 'בקשת שינוי לא נמצאה' }, 404);

      const booking = change.booking;

      // Update change status
      await supabase.from('booking_changes').update({ status: 'approved' }).eq('id', changeId);

      // Update original booking with new date/time
      await supabase.from('bookings').update({
        event_date: change.requested_date,
        start_time: change.requested_start_time,
        duration_minutes: change.requested_duration_minutes,
      }).eq('id', booking.id);

      // Fetch room name
      let roomName: string | undefined;
      if (booking.room_id) {
        const { data: r } = await supabase.from('rooms').select('name').eq('id', booking.room_id).single();
        roomName = r?.name;
      }

      await sendRescheduleApproved({
        bookingId: booking.id,
        requesterName: booking.requester_name,
        requesterEmail: booking.requester_email,
        originalDate: booking.event_date,
        originalTime: booking.start_time,
        originalDuration: booking.duration_minutes,
        requestedDate: change.requested_date,
        requestedTime: change.requested_start_time,
        requestedDuration: change.requested_duration_minutes,
        roomName,
        cancellationCode: booking.cancellation_code,
        adminEmail,
        fromEmail,
        appUrl,
      });

      return json({ success: true });
    }

    // ── Reject reschedule change ────────────────────────────────
    if (action === 'reject_change') {
      const { changeId, adminNotes } = body;

      const { data: change, error: fetchErr } = await supabase
        .from('booking_changes')
        .select(`*, booking:booking_id(*)`)
        .eq('id', changeId)
        .single();

      if (fetchErr || !change) return json({ error: 'בקשת שינוי לא נמצאה' }, 404);

      await supabase.from('booking_changes')
        .update({ status: 'rejected', admin_notes: adminNotes || null })
        .eq('id', changeId);

      const booking = change.booking;

      await sendRescheduleRejected({
        bookingId: booking.id,
        requesterName: booking.requester_name,
        requesterEmail: booking.requester_email,
        originalDate: booking.event_date,
        originalTime: booking.start_time,
        originalDuration: booking.duration_minutes,
        requestedDate: change.requested_date,
        requestedTime: change.requested_start_time,
        requestedDuration: change.requested_duration_minutes,
        cancellationCode: booking.cancellation_code,
        adminNotes,
        adminEmail,
        fromEmail,
        appUrl,
      });

      return json({ success: true });
    }

    // ── Room CRUD ───────────────────────────────────────────────
    if (action === 'create_room') {
      const { name, capacity, description } = body;
      const { data, error } = await supabase.from('rooms').insert({ name, capacity, description }).select().single();
      if (error) throw error;
      return json({ success: true, room: data });
    }

    if (action === 'update_room') {
      const { roomId, name, capacity, description, isActive } = body;
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (capacity !== undefined) updates.capacity = capacity;
      if (description !== undefined) updates.description = description;
      if (isActive !== undefined) updates.is_active = isActive;
      const { error } = await supabase.from('rooms').update(updates).eq('id', roomId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === 'add_block') {
      const { roomId, from, to, reason } = body;
      const { data: room } = await supabase.from('rooms').select('blocked_dates').eq('id', roomId).single();
      const blocked = [...(room?.blocked_dates || []), { from, to, reason: reason || '' }];
      await supabase.from('rooms').update({ blocked_dates: blocked }).eq('id', roomId);
      return json({ success: true });
    }

    if (action === 'remove_block') {
      const { roomId, index } = body;
      const { data: room } = await supabase.from('rooms').select('blocked_dates').eq('id', roomId).single();
      const blocked = [...(room?.blocked_dates || [])];
      blocked.splice(index, 1);
      await supabase.from('rooms').update({ blocked_dates: blocked }).eq('id', roomId);
      return json({ success: true });
    }

    return json({ error: 'פעולה לא מוכרת' }, 400);

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'שגיאה פנימית בשרת' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
