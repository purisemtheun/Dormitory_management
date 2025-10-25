// src/components/reports/RevenueDailyChart.jsx
import React, { useMemo } from 'react';

function normalizeDate(v) {
  if (!v) return '';
  const s = String(v);
  // กรณี backend ส่งมาเป็น YYYY-MM-DD อยู่แล้ว
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // พยายาม parse เป็น Date แล้วคืนค่าเป็น YYYY-MM-DD (ตาม local TZ)
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) {
    // ถ้า parse ไม่ได้ ตัด 10 ตัวแรกเป็นวันที่
    return s.slice(0, 10);
  }
  // ปรับ offset เพื่อให้ได้วันที่ของ local (เลี่ยงปัญหา Z/UTC)
  const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  return local;
}

export default function RevenueDailyChart({ data, range, setRange }) {
  const rows = useMemo(() => {
    const items = Array.isArray(data) ? data : [];
    return items
      .map(r => {
        const d =
          r.date ||
          r.report_date ||
          r.paid_at ||
          r.payment_date ||
          ''; // รองรับหลายชื่อฟิลด์
        return {
          _date: normalizeDate(d),
          total: Number(r.revenue ?? r.total ?? 0),
        };
      })
      .sort((a, b) => a._date.localeCompare(b._date));
  }, [data]);

  const totalRevenue = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.total) || 0), 0),
    [rows]
  );

  return (
    <div>
      <div
        style={{
          marginBottom: 12,
          padding: '10px',
          border: '1px solid #3498db',
          backgroundColor: '#e9f5fe',
          borderRadius: '4px',
        }}
      >
        <strong style={{ marginRight: 10 }}>
          ยอดรายรับรวมใน {rows.length} วัน:
        </strong>
        <span style={{ fontWeight: 'bold', color: '#2980b9' }}>
          {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
          บาท
        </span>
      </div>

      <div
        style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: '10px' }}
      >
        <label style={{ marginRight: 8 }}>วันที่เริ่มต้น:</label>
        <input
          type="date"
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          value={range.from}
          onChange={e => setRange(p => ({ ...p, from: e.target.value }))}
        />
        <span style={{ margin: '0 8px' }}>ถึง</span>
        <input
          type="date"
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          value={range.to}
          onChange={e => setRange(p => ({ ...p, to: e.target.value }))}
        />
      </div>

      <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f4f4f4' }}>
            <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>
              วันที่
            </th>
            <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>
              รายรับ (บาท)
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td style={{ padding: '10px', textAlign: 'center' }} colSpan={2}>
                ไม่มีข้อมูลรายรับใน {range.from} ถึง {range.to}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={r._date || i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                  {r._date || '-'}
                </td>
                <td
                  style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}
                >
                  {Number(r.total || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
