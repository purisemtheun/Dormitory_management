// src/pages/admin/AdminInvoiceCreatePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getToken } from "../../utils/auth";
import { FileSpreadsheet, CalendarDays, UserCircle2 } from "lucide-react";

/* ========= tiny utils ========= */
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const baht = (n) =>
  typeof n === "number"
    ? n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n;
const toDate = (s) => (s ? String(s).slice(0, 10) : "-");

/* ========= API helpers (defensive fetch) ========= */
async function fetchJSON(input, init) {
  const r = await fetch(input, init);
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!r.ok) {
    throw new Error(
      (data && (data.error || data.message)) || `HTTP ${r.status} ${r.statusText}`
    );
  }
  return data;
}

const api = {
  getTenants: () =>
    fetchJSON("/api/admin/tenants", {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then((a) => (Array.isArray(a) ? a : [])),

  listInvoices: (limit = 10) =>
    fetchJSON(`/api/admin/invoices?limit=${limit}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then((a) => (Array.isArray(a) ? a : [])),

  createInvoice: (payload) =>
    fetchJSON("/api/admin/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(payload),
    }),
};

/* ========= view helpers ========= */
const statusView = (inv) => {
  const raw = String(inv?.status || "").toLowerCase();
  if (raw !== "paid" && inv?.slip_url) {
    return { label: "รอดำเนินการ", className: "bg-amber-50 text-amber-700 ring-amber-200" };
  }
  if (raw === "paid") {
    return { label: "ชำระแล้ว", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  }
  return { label: "รอผู้เช่าชำระ", className: "bg-indigo-50 text-indigo-700 ring-indigo-200" };
};

export default function AdminInvoiceCreatePage() {
  /* ---------- page state ---------- */
  const [tenants, setTenants] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState("");

  /* ---------- form state ---------- */
  const [tenantId, setTenantId] = useState("");
  const [periodYm, setPeriodYm] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [rent, setRent] = useState("");
  const [water, setWater] = useState("");
  const [elec, setElec] = useState("");

  /* ---------- derived total (no setState; avoid loops) ---------- */
  const total = useMemo(() => num(rent) + num(water) + num(elec), [rent, water, elec]);

  /* ---------- initial load (safe) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setFormErr("");
        const [ts, invs] = await Promise.all([api.getTenants(), api.listInvoices(10)]);
        if (!alive) return;

        const okTenants = (ts || []).filter((t) => (t.is_deleted ?? 0) === 0);
        setTenants(okTenants);

        const sorted = [...(invs || [])].sort((a, b) => {
          const ax = new Date(a?.created_at || a?.updated_at || 0).getTime();
          const bx = new Date(b?.created_at || b?.updated_at || 0).getTime();
          return bx - ax;
        });
        setRecent(sorted.slice(0, 3));
      } catch (e) {
        if (alive) setFormErr(e.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ---------- submit ---------- */
  const submitOne = async (e) => {
    e.preventDefault();
    if (busy) return;

    const amt = num(total);
    if (!tenantId || !periodYm || !dueDate || !(amt > 0)) {
      alert("กรอกให้ครบและถูกต้อง: ผู้เช่า / เดือนงวด / กำหนดชำระ / ยอดรวม (> 0)");
      return;
    }

    const payload = {
      tenant_id: String(tenantId).trim(),     // ส่งเป็น tenant_id ตรง ๆ
      period_ym: String(periodYm).trim(),
      due_date: String(dueDate).slice(0, 10),
      rent_amount: num(rent),
      water_amount: num(water),
      electric_amount: num(elec),
      amount: amt,                            // ให้ backend ใช้รายงานเดิมได้ต่อ
    };

    try {
      setBusy(true);
      setFormErr("");
      await api.createInvoice(payload);
      alert("ออกใบแจ้งหนี้สำเร็จ");

      // reset form
      setTenantId("");
      setPeriodYm("");
      setDueDate("");
      setRent("");
      setWater("");
      setElec("");

      // refresh recent
      const invs = await api.listInvoices(10);
      const sorted = [...(invs || [])].sort((a, b) => {
        const ax = new Date(a?.created_at || a?.updated_at || 0).getTime();
        const bx = new Date(b?.created_at || b?.updated_at || 0).getTime();
        return bx - ax;
      });
      setRecent(sorted.slice(0, 3));
    } catch (e2) {
      setFormErr(e2.message || "ออกใบแจ้งหนี้ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const tenantNameMap = useMemo(() => {
    const m = new Map();
    tenants.forEach((t) => {
      m.set(String(t.tenant_id), t.fullname || t.name || `ผู้เช่า ${t.tenant_id}`);
    });
    return m;
  }, [tenants]);

  const roomLabel = (r) => r.room_no || r.room_number || r.room_id || "-";

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-6 space-y-5">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
              <FileSpreadsheet size={20} />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-slate-800">ออกใบแจ้งหนี้</h2>
              <p className="text-sm text-slate-500">
                ออกใบแจ้งหนี้รายบุคคล — กำหนดเดือนงวด แยกรายการ (ค่าเช่า/ค่าน้ำ/ค่าไฟ) และคำนวณยอดรวมอัตโนมัติ
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
          <div className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3.5">
            <FileSpreadsheet size={18} className="opacity-90" />
            <span className="font-medium text-base">ฟอร์มออกใบแจ้งหนี้</span>
          </div>

          <form onSubmit={submitOne} className="p-6 sm:p-7 space-y-5">
            {formErr && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {formErr}
              </div>
            )}

            {/* ผู้เช่า */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">ผู้เช่า</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <UserCircle2 size={18} />
                </span>
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  disabled={loading || busy}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 h-11 text-sm sm:text-base
                             focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 outline-none
                             disabled:bg-slate-50 disabled:text-slate-500"
                >
                  <option value="">— เลือกผู้เช่า —</option>
                  {tenants.map((t) => (
                    <option key={t.tenant_id} value={t.tenant_id}>
                      {(t.fullname || t.name || `ผู้เช่า ${t.tenant_id}`)} — ห้อง {roomLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-500">ระบบจะแนบใบแจ้งหนี้กับรหัสผู้เช่าที่เลือก</p>
            </div>

            {/* เดือนงวด & กำหนดชำระ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">เดือนงวด (YYYY-MM)</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <CalendarDays size={18} />
                  </span>
                  <input
                    type="month"
                    placeholder="2025-11"
                    value={periodYm}
                    onChange={(e) => setPeriodYm(e.target.value)}
                    disabled={busy}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 h-11 text-sm sm:text-base
                               focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 outline-none
                               disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">กำหนดชำระ</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <CalendarDays size={18} />
                  </span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    disabled={busy}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 h-11 text-sm sm:text-base
                               focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 outline-none
                               disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>
            </div>

            {/* ยอดแยก */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">ค่าเช่า (บาท)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="เช่น 3000.00"
                  value={rent}
                  onChange={(e) => setRent(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 h-11 text-sm sm:text-base
                             focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 outline-none
                             disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">ค่าน้ำ (บาท)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="เช่น 150.00"
                  value={water}
                  onChange={(e) => setWater(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 h-11 text-sm sm:text-base
                             focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 outline-none
                             disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">ค่าไฟ (บาท)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="เช่น 450.00"
                  value={elec}
                  onChange={(e) => setElec(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 h-11 text-sm sm:text-base
                             focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 outline-none
                             disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>

            {/* ยอดรวม (อ่านอย่างเดียว) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">ยอดรวม (บาท)</label>
              <input
                readOnly
                value={baht(total)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 h-11 text-base font-semibold text-slate-800"
              />
              <p className="text-xs text-slate-500">ระบบจะบันทึกยอดรวมนี้ลงในช่อง amount ของใบแจ้งหนี้</p>
            </div>

            <div className="pt-1.5">
              <button
                type="submit"
                disabled={busy || loading}
                className="w-full h-12 rounded-xl bg-indigo-600 text-white text-sm sm:text-base font-semibold
                           shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "กำลังบันทึก..." : "ออกใบแจ้งหนี้"}
              </button>
            </div>
          </form>
        </div>

        {/* ประวัติล่าสุด */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-3.5 bg-green-600 text-white border-b border-green-900/40">
            <FileSpreadsheet size={18} className="text-white/90" />
            <span className="font-medium text-base">ประวัติออกใบแจ้งหนี้ล่าสุด</span>
            <span className="text-xs text-white/80">แสดง 3 รายการล่าสุดที่เพิ่งออก</span>
          </div>

          {recent.length === 0 ? (
            <div className="px-6 py-7 text-sm text-slate-500">ยังไม่มีข้อมูล</div>
          ) : (
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {recent.map((r, idx) => {
                const st = statusView(r);
                const name = tenantNameMap.get(String(r.tenant_id)) || r.tenant_id || "-";
                const key = r.id ?? r.invoice_id ?? r.invoice_no ?? `${r.tenant_id}-${r.period_ym}-${idx}`;

                const showLine = (label, val) =>
                  num(val) > 0 ? <span className="mr-2">{label} {baht(num(val))}</span> : null;

                return (
                  <div key={key} className="rounded-xl border border-slate-200 p-4 hover:shadow-sm transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">
                            {r.invoice_no || "—"}
                          </span>
                          <span className={`text-[11px] px-2 py-1 rounded-full ring-1 ${st.className}`}>
                            {st.label}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          ผู้เช่า: {name} · ห้อง {roomLabel(r)}
                        </div>
                        <div className="text-xs text-slate-500">
                          งวด {r.period_ym || "-"} · กำหนด {toDate(r.due_date)}
                        </div>
                        {(r.rent_amount || r.water_amount || r.electric_amount) && (
                          <div className="text-xs text-slate-500 mt-1">
                            {showLine("ค่าเช่า", r.rent_amount)}
                            {showLine("ค่าน้ำ", r.water_amount)}
                            {showLine("ค่าไฟ", r.electric_amount)}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-800">
                          ฿ {baht(num(r.amount))}
                        </div>
                        <div className="text-[11px] text-slate-400">{toDate(r.created_at)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-xs text-slate-400 px-1">
          เมื่อผู้เช่าอัปโหลดสลิป ระบบจะแสดงสถานะ “รอดำเนินการ” จนกว่าแอดมินจะตรวจสอบและอนุมัติการชำระเงิน
        </div>
      </div>
    </div>
  );
}
