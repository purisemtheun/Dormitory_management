import React, { useMemo, useRef, useState, useEffect } from "react";
import useTenantNotifications from "../../hooks/useTenantNotifications";

export default function NotificationBell({ limit = 5 }) {
  const { list, markRead, markAll } = useTenantNotifications();
  const items = list.data || [];
  const unread = useMemo(
    () => items.filter(n => n.status === "unread" || !n.read_at).length,
    [items]
  );
  const visible = useMemo(() => items.slice(0, limit), [items, limit]);

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // ปิดเมื่อคลิกนอก
  useEffect(() => {
    const onClick = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="tn-bell" ref={ref}>
      <button className="tn-bell-btn" title="การแจ้งเตือน" onClick={() => setOpen(v => !v)}>
        {/* ไอคอนกระดิ่งแบบเบสิค */}
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2a6 6 0 0 0-6 6v3.6l-1.3 1.3A1 1 0 0 0 5 14h14a1 1 0 0 0 .7-1.7L18.4 11.6V8a6 6 0 0 0-6-6z" fill={unread>0?"currentColor":"none"} stroke="currentColor" strokeWidth="1.5"/>
          <path d="M9 18a3 3 0 0 0 6 0" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        {unread > 0 && <span className="tn-bell-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <div className="tn-bell-panel">
          <div className="tn-bell-head">
            <div className="tn-bell-title">การแจ้งเตือน</div>
            <div className="tn-bell-tools">
              {unread > 0 && (
                <button className="tn-link-btn" onClick={() => markAll.mutate()}>
                  ทำทั้งหมดเป็นอ่านแล้ว
                </button>
              )}
              <button className="tn-icon-btn" title="รีเฟรช" onClick={() => list.refetch()}>⟳</button>
              <button className="tn-icon-btn" title="ปิด" onClick={() => setOpen(false)}>✕</button>
            </div>
          </div>

          {list.isLoading ? (
            <div className="tn-bell-empty">กำลังโหลด…</div>
          ) : visible.length === 0 ? (
            <div className="tn-bell-empty">ยังไม่มีการแจ้งเตือน</div>
          ) : (
            <ul className="tn-bell-list">
              {visible.map(n => {
                const isRead = n.status === "read" || n.read_at;
                const tone =
                  n.type === "payment_approved" ? "emerald" :
                  n.type === "payment_rejected" ? "amber" :
                  n.type?.startsWith("invoice") ? "blue" :
                  n.type?.startsWith("repair") ? "purple" : "zinc";
                return (
                  <li key={n.id} className={`tn-bell-item tn-${tone}`}>
                    <div className="tn-bell-item-main">
                      <div className="tn-bell-item-title">{n.title}</div>
                      <div className="tn-bell-item-body">{n.body}</div>
                      <div className="tn-bell-item-meta">{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                    {!isRead && (
                      <button className="tn-chip-btn" onClick={() => markRead.mutate(n.id)}>
                        อ่านแล้ว
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="tn-bell-foot">
            <a href="/tenant/notifications" className="tn-link-btn" onClick={() => setOpen(false)}>
              ดูการแจ้งเตือนทั้งหมด
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
