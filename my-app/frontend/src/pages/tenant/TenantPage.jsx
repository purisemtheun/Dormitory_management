import React from "react";
import { Link } from "react-router-dom";
import TenantNavbar from "../../components/nav/TenantNavbar";
import LogoutButton from "../../components/nav/LogoutButton";

export default function TenantPage() {
  return (
    <div className="tn-shell">
      <TenantNavbar />
      <main className="tn-container">
        <h1 className="tn-title">เมนูผู้เช่า</h1>
        <p className="muted">เลือกเมนูที่ต้องการทำรายการ</p>

        <div className="tn-grid">
          <Link to="/tenant/room" className="tn-tile">
            <div className="tn-ico" aria-hidden>
              {/* ห้องพัก */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M4 11h16v9H4z" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6"/>
              </svg>
            </div>
            <div className="tn-txt">
              <h3>ข้อมูลห้องพัก</h3>
              <p className="muted">ดูเลขห้อง สัญญา และรายละเอียดห้อง</p>
            </div>
          </Link>

          <Link to="/tenant/repairs" className="tn-tile">
            <div className="tn-ico" aria-hidden>
              {/* แจ้งซ่อม */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="m3 21 6-6" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M14 3a4 4 0 0 0 5 5l-9 9-5-5 9-9z" stroke="currentColor" strokeWidth="1.6"/>
              </svg>
            </div>
            <div className="tn-txt">
              <h3>แจ้งซ่อม / ประวัติ</h3>
              <p className="muted">ส่งคำขอใหม่และติดตามสถานะย้อนหลัง</p>
            </div>
          </Link>
                        


          <Link to="/tenant/payments" className="tn-tile">
            <div className="tn-ico" aria-hidden>
              {/* การเงิน */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6"/>
                <circle cx="16.5" cy="14" r="1.6" fill="currentColor"/>
              </svg>
            </div>
            <div className="tn-txt">
              <h3>ข้อมูลชำระเงิน</h3>
              <p className="muted">ดูบิล ค่าใช้จ่าย และสถานะการชำระ</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
