import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../utils/auth';

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function useTenantNotifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/tenant/notifications', {
        credentials: 'include',
        headers: { ...authHeaders() },
      });
      if (!r.ok) {
        // ถ้า 401 ให้เคลียร์รายการเงียบ ๆ (ไม่ให้หน้าแดง)
        if (r.status === 401) {
          setItems([]);
          setLoading(false);
          return;
        }
        throw new Error(`HTTP ${r.status}`);
      }
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (_e) {
      // อย่าโยน error ให้ React — เดี๋ยวหน้าแตก
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = useCallback(async (id) => {
    const r = await fetch(`/api/tenant/notifications/${id}/read`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { ...authHeaders() },
    });
    if (r.ok) load();
  }, [load]);

  const markAll = useCallback(async () => {
    const r = await fetch(`/api/tenant/notifications/read-all`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { ...authHeaders() },
    });
    if (r.ok) load();
  }, [load]);

  const clearRead = useCallback(async () => {
    const r = await fetch(`/api/tenant/notifications/clear-read`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { ...authHeaders() },
    });
    if (r.ok) load();
  }, [load]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const unreadCount = useMemo(
    () => items.filter((n) => n.status === 'unread' || !n.read_at).length,
    [items]
  );

  return {
    list: { data: items, isLoading: loading, refetch: load, unreadCount },
    markRead: { mutate: markRead },
    markAll: { mutate: markAll },
    clearRead: { mutate: clearRead },
  };
}
