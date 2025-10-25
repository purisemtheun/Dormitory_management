// src/components/reports/PaymentsTable.jsx

import React, { useMemo } from 'react';

export default function PaymentsTable({ data, range, setRange }) {
  const items = Array.isArray(data) ? data : [];
  
  // คำนวณสรุปยอดรวม
  const totalPaid = useMemo(() => {
    return items.reduce((sum, p) => sum + (Number(p.amount || p.total || 0)), 0);
  }, [items]);
  
  return (
    <div>
      <div style={{marginBottom: 12, padding: '10px', border: '1px solid #2ecc71', backgroundColor: '#e8f8f0', borderRadius: '4px'}}>
        <strong style={{marginRight: 10}}>ยอดชำระเงินรวม:</strong>
        <span style={{fontWeight: 'bold', color: '#27ae60'}}>{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
      </div>
      
      <div style={{marginBottom: 12, display: 'flex', alignItems: 'center', gap: '10px'}}>
        <label style={{marginRight: 8}}>วันที่เริ่มต้น:</label>
        <input
          type="date"
          style={{padding: '8px', border: '1px solid #ccc', borderRadius: '4px'}}
          value={range.from}
          onChange={e => setRange(p => ({...p, from: e.target.value}))}
        />
        <span style={{margin: "0 8px"}}>ถึง</span>
        <input
          type="date"
          style={{padding: '8px', border: '1px solid #ccc', borderRadius: '4px'}}
          value={range.to}
          onChange={e => setRange(p => ({...p, to: e.target.value}))}
        />
      </div>

      <table className="table" style={{width: '100%', borderCollapse: 'collapse'}}>
        <thead>
          <tr style={{backgroundColor: '#f4f4f4'}}>
            <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'left'}}>วันที่ชำระ</th>
            <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'left'}}>ห้อง</th>
            <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'left'}}>เลขที่บิล</th>
            <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>จำนวนเงิน (บาท)</th>
            <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'left'}}>ผู้ชำระ</th>
            <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'left'}}>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td style={{padding: '10px', textAlign: 'center'}} colSpan={6}>ไม่พบรายการชำระเงินในรอบนี้</td></tr>
          ) : items.map((p, i) => (
            <tr key={i} style={{borderBottom: '1px solid #eee'}}>
              <td style={{padding: '10px', border: '1px solid #ddd'}}>{p.paid_at ? p.paid_at.slice(0, 10) : p.date}</td>
              <td style={{padding: '10px', border: '1px solid #ddd'}}>{p.room_id}</td>
              <td style={{padding: '10px', border: '1px solid #ddd'}}>{p.invoice_no || p.invoiceNo}</td>
              <td style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>{Number(p.amount || p.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td style={{padding: '10px', border: '1px solid #ddd'}}>{p.tenant_name || p.payer || p.tenant_id}</td>
              <td style={{padding: '10px', border: '1px solid #ddd'}}>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}