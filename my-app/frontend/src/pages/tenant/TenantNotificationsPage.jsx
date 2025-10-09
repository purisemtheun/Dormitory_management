// frontend/src/pages/tenant/TenantNotificationsPage.jsx
import React, { useEffect, useState } from "react";
import { getToken } from "../../utils/auth";

export default function TenantNotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/notifications", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id) {
    await fetch(`/api/tenant/notifications/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, read_at: new Date().toISOString() } : it))
    );
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div>กำลังโหลดแจ้งเตือน…</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-3">แจ้งเตือนของฉัน</h2>
      {items.length === 0 ? (
        <div>ไม่มีแจ้งเตือน</div>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id} className="border rounded p-3">
              <div className="text-sm text-gray-500">
                {new Date(n.created_at).toLocaleString()}
              </div>
              <div className="font-medium">{n.title}</div>
              <div className="text-gray-700 whitespace-pre-wrap">{n.body}</div>
              <div className="mt-2 flex gap-2">
                {n.read_at ? (
                  <span className="text-green-600 text-sm">อ่านแล้ว</span>
                ) : (
                  <button
                    onClick={() => markRead(n.id)}
                    className="px-3 py-1 text-sm rounded bg-black text-white"
                  >
                    ทำเป็นอ่านแล้ว
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
