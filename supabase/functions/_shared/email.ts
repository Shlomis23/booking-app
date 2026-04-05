// Shared email utilities for all edge functions

const BREVO_API = 'https://api.brevo.com/v3/smtp/email';

interface EmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const res = await fetch(BREVO_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': Deno.env.get('BREVO_API_KEY') ?? '',
    },
    body: JSON.stringify({
      sender: { name: 'מערכת שריון חדרים', email: payload.from },
      to: payload.to.map(email => ({ email })),
      subject: payload.subject,
      htmlContent: payload.html,
    }),
  });
  return res.ok;
}

// ── Template helpers ─────────────────────────────────────────

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;color:#1a1a1a;direction:rtl}
  .wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
  .header{background:#1d4ed8;padding:24px 32px;color:#fff}
  .header h1{font-size:20px;font-weight:700}
  .header p{font-size:13px;opacity:.8;margin-top:4px}
  .body{padding:32px}
  h2{font-size:17px;font-weight:600;margin-bottom:16px;color:#1e40af}
  .info-table{width:100%;border-collapse:collapse;margin-bottom:20px}
  .info-table td{padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;vertical-align:top}
  .info-table td:first-child{font-weight:600;white-space:nowrap;color:#374151;width:40%}
  .badge{display:inline-block;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600}
  .badge-pending{background:#fef9c3;color:#854d0e}
  .badge-approved{background:#dcfce7;color:#166534}
  .badge-rejected{background:#fee2e2;color:#991b1b}
  .badge-cancelled{background:#f3f4f6;color:#374151}
  .badge-special{background:#ede9fe;color:#5b21b6}
  .btn{display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;margin-top:16px}
  .footer{background:#f9fafb;padding:16px 32px;font-size:12px;color:#9ca3af;text-align:center}
  .divider{border:none;border-top:1px solid #e5e7eb;margin:20px 0}
  .note-box{background:#fef3c7;border-right:4px solid #f59e0b;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>מערכת שריון חדרים</h1>
    <p>ניהול חדרי הדרכה</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">מערכת שריון חדרים — הודעה אוטומטית, אין להשיב על מייל זה</div>
</div>
</body>
</html>`;
}

function infoRow(label: string, value: string): string {
  return `<tr><td>${label}</td><td>${value}</td></tr>`;
}

// ── Email type interfaces ─────────────────────────────────────

export interface BookingInfo {
  id: string;
  requesterName: string;
  requesterEmail: string;
  eventDate: string;
  startTime: string;
  durationMinutes: number;
  participantCount: number;
  meetingPurpose?: string;
  notes?: string;
  roomName?: string;
  secondRoomName?: string;
  cancellationCode: string;
  isSpecial?: boolean;
  adminNotes?: string;
  adminEmail: string;
  fromEmail: string;
  appUrl: string;
}

export interface ChangeInfo {
  bookingId: string;
  requesterName: string;
  requesterEmail: string;
  originalDate: string;
  originalTime: string;
  originalDuration: number;
  requestedDate: string;
  requestedTime: string;
  requestedDuration: number;
  roomName?: string;
  cancellationCode: string;
  adminNotes?: string;
  adminEmail: string;
  fromEmail: string;
  appUrl: string;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jerusalem' });
}

function formatDuration(m: number): string {
  if (m < 60) return `${m} דקות`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h} שעות ו-${min} דקות` : `${h} שעות`;
}

// ── 1. Booking received (to requester) ───────────────────────
export async function sendBookingReceived(info: BookingInfo): Promise<void> {
  const html = baseTemplate(`
    <h2>בקשת השריון שלך התקבלה</h2>
    <p style="margin-bottom:16px">שלום ${info.requesterName},<br>
    קיבלנו את בקשת השריון שלך. הבקשה ממתינה לאישור הרכז.</p>
    <table class="info-table">
      ${infoRow('תאריך', formatDate(info.eventDate))}
      ${infoRow('שעת התחלה', info.startTime.slice(0,5))}
      ${infoRow('משך', formatDuration(info.durationMinutes))}
      ${infoRow('מספר משתתפים', String(info.participantCount))}
      ${info.meetingPurpose ? infoRow('מטרת הפגישה', info.meetingPurpose) : ''}
      ${info.isSpecial ? infoRow('סוג בקשה', '<span class="badge badge-special">בקשה מיוחדת — שני חדרים</span>') : ''}
      ${infoRow('סטטוס', '<span class="badge badge-pending">ממתין לאישור</span>')}
      ${info.notes ? infoRow('הערות', info.notes) : ''}
    </table>
    <hr class="divider">
    <p style="font-size:14px;margin-bottom:8px">לניהול השריון שלך (ביטול / שינוי מועד) היכנס לאתר והזן את מספר ההזמנה:</p>
    <div style="background:#f0f4ff;border:2px dashed #1d4ed8;border-radius:8px;padding:20px;text-align:center;margin:12px 0">
      <p style="font-size:12px;color:#6b7280;margin-bottom:6px">מספר הזמנה</p>
      <p style="font-size:36px;font-weight:700;color:#1d4ed8;letter-spacing:6px;font-family:monospace">${info.cancellationCode}</p>
    </div>
    <div class="note-box" style="margin-top:20px">שמור על מספר ההזמנה — הוא ייחודי עבורך ומאפשר לנהל את השריון דרך האתר.</div>
  `);
  await sendEmail({ from: info.fromEmail, to: [info.requesterEmail], subject: 'בקשת השריון שלך התקבלה', html });
}

// ── 2. New booking alert (to admin) ──────────────────────────
export async function sendNewBookingAdmin(info: BookingInfo): Promise<void> {
  const adminUrl = `${info.appUrl}/admin/dashboard`;
  const html = baseTemplate(`
    <h2>בקשת שריון חדשה ממתינה לאישורך</h2>
    ${info.isSpecial ? '<p style="margin-bottom:16px"><strong class="badge badge-special" style="font-size:14px">⚠️ בקשה מיוחדת — נדרשים שני חדרים</strong></p>' : ''}
    <p style="margin-bottom:16px">התקבלה בקשת שריון חדשה:</p>
    <table class="info-table">
      ${infoRow('שם המגיש', info.requesterName)}
      ${infoRow('אימייל', info.requesterEmail)}
      ${infoRow('תאריך', formatDate(info.eventDate))}
      ${infoRow('שעת התחלה', info.startTime.slice(0,5))}
      ${infoRow('משך', formatDuration(info.durationMinutes))}
      ${infoRow('מספר משתתפים', String(info.participantCount))}
      ${info.meetingPurpose ? infoRow('מטרת הפגישה', info.meetingPurpose) : ''}
      ${info.notes ? infoRow('הערות', info.notes) : ''}
    </table>
    <a class="btn" href="${adminUrl}">למעבר ללוח הבקרה</a>
  `);
  await sendEmail({ from: info.fromEmail, to: [info.adminEmail], subject: 'בקשת שריון חדשה ממתינה לאישורך', html });
}

// ── 3. Booking approved (to requester) ───────────────────────
export async function sendBookingApproved(info: BookingInfo): Promise<void> {
  const rooms = [info.roomName, info.secondRoomName].filter(Boolean).join(' + ');
  const html = baseTemplate(`
    <h2>השריון שלך אושר ✓</h2>
    <p style="margin-bottom:16px">שלום ${info.requesterName},<br>
    אנו שמחים לאשר שבקשת השריון שלך אושרה!</p>
    <table class="info-table">
      ${infoRow('חדר/ים', `<strong>${rooms}</strong>`)}
      ${infoRow('תאריך', formatDate(info.eventDate))}
      ${infoRow('שעת התחלה', info.startTime.slice(0,5))}
      ${infoRow('משך', formatDuration(info.durationMinutes))}
      ${infoRow('מספר משתתפים', String(info.participantCount))}
      ${infoRow('סטטוס', '<span class="badge badge-approved">מאושר</span>')}
    </table>
    <hr class="divider">
    <p style="font-size:14px;margin-bottom:8px">מספר ההזמנה שלך לניהול השריון:</p>
    <div style="background:#f0f4ff;border:2px dashed #1d4ed8;border-radius:8px;padding:20px;text-align:center;margin:12px 0">
      <p style="font-size:12px;color:#6b7280;margin-bottom:6px">מספר הזמנה</p>
      <p style="font-size:36px;font-weight:700;color:#1d4ed8;letter-spacing:6px;font-family:monospace">${info.cancellationCode}</p>
    </div>
  `);
  await sendEmail({ from: info.fromEmail, to: [info.requesterEmail], subject: 'השריון שלך אושר ✓', html });
}

// ── 4. Booking rejected (to requester) ───────────────────────
export async function sendBookingRejected(info: BookingInfo & { reason?: string }): Promise<void> {
  const html = baseTemplate(`
    <h2>בקשת השריון נדחתה</h2>
    <p style="margin-bottom:16px">שלום ${info.requesterName},<br>
    לצערנו, בקשת השריון שלך נדחתה.</p>
    <table class="info-table">
      ${infoRow('תאריך', formatDate(info.eventDate))}
      ${infoRow('שעת התחלה', info.startTime.slice(0,5))}
      ${infoRow('משך', formatDuration(info.durationMinutes))}
      ${infoRow('סטטוס', '<span class="badge badge-rejected">נדחתה</span>')}
      ${info.reason ? infoRow('סיבת הדחייה', info.reason) : ''}
    </table>
    <p style="margin-top:16px;font-size:14px">ניתן להגיש בקשה חדשה למועד אחר דרך מערכת השריון.</p>
  `);
  await sendEmail({ from: info.fromEmail, to: [info.requesterEmail], subject: 'בקשת השריון נדחתה', html });
}

// ── 5. Cancellation confirmed (to requester) ─────────────────
export async function sendCancellationConfirmed(info: BookingInfo): Promise<void> {
  const rooms = [info.roomName, info.secondRoomName].filter(Boolean).join(' + ');
  const html = baseTemplate(`
    <h2>השריון בוטל בהצלחה</h2>
    <p style="margin-bottom:16px">שלום ${info.requesterName},<br>
    אישור ביטול — השריון הבא בוטל בהצלחה:</p>
    <table class="info-table">
      ${rooms ? infoRow('חדר/ים', rooms) : ''}
      ${infoRow('תאריך', formatDate(info.eventDate))}
      ${infoRow('שעת התחלה', info.startTime.slice(0,5))}
      ${infoRow('משך', formatDuration(info.durationMinutes))}
      ${infoRow('סטטוס', '<span class="badge badge-cancelled">בוטל</span>')}
      ${info.adminNotes ? infoRow('סיבת הביטול', info.adminNotes) : ''}
    </table>
    <p style="margin-top:16px;font-size:14px">ניתן להגיש בקשת שריון חדשה בכל עת.</p>
  `);
  await sendEmail({ from: info.fromEmail, to: [info.requesterEmail], subject: 'השריון בוטל בהצלחה', html });
}

// ── 6. Cancellation alert (to admin) ─────────────────────────
export async function sendCancellationAdmin(info: BookingInfo): Promise<void> {
  const rooms = [info.roomName, info.secondRoomName].filter(Boolean).join(' + ');
  const html = baseTemplate(`
    <h2>שריון בוטל על ידי המגיש</h2>
    <p style="margin-bottom:16px">המגיש ביטל את השריון הבא:</p>
    <table class="info-table">
      ${infoRow('שם המגיש', info.requesterName)}
      ${infoRow('אימייל', info.requesterEmail)}
      ${rooms ? infoRow('חדר/ים שפונה', rooms) : ''}
      ${infoRow('תאריך', formatDate(info.eventDate))}
      ${infoRow('שעת התחלה', info.startTime.slice(0,5))}
      ${infoRow('משך', formatDuration(info.durationMinutes))}
    </table>
    <p style="margin-top:16px;font-size:14px">החדר/ים פנויים כעת לשריון חדש.</p>
  `);
  await sendEmail({ from: info.fromEmail, to: [info.adminEmail], subject: 'שריון בוטל על ידי המגיש', html });
}

// ── 7. Reschedule request received (to requester) ────────────
export async function sendRescheduleReceived(info: ChangeInfo): Promise<void> {
  const html = baseTemplate(`
    <h2>בקשת שינוי מועד התקבלה</h2>
    <p style="margin-bottom:16px">שלום ${info.requesterName},<br>
    קיבלנו את בקשתך לשינוי מועד השריון. הבקשה ממתינה לאישור הרכז.</p>
    <table class="info-table">
      ${infoRow('מועד מקורי', `${formatDate(info.originalDate)} בשעה ${info.originalTime.slice(0,5)}`)}
      ${infoRow('משך מקורי', formatDuration(info.originalDuration))}
      ${infoRow('מועד מבוקש', `${formatDate(info.requestedDate)} בשעה ${info.requestedTime.slice(0,5)}`)}
      ${infoRow('משך מבוקש', formatDuration(info.requestedDuration))}
      ${infoRow('סטטוס', '<span class="badge badge-pending">ממתין לאישור</span>')}
    </table>
  `);
  await sendEmail({ from: info.fromEmail, to: [info.requesterEmail], subject: 'בקשת שינוי מועד התקבלה', html });
}

// ── 8. Reschedule alert (to admin) ───────────────────────────
export async function sendRescheduleAdmin(info: ChangeInfo): Promise<void> {
  const changesUrl = `${info.appUrl}/admin/changes`;
  const html = baseTemplate(`
    <h2>בקשת שינוי מועד ממתינה לאישורך</h2>
    <p style="margin-bottom:16px">התקבלה בקשת שינוי מועד:</p>
    <table class="info-table">
      ${infoRow('שם המגיש', info.requesterName)}
      ${infoRow('אימייל', info.requesterEmail)}
      ${info.roomName ? infoRow('חדר', info.roomName) : ''}
      ${infoRow('מועד מקורי', `${formatDate(info.originalDate)} בשעה ${info.originalTime.slice(0,5)}`)}
      ${infoRow('מועד מבוקש', `${formatDate(info.requestedDate)} בשעה ${info.requestedTime.slice(0,5)}`)}
      ${infoRow('משך מבוקש', formatDuration(info.requestedDuration))}
    </table>
    <a class="btn" href="${changesUrl}">לטיפול בבקשה</a>
  `);
  await sendEmail({ from: info.fromEmail, to: [info.adminEmail], subject: 'בקשת שינוי מועד ממתינה לאישורך', html });
}

// ── 9. Reschedule approved (to requester) ────────────────────
export async function sendRescheduleApproved(info: ChangeInfo): Promise<void> {
  const rooms = info.roomName || '';
  const html = baseTemplate(`
    <h2>שינוי המועד אושר ✓</h2>
    <p style="margin-bottom:16px">שלום ${info.requesterName},<br>
    בקשת שינוי המועד שלך אושרה!</p>
    <table class="info-table">
      ${rooms ? infoRow('חדר', `<strong>${rooms}</strong>`) : ''}
      ${infoRow('תאריך חדש', formatDate(info.requestedDate))}
      ${infoRow('שעת התחלה', info.requestedTime.slice(0,5))}
      ${infoRow('משך', formatDuration(info.requestedDuration))}
      ${infoRow('סטטוס', '<span class="badge badge-approved">מאושר</span>')}
    </table>
  `);
  await sendEmail({ from: info.fromEmail, to: [info.requesterEmail], subject: 'שינוי המועד אושר ✓', html });
}

// ── 10. Reschedule rejected (to requester) ───────────────────
export async function sendRescheduleRejected(info: ChangeInfo): Promise<void> {
  const html = baseTemplate(`
    <h2>בקשת שינוי המועד נדחתה</h2>
    <p style="margin-bottom:16px">שלום ${info.requesterName},<br>
    לצערנו, בקשת שינוי המועד שלך נדחתה.</p>
    <table class="info-table">
      ${infoRow('מועד מקורי', `${formatDate(info.originalDate)} בשעה ${info.originalTime.slice(0,5)}`)}
      ${infoRow('מועד שנדחה', `${formatDate(info.requestedDate)} בשעה ${info.requestedTime.slice(0,5)}`)}
      ${info.adminNotes ? infoRow('סיבה', info.adminNotes) : ''}
    </table>
    <p style="margin-top:16px;font-size:14px">השריון המקורי שלך עדיין פעיל.</p>
  `);
  await sendEmail({ from: info.fromEmail, to: [info.requesterEmail], subject: 'בקשת שינוי המועד נדחתה', html });
}
