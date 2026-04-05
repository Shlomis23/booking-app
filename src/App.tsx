import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from './components/layout/PublicLayout';

// Public pages
import AvailabilityPage from './pages/public/AvailabilityPage';
import BookingFormPage from './pages/public/BookingFormPage';
import ManageBookingPage from './pages/public/ManageBookingPage';
import ManageEntryPage from './pages/public/ManageEntryPage';

// Admin pages
import LoginPage from './pages/admin/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import BookingsPage from './pages/admin/BookingsPage';
import RoomsPage from './pages/admin/RoomsPage';
import CalendarPage from './pages/admin/CalendarPage';
import ChangesPage from './pages/admin/ChangesPage';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* ── Public routes ───────────────────────────────────── */}
        <Route
          path="/"
          element={
            <PublicLayout>
              <AvailabilityPage />
            </PublicLayout>
          }
        />
        <Route
          path="/book"
          element={
            <PublicLayout>
              <BookingFormPage />
            </PublicLayout>
          }
        />
        <Route
          path="/manage"
          element={
            <PublicLayout>
              <ManageEntryPage />
            </PublicLayout>
          }
        />
        <Route
          path="/manage/:cancellationCode"
          element={
            <PublicLayout>
              <ManageBookingPage />
            </PublicLayout>
          }
        />

        {/* ── Admin routes ─────────────────────────────────────── */}
        <Route path="/admin" element={<LoginPage />} />
        <Route path="/admin/dashboard" element={<DashboardPage />} />
        <Route path="/admin/bookings" element={<BookingsPage />} />
        <Route path="/admin/rooms" element={<RoomsPage />} />
        <Route path="/admin/calendar" element={<CalendarPage />} />
        <Route path="/admin/changes" element={<ChangesPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
