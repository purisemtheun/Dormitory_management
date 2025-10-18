import React, { useMemo, useState } from 'react';
import useTenantNotifications from '../../hooks/useTenantNotifications';

export default function NotificationCenter() {
  const { list, markRead, markAll, clearRead } = useTenantNotifications();
  const [tab, setTab] = useState('all'); // 'all' | 'unread'

  const items = useMemo(() => {
    const src = list.data || [];
    return tab === 'unread'
      ? src.filter(n => n.status === 'unread' || !n.read_at)
      : src;
  }, [list.data, tab]);

  return (
    <div className="room-section" style={{ maxWidth: 880 }}>
      <div className="section-head">
        <div>
          <h1 className="tn-title" style={{ margin: 0 }}>การแจ้งเตือนทั้งหมด</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            รวมการแจ้งเตือนสำหรับบัญชีนี้ ({list.unreadCount || 0} ยังไม่ได้อ่าน)
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => list.refetch()}>รีเฟรช</button>
          <button className="btn" onClick={() => markAll.mutate()}>ทำเป็นอ่านทั้งหมด</button>
          {/* ✅ ปุ่มใหม่: ล้างเฉพาะที่อ่านแล้ว */}
          <button className="btn-danger" onClick={() => clearRead.mutate()}>
            ล้างที่อ่านแล้ว
          </button>
        </div>
      </div>

      {/* แถบสลับ All/Unread */}
      <div style={{ display: 'flex', gap: 8, margin: '6px 0 10px' }}>
        <button
          className={`btn ${tab === 'all' ? 'btn-warning' : ''}`}
          onClick={() => setTab('all')}
        >
          ทั้งหมด
        </button>
        <button
          className={`btn ${tab === 'unread' ? 'btn-warning' : ''}`}
          onClick={() => setTab('unread')}
        >
          ยังไม่ได้อ่าน
        </button>
      </div>

      {list.isLoading ? (
        <div className="card"><p className="muted">กำลังโหลด…</p></div>
      ) : items.length === 0 ? (
        <div className="card"><p className="muted">ไม่มีรายการ</p></div>
      ) : (
        <ul className="notif-list">
          {items.map((n) => {
            const isRead = n.status === 'read' || n.read_at;
            const tone =
              n.type === 'payment_approved' ? 'border-emerald-500/40' :
              n.type === 'payment_rejected' ? 'border-amber-500/40' :
              n.type?.startsWith('invoice') ? 'border-blue-500/40' :
              n.type?.startsWith('repair') ? 'border-purple-500/40' :
              'border-zinc-300';

            return (
              <li key={n.id} className="notif-card" style={{ borderLeft: '4px solid', borderLeftColor: tone.split('border-')[1]?.split('/')[0] ? '' : '' }}>
                <div className="notif-icon">🔔</div>
                <div className="notif-body">
                  <h3 className="notif-title">{n.title}</h3>
                  <p className="notif-msg">{n.body}</p>
                  <div className="notif-meta">
                    <span className="notif-type">{n.type}</span>
                    <span className="notif-date">{new Date(n.created_at).toLocaleString()}</span>
                  </div>
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
    </div>
  );
}
