// src/components/reports/DebtsTable.jsx

import React from "react";
// แก้ไข prop จาก items เป็น data
export default function DebtsTable({ data=[], asOf, setAsOf }) {
  const items = Array.isArray(data) ? data : [];
  
  return (
    <div>
      <div style={{marginBottom: 12, display: 'flex', alignItems: 'center', gap: '10px'}}>
        <label style={{marginRight: 8}}>ณ วันที่:</label>
        <input
          type="date"
          style={{padding: '8px', border: '1px solid #ccc', borderRadius: '4px'}}
          value={asOf}
          onChange={e => setAsOf(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table className="table" style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead style={{backgroundColor: '#f4f4f4'}}>
            <tr>
              <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'left'}}>ห้อง</th>
              <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'left'}}>ผู้เช่า</th>
              <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>ยอดค้าง (บาท)</th>
              <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>เกินกำหนด (วัน)</th>
              <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'left'}}>เลขที่ใบแจ้งหนี้</th>
            </tr>
          </thead>
          <tbody>
            {items.length===0 ? (
              <tr><td style={{padding: '10px', textAlign: 'center'}} className="empty" colSpan={5}>ไม่มีข้อมูลหนี้ค้างชำระ</td></tr>
            ) : items.map((x,i)=>(
              <tr className="tr" key={i} style={{borderBottom: '1px solid #eee'}}>
                <td style={{padding: '10px', border: '1px solid #ddd'}}>{x.roomNo || x.room_number || x.room_id}</td>
                <td style={{padding: '10px', border: '1px solid #ddd'}}>{x.tenant || x.tenant_name || "-"}</td>
                <td style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>{Number(x.amount||0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>{x.daysOverdue ?? x.days_overdue ?? "-"}</td>
                <td style={{padding: '10px', border: '1px solid #ddd'}}>{x.invoiceNo || x.invoice_no}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}