import React, { useEffect, useState } from "react";
import http from "../../services/http"; // ⬅ เปลี่ยนมาใช้ services/http

export default function PaymentsPending() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await http.get("/api/admin/payments/pending");
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  async function approve(proofId) {
    await http.patch(`/api/admin/payment-proofs/${proofId}/approve`);
    setItems(prev => prev.filter(x => x.proof_id !== proofId));
  }

  async function reject(proofId) {
    const reason = window.prompt("เหตุผลที่ปฏิเสธสลิป:", "ข้อมูลไม่ชัดเจน");
    if (reason === null) return; // กดยกเลิก
    await http.patch(`/api/admin/payment-proofs/${proofId}/reject`, { reason });
    setItems(prev => prev.filter(x => x.proof_id !== proofId));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-4">กำลังโหลด…</div>;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">สลิปที่รออนุมัติ</h2>
      {items.length === 0 ? (
        <div>ไม่มีรายการรออนุมัติ</div>
      ) : (
        <ul className="space-y-3">
          {items.map(it => (
            <li key={it.proof_id} className="border rounded p-3">
              <div className="text-sm text-gray-500">
                Invoice #{it.invoice_id} — สถานะ: {it.status} — ยอด: {Number(it.amount).toLocaleString()} บาท
              </div>
              {it.file_path ? (
                <div className="mt-2">
                  <img
                    alt="payment proof"
                    src={it.file_path.startsWith("/uploads") ? it.file_path : `/uploads/${it.file_path}`}
                    style={{ maxWidth: 360, maxHeight: 360, objectFit: "contain", borderRadius: 8 }}
                  />
                </div>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => approve(it.proof_id)}
                  className="px-3 py-1 rounded bg-green-600 text-white"
                >
                  อนุมัติ
                </button>
                <button
                  onClick={() => reject(it.proof_id)}
                  className="px-3 py-1 rounded bg-red-600 text-white"
                >
                  ปฏิเสธ
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button onClick={load} className="px-3 py-1 rounded border">รีเฟรช</button>
    </div>
  );
}
