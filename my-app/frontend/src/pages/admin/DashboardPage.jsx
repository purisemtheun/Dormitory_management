// frontend/src/pages/admin/DashboardPage.jsx
import { useEffect, useMemo, useState } from "react";
import { dashboardApi } from "../../services/dashboard.api";
import { AlertTriangle, UserRound } from "lucide-react";

const MONTHS_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr("");
        setLoading(true);

        // บางโปรเจกต์ dashboardApi.get() คืน response.data
        // บางโปรเจกต์คืน { data: ... } — ทำให้ robust รองรับทั้งคู่
        const res = await dashboardApi.get();
        const payload =
          res && typeof res === "object"
            ? (res.data ?? res)       // ถ้ามี .data เอา .data, ถ้าไม่มีก็เอา res
            : null;

        if (alive) setData(payload);
      } catch (e) {
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          "โหลดข้อมูลไม่สำเร็จ";
        setErr(msg);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const fmtMoney = (n) =>
    Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const year = data?.year ?? new Date().getFullYear();

  const maxRevenue   = useMemo(() => Math.max(...(data?.revenue_by_month || [0]), 1), [data]);
  const maxInvAmount = useMemo(() => Math.max(...(data?.invoices_amount_by_month || [0]), 1), [data]);
  const maxInvCount  = useMemo(() => Math.max(...(data?.invoices_count_by_month || [0]), 1), [data]);

  return (
    <div className="dash">
      {/* Header */}
      <div className="dash__head">
        <h1>ภาพรวมระบบ (Dashboard)</h1>
        <span className="pill">สรุปรายปี {year}</span>
      </div>

      {/* Alerts */}
      {err && (
        <div className="alert">
          <div className="alert__bar" />
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{err}</span>
            {String(err).includes("502") && (
              <span className="text-slate-500">
                • ตรวจสอบเซิร์ฟเวอร์ หรือค่า <code>REACT_APP_API*</code> ใน .env
              </span>
            )}
          </div>
        </div>
      )}
      {loading && <div className="panel">กำลังโหลด…</div>}

      {!loading && data && (
        <>
          {/* Stats */}
          <section className="stats">
            <Stat title="ห้องทั้งหมด"           value={data.rooms_total ?? 0}                         icon="🏠" tone="indigo" />
            <Stat title="ผู้เช่าทั้งหมด"         value={data.tenants_total ?? 0}                       icon="👥" tone="violet" />
            <Stat title="บิลค้าง/รอดำเนินการ"    value={data.invoices_open ?? 0}                       icon="🧾" tone="amber" />
            <Stat title="ยอดค้างรวม (บาท)"       value={fmtMoney(data.outstanding_total)}              icon="💰" tone="emerald" />
            <Stat title="คำขอชำระค้างตรวจ"       value={data.payments_pending ?? 0}                    icon="✅" tone="sky" />
            <Stat title="รายได้เดือนนี้ (บาท)"    value={fmtMoney(data.revenue_this_month)}             icon="📈" tone="pink" />
            <Stat title="บิลที่ออกเดือนนี้"       value={data.invoices_this_month?.count ?? 0}          icon="📄" tone="purple" />
            <Stat title="ยอดบิลเดือนนี้ (บาท)"    value={fmtMoney(data.invoices_this_month?.amount)}    icon="💳" tone="yellow" />
          </section>

          {/* Charts */}
          <section className="grid-3">
            <ChartBlock title="รายได้ต่อเดือน (บาท)">
              <Bars
                values={data.revenue_by_month || []}
                max={maxRevenue}
                labels={MONTHS_TH}
                format={fmtMoney}
                barColor="linear-gradient(180deg, rgba(59,130,246,.95), rgba(37,99,235,.9))"
              />
            </ChartBlock>

            <ChartBlock title="ยอดบิลที่ออกต่อเดือน (บาท)">
              <Bars
                values={data.invoices_amount_by_month || []}
                max={maxInvAmount}
                labels={MONTHS_TH}
                format={fmtMoney}
                barColor="linear-gradient(180deg, rgba(139,92,246,.95), rgba(99,102,241,.9))"
              />
            </ChartBlock>

            <ChartBlock title="จำนวนบิลต่อเดือน (ฉบับ)">
              <Bars
                values={data.invoices_count_by_month || []}
                max={maxInvCount}
                labels={MONTHS_TH}
                format={(v) => `${v}`}
                barColor="linear-gradient(180deg, rgba(16,185,129,.95), rgba(5,150,105,.9))"
              />
            </ChartBlock>
          </section>

          {/* Top 5 Debtors */}
          <section className="grid-1">
            <ChartBlock title="ลูกหนี้สูงสุด (Top 5)">
              <TopDebtors list={Array.isArray(data.top_debtors) ? data.top_debtors : []} fmtMoney={fmtMoney} />
            </ChartBlock>
          </section>
        </>
      )}

      <style>{styles}</style>
    </div>
  );
}

/* ============== Components ============== */
function Stat({ title, value, icon, tone = "indigo" }) {
  const tints = {
    indigo: ["#eef2ff", "#c7d2fe", "#3730a3"],
    violet: ["#f5f3ff", "#e9d5ff", "#6d28d9"],
    amber:  ["#fffbeb", "#fde68a", "#92400e"],
    emerald:["#ecfdf5", "#a7f3d0", "#065f46"],
    sky:    ["#f0f9ff", "#bae6fd", "#075985"],
    pink:   ["#fdf2f8", "#fbcfe8", "#9d174d"],
    purple: ["#f5f3ff", "#ddd6fe", "#5b21b6"],
    yellow: ["#fefce8", "#fef08a", "#92400e"],
  }[tone];

  return (
    <div className="stat">
      <div className="stat__badge" style={{ background: `linear-gradient(135deg, ${tints[1]}, ${tints[2]} )` }}>
        <span className="stat__icon">{icon}</span>
      </div>
      <div className="stat__meta">
        <div className="stat__title">{title}</div>
        <div className="stat__value">{value}</div>
      </div>
    </div>
  );
}

function ChartBlock({ title, children }) {
  return (
    <div className="panel panel--tint">
      <div className="panel__title">{title}</div>
      {children}
    </div>
  );
}

function Bars({ values = [], max = 1, labels = [], format = (v) => v, barColor }) {
  const safe = Array.isArray(values) ? values : [];
  const total = safe.reduce((s, n) => s + Number(n || 0), 0);
  return (
    <>
      <div className="bars">
        {safe.map((v, i) => {
          const h = Math.max(2, Math.round((Number(v || 0) / max) * 136));
          return (
            <div key={i} className="bar" title={`${labels[i] ?? ""}: ${format(v)}`}>
              <div className="bar__rect" style={{ height: h, background: barColor }} />
              <div className="bar__label">{labels[i] ?? ""}</div>
            </div>
          );
        })}
      </div>
      <div className="bars__total">รวมปี: {format(total)}</div>
    </>
  );
}

function TopDebtors({ list = [], fmtMoney }) {
  const top = (Array.isArray(list) ? list : []).slice(0, 5);
  if (top.length === 0) return <div className="empty">— ไม่มีข้อมูลลูกหนี้ —</div>;

  return (
    <ul className="debtor">
      {top.map((r, idx) => (
        <li key={r.tenant_id ?? idx} className="debtor__item">
          <div className="debtor__left">
            <div className="debtor__avatar"><UserRound size={18} /></div>
            <div className="debtor__info">
              <div className="debtor__name">{r.tenant_name || "ไม่ระบุชื่อ"}</div>
              <div className="debtor__sub">
                <span className="debtor__chip">ห้อง {r.room_no ?? "-"}</span>
                <span className="debtor__dot">•</span>
                <span className="debtor__due">
                  ครบกำหนดล่าสุด: {r.last_due ? new Date(r.last_due).toLocaleDateString() : "-"}
                </span>
              </div>
            </div>
          </div>
          <div className="debtor__amt">{fmtMoney(r.outstanding)}</div>
        </li>
      ))}
    </ul>
  );
}

/* ============== Styles ============== */
const styles = `
:root{
  --bg: #f6f8fb;
  --surface: #ffffff;
  --line: #e5e7eb;
  --muted: #6b7280;
  --title: #0f172a;
  --shadow: 0 8px 22px rgba(2,6,23,.06);
}

.dash{
  background:
    radial-gradient(1200px 600px at -10% -10%, #eef2ff 0%, transparent 35%),
    radial-gradient(900px 500px at 110% 0%, #ecfdf5 0%, transparent 40%),
    radial-gradient(900px 500px at 100% 120%, #fff7ed 0%, transparent 35%),
    var(--bg);
  border-radius: 14px;
  padding: 8px;
}

.dash__head{
  display:flex; align-items:center; gap:10px;
  margin: 6px 0 10px;
}
.dash__head h1{ margin:0; font-weight:900; font-size:1.45rem; color:var(--title); letter-spacing:.2px; }
.pill{
  background:#e3e8ff; color:#1f2937;
  border:1px solid #c7d2fe; border-radius:999px;
  padding:.2rem .6rem; font-size:.78rem; font-weight:700;
}

.alert{ display:flex; gap:10px; align-items:center; background:#fff1f2; border:1px solid #fecdd3; border-radius:12px; padding:10px 12px; margin-bottom:10px; box-shadow:var(--shadow); }
.alert__bar{ width:6px; align-self:stretch; background:#ef4444; border-radius:6px; }

.stats{
  display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap:10px; margin-bottom:10px;
}
.stat{
  display:flex; gap:12px; align-items:center;
  background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:12px;
  box-shadow: var(--shadow);
}
.stat__badge{
  width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; color:white;
}
.stat__icon{ font-size:22px; transform: translateY(-1px); }
.stat__meta{ display:flex; flex-direction:column; }
.stat__title{ font-size:.88rem; color:#4b5563; }
.stat__value{ font-weight:900; font-size:1.28rem; color:#111827; }

.panel{
  background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:12px;
  box-shadow: var(--shadow);
}
.panel--tint{
  background: linear-gradient(180deg, #ffffff, #fbfbfd);
}
.panel__title{ font-weight:900; margin-bottom:6px; color:#111827; }

.grid-3{ display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:10px; margin-bottom:10px; }
.grid-1{ display:grid; grid-template-columns: 1fr; }

.bars{
  display:flex; align-items:flex-end; gap:8px; height:160px;
  margin-top:6px; padding:10px;
  background:linear-gradient(180deg,#f8fafc, #f3f4f6); border-radius:10px; border:1px dashed #e2e8f0;
}
.bar{ flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; gap:6px; }
.bar__rect{ width:100%; border-radius:8px; box-shadow: 0 4px 10px rgba(15,23,42,.12); transition:height .2s ease; }
.bar__label{ margin-top:6px; font-size:.75rem; color:#64748b; }
.bars__total{ margin-top:6px; font-size:.84rem; color:#475569; }

.debtor{ list-style:none; padding:0; margin:4px 0 0; display:flex; flex-direction:column; gap:8px; }
.debtor__item{
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  background:linear-gradient(180deg,#ffffff,#fbfbfd);
  border:1px solid var(--line); border-radius:12px; padding:10px 12px;
}
.debtor__left{ display:flex; align-items:center; gap:10px; min-width:0; }
.debtor__avatar{ width:34px; height:34px; border-radius:999px; background:#e5e7eb; color:#334155; display:flex; align-items:center; justify-content:center; }
.debtor__info{ display:flex; flex-direction:column; min-width:0; }
.debtor__name{ font-weight:800; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.debtor__sub{ font-size:.8rem; color:var(--muted); display:flex; gap:8px; align-items:center; }
.debtor__chip{ background:#eef2ff; color:#3730a3; border-radius:999px; padding:.08rem .45rem; border:1px solid #c7d2fe; }
.debtor__dot{ opacity:.6; }
.debtor__due{ white-space:nowrap; }
.debtor__amt{ font-weight:900; color:#0f172a; white-space:nowrap; }

.empty{ text-align:center; color:#6b7280; padding:18px 0; }
`;
