// src/pages/admin/AdminRepairManagement.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getToken } from "../../utils/auth";
import {
  Wrench,
  RefreshCw,
  Search as SearchIcon,
  Briefcase,
  XCircle,
  CheckCircle2,
} from "lucide-react";

/* ---------------- safe JSON ---------------- */
const safeJson = async (r) => {
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("application/json")) return r.json();
  const text = await r.text();
  throw new Error(text.slice(0, 300) || "Invalid response from server");
};

/* ---------------- API ---------------- */
const api = {
  listRepairs: async () => {
    const r = await fetch("/api/repairs", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const d = await safeJson(r);
    if (!r.ok) throw new Error(d?.error || "โหลดรายการซ่อมไม่สำเร็จ");
    return Array.isArray(d) ? d : [];
  },
  listTechnicians: async () => {
    const headers = { Authorization: `Bearer ${getToken()}` };
    const tryOnce = async (url) => {
      const r = await fetch(url, { headers });
      const d = await safeJson(r).catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || `GET ${url} failed`);
      const arr = Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []);
      return arr.map((x) => ({ id: x.id, name: x.name || `Tech#${x.id}` }));
    };
    try {
      return await tryOnce("/api/repairs/technicians");
    } catch {
      try {
        return await tryOnce("/api/technicians");
      } catch {
        return [];
      }
    }
  },
  assign: async (repairId, techId) => {
    const r = await fetch(`/api/repairs/${encodeURIComponent(repairId)}/assign`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ assigned_to: Number(techId) }),
    });
    const d = await safeJson(r).catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || d?.message || "มอบหมายงานไม่สำเร็จ");
    return d;
  },
  deleteRepair: async (repairId) => {
    const r = await fetch(`/api/repairs/${encodeURIComponent(repairId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const d = await safeJson(r).catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || "ลบงานไม่สำเร็จ");
    return d;
  },
};

/* ---------------- UI helpers ---------------- */
const statusMeta = (s) => {
  const k = String(s || "").toLowerCase();
  switch (k) {
    case "new":
      return { text: "รอดำเนินการ", cls: "bg-violet-50 text-violet-700 ring-violet-100" };
    case "assigned":
      return { text: "มอบหมายแล้ว", cls: "bg-green-50 text-green-700 ring-green-100" };
    case "in_progress":
      return { text: "กำลังดำเนินการ", cls: "bg-indigo-50 text-indigo-700 ring-indigo-100" };
    case "done":
      return { text: "เสร็จสิ้น", cls: "bg-emerald-50 text-emerald-700 ring-emerald-100" };
    case "rejected":
      return { text: "ปฏิเสธแล้ว", cls: "bg-rose-50 text-rose-700 ring-rose-100" };
    case "cancelled":
      return { text: "ยกเลิก", cls: "bg-slate-100 text-slate-700 ring-slate-200" };
    default:
      return { text: k || "-", cls: "bg-slate-100 text-slate-700 ring-slate-200" };
  }
};

const StatusBadge = ({ status }) => {
  const m = statusMeta(status);
  return (
    <span
      className={
        `inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 
         whitespace-nowrap ` + m.cls
      }
    >
      {m.text}
    </span>
  );
};

export default function AdminRepairManagement() {
  const [items, setItems] = useState([]);
  const [techs, setTechs] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [q, setQ] = useState("");
  const [assignSel, setAssignSel] = useState({});

  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      const [rps, tcs] = await Promise.all([api.listRepairs(), api.listTechnicians()]);
      setItems(rps);
      setTechs(tcs);
      const init = {};
      rps.forEach((r) => {
        const id = r.assigned_technician_id || r.assigned_to;
        if (id) init[r.repair_id] = id;
      });
      setAssignSel(init);
    } catch (e) {
      setErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
      setItems([]);
      setTechs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // ——— ดูได้อย่างเดียวเมื่อ assigned/in_progress/done ———
  const isAssignedOrMore = (r) => {
    const st = String(r.status || "").toLowerCase();
    return ["assigned", "in_progress", "done"].includes(st) ||
      !!(r.assigned_technician_id || r.assigned_to);
  };

  // ซ่อน DONE / CANCELLED / REJECTED
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = items.filter((r) => {
      const st = String(r.status || "").toLowerCase();
      return st !== "done" && st !== "cancelled" && st !== "rejected";
    });
    if (!s) return base;
    return base.filter((r) =>
      String(r.repair_id).toLowerCase().includes(s) ||
      String(r.title || "").toLowerCase().includes(s) ||
      String(r.room_id || "").toLowerCase().includes(s) ||
      String(r.technician_name || "").toLowerCase().includes(s)
    );
  }, [items, q]);

  const totalPages = Math.max(1, Math.min(10, Math.ceil(filtered.length / PAGE_SIZE)));
  const pageSafe = Math.min(Math.max(page, 1), totalPages);
  const paged = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

  const assign = async (rid) => {
    const techId = assignSel[rid];
    if (!techId) return alert("กรุณาเลือกช่างก่อนมอบหมาย");
    try {
      setBusyId(rid);
      await api.assign(rid, techId);
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (rid) => {
    if (!window.confirm("ยืนยันลบงานนี้ทิ้งถาวร?")) return;
    try {
      setBusyId(rid);
      await api.deleteRepair(rid);
      setItems((list) => list.filter((x) => x.repair_id !== rid));
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50">
      {/* ✨ ทำให้กว้างเท่าหน้าอื่น: 7xl + padding ใหญ่ขึ้น */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-6 space-y-5">

        {/* Header + Search */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 sm:p-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                <Wrench size={20} />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-slate-800">จัดการงานซ่อม</h2>
                <p className="text-sm text-slate-500">มอบหมายงานให้ช่าง / ปฏิเสธงานที่ไม่รับดำเนินการ</p>
              </div>
              <button
                onClick={load}
                className="inline-flex items-center gap-2 rounded-xl px-4 h-11 text-sm font-medium
                           bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
              >
                <RefreshCw size={18} /> รีเฟรช
              </button>
            </div>

            {/* Search input — ไอคอนจัดกึ่งกลางแนวตั้ง */}
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon size={18} />
              </span>
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                placeholder="ค้นหา: รหัส/หัวข้อ/ห้อง/ช่าง"
                className="w-full rounded-xl border border-slate-200 focus:border-indigo-300
                           focus:ring-4 focus:ring-indigo-100 outline-none pl-10 pr-3 h-11 text-sm sm:text-base
                           placeholder:text-slate-400"
              />
              <div className="mt-2 text-xs text-slate-500">
                แสดงงานที่ยังไม่เสร็จสิ้น (รอดำเนินการ / มอบหมายแล้ว / กำลังดำเนินการ)
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
          {loading && <div className="p-6 text-sm text-slate-500">กำลังโหลดรายการ…</div>}
          {!loading && err && <div className="p-6 text-sm text-rose-600">{err}</div>}
          {!loading && !err && filtered.length === 0 && <div className="p-6 text-sm text-slate-500">– ไม่มีรายการ –</div>}

          {!loading && !err && filtered.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-[1080px] w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-indigo-600 text-white text-xs uppercase tracking-wide">
                      <th className="text-left font-semibold px-4 py-3 border-b border-indigo-700/50 w-20">รหัส</th>
                      <th className="text-left font-semibold px-4 py-3 border-b border-indigo-700/50 w-[360px]">หัวข้อ / รายละเอียด</th>
                      <th className="text-left font-semibold px-4 py-3 border-b border-indigo-700/50 w-24">ห้อง</th>
                      <th className="text-left font-semibold px-4 py-3 border-b border-indigo-700/50 w-28">วันเดดไลน์</th>
                      <th className="text-left font-semibold px-4 py-3 border-b border-indigo-700/50 w-40">สถานะ</th>
                      <th className="text-left font-semibold px-4 py-3 border-b border-indigo-700/50 w-48">ช่างที่มอบหมาย</th>
                      <th className="text-left font-semibold px-4 py-3 border-b border-indigo-700/50 w-64">มอบหมายงาน</th>
                      <th className="text-left font-semibold px-4 py-3 border-b border-indigo-700/50 w-40">จัดการ</th>
                    </tr>
                  </thead>

                  <tbody className="text-sm text-slate-700">
                    {paged.map((r, idx) => {
                      const viewOnly = isAssignedOrMore(r);
                      return (
                        <tr key={r.repair_id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                          <td className="px-4 py-3 border-b border-slate-100 align-top">{r.repair_id}</td>

                          <td className="px-4 py-3 border-b border-slate-100 align-top">
                            <div className="font-medium text-slate-800">{r.title}</div>
                            {r.description && <div className="text-slate-500 text-xs mt-1">{r.description}</div>}
                            {r.image_url && (
                              <div className="mt-2">
                                <a
                                  href={encodeURI(r.image_url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-indigo-50 bg-indigo-600 hover:bg-indigo-700 inline-flex items-center
                                             rounded-md px-2 py-1 text-xs font-medium"
                                >
                                  ดูรูปแนบ
                                </a>
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 border-b border-slate-100 align-top">{r.room_id || "-"}</td>

                          <td className="px-4 py-3 border-b border-slate-100 align-top">
                            {r.due_date ? String(r.due_date).slice(0, 10) : "-"}
                          </td>

                          <td className="px-4 py-3 border-b border-slate-100 align-top">
                            <StatusBadge status={r.status} />
                          </td>

                          <td className="px-4 py-3 border-b border-slate-100 align-top">
                            {r.technician_name ||
                              (r.assigned_technician_id || r.assigned_to
                                ? `Tech#${r.assigned_technician_id || r.assigned_to}`
                                : "—")}
                          </td>

                          <td className="px-4 py-3 border-b border-slate-100 align-top">
                            <select
                              disabled={busyId === r.repair_id || loading || viewOnly}
                              value={assignSel[r.repair_id] ?? ""}
                              onChange={(e) =>
                                setAssignSel((s) => ({ ...s, [r.repair_id]: e.target.value }))
                              }
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 h-11 text-sm sm:text-base
                                         focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 outline-none
                                         disabled:bg-slate-50 disabled:text-slate-500"
                            >
                              {loading ? (
                                <option value="">— กำลังโหลดรายชื่อช่าง... —</option>
                              ) : techs.length === 0 ? (
                                <option value="">— ไม่มีช่าง —</option>
                              ) : (
                                <>
                                  <option value="">— เลือกช่าง —</option>
                                  {techs.map((t) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                  ))}
                                </>
                              )}
                            </select>
                          </td>

                          <td className="px-4 py-3 border-b border-slate-100 align-top">
                            <div className="flex items-center gap-2">
                              {!viewOnly ? (
                                <>
                                  <button
                                    onClick={() => assign(r.repair_id)}
                                    disabled={busyId === r.repair_id || techs.length === 0 || !assignSel[r.repair_id]}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl
                                               min-w-[110px] h-11 px-3 text-sm font-semibold
                                               bg-indigo-600 text-white shadow-sm hover:bg-indigo-700
                                               disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Briefcase size={16} /> มอบหมาย
                                  </button>
                                  {/* ปุ่มปฏิเสธแสดงเฉพาะตอนยังไม่มอบหมาย */}
                                  <button
                                    onClick={() => reject(r.repair_id)}
                                    disabled={busyId === r.repair_id}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl
                                               min-w-[90px] h-11 px-3 text-sm font-semibold
                                               bg-rose-600 text-white shadow-sm hover:bg-rose-700
                                               disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <XCircle size={16} /> ปฏิเสธ
                                  </button>
                                </>
                              ) : (
                                // View-only: แสดงป้ายมอบหมายแล้ว
                                <span className="inline-flex items-center gap-2 rounded-xl min-w-[130px] h-11 px-3 text-sm font-semibold
                 bg-green-50 text-green-700 ring-1 ring-green-100">
                                  <CheckCircle2 size={16} /> มอบหมายแล้ว
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-100">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pageSafe === 1}
                  className="rounded-xl px-4 h-10 text-sm bg-white text-slate-700 ring-1 ring-black/5
                             shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  ก่อนหน้า
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const n = i + 1;
                    const active = n === pageSafe ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50";
                    return (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={"min-w-9 h-9 rounded-xl px-3 text-sm font-medium ring-1 ring-black/5 " + active}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={pageSafe === totalPages}
                  className="rounded-xl px-4 h-10 text-sm bg-white text-slate-700 ring-1 ring-black/5
                             shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  ถัดไป
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
