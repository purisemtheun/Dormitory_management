import React, { useEffect, useState } from "react";
import http from "../../services/http";

export default function AdminNotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await http.get("/api/admin/notifications");
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load notifications error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="ad-main">
      <header className="ad-header">
        <h1 className="text-2xl font-bold text-gray-800">
          📢 การแจ้งเตือนล่าสุด
        </h1>
        <button onClick={load} className="btn">
          🔄 รีเฟรช
        </button>
      </header>

      <div className="ad-panel" style={{ padding: "20px 24px" }}>
        {loading ? (
          <div className="muted">กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 0",
              color: "#6b7280",
              fontSize: "1rem",
            }}
          >
            ไม่มีการแจ้งเตือนในขณะนี้
          </div>
        ) : (
          <ul className="notif-list">
            {items.map((n) => (
              <li key={n.id} className="notif-card">
                <div className="notif-icon">
                  <span role="img" aria-label="bell">
                    🔔
                  </span>
                </div>
                <div className="notif-body">
                  <h3 className="notif-title">{n.title}</h3>
                  <p className="notif-msg">{n.body}</p>
                  <div className="notif-meta">
                    <span className="notif-type">
                      {n.type?.toUpperCase() ?? "-"}
                    </span>
                    <span className="notif-date">
                      {new Date(n.created_at).toLocaleString("th-TH")}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
