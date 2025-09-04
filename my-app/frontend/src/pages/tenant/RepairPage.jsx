import React from "react";
import TenantNavbar from "../../components/nav/TenantNavbar";

export default function RepairsPage(){
  return (
    <div className="tn-shell">
      <TenantNavbar />
      <main className="tn-container">
        <h1 className="tn-title">แจ้งซ่อม / ประวัติแจ้งซ่อม</h1>
        <div className="card" style={{marginTop:12}}>
          <p className="muted">ยังไม่เชื่อม API — ภายหลังค่อยใส่ฟอร์มแจ้งซ่อมและตารางประวัติ</p>
        </div>
      </main>
    </div>
  );
}
