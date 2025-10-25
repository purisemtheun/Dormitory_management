import React, { useMemo } from 'react';

const fmtDate = (v) => {
  if (!v) return '';
  try {
    // รองรับทั้ง '2025-10-25T00:00:00.000Z' และ '2025-10-25'
    const d = new Date(v);
    if (Number.isNaN(+d)) return String(v).slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return String(v).slice(0, 10);
  }
};

const statusTH = (s) => {
  if (!s) return '';
  const m = {
    approved: 'ชำระเสร็จสิ้น',
    paid: 'ชำระเสร็จสิ้น',
    unpaid: 'ยังไม่ชำระ',
    pending: 'รอตรวจสอบ',
    rejected: 'ถูกปฏิเสธ',
    overdue: 'เกินกำหนด',
    partial: 'ชำระบางส่วน',
  };
  return m[s] || s;
};

export default function PaymentsTable({ data, range, setRange }) {
  const items = Array.isArray(data) ? data : [];

  const totalPaid = useMemo(() => {
    return items.reduce(
      (sum, p) => sum + Number(p.amount ?? p.total ?? p.amount_paid ?? 0),
      0
    );
  }, [items]);

  return (
    <div>
      <div style={{marginBottom: 12, padding: '10px', border: '1px solid #2ecc71', backgroundColor: '#e8f8f0', borderRadius: 4}}>
        <strong style={{marginRight: 10}}>ยอดชำระเงินรวม:</strong>
        <span style={{fontWeight: 'bold', color: '#27ae60'}}>
          {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
        </span>
      </div>

      <div style={{marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10}}>
        <label>วันที่เริ่มต้น:</label>
        <input
          type="date"
          value={range.from}
          onChange={e => setRange(p => ({ ...p, from: e.target.value }))}
          style={{padding: 8, border: '1px solid #ccc', borderRadius: 4}}
        />
        <span>ถึง</span>
        <input
          type="date"
          value={range.to}
          onChange={e => setRange(p => ({ ...p, to: e.target.value }))}
          style={{padding: 8, border: '1px solid #ccc', borderRadius: 4}}
        />
      </div>

      <table className="table" style={{width: '100%', borderCollapse: 'collapse'}}>
        <thead>
          <tr style={{backgroundColor: '#f4f4f4'}}>
            <th style={{padding: 10, border: '1px solid #ddd', textAlign: 'left'}}>วันที่ชำระ</th>
            <th style={{padding: 10, border: '1px solid #ddd', textAlign: 'left'}}>ห้อง</th>
            <th style={{padding: 10, border: '1px solid #ddd', textAlign: 'left'}}>เลขที่บิล</th>
            <th style={{padding: 10, border: '1px solid #ddd', textAlign: 'right'}}>จำนวนเงิน (บาท)</th>
            <th style={{padding: 10, border: '1px solid #ddd', textAlign: 'left'}}>ผู้ชำระ</th>
            <th style={{padding: 10, border: '1px solid #ddd', textAlign: 'left'}}>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={6} style={{padding: 10, textAlign: 'center'}}>ไม่พบรายการชำระเงินในรอบนี้</td>
            </tr>
          ) : items.map((p, i) => {
              const paidDate = p.paid_at || p.payment_date || p.date || p.paidAt;
              const room =
                p.room_no || p.room_number || p.roomNo || p.room || p.room_id || p.roomId || '';
              const invoiceNo =
                p.invoice_no || p.invoiceNo || p.invoice_id || p.invoiceId || p.bill_no || '';
              const amount = Number(p.amount ?? p.total ?? p.amount_paid ?? 0);
              const payer =
                p.payer_name || p.tenant_name || p.fullname || p.name || p.tenant_fullname || p.payer || p.tenant_id || '';
              const rawStatus =
                p.payment_status || p.pay_status || p.status || p.invoice_status || '';
              return (
                <tr key={i} style={{borderBottom: '1px solid #eee'}}>
                  <td style={{padding: 10, border: '1px solid #ddd'}}>{fmtDate(paidDate)}</td>
                  <td style={{padding: 10, border: '1px solid #ddd'}}>{room}</td>
                  <td style={{padding: 10, border: '1px solid #ddd'}}>{invoiceNo}</td>
                  <td style={{padding: 10, border: '1px solid #ddd', textAlign: 'right'}}>
                    {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{padding: 10, border: '1px solid #ddd'}}>{payer}</td>
                  <td style={{padding: 10, border: '1px solid #ddd'}}>{statusTH(rawStatus)}</td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
