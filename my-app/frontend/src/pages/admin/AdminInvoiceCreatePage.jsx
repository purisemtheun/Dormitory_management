import React, { useEffect, useState } from "react";
import { getToken } from "../../utils/auth";

/* ===== API helpers ===== */
const api = {
  getTenants: async () => {
    const r = await fetch("/api/admin/tenants", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || "โหลดผู้เช่าไม่สำเร็จ");
    return Array.isArray(d) ? d : [];
  },
  createInvoice: async (payload) => {
    const r = await fetch("/api/admin/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || "ออกใบแจ้งหนี้ไม่สำเร็จ");
    return d;
  },
};

export default function AdminInvoiceCreatePage() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // form state
  const [tenantId, setTenantId] = useState("");
  const [periodYm, setPeriodYm] = useState(""); // YYYY-MM
  const [dueDate, setDueDate] = useState("");   // YYYY-MM-DD
  const [amount, setAmount] = useState("");     // string input
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const list = await api.getTenants();
        setTenants(list.filter((t) => (t.is_deleted ?? 0) === 0));
      } catch (e) {
        setErr(e.message || "โหลดผู้เช่าไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const submitOne = async (e) => {
    e.preventDefault();

    const amt = Number(amount);
    if (!tenantId || !periodYm || !dueDate || !amt || amt <= 0) {
      return alert("กรอกให้ครบและถูกต้อง: ผู้เช่า / เดือนงวด / กำหนดชำระ / ยอดเงิน (> 0)");
    }

    // safety: ตัดช่องว่าง, รูปแบบวันที่
    const payload = {
      tenant_id: String(tenantId).trim(),   // ← ส่งเป็น string ตรงสคีมา
      period_ym: String(periodYm).trim(),   // YYYY-MM
      amount: amt,                          // number
      due_date: String(dueDate).slice(0, 10), // YYYY-MM-DD
    };

    try {
      setBusy(true);
      setErr("");
      await api.createInvoice(payload);
      alert("ออกใบแจ้งหนี้สำเร็จ");
      setTenantId("");
      setPeriodYm("");
      setAmount("");
      setDueDate("");
    } catch (e2) {
      setErr(e2.message || "ออกใบแจ้งหนี้ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  // ---- UI ----
  const pageBg = { background: "#f8fafc", minHeight: "calc(100vh - 80px)" };
  const wrap = { maxWidth: 900, margin: "24px auto", padding: 16 };
  const card = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    boxShadow: "0 6px 16px rgba(0,0,0,0.05)",
    padding: 16,
  };
  const label = { display: "block", fontWeight: 700, marginBottom: 6 };
  const input = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" };
  const row2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };

  return (
    <div style={pageBg}>
      <div style={wrap}>
        <h2 style={{ marginTop: 0 }}>ออกใบแจ้งหนี้รายบุคคล</h2>

        {err && <p style={{ color: "#b91c1c", marginTop: 0 }}>{err}</p>}

        <section style={card}>
          <form onSubmit={submitOne}>
            <div style={{ marginBottom: 12 }}>
              <label style={label}>ผู้เช่า</label>
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                style={input}
                disabled={loading || busy}
              >
                <option value="">— เลือกผู้เช่า —</option>
                {tenants.map((t) => (
                  <option key={t.tenant_id} value={t.tenant_id}>
                    {(t.full_name || t.name || `ผู้เช่า ${t.tenant_id}`)} — ห้อง {t.room_no || t.room_id || "-"}
                  </option>
                ))}
              </select>
            </div>

            <div style={row2}>
              <div>
                <label style={label}>เดือนงวด (YYYY-MM)</label>
                <input
                  type="month"                        // ← บังคับฟอร์แมต
                  placeholder="2025-11"
                  value={periodYm}
                  onChange={(e) => setPeriodYm(e.target.value)}
                  style={input}
                  disabled={busy}
                />
              </div>
              <div>
                <label style={label}>กำหนดชำระ</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={input}
                  disabled={busy}
                />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={label}>ยอดเงิน (บาท)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="เช่น 3000.00"         // ← แค่ตัวอย่าง ไม่เติมค่า
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={input}
                disabled={busy}
                required
              />
            </div>

            <button
              type="submit"
              disabled={busy || loading}
              style={{
                marginTop: 16,
                width: "100%",
                height: 44,
                borderRadius: 12,
                fontWeight: 800,
                background: "#4f46e5",
                color: "#fff",
                border: "none",
              }}
            >
              {busy ? "กำลังบันทึก..." : "ออกใบแจ้งหนี้"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
