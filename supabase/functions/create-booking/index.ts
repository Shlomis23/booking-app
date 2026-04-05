import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  sendBookingReceived,
  sendNewBookingAdmin,
} from '../_shared/email.ts';

function isOrganizationalEmail(_email: string): boolean {
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      requesterName, requesterEmail, eventDate, startTime,
      durationMinutes, participantCount, meetingPurpose, notes, isSpecial,
    } = body;

    // Validate required fields
    if (!requesterName || !requesterEmail || !eventDate || !startTime || !durationMinutes || !participantCount || !meetingPurpose) {
      return new Response(JSON.stringify({ error: 'שדות חובה חסרים' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isOrganizationalEmail(requesterEmail)) {
      return new Response(JSON.stringify({ error: 'יש להשתמש באימייל ארגוני' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Generate a 6-digit numeric code
    const cancellationCode = String(Math.floor(100000 + Math.random() * 900000));

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        type: isSpecial ? 'special' : 'regular',
        status: 'pending',
        requester_name: requesterName,
        requester_email: requesterEmail,
        event_date: eventDate,
        start_time: startTime,
        duration_minutes: durationMinutes,
        participant_count: participantCount,
        meeting_purpose: meetingPurpose,
        notes: notes || null,
        cancellation_code: cancellationCode,
      })
      .select()
      .single();

    if (error) throw error;

    const appUrl = Deno.env.get('APP_URL') || 'https://localhost:5173';
    const adminEmail = Deno.env.get('ADMIN_EMAIL')!;
    const fromEmail = Deno.env.get('ADMIN_FROM_EMAIL')!;

    const info = {
      id: booking.id,
      requesterName: booking.requester_name,
      requesterEmail: booking.requester_email,
      eventDate: booking.event_date,
      startTime: booking.start_time,
      durationMinutes: booking.duration_minutes,
      participantCount: booking.participant_count,
      meetingPurpose: booking.meeting_purpose,
      notes: booking.notes,
      cancellationCode: booking.cancellation_code,
      isSpecial: booking.type === 'special',
      adminEmail,
      fromEmail,
      appUrl,
    };

    await Promise.all([
      sendBookingReceived(info),
      sendNewBookingAdmin(info),
    ]);

    return new Response(JSON.stringify({ success: true, bookingId: booking.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'שגיאה פנימית בשרת' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
