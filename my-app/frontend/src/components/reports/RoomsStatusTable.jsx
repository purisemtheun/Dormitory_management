import React, { useMemo, useState } from "react";
import {
  Search,
  ClipboardList,
  Home,
  Users,
  CircleCheckBig,
  Clock,
  ChevronDown,
} from "lucide-react";

/* ====== Safe helpers ====== */
const arr = (d) =>
  Array.isArray(d) ? d :
  Array.isArray(d?.rows) ? d.rows :
  Array.isArray(d?.data) ? d.data :
  Array.isArray(d?.items) ? d.items :
  Array.isArray(d?.result) ? d.result : [];

const getRoomId = (r = {}) =>
  String(r.room_id ?? r.roomId ?? r.room_code ?? r.roomCode ?? "").trim();
const getRoomNo = (r = {}) =>
  String(r.room_number ?? r.roomNumber ?? r.room_no ?? r.number ?? "").trim();

const guessRoomAny = (r = {}) => {
  const direct = [
    r.room, r.room_no, r.roomNo, r.room_code, r.roomCode, r.roomName,
    r.roomname, r.room_label, r.label
  ];
  for (const v of direct) if (v != null && v !== "") return String(v).trim();
  for (const [k, v] of Object.entries(r || {})) {
    if (!/(room|ห้อง)/i.test(k) || v == null) continue;
    if (typeof v === "string" || typeof v === "number") return String(v).trim();
    if (typeof v === "object") {
      const vv = v.room_id ?? v.room_number ?? v.id ?? v.code ?? v.number ?? v.name ?? v.no;
      if (vv != null && vv !== "") return String(vv).trim();
    }
  }
  return "";
};

const roomLabel = (r = {}) => {
  const id = getRoomId(r);
  const no = getRoomNo(r);
  if (id && no) return `${id} (${no})`;
  const any = guessRoomAny(r);
  return (id || no || any || "-");
};

const normalizeStatusKey = (s) => {
  const k = String(s || "").toLowerCase();
  if (k === "overdue") return "occupied";
  return k;
};

const statusTheme = {
  vacant:   { text: "ว่าง",     ring: "border-emerald-300", bg: "bg-emerald-50",  dot: "bg-emerald-500",  textColor: "text-emerald-900" },
  occupied: { text: "พักอยู่",   ring: "border-indigo-300",  bg: "bg-indigo-50",   dot: "bg-indigo-600",   textColor: "text-indigo-900" },
  pending:  { text: "รอเข้าพัก", ring: "border-amber-300",  bg: "bg-amber-50",    dot: "bg-amber-600",    textColor: "text-amber-900" },
};
const StatusBadge = ({ status }) => {
  const key = normalizeStatusKey(status);
  const th = statusTheme[key];
  if (!th) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-800 bg-slate-50">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> {status || "-"}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border ${th.ring} ${th.bg} ${th.textColor} px-3 py-1 text-xs font-medium`}>
      <span className={`h-1.5 w-1.5 rounded-full ${th.dot}`} />
      {th.text}
    </span>
  );
};

const roomComparator = (a, b) =>
  roomLabel(a).localeCompare(roomLabel(b), undefined, { numeric: true, sensitivity: "base" });

/* ====== Component ====== */
export default function RoomsStatusReport({ data }) {
  // รองรับรูปแบบ object / array ได้หมด
  const rows = useMemo(() => arr(data), [data]);

  const [q, setQ] = useState("");
  const [statusTab, setStatusTab] = useState("all"); // all | vacant | occupied | pending
  const [sortBy, setSortBy] = useState("room"); // room | tenant

  // KPI – ใช้ summary จาก backend ถ้ามี, ไม่มีก็คำนวณจากแถว
  const kpi = useMemo(() => {
    const fallbackCount = () => {
      const total    = rows.length;
      const vacant   = rows.filter(r => normalizeStatusKey(r.status || r.room_status) === "vacant").length;
      const occupied = rows.filter(r => normalizeStatusKey(r.status || r.room_status) === "occupied").length;
      const pending  = rows.filter(r => normalizeStatusKey(r.status || r.room_status) === "pending").length;
      return { total, vacant, occupied, pending };
    };

    // ลองอ่านจากหลายคีย์ที่มักใช้
    const s = data?.summary ?? data?.counts ?? data;
    const pickNum = (...keys) => {
      for (const k of keys) {
        const v = s?.[k];
        if (typeof v === "number" && !Number.isNaN(v)) return v;
      }
      return null;
    };

    if (s && typeof s === "object") {
      const total    = pickNum("total","total_rooms","rooms_total","count","roomsCount");
      const vacant   = pickNum("vacant","vacant_count","rooms_vacant");
      const occupied = pickNum("occupied","occupied_count","rooms_occupied");
      const pending  = pickNum("pending","pending_count","rooms_pending");
      const any = [total, vacant, occupied, pending].some(v => v != null);
      if (any) {
        return {
          total:    total    ?? rows.length,
          vacant:   vacant   ?? 0,
          occupied: occupied ?? 0,
          pending:  pending  ?? 0,
        };
      }
    }
    return fallbackCount();
  }, [data, rows]);

  // Filter/Sort
  const filtered = useMemo(() => {
    const base = [...rows].sort((a, b) => {
      if (sortBy === "tenant") {
        const A = String(a.tenant_name ?? a.tenant ?? "").toLowerCase();
        const B = String(b.tenant_name ?? b.tenant ?? "").toLowerCase();
        return A.localeCompare(B, undefined, { numeric: true, sensitivity: "base" }) || roomComparator(a, b);
      }
      return roomComparator(a, b);
    });

    const listByTab = base.filter((r) => {
      if (statusTab === "all") return true;
      return normalizeStatusKey(r.status ?? r.room_status) === statusTab;
    });

    const term = (q || "").trim().toLowerCase();
    if (!term) return listByTab;

    return listByTab.filter((r) => {
      const room = roomLabel(r).toLowerCase();
      const tenant = String(r.tenant_name ?? r.tenant ?? "-").toLowerCase();
      const sKey = normalizeStatusKey(r.status ?? r.room_status ?? "");
      const sTh  = sKey === "vacant" ? "ว่าง" : sKey === "occupied" ? "พักอยู่" : sKey === "pending" ? "รอเข้าพัก" : "";
      const isThai = (term === "ว่าง" && sKey === "vacant") || (term === "พักอยู่" && sKey === "occupied") || (term === "รอเข้าพัก" && sKey === "pending");
      return room.includes(term) || tenant.includes(term) || sTh.includes(term) || isThai;
    });
  }, [rows, statusTab, q, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border border-indigo-300 bg-indigo-50 flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-indigo-700" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">รายงานห้องพัก</h2>
              <p className="text-slate-600 text-sm mt-0.5">
                สรุปสถานะห้องแบบเรียลไทม์ • ค้นหา • เรียง • กรองสถานะ
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI title="ห้องทั้งหมด" value={kpi.total} icon={<Home />} tone="slate" />
        <KPI title="ว่าง" value={kpi.vacant} icon={<CircleCheckBig />} tone="emerald" />
        <KPI title="พักอยู่" value={kpi.occupied} icon={<Users />} tone="indigo" />
        <KPI title="รอเข้าพัก" value={kpi.pending} icon={<Clock />} tone="amber" />
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                className="w-full pl-10 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-100 text-[15px] placeholder:text-slate-400"
                placeholder="ค้นหา (A101, 101, ชื่อผู้เช่า, ว่าง/พักอยู่)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">เรียงตาม</span>
            <div className="relative">
              <select
                className="appearance-none pl-3 pr-9 py-2.5 rounded-lg border border-slate-300 text-[15px] focus:ring-2 focus:ring-indigo-500"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="room">เลขห้อง</option>
                <option value="tenant">ชื่อผู้เช่า</option>
              </select>
              <ChevronDown className="w-5 h-5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Pill active={statusTab === "all"} onClick={() => setStatusTab("all")} label="ทั้งหมด" tone="slate" />
          <Pill active={statusTab === "vacant"} onClick={() => setStatusTab("vacant")} label={`ว่าง (${kpi.vacant})`} tone="emerald" />
          <Pill active={statusTab === "occupied"} onClick={() => setStatusTab("occupied")} label={`พักอยู่ (${kpi.occupied})`} tone="indigo" />
          <Pill active={statusTab === "pending"} onClick={() => setStatusTab("pending")} label={`รอเข้าพัก (${kpi.pending})`} tone="amber" />
          <span className="ml-auto text-sm font-medium text-slate-600">
            แสดงผล {filtered.length} จาก {rows.length} ห้อง
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="sticky top-0 z-10 bg-indigo-900 text-white shadow-md">
                <Th className="text-left">ห้อง</Th>
                <Th className="text-left">สถานะ</Th>
                <Th className="text-left">ผู้เช่า</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length ? (
                filtered.map((r, i) => (
                  <tr key={i} className="hover:bg-indigo-50/30 transition-colors text-[16px]">
                    <td className="px-6 py-4 font-bold text-slate-900">{roomLabel(r)}</td>
                    <td className="px-6 py-4"><StatusBadge status={r.status || r.room_status} /></td>
                    <td className="px-6 py-4 text-slate-800">{r.tenant_name || r.tenant || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-16 text-center text-lg text-slate-500 bg-slate-50/50">
                    ไม่มีข้อมูลที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ====== tiny UI pieces ====== */
function KPI({ title, value, icon, tone = "slate" }) {
  const toneMap = {
    slate:   { text: "text-slate-700",   border: "border-slate-400",   bg: "bg-slate-50" },
    emerald: { text: "text-emerald-700", border: "border-emerald-400", bg: "bg-emerald-50" },
    indigo:  { text: "text-indigo-700",  border: "border-indigo-400",  bg: "bg-indigo-50" },
    amber:   { text: "text-amber-700",   border: "border-amber-400",   bg: "bg-amber-50" },
  };
  const th = toneMap[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 relative overflow-hidden transition-all duration-300 hover:shadow-lg">
      <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${th.border.replace('border', 'bg')}`} />
      <div className="pl-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 tracking-wide">{title}</p>
          <p className="mt-1 text-3xl font-extrabold text-slate-900">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-full ${th.bg} flex items-center justify-center`}>
          {React.cloneElement(icon, { className: `w-6 h-6 ${th.text}` })}
        </div>
      </div>
    </div>
  );
}
function Pill({ label, active, tone = "slate", onClick }) {
  const toneMap = {
    slate:   "border-slate-300 text-slate-800 data-[active=true]:bg-slate-700 data-[active=true]:text-white data-[active=true]:border-slate-700",
    emerald: "border-emerald-300 text-emerald-800 data-[active=true]:bg-emerald-600 data-[active=true]:text-white data-[active=true]:border-emerald-600",
    indigo:  "border-indigo-300 text-indigo-800 data-[active=true]:bg-indigo-600 data-[active=true]:text-white data-[active=true]:border-indigo-600",
    amber:   "border-amber-300 text-amber-800 data-[active=true]:bg-amber-600 data-[active=true]:text-white data-[active=true]:border-amber-600",
  };
  return (
    <button
      data-active={active || undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition bg-white hover:shadow-md ${toneMap[tone]}`}
    >
      {label}
    </button>
  );
}
function Th({ children, className = "" }) {
  return <th className={`px-6 py-3.5 text-base font-semibold ${className}`}>{children}</th>;
}