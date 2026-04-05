import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';

export default function ManageEntryPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) { setError('יש להזין מספר הזמנה'); return; }
    if (!/^\d{6}$/.test(trimmed)) { setError('מספר הזמנה חייב להיות 6 ספרות'); return; }
    navigate(`/manage/${trimmed}`);
  }

  return (
    <div className="max-w-md mx-auto py-10 space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">ניהול הזמנה</h1>
        <p className="text-gray-500 text-sm mt-2">הזן את מספר ההזמנה שקיבלת באימייל</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">מספר הזמנה</label>
            <input
              type="text"
              className={`block w-full rounded-xl border px-4 py-3 text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all ${error ? 'border-rose-400' : 'border-gray-200'}`}
              placeholder="123456"
              value={code}
              onChange={e => { setCode(e.target.value); setError(''); }}
              autoFocus
              dir="ltr"
              maxLength={6}
            />
            {error && <p className="text-xs text-rose-600 text-center">{error}</p>}
          </div>
          <Button type="submit" className="w-full" size="lg">
            עבור לניהול ההזמנה
          </Button>
        </form>
      </div>

      <p className="text-center text-xs text-gray-400">
        אין לך מספר הזמנה?{' '}
        <a href="/book" className="text-violet-600 hover:underline font-medium">הגש בקשת שריון חדשה</a>
      </p>
    </div>
  );
}
