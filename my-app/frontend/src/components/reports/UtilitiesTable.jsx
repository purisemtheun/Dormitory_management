// src/components/reports/UtilitiesTable.jsx (ไฟล์ใหม่)

import React, { useMemo, useState } from 'react';

// Helper เพื่อสร้าง 'YYYY-MM' ของเดือนปัจจุบัน
const getCurrentPeriod = () => {
    return new Date().toISOString().slice(0, 7);
}

export default function UtilitiesTable({ data=[] }) {
    const [period, setPeriod] = useState(getCurrentPeriod()); // YYYY-MM
    
    // คำนวณสรุปหน่วยรวม
    const summary = useMemo(() => {
        return data.reduce((acc, item) => {
            acc.water_unit += (item.water_unit || 0);
            acc.electric_unit += (item.electric_unit || 0);
            acc.total_water_cost += (item.water_cost || 0);
            acc.total_electric_cost += (item.electric_cost || 0);
            return acc;
        }, { water_unit: 0, electric_unit: 0, total_water_cost: 0, total_electric_cost: 0 });
    }, [data]);

    return (
        <div>
            {/* Control */}
            <div style={{marginBottom: 15, display: 'flex', alignItems: 'center', gap: '10px'}}>
                <label style={{marginRight: 8}}>เลือกงวด (เดือน):</label>
                <input
                    type="month"
                    style={{padding: '8px', border: '1px solid #ccc', borderRadius: '4px'}}
                    value={period}
                    onChange={e => setPeriod(e.target.value)}
                />
            </div>
            
            {/* Summary */}
            <div style={{marginBottom: 20, padding: '15px', border: '1px solid #f39c12', backgroundColor: '#fef5e7', borderRadius: '4px'}}>
                <h4 style={{margin: '0 0 10px 0'}}>สรุปยอด {period}</h4>
                <p style={{margin: '5px 0'}}><strong>หน่วยน้ำรวม:</strong> {summary.water_unit.toLocaleString()} หน่วย ({summary.total_water_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท)</p>
                <p style={{margin: '5px 0'}}><strong>หน่วยไฟฟ้ารวม:</strong> {summary.electric_unit.toLocaleString()} หน่วย ({summary.total_electric_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท)</p>
            </div>

            {/* Table */}
            <table className="table" style={{width: '100%', borderCollapse: 'collapse'}}>
                <thead>
                    <tr style={{backgroundColor: '#f4f4f4'}}>
                        <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'left'}}>ห้อง</th>
                        <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>หน่วยน้ำ</th>
                        <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>ค่าน้ำ (บาท)</th>
                        <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>หน่วยไฟฟ้า</th>
                        <th style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>ค่าไฟฟ้า (บาท)</th>
                    </tr>
                </thead>
                <tbody>
                    {data.length === 0 ? (
                        <tr><td style={{padding: '10px', textAlign: 'center'}} colSpan={5}>ไม่พบข้อมูลค่าน้ำ/ค่าไฟสำหรับงวด {period}</td></tr>
                    ) : data.map((item, i) => (
                        <tr key={i} style={{borderBottom: '1px solid #eee'}}>
                            <td style={{padding: '10px', border: '1px solid #ddd'}}>{item.room_id}</td>
                            <td style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>{(item.water_unit || 0).toLocaleString()}</td>
                            <td style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>{(item.water_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>{(item.electric_unit || 0).toLocaleString()}</td>
                            <td style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>{(item.electric_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}