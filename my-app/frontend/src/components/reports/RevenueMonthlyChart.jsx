// src/components/reports/RevenueMonthlyChart.jsx

import React, { useMemo } from 'react';

export default function RevenueMonthlyChart({ data, months, setMonths }) {
  
  // คำนวณสรุปยอดรวม
  const totalRevenue = useMemo(() => {
    return data.reduce((sum, r) => sum + (Number(r.revenue || r.total || 0)), 0);
  }, [data]);
  
  return (
    <div>
      <div style={{marginBottom: 12, padding: '10px', border: '1px solid #3498db', backgroundColor: '#e9f5fe', borderRadius: '4px'}}>
        <strong style={{marginRight: 10}}>ยอดรายรับรวม {data.length} เดือน:</strong>
        <span style={{fontWeight: 'bold', color: '#2980b9'}}>{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
      </div>

      <div style={{marginBottom: 12}}>
        <label style={{marginRight: 8}}>จำนวนเดือนย้อนหลัง:</label>
        <input 
          type="number" 
          style={{padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '80px'}}
          min="1" 
          max="12"
          value={months}
          onChange={e => setMonths(e.target.value)}
        />
      </div>

      <table className="table" style={{width: '100%', borderCollapse: 'collapse'}}>
        <thead>
          <tr style={{backgroundColor: '#f4f4f4'}}>
            <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'left'}}>งวด (ปี-เดือน)</th>
            <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>รายรับ (บาท)</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td style={{padding: '10px', textAlign: 'center'}} colSpan={2}>ไม่มีข้อมูลรายรับในรอบนี้</td></tr>
          ) : data.map((r, i) => (
            <tr key={i} style={{borderBottom: '1px solid #eee'}}>
              <td style={{padding: '10px', border: '1px solid #ddd'}}>{r.month_label || r.period || r.month}</td>
              <td style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>{Number(r.revenue || r.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}