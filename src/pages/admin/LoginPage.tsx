import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin, isAdminAuthenticated } from '../../lib/auth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function LoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAdminAuthenticated()) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    const ok = await adminLogin(password);
    setLoading(false);
    if (ok) {
      navigate('/admin/dashboard', { replace: true });
    } else {
      setError('סיסמה שגויה. נסה שנית.');
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">מערכת שריון חדרים</h1>
          <p className="text-gray-400 text-sm mt-1">כניסה לממשק הניהול</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-2xl space-y-4">
          <Input
            label="סיסמת כניסה"
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            error={error}
            placeholder="••••••••"
            autoFocus
          />
          <Button type="submit" loading={loading} className="w-full" size="lg">
            כניסה
          </Button>
          <div className="text-center">
            <a href="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              חזרה לאתר הציבורי
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
