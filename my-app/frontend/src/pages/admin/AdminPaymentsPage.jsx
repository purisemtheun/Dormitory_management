// frontend/src/pages/admin/AdminPaymentsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getToken } from "../../utils/auth";
import {
  CreditCard,
  Search as SearchIcon,
  CheckCircle,
  XCircle,
  ReceiptText,
  User,
  CalendarDays,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";

/* ===================== helper apis ===================== */
const api = {
  getPending: async () => {
    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const r = await fetch("/api/admin/invoices/pending", { headers, credentials: "include" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || "โหลดรายการไม่สำเร็จ");
    return Array.isArray(d) ? d : [];
  },
  decide: async (id, action) => {
    const token = getToken();
    const r = await fetch(`/api/admin/invoices/${id}/decision`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ action }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || "อัปเดตไม่สำเร็จ");
    return d;
  },
};

/* ===================== utils ===================== */
const fmtTHB = (v) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "-";
  try {
    return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(n);
  } catch {
    return n.toFixed(2);
  }
};

const ymToThai = (ym) => {
  if (!ym) return "-";
  const m = String(ym).replace(/[^0-9]/g, "");
  let year, month;
  if (m.length >= 6) {
    year = Number(m.slice(0, 4));
    month = Number(m.slice(4, 6));
  } else {
    const parts = String(ym).split(/[-/_.\s]+/);
    if (parts.length >= 2) {
      year = Number(parts[0]);
      month = Number(parts[1]);
    }
  }
  if (!year || !month) return ym;
  const thMonths = ["-","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${thMonths[month]} ${year + 543}`;
};

const isImage = (url = "") => /\.(png|jpe?g|webp|gif|bmp)$/i.test(url || "");
const normalizeUrl = (u = "") => { try { return u.includes("%25") ? decodeURIComponent(u) : u; } catch { return u; } };

/* ===================== page ===================== */
export default function AdminPaymentsPage() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [q, setQ] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      const data = await api.getPending();
      setItems(data);
    } catch (e) {
      setErr(e.message || "โหลดรายการไม่สำเร็จ");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((r) => {
      const name = String(r.tenant_name ?? `Tenant#${r.tenant_id ?? ""}`).toLowerCase();
      const room = String(r.tenant_room ?? r.room_no ?? "").toLowerCase();
      const ym = String(r.period_ym ?? r.billing_month ?? "").toLowerCase();
      return name.includes(s) || room.includes(s) || ym.includes(s);
    });
  }, [q, items]);

  const act = async (invoiceId, action) => {
    try {
      setBusyId(invoiceId);
      await api.decide(invoiceId, action);
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  // ==== tailwind UI (match AdminRoomManagePage) ====
  const badgeNode = (statusRaw) => {
    const s = String(statusRaw || "").toLowerCase();
    if (s === "paid" || s === "approved") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
          <CheckCircle className="w-3.5 h-3.5" /> อนุมัติแล้ว
        </span>
      );
    }
    if (s === "rejected") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
          <XCircle className="w-3.5 h-3.5" /> ปฏิเสธ
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <ReceiptText className="w-3.5 h-3.5" /> รอตรวจ
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">ตรวจสอบการชำระเงิน</h2>
            </div>
            <p className="text-slate-600 text-sm">ดูสลิป โอน–อนุมัติ–ปฏิเสธ การชำระของผู้เช่า</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/payments"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              title="ไปยังหน้าออกใบแจ้งหนี้ (ฟอร์ม)"
            >
              <ReceiptText className="w-4 h-4" />
              ออกใบแจ้งหนี้ (ฟอร์ม)
            </Link>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 
                         text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 
                         transition-all duration-200 shadow-lg shadow-indigo-200 font-medium"
              title="รีเฟรช"
            >
              <RefreshCw className="w-4 h-4" />
              รีเฟรช
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหา: ชื่อผู้เช่า / ห้อง / เดือน (YYYY-MM)"
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                         text-sm bg-white"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="sticky top-0 z-10 bg-indigo-700 border-b border-indigo-800">
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">ลำดับ</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">ผู้เช่า</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">ห้อง</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">งวด</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-white">ยอดชำระ</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">หลักฐาน</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">สถานะ</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-white">จัดการ</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-500">กำลังโหลดรายการ…</td>
                </tr>
              ) : err ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-rose-600">{err}</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-500">– ไม่มีรายการรอตรวจสอบ –</td>
                </tr>
              ) : (
                filtered.map((row, idx) => {
                  const id = row.invoice_id ?? row.bill_id ?? row.id ?? `${idx}`;
                  const name = row.tenant_name ?? `Tenant#${row.tenant_id ?? "-"}`;
                  const room = row.tenant_room ?? row.room_no ?? "-";
                  const ym = ymToThai(row.period_ym ?? row.billing_month);
                  const amount = fmtTHB(row.amount ?? row.total ?? row.rent);
                  const rawSlip = row.slip_abs || row.slip_url || row.slip || "";
                  const slip = normalizeUrl(rawSlip);
                  const status = row.status ?? "pending";

                  return (
                    <tr key={id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-600 text-sm">{idx + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-800">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">{name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">{room}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-slate-400" />
                          <span>{ym}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-900">{amount}</td>
                      <td className="px-6 py-4">
                        {slip ? (
                          isImage(slip) ? (
                            <a
                              href={slip}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2"
                              title="เปิดสลิป"
                            >
                              <ImageIcon className="w-4 h-4 text-slate-400" />
                              <img
                                src={slip}
                                alt="slip"
                                className="w-24 h-16 object-cover rounded-lg border border-slate-200"
                              />
                            </a>
                          ) : (
                            <a
                              href={slip}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-700 hover:underline"
                            >
                              เปิดไฟล์
                            </a>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-6 py-4">{badgeNode(status)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="px-3 py-2 text-sm rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            disabled={busyId === id}
                            onClick={() => act(id, "approve")}
                            title="อนุมัติการชำระเงิน"
                          >
                            <div className="inline-flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" />
                              อนุมัติ
                            </div>
                          </button>
                          <button
                            className="px-3 py-2 text-sm rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            disabled={busyId === id}
                            onClick={() => act(id, "reject")}
                            title="ปฏิเสธการชำระเงิน"
                          >
                            <div className="inline-flex items-center gap-1">
                              <XCircle className="w-4 h-4" />
                              ปฏิเสธ
                            </div>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
