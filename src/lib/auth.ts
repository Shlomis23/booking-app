const STORAGE_KEY = 'adminToken';

export function getAdminToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function isAdminAuthenticated(): boolean {
  return !!getAdminToken();
}

export function clearAdminSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function adminLogin(password: string): Promise<boolean> {
  const expected = import.meta.env.VITE_ADMIN_PASSWORD as string;
  if (!expected || password !== expected) return false;
  const token = btoa(password);
  localStorage.setItem(STORAGE_KEY, token);
  return true;
}
