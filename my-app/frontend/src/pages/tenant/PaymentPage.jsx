import React from "react";
import TenantNavbar from "../../components/nav/TenantNavbar";

export default function PaymentsPage(){
  return (
    <div className="tn-shell">
      <TenantNavbar />
      <main className="tn-container">
        <h1 className="tn-title">ข้อมูลชำระเงิน</h1>
        <div className="card" style={{marginTop:12}}>
          <p className="muted">ยังไม่เชื่อม API — ภายหลังค่อยเพิ่มตารางบิล/สเตตัสการชำระ</p>
        </div>
      </main>
    </div>
  );
}
