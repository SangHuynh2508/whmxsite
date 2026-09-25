import { useEffect, useState } from 'react';
import { getSession } from '../../app/auth/session.js';

// UI-only (e.g. "Xuất bản ngay"); the server still checks every request.
export function useIsOwner() {
  const [owner, setOwner] = useState(false);
  useEffect(() => { void getSession().then((s: { user?: { role?: string } } | null) => setOwner(s?.user?.role === 'owner')); }, []);
  return owner;
}
