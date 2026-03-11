import { useState, useEffect } from "react";

// ============================================================
// SUPABASE CONFIG — החלף בפרטים שלך מ-Supabase dashboard
// ============================================================
const SUPABASE_URL = "https://bxyyggjqqicpsmhsguuq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4eXlnZ2pxcWljcHNtaHNndXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDcwODgsImV4cCI6MjA4ODcyMzA4OH0.e1aZDIOxuffNTKUhHteBhSFdIp0UfZNFZNm1jT4XvoY";

// BREVO CONFIG — לשליחת מיילים
const BREVO_API_KEY = "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"; // החלף במפתח שלך
const ADMIN_EMAIL = "Shlomi.sela@yashir.co.il"; // המיל שלך

// ADMIN PASSWORD — שנה לסיסמה שלך
const ADMIN_PASSWORD = "admin123";

// ============================================================
// SUPABASE SQL — הרץ את זה ב-Supabase SQL Editor:
// ============================================================
/*
create table bookings (
  id uuid default gen_random_uuid() primary key,
  room_id integer not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  requester_name text not null,
  topic text not null,
  participants integer not null,
  requester_email text not null,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now()
);

create table blockings (
  id uuid default gen_random_uuid() primary key,
  room_id integer not null,
  date_from date not null,
  date_to date not null,
  start_time time not null,
  end_time time not null,
  reason text,
  created_at timestamptz default now()
);
*/

// ============================================================
// DATA & CONSTANTS
// ============================================================
const ROOMS = [
  { id: 1, name: "חדר ימני ליד מכירות", color: "#4f8ef7" },
  { id: 2, name: "חדר אמצעי", color: "#f7774f" },
  { id: 3, name: "חדר שמאלי ליד המטבחון", color: "#4fc98e" },
];

const HOURS = Array.from({ length: 21 }, (_, i) => {
  const h = 8 + Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
}).filter((h) => h <= "18:00");

const DURATION_OPTIONS = [
  { label: "30 דקות", value: 0.5 },
  { label: "שעה", value: 1 },
  { label: "שעה וחצי", value: 1.5 },
  { label: "שעתיים", value: 2 },
  { label: "שלוש שעות", value: 3 },
];

function getWeekDays(baseDate) {
  const date = new Date(baseDate);
  const day = date.getDay();
  // Find Sunday (start of week)
  const diff = day === 0 ? 0 : -day;
  const sunday = new Date(date);
  sunday.setDate(date.getDate() + diff);

  return [0, 1, 2, 3, 4].map((i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function addHours(timeStr, hours) {
  const [h, m] = timeStr.split(":").map(Number);
  const totalMins = h * 60 + m + hours * 60;
  const nh = Math.floor(totalMins / 60);
  const nm = totalMins % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function hebrewDay(date) {
  const days = ["ראשון", "שני", "שלישי", "רביעי", "חמישי"];
  return days[date.getDay()];
}

// ============================================================
// SUPABASE HELPERS
// ============================================================
async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function getBookings(dateFrom, dateTo) {
  return sbFetch(
    `bookings?date=gte.${dateFrom}&date=lte.${dateTo}&order=date,start_time`
  );
}

async function createBooking(data) {
  return sbFetch("bookings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updateBookingStatus(id, status) {
  return sbFetch(`bookings?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

async function getBlockings(dateFrom, dateTo) {
  return sbFetch(`blockings?date_from=lte.${dateTo}&date_to=gte.${dateFrom}&order=date_from`);
}

async function createBlocking(data) {
  return sbFetch("blockings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function deleteBlocking(id) {
  return sbFetch(`blockings?id=eq.${id}`, { method: "DELETE" });
}

// ============================================================
// BREVO EMAIL HELPERS
// ============================================================
async function sendEmailToAdmin({ requester_name, topic, participants, room_name, date, start_time, end_time, requester_email }) {
  try {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "שריון חדרי הדרכה", email: ADMIN_EMAIL },
        to: [{ email: ADMIN_EMAIL }],
        subject: `בקשת שריון חדשה — ${room_name} | ${date}`,
        htmlContent: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e3a5f;">בקשת שריון חדשה התקבלה</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>חדר:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${room_name}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>תאריך:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${date}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>שעות:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${start_time} – ${end_time}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>נושא:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${topic}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>מבקש:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${requester_name}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>משתתפים:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${participants}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>אימייל מבקש:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${requester_email}</td></tr>
            </table>
            <p style="color: #64748b; margin-top: 20px;">כנס למערכת כדי לאשר או לדחות את הבקשה.</p>
            <p style="color: #94a3b8; font-size: 12px;">מערכת שריון חדרי הדרכה — ביטוח ישיר יקנעם</p>
          </div>
        `,
      }),
    });
  } catch (e) {
    console.warn("Email to admin failed:", e);
  }
}

async function sendEmailToUser({ to_email, requester_name, status, room_name, date, start_time, end_time, topic }) {
  const isApproved = status.includes("אושר");
  try {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "שריון חדרי הדרכה", email: ADMIN_EMAIL },
        to: [{ email: to_email }],
        subject: `עדכון בקשת שריון — ${isApproved ? "אושרה ✅" : "נדחתה ❌"}`,
        htmlContent: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: ${isApproved ? "#16a34a" : "#dc2626"};">
              בקשת השריון שלך ${isApproved ? "אושרה ✅" : "נדחתה ❌"}
            </h2>
            <p>שלום ${requester_name},</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>חדר:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${room_name}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>תאריך:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${date}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>שעות:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${start_time} – ${end_time}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>נושא:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${topic}</td></tr>
            </table>
            <p style="color: #64748b; margin-top: 20px;">לשאלות ניתן לפנות למנהל ישירות.</p>
            <p style="color: #94a3b8; font-size: 12px;">מערכת שריון חדרי הדרכה — ביטוח ישיר יקנעם</p>
          </div>
        `,
      }),
    });
  } catch (e) {
    console.warn("Email to user failed:", e);
  }
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [view, setView] = useState("user"); // 'user' | 'admin'
  const [isAdmin, setIsAdmin] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [blockings, setBlockings] = useState([]);
  const [showBlockingForm, setShowBlockingForm] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(1);
  const [weekBase, setWeekBase] = useState(new Date());
  const [bookingForm, setBookingForm] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const weekDays = getWeekDays(weekBase);
  const dateFrom = formatDate(weekDays[0]);
  const dateTo = formatDate(weekDays[4]);

  useEffect(() => {
    loadBookings();
  }, [weekBase]);

  async function loadBookings() {
    setLoading(true);
    try {
      const [data, blk] = await Promise.all([
        getBookings(dateFrom, dateTo),
        getBlockings(dateFrom, dateTo),
      ]);
      setBookings(data);
      setBlockings(blk);
    } catch (e) {
      showToast("שגיאה בטעינת נתונים", "error");
    }
    setLoading(false);
  }

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function isSlotBlocked(roomId, date, startTime) {
    const dateStr = formatDate(date);
    const bookedBlocked = bookings.some((b) => {
      if (b.room_id !== roomId || b.date !== dateStr) return false;
      if (b.status === "rejected") return false;
      return startTime >= b.start_time && startTime < b.end_time;
    });
    if (bookedBlocked) return true;
    const adminBlocked = blockings.some((bl) => {
      if (bl.room_id !== roomId) return false;
      if (dateStr < bl.date_from || dateStr > bl.date_to) return false;
      return startTime >= bl.start_time && startTime < bl.end_time;
    });
    return adminBlocked;
  }

  function handleSlotClick(roomId, date, startTime) {
    if (isSlotBlocked(roomId, date, startTime)) return;
    setBookingForm({
      room_id: roomId,
      date: formatDate(date),
      start_time: startTime,
      duration: 1,
      requester_name: "",
      topic: "",
      participants: "",
      requester_email: "",
      notes: "",
    });
  }

  async function submitBooking() {
    const { room_id, date, start_time, duration, requester_name, topic, participants, requester_email, notes } = bookingForm;
    if (!requester_name || !topic || !participants || !requester_email) {
      showToast("נא למלא את כל השדות", "error");
      return;
    }
    const end_time = addHours(start_time, duration);
    if (end_time > "18:00") {
      showToast("הזמן המבוקש חורג משעות הפעילות", "error");
      return;
    }

    setLoading(true);
    try {
      await createBooking({ room_id, date, start_time, end_time, requester_name, topic, participants: Number(participants), requester_email, notes, status: "pending" });
      const room = ROOMS.find((r) => r.id === room_id);
      await sendEmailToAdmin({
        requester_name, topic, participants,
        room_name: room.name,
        date, start_time, end_time,
        requester_email,
      });
      showToast("בקשת השריון נשלחה! ממתין לאישור מנהל");
      setBookingForm(null);
      loadBookings();
    } catch (e) {
      showToast("שגיאה בשמירת הבקשה", "error");
    }
    setLoading(false);
  }

  async function handleApprove(booking) {
    await updateBookingStatus(booking.id, "approved");
    await sendEmailToUser({
      to_email: booking.requester_email,
      requester_name: booking.requester_name,
      status: "אושר ✅",
      room_name: ROOMS.find((r) => r.id === booking.room_id)?.name,
      date: booking.date,
      start_time: booking.start_time,
      end_time: booking.end_time,
      topic: booking.topic,
    });
    showToast("השריון אושר");
    loadBookings();
  }

  async function handleReject(booking) {
    await updateBookingStatus(booking.id, "rejected");
    await sendEmailToUser({
      to_email: booking.requester_email,
      requester_name: booking.requester_name,
      status: "נדחה ❌",
      room_name: ROOMS.find((r) => r.id === booking.room_id)?.name,
      date: booking.date,
      start_time: booking.start_time,
      end_time: booking.end_time,
      topic: booking.topic,
    });
    showToast("הבקשה נדחתה");
    loadBookings();
  }

  function loginAdmin() {
    if (adminEmail === ADMIN_EMAIL && adminPass === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setView("admin");
      setShowAdminLogin(false);
      setAdminPass("");
      setAdminEmail("");
    } else {
      showToast("אימייל או סיסמה שגויים", "error");
    }
  }

  async function handleCreateBlocking(data) {
    setLoading(true);
    try {
      await createBlocking(data);
      showToast("החדר נחסם בהצלחה");
      setShowBlockingForm(false);
      loadBookings();
    } catch (e) {
      showToast("שגיאה בסגירת החדר", "error");
    }
    setLoading(false);
  }

  async function handleDeleteBlocking(id) {
    setLoading(true);
    try {
      await deleteBlocking(id);
      showToast("החסימה הוסרה");
      loadBookings();
    } catch (e) {
      showToast("שגיאה בהסרת החסימה", "error");
    }
    setLoading(false);
  }

  const pendingBookings = bookings.filter((b) => b.status === "pending");

  return (
    <div style={styles.root}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div>
            <div style={styles.logo}>🏛️ שריון חדרי הדרכה - ביטוח ישיר יקנעם</div>
          </div>
          <div style={styles.headerActions}>
            {isAdmin ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button style={view === "user" ? styles.tabActive : styles.tab} onClick={() => setView("user")}>תצוגת משתמש</button>
                <button style={view === "admin" ? styles.tabActive : styles.tab} onClick={() => setView("admin")}>
                  פאנל מנהל {pendingBookings.length > 0 && <span style={styles.badge}>{pendingBookings.length}</span>}
                </button>
                <button style={styles.logoutBtn} onClick={() => { setIsAdmin(false); setView("user"); }}>יציאה</button>
              </div>
            ) : (
              <button style={styles.adminBtn} onClick={() => setShowAdminLogin(true)}>כניסת מנהל</button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main style={styles.main}>
        {view === "user" ? (
          <UserView
            rooms={ROOMS}
            selectedRoom={selectedRoom}
            setSelectedRoom={setSelectedRoom}
            weekDays={weekDays}
            weekBase={weekBase}
            setWeekBase={setWeekBase}
            hours={HOURS}
            isSlotBlocked={isSlotBlocked}
            handleSlotClick={handleSlotClick}
            loading={loading}
          />
        ) : (
          <AdminView
            bookings={bookings}
            blockings={blockings}
            rooms={ROOMS}
            onApprove={handleApprove}
            onReject={handleReject}
            onAddBlocking={() => setShowBlockingForm(true)}
            onDeleteBlocking={handleDeleteBlocking}
          />
        )}
      </main>

      {/* BOOKING MODAL */}
      {bookingForm && (
        <Modal onClose={() => setBookingForm(null)}>
          <BookingForm
            form={bookingForm}
            setForm={setBookingForm}
            rooms={ROOMS}
            durations={DURATION_OPTIONS}
            onSubmit={submitBooking}
            onCancel={() => setBookingForm(null)}
            loading={loading}
          />
        </Modal>
      )}

      {/* BLOCKING FORM MODAL */}
      {showBlockingForm && (
        <Modal onClose={() => setShowBlockingForm(false)}>
          <BlockingForm
            rooms={ROOMS}
            hours={HOURS}
            onSubmit={handleCreateBlocking}
            onCancel={() => setShowBlockingForm(false)}
            loading={loading}
          />
        </Modal>
      )}

      {/* ADMIN LOGIN MODAL */}
      {showAdminLogin && (
        <Modal onClose={() => setShowAdminLogin(false)}>
          <div style={styles.adminLogin}>
            <h2 style={styles.modalTitle}>כניסת מנהל</h2>
            <div style={styles.formGroup}>
              <label style={styles.label}>אימייל</label>
              <input
                style={styles.input}
                type="email"
                placeholder="your@email.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>סיסמה</label>
              <input
                style={styles.input}
                type="password"
                placeholder="••••••••"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loginAdmin()}
              />
            </div>
            <button style={styles.submitBtn} onClick={loginAdmin}>כניסה</button>
          </div>
        </Modal>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ ...styles.toast, background: toast.type === "error" ? "#ef4444" : "#22c55e" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ============================================================
// USER VIEW — Weekly Grid
// ============================================================
function UserView({ rooms, selectedRoom, setSelectedRoom, weekDays, weekBase, setWeekBase, hours, isSlotBlocked, handleSlotClick, loading }) {
  return (
    <div>
      {/* Room Tabs */}
      <div style={styles.roomTabs}>
        {rooms.map((r) => (
          <button
            key={r.id}
            style={{ ...styles.roomTab, ...(selectedRoom === r.id ? { background: r.color, color: "#fff", borderColor: r.color } : {}) }}
            onClick={() => setSelectedRoom(r.id)}
          >
            {r.name}
          </button>
        ))}
      </div>

      {/* Week Navigation */}
      <div style={styles.weekNav}>
        <button style={styles.navBtn} onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d); }}>← שבוע קודם</button>
        <span style={styles.weekLabel}>
          {weekDays[0].toLocaleDateString("he-IL", { day: "numeric", month: "long" })} – {weekDays[4].toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })}
        </span>
        <button style={styles.navBtn} onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d); }}>שבוע הבא →</button>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={styles.loading}>טוען...</div>
      ) : (
        <div style={styles.grid}>
          {/* Header row */}
          <div style={styles.timeCol} />
          {weekDays.map((d) => (
            <div key={d} style={styles.dayHeader}>
              <div style={styles.dayName}>יום {hebrewDay(d)}</div>
              <div style={styles.dayDate}>{d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}</div>
            </div>
          ))}

          {/* Time rows */}
          {hours.map((hour) => (
            <>
              <div key={`t-${hour}`} style={styles.timeLabel}>{hour}</div>
              {weekDays.map((day) => {
                const blocked = isSlotBlocked(selectedRoom, day, hour);
                const isPast = day < new Date(new Date().toDateString());
                const isToday = formatDate(day) === formatDate(new Date());
                return (
                  <div
                    key={`${day}-${hour}`}
                    style={{
                      ...styles.slot,
                      background: blocked ? "#fde8e8" : isPast ? "#f5f5f5" : "#e8f5e9",
                      cursor: blocked || isPast ? "default" : "pointer",
                      borderLeft: isToday ? "3px solid #4f8ef7" : "1px solid #e5e7eb",
                    }}
                    onClick={() => !blocked && !isPast && handleSlotClick(selectedRoom, day, hour)}
                    title={blocked ? "תפוס" : isPast ? "עבר" : "לחץ לשריון"}
                  >
                    <span style={{ fontSize: 13, color: blocked ? "#ef4444" : isPast ? "#aaa" : "#16a34a" }}>
                      {blocked ? "תפוס" : isPast ? "" : "פנוי"}
                    </span>
                  </div>
                );
              })}
            </>
          ))}
        </div>
      )}

      <div style={styles.legend}>
        <span style={styles.legendItem}><span style={{ ...styles.dot, background: "#e8f5e9" }} /> פנוי — לחץ לשריון</span>
        <span style={styles.legendItem}><span style={{ ...styles.dot, background: "#fde8e8" }} /> תפוס</span>
      </div>
    </div>
  );
}

// ============================================================
// ADMIN VIEW
// ============================================================
function AdminView({ bookings, blockings, rooms, onApprove, onReject, onAddBlocking, onDeleteBlocking }) {
  const pending = bookings.filter((b) => b.status === "pending");
  const approved = bookings.filter((b) => b.status === "approved");
  const rejected = bookings.filter((b) => b.status === "rejected");

  return (
    <div style={styles.adminContainer}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ ...styles.adminTitle, marginBottom: 0 }}>פאנל ניהול שריונות</h2>
        <button style={styles.blockBtn} onClick={onAddBlocking}>🔒 סגירת חדר לתקופה</button>
      </div>

      {/* ACTIVE BLOCKINGS */}
      {blockings.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>🔒 חסימות מנהל פעילות ({blockings.length})</h3>
          {blockings.map((bl) => {
            const room = rooms.find((r) => r.id === bl.room_id);
            return (
              <div key={bl.id} style={{ ...styles.bookingCard, borderRight: `4px solid ${room?.color}` }}>
                <div style={styles.bookingCardTop}>
                  <div style={{ ...styles.roomBadge, background: room?.color }}>{room?.name}</div>
                  <button style={styles.removeBtnSmall} onClick={() => onDeleteBlocking(bl.id)}>✕ הסר חסימה</button>
                </div>
                {bl.reason && <div style={{ ...styles.bookingMain, fontSize: 14 }}>{bl.reason}</div>}
                <div style={styles.bookingGrid}>
                  <div style={styles.bookingField}><span style={styles.fieldLabel}>📅 מתאריך</span><span>{bl.date_from}</span></div>
                  <div style={styles.bookingField}><span style={styles.fieldLabel}>📅 עד תאריך</span><span>{bl.date_to}</span></div>
                  <div style={styles.bookingField}><span style={styles.fieldLabel}>🕐 שעת התחלה</span><span>{bl.start_time}</span></div>
                  <div style={styles.bookingField}><span style={styles.fieldLabel}>🕐 שעת סיום</span><span>{bl.end_time}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BookingSection title={`⏳ ממתינות לאישור (${pending.length})`} bookings={pending} rooms={rooms} onApprove={onApprove} onReject={onReject} showActions />
      <BookingSection title={`✅ מאושרות (${approved.length})`} bookings={approved} rooms={rooms} />
      <BookingSection title={`❌ נדחו (${rejected.length})`} bookings={rejected} rooms={rooms} />
    </div>
  );
}

function BookingSection({ title, bookings, rooms, onApprove, onReject, showActions }) {
  if (!bookings.length) return null;
  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      {bookings.map((b) => {
        const room = rooms.find((r) => r.id === b.room_id);
        return (
          <div key={b.id} style={styles.bookingCard}>
            <div style={styles.bookingCardTop}>
              <div style={{ ...styles.roomBadge, background: room?.color }}>{room?.name}</div>
              <div style={styles.bookingStatus}>
                {b.status === "pending" && <span style={styles.statusPending}>⏳ ממתין לאישור</span>}
                {b.status === "approved" && <span style={styles.statusApproved}>✅ מאושר</span>}
                {b.status === "rejected" && <span style={styles.statusRejected}>❌ נדחה</span>}
              </div>
            </div>
            <div style={styles.bookingMain}>{b.topic}</div>
            <div style={styles.bookingGrid}>
              <div style={styles.bookingField}><span style={styles.fieldLabel}>📅 תאריך</span><span>{b.date}</span></div>
              <div style={styles.bookingField}><span style={styles.fieldLabel}>🕐 שעות</span><span>{b.start_time} – {b.end_time}</span></div>
              <div style={styles.bookingField}><span style={styles.fieldLabel}>👤 שם המבקש</span><span>{b.requester_name}</span></div>
              <div style={styles.bookingField}><span style={styles.fieldLabel}>✉️ אימייל</span><span>{b.requester_email}</span></div>
              <div style={styles.bookingField}><span style={styles.fieldLabel}>👥 משתתפים</span><span>{b.participants}</span></div>
              {b.notes && <div style={{ ...styles.bookingField, gridColumn: "1 / -1" }}><span style={styles.fieldLabel}>📝 דגשים ובקשות נוספות</span><span>{b.notes}</span></div>}
            </div>
            {showActions && (
              <div style={styles.actions}>
                <button style={styles.approveBtn} onClick={() => onApprove(b)}>אשר ✓</button>
                <button style={styles.rejectBtn} onClick={() => onReject(b)}>דחה ✗</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// BOOKING FORM
// ============================================================
function BookingForm({ form, setForm, rooms, durations, onSubmit, onCancel, loading }) {
  const room = rooms.find((r) => r.id === form.room_id);
  const endTime = addHours(form.start_time, form.duration);
  const f = (k) => (v) => setForm({ ...form, [k]: v });

  return (
    <div style={styles.formContainer}>
      <h2 style={styles.modalTitle}>בקשת שריון חדר</h2>
      <div style={{ ...styles.roomBadge, background: room?.color, marginBottom: 16 }}>{room?.name}</div>
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label style={styles.label}>תאריך</label>
          <div style={styles.readOnly}>{form.date}</div>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>שעת התחלה</label>
          <div style={styles.readOnly}>{form.start_time}</div>
        </div>
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>משך זמן</label>
        <select style={styles.input} value={form.duration} onChange={(e) => f("duration")(Number(e.target.value))}>
          {durations.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <div style={styles.endTimeNote}>שעת סיום: {endTime}</div>
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>שם המבקש *</label>
        <input style={styles.input} value={form.requester_name} onChange={(e) => f("requester_name")(e.target.value)} placeholder="שם מלא" />
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>אימייל לעדכון (מייל מקום העבודה) *</label>
        <input style={styles.input} type="email" value={form.requester_email} onChange={(e) => f("requester_email")(e.target.value)} placeholder="your@email.com" />
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>נושא הפגישה *</label>
        <input style={styles.input} value={form.topic} onChange={(e) => f("topic")(e.target.value)} placeholder="תאר את הנושא" />
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>מספר משתתפים *</label>
        <input style={styles.input} type="number" min={1} value={form.participants} onChange={(e) => f("participants")(e.target.value)} placeholder="כמה משתתפים?" />
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>דגשים ובקשות נוספות</label>
        <textarea style={{ ...styles.input, resize: "vertical", minHeight: 72 }} value={form.notes} onChange={(e) => f("notes")(e.target.value)} placeholder="ציוד נדרש, סידורים מיוחדים, הערות..." />
      </div>
      <div style={styles.formActions}>
        <button style={styles.submitBtn} onClick={onSubmit} disabled={loading}>{loading ? "שולח..." : "שלח בקשה"}</button>
        <button style={styles.cancelBtn} onClick={onCancel}>ביטול</button>
      </div>
    </div>
  );
}

// ============================================================
// BLOCKING FORM (Admin only)
// ============================================================
function BlockingForm({ rooms, hours, onSubmit, onCancel, loading }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    room_id: rooms[0].id,
    date_from: today,
    date_to: today,
    start_time: "08:00",
    end_time: "18:00",
    reason: "",
  });
  const f = (k) => (v) => setForm((prev) => ({ ...prev, [k]: v }));

  function handleSubmit() {
    if (!form.date_from || !form.date_to || !form.start_time || !form.end_time) {
      return;
    }
    if (form.date_to < form.date_from) {
      return;
    }
    if (form.end_time <= form.start_time) {
      return;
    }
    onSubmit({ ...form, room_id: Number(form.room_id) });
  }

  const selectedRoom = rooms.find((r) => r.id === Number(form.room_id));

  return (
    <div style={styles.formContainer}>
      <h2 style={styles.modalTitle}>🔒 סגירת חדר לתקופה</h2>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: 18, marginTop: -8 }}>
        החדר ייחסם לכל המשתמשים בטווח התאריכים והשעות שתבחר.
      </p>

      <div style={styles.formGroup}>
        <label style={styles.label}>חדר</label>
        <select style={styles.input} value={form.room_id} onChange={(e) => f("room_id")(e.target.value)}>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label style={styles.label}>מתאריך</label>
          <input style={styles.input} type="date" value={form.date_from} onChange={(e) => f("date_from")(e.target.value)} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>עד תאריך</label>
          <input style={styles.input} type="date" value={form.date_to} min={form.date_from} onChange={(e) => f("date_to")(e.target.value)} />
        </div>
      </div>

      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label style={styles.label}>שעת התחלה</label>
          <select style={styles.input} value={form.start_time} onChange={(e) => f("start_time")(e.target.value)}>
            {hours.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>שעת סיום</label>
          <select style={styles.input} value={form.end_time} onChange={(e) => f("end_time")(e.target.value)}>
            {[...hours.slice(1), "18:00"].map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>סיבה / הערה (אופציונלי)</label>
        <input style={styles.input} value={form.reason} onChange={(e) => f("reason")(e.target.value)} placeholder="למשל: תחזוקה, אירוע חברה..." />
      </div>

      {selectedRoom && (
        <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#475569", borderRight: `3px solid ${selectedRoom.color}` }}>
          <strong>{selectedRoom.name}</strong> ייחסם מ-<strong>{form.date_from}</strong> עד <strong>{form.date_to}</strong> בין השעות <strong>{form.start_time}–{form.end_time}</strong>
        </div>
      )}

      <div style={styles.formActions}>
        <button style={{ ...styles.submitBtn, background: "#dc2626" }} onClick={handleSubmit} disabled={loading}>
          {loading ? "שומר..." : "🔒 סגור חדר"}
        </button>
        <button style={styles.cancelBtn} onClick={onCancel}>ביטול</button>
      </div>
    </div>
  );
}

// ============================================================
// MODAL
// ============================================================
function Modal({ children, onClose }) {
  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>{children}</div>
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = {
  root: { minHeight: "100vh", background: "#f8fafc", fontFamily: "'Segoe UI', Arial, sans-serif", direction: "rtl", color: "#1e293b" },
  header: { background: "#1e3a5f", color: "#fff", padding: "0 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" },
  headerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 },
  logo: { fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px" },
  orgName: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  headerActions: { display: "flex", alignItems: "center", gap: 8 },
  tab: { padding: "6px 16px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 14 },
  tabActive: { padding: "6px 16px", borderRadius: 6, border: "1px solid #4f8ef7", background: "#4f8ef7", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 },
  badge: { background: "#ef4444", color: "#fff", borderRadius: "50%", padding: "1px 6px", fontSize: 11, marginRight: 6 },
  adminBtn: { padding: "6px 16px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.4)", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 13 },
  logoutBtn: { padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 12, opacity: 0.7 },
  main: { maxWidth: 1100, margin: "24px auto", padding: "0 16px" },
  roomTabs: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" },
  roomTab: { padding: "10px 20px", borderRadius: 10, border: "2px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14, transition: "all 0.2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  capacity: { fontSize: 11, fontWeight: 400, opacity: 0.7 },
  weekNav: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 16 },
  navBtn: { padding: "8px 18px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 14, color: "#1e3a5f", fontWeight: 600 },
  weekLabel: { fontSize: 15, fontWeight: 600, color: "#1e3a5f" },
  grid: { display: "grid", gridTemplateColumns: "60px repeat(5, 1fr)", gap: 0, background: "#e2e8f0", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" },
  timeCol: { background: "#f8fafc" },
  dayHeader: { background: "#1e3a5f", color: "#fff", padding: "10px 4px", textAlign: "center" },
  dayName: { fontSize: 13, fontWeight: 600 },
  dayDate: { fontSize: 11, opacity: 0.7, marginTop: 2 },
  timeLabel: { background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#64748b", fontWeight: 600, borderTop: "1px solid #e2e8f0" },
  slot: { padding: "6px 4px", textAlign: "center", borderTop: "1px solid #e2e8f0", transition: "filter 0.1s", minHeight: 34 },
  loading: { textAlign: "center", padding: 40, color: "#64748b" },
  legend: { display: "flex", gap: 20, marginTop: 16, fontSize: 13, color: "#64748b" },
  legendItem: { display: "flex", alignItems: "center", gap: 6 },
  dot: { width: 14, height: 14, borderRadius: 3, display: "inline-block", border: "1px solid #e2e8f0" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" },
  formContainer: {},
  modalTitle: { fontSize: 20, fontWeight: 700, color: "#1e3a5f", marginBottom: 16, marginTop: 0 },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  formGroup: { marginBottom: 14 },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 },
  input: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box", color: "#1e293b", background: "#f8fafc" },
  readOnly: { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 14, background: "#f1f5f9", color: "#64748b" },
  endTimeNote: { fontSize: 12, color: "#64748b", marginTop: 4 },
  formActions: { display: "flex", gap: 10, marginTop: 20 },
  submitBtn: { flex: 1, padding: "11px 0", borderRadius: 9, border: "none", background: "#1e3a5f", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  cancelBtn: { padding: "11px 20px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 14, cursor: "pointer" },
  adminContainer: { maxWidth: 800, margin: "0 auto" },
  adminTitle: { fontSize: 22, fontWeight: 700, color: "#1e3a5f", marginBottom: 24 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: "#475569", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #e2e8f0" },
  bookingCard: { background: "#fff", borderRadius: 12, padding: "18px 20px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" },
  bookingCardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  bookingStatus: { fontSize: 13, fontWeight: 600 },
  statusPending: { color: "#d97706" },
  statusApproved: { color: "#16a34a" },
  statusRejected: { color: "#dc2626" },
  bookingGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", margin: "12px 0" },
  bookingField: { display: "flex", flexDirection: "column", gap: 3 },
  fieldLabel: { fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" },
  roomBadge: { color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" },
  bookingMain: { fontWeight: 700, fontSize: 16, color: "#1e293b", marginBottom: 4 },
  actions: { display: "flex", gap: 8 },
  approveBtn: { padding: "7px 16px", borderRadius: 7, border: "none", background: "#22c55e", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 },
  rejectBtn: { padding: "7px 16px", borderRadius: 7, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 },
  adminLogin: { display: "flex", flexDirection: "column", gap: 14 },
  blockBtn: { padding: "9px 18px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 },
  removeBtnSmall: { padding: "4px 12px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontWeight: 600, cursor: "pointer", fontSize: 12 },
  toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", color: "#fff", padding: "12px 28px", borderRadius: 10, fontWeight: 600, fontSize: 15, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" },
};
