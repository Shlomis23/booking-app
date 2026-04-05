export type BookingType = 'regular' | 'special';
export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ChangeStatus = 'pending' | 'approved' | 'rejected';

export interface BlockedDate {
  from: string;  // ISO date YYYY-MM-DD
  to: string;    // ISO date YYYY-MM-DD
  reason?: string;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  description?: string;
  is_active: boolean;
  blocked_dates: BlockedDate[];
  created_at: string;
}

export interface Booking {
  id: string;
  type: BookingType;
  status: BookingStatus;
  requester_name: string;
  requester_email: string;
  event_date: string;  // YYYY-MM-DD
  start_time: string;  // HH:MM:SS
  duration_minutes: number;
  participant_count: number;
  notes?: string;
  room_id?: string;
  second_room_id?: string;
  cancellation_code: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  // Joined
  room?: Room;
  second_room?: Room;
}

export interface BookingChange {
  id: string;
  booking_id: string;
  type: 'reschedule';
  status: ChangeStatus;
  requested_date?: string;
  requested_start_time?: string;
  requested_duration_minutes?: number;
  requester_notes?: string;
  admin_notes?: string;
  created_at: string;
  // Joined
  booking?: Booking;
}

export interface BookingFormData {
  requesterName: string;
  requesterEmail: string;
  eventDate: string;
  startTime: string;
  durationMinutes: number;
  participantCount: number;
  notes: string;
  isSpecial: boolean;
}
