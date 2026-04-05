import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAdminAuthenticated, clearAdminSession, getAdminToken } from '../lib/auth';

export function useAdminGuard() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      navigate('/admin', { replace: true });
    } else {
      setReady(true);
    }
  }, [navigate]);

  return ready;
}

export function useAdminToken(): string {
  return getAdminToken() ?? '';
}

export function useLogout() {
  const navigate = useNavigate();
  return () => {
    clearAdminSession();
    navigate('/admin', { replace: true });
  };
}
