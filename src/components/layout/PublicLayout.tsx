import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface PublicLayoutProps {
  children: React.ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { to: '/', label: 'לוח זמינות' },
    { to: '/book', label: 'הזמנת חדר' },
    { to: '/manage', label: 'מעקב הזמנה' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" dir="rtl">
      {/* Header */}
      <header className="bg-gradient-to-l from-violet-600 to-indigo-600 shadow-lg shadow-indigo-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-white text-base leading-tight">מערכת שריון חדרים</h1>
              <p className="text-xs text-white/60 hidden sm:block">ניהול חדרי הדרכה</p>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === to
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/15'
                }`}
              >
                {label}
              </Link>
            ))}
            <a
              href="/admin"
              className="px-4 py-2 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/15 transition-all"
            >
              כניסת מנהל
            </a>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden p-2 rounded-xl bg-white/20 text-white"
            onClick={() => setMenuOpen(o => !o)}
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="sm:hidden border-t border-white/20 px-4 py-2 space-y-1">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === to
                    ? 'bg-white text-violet-700'
                    : 'text-white/80 hover:bg-white/15 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
            <a
              href="/admin"
              className="block px-4 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:bg-white/15 hover:text-white transition-all"
            >
              כניסת מנהל
            </a>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 sm:py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-4 text-center text-xs text-gray-400">
        מערכת שריון חדרים — כל הזכויות שמורות
      </footer>
    </div>
  );
}
