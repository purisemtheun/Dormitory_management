// src/components/reports/RevenueDailyChart.jsx

import React, { useMemo } from 'react';

export default function RevenueDailyChart({ data, range, setRange }) {
  
  // คำนวณสรุปยอดรวม
  const totalRevenue = useMemo(() => {
    return data.reduce((sum, r) => sum + (Number(r.revenue || r.total || 0)), 0);
  }, [data]);

  return (
    <div>
      <div style={{marginBottom: 12, padding: '10px', border: '1px solid #3498db', backgroundColor: '#e9f5fe', borderRadius: '4px'}}>
        <strong style={{marginRight: 10}}>ยอดรายรับรวมใน {data.length} วัน:</strong>
        <span style={{fontWeight: 'bold', color: '#2980b9'}}>{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
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
            <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'left'}}>วันที่</th>
            <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>รายรับ (บาท)</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td style={{padding: '10px', textAlign: 'center'}} colSpan={2}>ไม่มีข้อมูลรายรับใน {range.from} ถึง {range.to}</td></tr>
          ) : data.map((r, i) => (
            <tr key={i} style={{borderBottom: '1px solid #eee'}}>
              <td style={{padding: '10px', border: '1px solid #ddd'}}>{r.date}</td>
              <td style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>{Number(r.revenue || r.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}