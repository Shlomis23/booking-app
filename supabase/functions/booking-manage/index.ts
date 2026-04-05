import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  sendCancellationConfirmed,
  sendCancellationAdmin,
  sendRescheduleReceived,
  sendRescheduleAdmin,
} from '../_shared/email.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, cancellationCode } = body;

    if (!action || !cancellationCode) {
      return new Response(JSON.stringify({ error: 'פרמטרים חסרים' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Load the booking by cancellation code
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select(`*, room:room_id(name), second_room:second_room_id(name)`)
      .eq('cancellation_code', cancellationCode)
      .single();

    if (fetchError || !booking) {
      return new Response(JSON.stringify({ error: 'שריון לא נמצא' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const appUrl = Deno.env.get('APP_URL') || 'https://localhost:5173';
    const adminEmail = Deno.env.get('ADMIN_EMAIL')!;
    const fromEmail = Deno.env.get('ADMIN_FROM_EMAIL')!;

    // ── Cancel ─────────────────────────────────────────────────
    if (action === 'cancel') {
      if (!['pending', 'approved'].includes(booking.status)) {
        return new Response(JSON.stringify({ error: 'לא ניתן לבטל שריון זה' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id);

      if (updateError) throw updateError;

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
        adminEmail,
        fromEmail,
        appUrl,
      };

      await Promise.all([
        sendCancellationConfirmed(info),
        sendCancellationAdmin(info),
      ]);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Reschedule request ─────────────────────────────────────
    if (action === 'reschedule') {
      const { requestedDate, requestedStartTime, requestedDurationMinutes, requesterNotes } = body;

      if (!requestedDate || !requestedStartTime || !requestedDurationMinutes) {
        return new Response(JSON.stringify({ error: 'פרטי המועד החדש חסרים' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!['pending', 'approved'].includes(booking.status)) {
        return new Response(JSON.stringify({ error: 'לא ניתן לבקש שינוי מועד לשריון זה' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: change, error: changeError } = await supabase
        .from('booking_changes')
        .insert({
          booking_id: booking.id,
          type: 'reschedule',
          status: 'pending',
          requested_date: requestedDate,
          requested_start_time: requestedStartTime,
          requested_duration_minutes: requestedDurationMinutes,
          requester_notes: requesterNotes || null,
        })
        .select()
        .single();

      if (changeError) throw changeError;

      const changeInfo = {
        bookingId: booking.id,
        requesterName: booking.requester_name,
        requesterEmail: booking.requester_email,
        originalDate: booking.event_date,
        originalTime: booking.start_time,
        originalDuration: booking.duration_minutes,
        requestedDate,
        requestedTime: requestedStartTime,
        requestedDuration: requestedDurationMinutes,
        roomName: booking.room?.name,
        cancellationCode: booking.cancellation_code,
        adminEmail,
        fromEmail,
        appUrl,
      };

      await Promise.all([
        sendRescheduleReceived(changeInfo),
        sendRescheduleAdmin(changeInfo),
      ]);

      return new Response(JSON.stringify({ success: true, changeId: change.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'פעולה לא מוכרת' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'שגיאה פנימית בשרת' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
