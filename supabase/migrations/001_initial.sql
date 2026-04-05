-- ============================================================
-- Room Booking Management System — Initial Migration
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Enums ────────────────────────────────────────────────────
CREATE TYPE booking_type   AS ENUM ('regular', 'special');
CREATE TYPE booking_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE change_type    AS ENUM ('reschedule');
CREATE TYPE change_status  AS ENUM ('pending', 'approved', 'rejected');

-- ── Tables ───────────────────────────────────────────────────

CREATE TABLE rooms (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT        NOT NULL,
  capacity      INTEGER     NOT NULL CHECK (capacity > 0),
  description   TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  blocked_dates JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bookings (
  id                  UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  type                booking_type   NOT NULL DEFAULT 'regular',
  status              booking_status NOT NULL DEFAULT 'pending',
  requester_name      TEXT           NOT NULL,
  requester_email     TEXT           NOT NULL,
  event_date          DATE           NOT NULL,
  start_time          TIME           NOT NULL,
  duration_minutes    INTEGER        NOT NULL CHECK (duration_minutes > 0),
  participant_count   INTEGER        NOT NULL CHECK (participant_count > 0),
  notes               TEXT,
  room_id             UUID           REFERENCES rooms(id) ON DELETE SET NULL,
  second_room_id      UUID           REFERENCES rooms(id) ON DELETE SET NULL,
  cancellation_code   UUID           NOT NULL DEFAULT uuid_generate_v4(),
  admin_notes         TEXT,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE booking_changes (
  id                          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id                  UUID          NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  type                        change_type   NOT NULL DEFAULT 'reschedule',
  status                      change_status NOT NULL DEFAULT 'pending',
  requested_date              DATE,
  requested_start_time        TIME,
  requested_duration_minutes  INTEGER       CHECK (requested_duration_minutes > 0),
  requester_notes             TEXT,
  admin_notes                 TEXT,
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_bookings_event_date        ON bookings(event_date);
CREATE INDEX idx_bookings_status            ON bookings(status);
CREATE INDEX idx_bookings_room_id           ON bookings(room_id);
CREATE INDEX idx_bookings_second_room_id    ON bookings(second_room_id);
CREATE INDEX idx_bookings_cancellation_code ON bookings(cancellation_code);
CREATE INDEX idx_bookings_requester_email   ON bookings(requester_email);
CREATE INDEX idx_changes_booking_id         ON booking_changes(booking_id);
CREATE INDEX idx_changes_status             ON booking_changes(status);

-- ── updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE rooms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_changes ENABLE ROW LEVEL SECURITY;

-- Rooms: anyone can read; only service_role can write
CREATE POLICY "rooms_public_select"  ON rooms FOR SELECT USING (true);
CREATE POLICY "rooms_service_all"    ON rooms FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Bookings: anyone can read and insert; only service_role can update/delete
CREATE POLICY "bookings_public_select" ON bookings FOR SELECT USING (true);
CREATE POLICY "bookings_public_insert" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "bookings_service_all"   ON bookings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Booking changes: anyone can read and insert; only service_role can update/delete
CREATE POLICY "changes_public_select" ON booking_changes FOR SELECT USING (true);
CREATE POLICY "changes_public_insert" ON booking_changes FOR INSERT WITH CHECK (true);
CREATE POLICY "changes_service_all"   ON booking_changes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Seed data ────────────────────────────────────────────────
INSERT INTO rooms (name, capacity, description, is_active) VALUES
  ('חדר הדרכה א',  20, 'חדר הדרכה מאובזר עם מקרן, לוח חכם ומערכת שמע',        true),
  ('חדר הדרכה ב',  15, 'חדר הדרכה עם מסך ענק ומערכת וידאו קונפרנס',            true),
  ('חדר הדרכה ג',  12, 'חדר הדרכה קטן ואינטימי, מתאים לקבוצות קטנות',          true),
  ('אולם הכשרה',   40, 'אולם הכשרה מרווח עם ציוד מלא לכנסים והרצאות',          true);
