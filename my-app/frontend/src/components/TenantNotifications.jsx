// src/components/TenantNotifications.jsx
import { useEffect, useState } from "react";
import axios from "../utils/axios";

export default function TenantNotifications() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    axios.get("/api/tenant/notifications").then((res) => setItems(res.data));
  }, []);

  const markRead = async (id) => {
    await axios.patch(`/api/tenant/notifications/${id}/read`);
    // อัปเดต state ให้แสดงว่าอ่านแล้ว
    setItems((items) =>
      items.map((i) =>
        i.id === id ? { ...i, read_at: new Date().toISOString() } : i
      )
    );
  };

  return (
    <div className="card">
      <h3>การแจ้งเตือน</h3>
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id} className="border p-2 rounded">
            <div className="font-semibold">{n.title}</div>
            <div>{n.body}</div>
            <small>{new Date(n.created_at).toLocaleString()}</small>
            {!n.read_at && (
              <button
                className="btn btn-sm ml-2"
                onClick={() => markRead(n.id)}
              >
                ทำเครื่องหมายว่าอ่านแล้ว
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
