// frontend/src/pages/admin/AdminPaymentsPage.jsx
import React, { useEffect, useState } from "react";
import http from "../../services/http";

/**
 * หน้าจัดการอนุมัติการชำระเงินสำหรับแอดมิน
 * - โหลดรายการใบแจ้งหนี้ที่ status = 'pending'
 * - ดูสลิป (slip_url)
 * - อนุมัติ / ปฏิเสธ
 */
export default function AdminPaymentsPage() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null); // ใช้ disable ปุ่มของแถวนั้นๆ

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      const { data } = await http.get("/api/admin/invoices/pending");
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      const api = e?.response?.data;
      setErr(api?.error || "โหลดรายการไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const act = async (invoiceId, action) => {
    try {
      setBusyId(invoiceId);
      await http.patch(`/api/admin/invoices/${invoiceId}`, { action });
      await load();
    } catch (e) {
      const api = e?.response?.data;
      alert(api?.error || "อัปเดตไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="ad-header">
        <h1 className="tn-title">อนุมัติการชำระเงิน</h1>
        <button className="btn" onClick={load}>รีเฟรช</button>
      </div>

      <div className="ad-panel">
        {loading && <p className="muted">กำลังโหลดรายการ…</p>}
        {!loading && err && <p style={{ color: "#b91c1c" }}>{err}</p>}
        {!loading && !err && items.length === 0 && (
          <p className="muted">– ไม่มีรายการรอตรวจสอบ –</p>
        )}

        {!loading && !err && items.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  <th>ผู้เช่า</th>
                  <th>งวด (YYYY-MM)</th>
                  <th style={{ textAlign: "right" }}>ยอด (บาท)</th>
                  <th>ครบกำหนด</th>
                  <th>สลิป</th>
                  <th>สถานะ</th>
                  <th style={{ width: 240 }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {items.map(row => (
                  <tr key={row.invoice_id}>
                    <td>{row.invoice_id}</td>
                    <td>{row.tenant_id || "-"}</td>
                    <td>{row.period_ym || "-"}</td>
                    <td style={{ textAlign: "right" }}>
                      {Number(row.amount || 0).toLocaleString()}
                    </td>
                    <td>{row.due_date ? String(row.due_date).slice(0, 10) : "-"}</td>
                    <td>
                      {row.slip_url ? (
                        /\.png$|\.jpe?g$/i.test(row.slip_url) ? (
                          <a href={row.slip_url} target="_blank" rel="noreferrer">ดูสลิป</a>
                        ) : (
                          <a href={row.slip_url} target="_blank" rel="noreferrer">เปิดไฟล์</a>
                        )
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>{row.status}</td>
                    <td>
                      <button
                        className="btn"
                        disabled={busyId === row.invoice_id}
                        onClick={() => act(row.invoice_id, "approve")}
                        title="อนุมัติการชำระเงิน"
                      >
                        ✅ อนุมัติ
                      </button>{" "}
                      <button
                        className="btn btn-danger"
                        disabled={busyId === row.invoice_id}
                        onClick={() => act(row.invoice_id, "reject")}
                        title="ปฏิเสธ (ให้ผู้เช่าส่งใหม่)"
                      >
                        ❌ ปฏิเสธ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
