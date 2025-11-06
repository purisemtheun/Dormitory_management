import React, { useEffect, useMemo, useState } from "react";
import reportApi from "../../api/reports.api";
import {
  Home, Users, Clock, Search, RefreshCw, CheckCircle2, MinusCircle, AlertCircle
} from "lucide-react";

const theme = {
  VACANT:   { text: "ว่าง",     cls: "bg-emerald-50 text-emerald-700 border-emerald-300",  icon: CheckCircle2 },
  OCCUPIED: { text: "พักอยู่",  cls: "bg-indigo-50  text-indigo-700  border-indigo-300",   icon: Users },
  PENDING:  { text: "รอเข้าพัก", cls: "bg-amber-50   text-amber-700   border-amber-300",   icon: Clock },
  OVERDUE:  { text: "พักอยู่",  cls: "bg-indigo-50  text-indigo-700  border-indigo-300",   icon: Users }, // map overdue → occupied
};

export default function RoomsStatusPanel() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all"); // all | VACANT | OCCUPIED | PENDING
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await reportApi.roomsStatus();
      setRows(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("roomsStatus error", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const kpi = useMemo(() => {
    const total    = rows.length;
    const vacant   = rows.filter(r => (r.status || "").toUpperCase() === "VACANT").length;
    const occupied = rows.filter(r => ["OCCUPIED", "OVERDUE"].includes((r.status || "").toUpperCase())).length;
    const pending  = rows.filter(r => (r.status || "").toUpperCase() === "PENDING").length;
    return { total, vacant, occupied, pending };
  }, [rows]);

  const filtered = useMemo(() => {
    const list = rows.filter(r => {
      const s = (r.status || "").toUpperCase();
      if (tab === "all") return true;
      if (tab === "OCCUPIED") return s === "OCCUPIED" || s === "OVERDUE";
      return s === tab;
    });
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter(r =>
      String(r.roomNo ?? r.room_number ?? r.room ?? "").toLowerCase().includes(term) ||
      String(r.tenant ?? "").toLowerCase().includes(term) ||
      String(theme[(r.status || "").toUpperCase()]?.text ?? "").includes(term)
    );
  }, [rows, q, tab]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 inline-flex items-center justify-center">
              <Home className="w-6 h-6 text-indigo-600" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-800">รายงานห้องพัก</h2>
              <p className="text-slate-500 text-sm">สรุปสถานะห้องแบบเรียลไทม์ • ค้นหา • กรองสถานะ</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            title="โหลดใหม่"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            โหลดใหม่
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI title="ห้องทั้งหมด" value={kpi.total} icon={Home} accent="indigo" />
        <KPI title="ว่าง" value={kpi.vacant} icon={CheckCircle2} accent="emerald" />
        <KPI title="พักอยู่" value={kpi.occupied} icon={Users} accent="indigo" />
        <KPI title="รอเข้าพัก" value={kpi.pending} icon={Clock} accent="amber" />
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
          <input
            className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="ค้นหา (A101, 101, ผู้เช่า, ว่าง/พักอยู่)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Pill label={`ทั้งหมด (${kpi.total})`}    active={tab==="all"}       onClick={()=>setTab("all")}       icon={Home}/>
          <Pill label={`ว่าง (${kpi.vacant})`}      active={tab==="VACANT"}    onClick={()=>setTab("VACANT")}    icon={CheckCircle2}/>
          <Pill label={`พักอยู่ (${kpi.occupied})`} active={tab==="OCCUPIED"}  onClick={()=>setTab("OCCUPIED")}  icon={Users}/>
          <Pill label={`รอเข้าพัก (${kpi.pending})`} active={tab==="PENDING"} onClick={()=>setTab("PENDING")}   icon={Clock}/>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-indigo-700">
                <Th>ห้อง</Th>
                <Th>สถานะ</Th>
                <Th>ผู้เช่า</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <SkeletonRows />
              ) : filtered.length ? (
                filtered.map((r, i) => {
                  const statusKey = (r.status || "").toUpperCase();
                  const t = theme[statusKey] || { text: r.status || "-", cls: "bg-slate-50 text-slate-700 border-slate-300", icon: MinusCircle };
                  const Icon = t.icon || MinusCircle;
                  const room = String(r.roomNo ?? r.room_number ?? r.room ?? "-");
                  return (
                    <tr key={`${room}-${i}`} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-semibold">{room}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs ${t.cls}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {t.text}
                        </span>
                      </td>
                      <td className="px-6 py-3">{r.tenant || "-"}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-slate-500">
                    <div className="inline-flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      ไม่มีข้อมูล
                    </div>
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

function Th({children}) {
  return <th className="px-6 py-3 text-left text-sm font-semibold text-white">{children}</th>;
}

function Pill({label, active, onClick, icon:Icon}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full border text-sm inline-flex items-center gap-2 transition
        ${active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 hover:bg-slate-50"}`}
      type="button"
    >
      {Icon && <Icon className="w-4 h-4" />}
      {label}
    </button>
  );
}

function KPI({title, value, icon:Icon, accent="indigo"}) {
  const color = {
    indigo:  ["from-indigo-50 to-indigo-100","border-indigo-200","text-indigo-600","bg-indigo-500"],
    emerald: ["from-emerald-50 to-emerald-100","border-emerald-200","text-emerald-600","bg-emerald-500"],
    amber:   ["from-amber-50 to-amber-100","border-amber-200","text-amber-600","bg-amber-500"],
  }[accent] || ["from-slate-50 to-slate-100","border-slate-200","text-slate-600","bg-slate-500"];

  return (
    <div className={`rounded-xl p-4 border ${color[1]} bg-gradient-to-br ${color[0]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm ${color[2]} font-medium`}>{title}</p>
          <p className="text-3xl font-extrabold text-slate-900 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 ${color[3]} rounded-lg flex items-center justify-center shadow`}>
          {Icon && <Icon className="w-6 h-6 text-white" />}
        </div>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {[...Array(6)].map((_,i)=>(
        <tr key={i}>
          <td className="px-6 py-3">
            <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
          </td>
          <td className="px-6 py-3">
            <div className="h-6 w-24 bg-slate-200 rounded-full animate-pulse" />
          </td>
          <td className="px-6 py-3">
            <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
          </td>
        </tr>
      ))}
    </>
  );
}
