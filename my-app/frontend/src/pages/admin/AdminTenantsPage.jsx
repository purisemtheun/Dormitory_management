import React from "react";

export default function AdminTenantsPage() {
  return (
    <div>
      <div className="ad-header">
        <h2 style={{margin:0}}>ผู้เช่า</h2>
      </div>
      <div className="ad-panel">
        หน้านี้จะแสดงรายชื่อผู้เช่า (ชื่อ, อีเมล, เบอร์, ห้อง, วันที่เช็คอิน)
        <br/>เชื่อมต่อ API /api/admin/tenants ภายหลัง
      </div>
    </div>
  );
}