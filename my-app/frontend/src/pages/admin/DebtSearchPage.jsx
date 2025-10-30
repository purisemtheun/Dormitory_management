// frontend/src/pages/admin/DebtSearchPage.jsx
import { useEffect, useMemo, useState } from "react";
import { fetchDebtSummary, searchDebts } from "../../services/debtService";
import {
  Search as SearchIcon,
  RefreshCw,
  Users,
  AlertTriangle,
  Coins,
  Clock,
  Home,
  CalendarDays,
  Phone,
} from "lucide-react";

const defaultFilters = {
  query: "",
  room: "",
  status: "",          // '', 'unpaid', 'cleared'
  minOverdue: 0,
  page: 1,
  limit: 20,
  sort: "overdue_days:desc",
};

export default function DebtSearchPage() {
  const [filters, setFilters] = useState(defaultFilters);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [error, setError] = useState("");

  // ==== โหลดการ์ดสรุป (ใช้แหล่งเดียวกับตาราง) ====
  const loadSummary = async () => {
    try {
      const res = await fetchDebtSummary();
      setSummary(res?.data?.data || null);
    } catch {
      setSummary(null);
    }
  };

  // ==== โหลดตาราง ====
  const loadTable = async (override = {}) => {
    const params = { ...filters, ...override };
    setLoading(true);
    setError("");
    try {
      const { data } = await searchDebts(params);
      const list = Array.isArray(data) ? data : data?.data || [];
      const page = Array.isArray(data) ? 1 : data?.page ?? 1;
      const limit = Array.isArray(data) ? params.limit : data?.limit ?? params.limit;
      const total = Array.isArray(data) ? list.length : data?.total ?? list.length;

      setRows(list);
      setMeta({ page, limit, total });
      setFilters(params);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
      setFirstLoadDone(true);
    }
  };

  // โหลดครั้งแรก
  useEffect(() => {
    loadSummary();
    loadTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ปุ่มรีเฟรช = โหลดทั้งสรุป+ตาราง
  const refreshAll = () => {
    loadSummary();
    loadTable();
  };

  const totalPages = useMemo(() => {
    if (!meta.total) return 1;
    return Math.max(1, Math.ceil(meta.total / meta.limit));
  }, [meta.total, meta.limit]);

  const gotoPage = (p) => {
    if (p < 1 || p > totalPages) return;
    loadTable({ page: p });
  };

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "-");
  const fmtMoney = (n) =>
    Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">ค้นหาหนี้ผู้เช่า</h2>
              <p className="text-slate-600 text-sm">ดูภาพรวมยอดค้างและค้นหาผู้เช่าที่เกินกำหนด</p>
            </div>
          </div>
          <button
            onClick={refreshAll}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 
                       text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition-all
                       shadow-lg shadow-indigo-200 font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            รีเฟรช
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="ผู้เช่าทั้งหมด"
          value={summary?.tenants_total ?? "-"}
          icon={<Users className="w-6 h-6 text-indigo-600" />}
          bg="from-indigo-50 to-indigo-100"
          ring="border-indigo-200"
        />
        <StatCard
          title="มียอดค้าง"
          value={summary?.tenants_debtors ?? "-"}
          icon={<AlertTriangle className="w-6 h-6 text-amber-600" />}
          bg="from-amber-50 to-amber-100"
          ring="border-amber-200"
        />
        <StatCard
          title="ยอดค้างรวม"
          value={summary ? fmtMoney(summary.outstanding_total) : "-"}
          icon={<Coins className="w-6 h-6 text-emerald-600" />}
          bg="from-emerald-50 to-emerald-100"
          ring="border-emerald-200"
        />
        <StatCard
          title="ยอดเกินกำหนด"
          value={summary ? fmtMoney(summary.overdue_total) : "-"}
          icon={<Coins className="w-6 h-6 text-rose-600" />}
          bg="from-rose-50 to-rose-100"
          ring="border-rose-200"
        />
        <StatCard
          title="เกินกำหนดสูงสุด (วัน)"
          value={summary?.max_overdue_days ?? "-"}
          icon={<Clock className="w-6 h-6 text-sky-600" />}
          bg="from-sky-50 to-sky-100"
          ring="border-sky-200"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <form
          className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            loadTable({ page: 1 });
          }}
        >
          <Field label="ชื่อ / เบอร์โทร">
            <div className="relative">
              <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                placeholder="พิมพ์ชื่อหรือเบอร์"
                value={filters.query}
                onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && loadTable({ page: 1 })}
              />
            </div>
          </Field>

          <Field label="เลขห้อง">
            <div className="relative">
              <Home className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                placeholder="เช่น A101"
                value={filters.room}
                onChange={(e) => setFilters((f) => ({ ...f, room: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && loadTable({ page: 1 })}
              />
            </div>
          </Field>

          <Field label="สถานะ">
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              value={filters.status}
              onChange={(e) => {
                const value = e.target.value;
                setFilters((f) => ({ ...f, status: value, page: 1 }));
                loadTable({ status: value, page: 1 });
              }}
            >
              <option value="">ทั้งหมด</option>
              <option value="unpaid">ค้างชำระ</option>
              <option value="cleared">เคลียร์แล้ว</option>
            </select>
          </Field>

          <Field label="เกินกำหนดขั้นต่ำ (วัน)">
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              value={filters.minOverdue}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : 0;
                setFilters((f) => ({ ...f, minOverdue: value }));
              }}
              onBlur={() => loadTable({ page: 1 })}
            />
          </Field>

          <Field label="เรียงตาม">
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              value={filters.sort}
              onChange={(e) => {
                const value = e.target.value;
                setFilters((f) => ({ ...f, sort: value, page: 1 }));
                loadTable({ sort: value, page: 1 });
              }}
            >
              <option value="overdue_days:desc">เกินกำหนดมากสุด</option>
              <option value="outstanding:desc">ยอดค้างมากสุด</option>
              <option value="last_due:asc">ใกล้ครบกำหนด</option>
              <option value="tenant_name:asc">ชื่อ (ก-ฮ)</option>
              <option value="room_no:asc">เลขห้อง</option>
            </select>
          </Field>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 text-sm font-medium"
            >
              {loading ? "กำลังค้นหา…" : "ค้นหา"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setFilters(defaultFilters);
                loadTable({ ...defaultFilters });
              }}
              className="px-4 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition text-sm font-medium"
            >
              ล้าง
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="sticky top-0 z-10 bg-indigo-700 border-b border-indigo-800">
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">ผู้เช่า</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">เบอร์โทร</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">ห้อง</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-white">ยอดค้าง</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">ครบกำหนดล่าสุด</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-white">เกินกำหนด (วัน)</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {!rows.length && firstLoadDone && !loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={r.tenant_id ?? idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-800">{r.tenant_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span>{r.phone || "-"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{r.room_no}</td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900">
                      {fmtMoney(Number(r.outstanding ?? 0))}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-slate-400" />
                        <span>{fmtDate(r.last_due)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">{Number(r.overdue_days ?? 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-600">
            ทั้งหมด <span className="font-semibold">{meta.total}</span> รายการ | หน้า{" "}
            <span className="font-semibold">{meta.page}</span> /{" "}
            <span className="font-semibold">{totalPages}</span>
          </p>

          <div className="flex items-center gap-2">
            <button
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 font-medium disabled:opacity-50"
              disabled={meta.page <= 1 || loading}
              onClick={() => gotoPage(meta.page - 1)}
            >
              ก่อนหน้า
            </button>

            <select
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              value={meta.page}
              onChange={(e) => gotoPage(Number(e.target.value))}
              disabled={loading}
            >
              {Array.from({ length: totalPages }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>

            <button
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 font-medium disabled:opacity-50"
              disabled={meta.page >= totalPages || loading}
              onClick={() => gotoPage(meta.page + 1)}
            >
              ถัดไป
            </button>

            <select
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              value={meta.limit}
              onChange={(e) => loadTable({ page: 1, limit: Number(e.target.value) })}
              disabled={loading}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}/หน้า
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ small UI pieces ============ */
function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ title, value, icon, bg, ring }) {
  return (
    <div className={`bg-gradient-to-br ${bg} rounded-xl p-4 border ${ring}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-700">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow">
          {icon}
        </div>
      </div>
    </div>
  );
}
