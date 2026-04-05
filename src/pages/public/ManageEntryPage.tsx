import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Card, { CardBody } from '../../components/ui/Card';

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
        <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">ניהול הזמנה</h1>
        <p className="text-gray-500 text-sm mt-2">הזן את מספר ההזמנה שקיבלת באימייל</p>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">מספר הזמנה</label>
              <input
                type="text"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                placeholder="123456"
                value={code}
                onChange={e => { setCode(e.target.value); setError(''); }}
                autoFocus
                dir="ltr"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <Button type="submit" className="w-full" size="lg">
              עבור לניהול ההזמנה
            </Button>
          </form>
        </CardBody>
      </Card>

      <p className="text-center text-xs text-gray-400">
        אין לך מספר הזמנה?{' '}
        <a href="/book" className="text-blue-600 hover:underline">הגש בקשת שריון חדשה</a>
      </p>
    </div>
  );
}
