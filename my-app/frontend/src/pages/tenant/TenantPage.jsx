import React from "react";
import { Link } from "react-router-dom";
import TenantNavbar from "../../components/nav/TenantNavbar";

export default function TenantPage() {
  return (
    <div className="min-h-screen bg-rose-50/40">
      <TenantNavbar />

      {/* container กว้าง อ่านง่าย */}
      <main className="max-w-6xl mx-auto px-6 sm:px-8 py-8">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-rose-900">
            เมนูผู้เช่า
          </h1>
          <p className="text-rose-700/80 text-base mt-1">
            เลือกเมนูที่ต้องการทำรายการ
          </p>
        </header>

        {/* cards ขนาดใหญ่ ไอคอนชัด โทนชมพู/ขาว */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <Link
            to="/tenant/room"
            className="group rounded-2xl bg-white border border-rose-100 shadow-sm hover:shadow-md transition
                       p-5 flex items-start gap-4"
          >
            <div
              className="shrink-0 h-12 w-12 rounded-xl grid place-items-center
                         bg-rose-100 text-rose-700 ring-1 ring-rose-200 group-hover:bg-rose-200"
              aria-hidden
            >
              {/* ห้องพัก */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M4 11h16v9H4z" stroke="currentColor" strokeWidth="1.8" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-rose-900">
                ข้อมูลห้องพัก
              </h3>
              <p className="text-rose-700/80 text-sm mt-1">
                ดูเลขห้อง สัญญา และรายละเอียดห้อง
              </p>
            </div>
          </Link>

          <Link
            to="/tenant/repairs"
            className="group rounded-2xl bg-white border border-rose-100 shadow-sm hover:shadow-md transition
                       p-5 flex items-start gap-4"
          >
            <div
              className="shrink-0 h-12 w-12 rounded-xl grid place-items-center
                         bg-rose-100 text-rose-700 ring-1 ring-rose-200 group-hover:bg-rose-200"
              aria-hidden
            >
              {/* แจ้งซ่อม */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="m3 21 6-6" stroke="currentColor" strokeWidth="1.8" />
                <path d="M14 3a4 4 0 0 0 5 5l-9 9-5-5 9-9z" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-rose-900">
                แจ้งซ่อม / ประวัติ
              </h3>
              <p className="text-rose-700/80 text-sm mt-1">
                ส่งคำขอใหม่และติดตามสถานะย้อนหลัง
              </p>
            </div>
          </Link>

          <Link
            to="/tenant/payments"
            className="group rounded-2xl bg-white border border-rose-100 shadow-sm hover:shadow-md transition
                       p-5 flex items-start gap-4"
          >
            <div
              className="shrink-0 h-12 w-12 rounded-xl grid place-items-center
                         bg-rose-100 text-rose-700 ring-1 ring-rose-200 group-hover:bg-rose-200"
              aria-hidden
            >
              {/* การเงิน */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="16.5" cy="14" r="1.8" fill="currentColor" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-rose-900">
                ข้อมูลชำระเงิน
              </h3>
              <p className="text-rose-700/80 text-sm mt-1">
                ดูบิล ค่าใช้จ่าย และสถานะการชำระ
              </p>
            </div>
          </Link>
        </section>
      </main>
    </div>
  );
}
