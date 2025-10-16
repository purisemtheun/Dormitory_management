// frontend/src/pages/admin/DashboardPage.jsx
import { useEffect, useState, useMemo } from 'react';
import { dashboardApi } from '../../services/dashboard.api';

const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await dashboardApi.get();
        setData(res?.data || null);
        setErr('');
      } catch (e) {
        setErr(e?.response?.data?.message || e.message || 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fmtMoney = (n) =>
    Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const maxRevenue = useMemo(() => Math.max(...(data?.revenue_by_month || [0]), 1), [data]);
  const maxInvAmount = useMemo(() => Math.max(...(data?.invoices_amount_by_month || [0]), 1), [data]);
  const maxInvCount = useMemo(() => Math.max(...(data?.invoices_count_by_month || [0]), 1), [data]);

  return (
    <div className="ad-main">
      <div className="ad-header">
        <h1 style={{ fontWeight: 800, fontSize: '1.5rem' }}>ภาพรวมระบบ (Dashboard)</h1>
      </div>

      {err && (
        <div style={{ marginBottom: 12, padding: 12, borderLeft: '4px solid #ef4444', background: '#fff1f2' }}>
          {err}
        </div>
      )}

      {loading && <div className="ad-panel">กำลังโหลด…</div>}

      {!loading && data && (
        <>
          {/* ===== Summary Cards (สีสันสดใส) ===== */}
          <div className="sum-grid">
            <SummaryCard
              title="ห้องทั้งหมด"
              value={data.rooms_total}
              gradient="linear-gradient(135deg,#7dd3fc,#2563eb)"
              icon="🏠"
            />
            <SummaryCard
              title="ผู้เช่าทั้งหมด"
              value={data.tenants_total}
              gradient="linear-gradient(135deg,#fca5a5,#ef4444)"
              icon="👥"
            />
            <SummaryCard
              title="บิลค้าง/รอดำเนินการ"
              value={data.invoices_open}
              gradient="linear-gradient(135deg,#fde68a,#f59e0b)"
              icon="🧾"
            />
            <SummaryCard
              title="ยอดค้างรวม (บาท)"
              value={fmtMoney(data.outstanding_total)}
              gradient="linear-gradient(135deg,#a7f3d0,#10b981)"
              icon="💰"
            />
            <SummaryCard
              title="คำขอชำระค้างตรวจ"
              value={data.payments_pending}
              gradient="linear-gradient(135deg,#c7d2fe,#6366f1)"
              icon="✅"
            />
            <SummaryCard
              title="รายได้เดือนนี้ (บาท)"
              value={fmtMoney(data.revenue_this_month)}
              gradient="linear-gradient(135deg,#fbcfe8,#db2777)"
              icon="📈"
            />
            <SummaryCard
              title="บิลที่ออกเดือนนี้"
              value={data.invoices_this_month?.count ?? 0}
              gradient="linear-gradient(135deg,#ddd6fe,#7c3aed)"
              icon="📄"
            />
            <SummaryCard
              title="ยอดบิลเดือนนี้ (บาท)"
              value={fmtMoney(data.invoices_this_month?.amount)}
              gradient="linear-gradient(135deg,#fef08a,#eab308)"
              icon="💳"
            />
          </div>

          {/* ===== Yearly section ===== */}
          <div className="ad-panel" style={{ marginTop: 12 }}>
            <div className="ad-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>สรุปรายปี {data.year}</span>
              <span className="chip">ใหม่</span>
            </div>

            <div className="year-grid">
              <ChartBlock title="รายได้ต่อเดือน (บาท)">
                <Bars
                  values={data.revenue_by_month}
                  max={maxRevenue}
                  labels={MONTHS_TH}
                  format={(v) => fmtMoney(v)}
                />
              </ChartBlock>

              <ChartBlock title="ยอดบิลที่ออกต่อเดือน (บาท)">
                <Bars
                  values={data.invoices_amount_by_month}
                  max={maxInvAmount}
                  labels={MONTHS_TH}
                  format={(v) => fmtMoney(v)}
                />
              </ChartBlock>

              <ChartBlock title="จำนวนบิลต่อเดือน (ฉบับ)">
                <Bars
                  values={data.invoices_count_by_month}
                  max={maxInvCount}
                  labels={MONTHS_TH}
                  format={(v) => `${v}`}
                />
              </ChartBlock>
            </div>
          </div>

          <div className="ad-grid-2" style={{ marginTop: 12 }}>
            {/* Top debtors */}
            <section className="ad-panel">
              <div className="ad-panel-title">ลูกหนี้สูงสุด (Top 5)</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>ผู้เช่า</th>
                      <th>ห้อง</th>
                      <th style={{ textAlign: 'right' }}>ยอดค้าง</th>
                      <th>ครบกำหนดล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_debtors?.length ? (
                      data.top_debtors.map((r) => (
                        <tr key={r.tenant_id}>
                          <td>{r.tenant_name}</td>
                          <td>{r.room_no}</td>
                          <td style={{ textAlign: 'right' }}>{fmtMoney(r.outstanding)}</td>
                          <td>{r.last_due ? new Date(r.last_due).toLocaleDateString() : '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', color: 'var(--gray-500)' }}>
                          ไม่มีข้อมูล
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Recent payments (ย้ายจากเวอร์ชันก่อน: ตัดออกเพื่อโฟกัสสีสัน/รายปี)
                ถ้าต้องการกลับมาแสดง recent payments แจ้งได้ครับ */}
            <section className="ad-panel" style={{ background: 'linear-gradient(135deg,#e0e7ff,#f5f3ff)' }}>
              <div className="ad-panel-title">คำแนะนำ</div>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
                <li>ดู “ลูกหนี้สูงสุด” เพื่อเร่งติดตาม</li>
                <li>ตรวจ “รายได้ต่อเดือน” เทียบ “ยอดบิล” เพื่อประเมินการจ่ายจริง</li>
                <li>ดู “ยอดค้างรวม” และ “คำขอชำระค้างตรวจ” ทุกวัน</li>
              </ul>
            </section>
          </div>
        </>
      )}

      {/* ===== Inline styles เฉพาะหน้านี้ (ให้สีสันโดยไม่ต้องเพิ่มไลบรารี) ===== */}
      <style>{`
        .sum-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 12px;
          margin-bottom: 12px;
        }
        .sum-card {
          position: relative;
          overflow: hidden;
          border-radius: 14px;
          color: white;
          padding: 16px;
          box-shadow: 0 10px 24px rgba(0,0,0,.12);
        }
        .sum-card .icon {
          position: absolute;
          right: 12px;
          top: 10px;
          font-size: 26px;
          opacity: .8;
        }
        .sum-card .title {
          font-size: .9rem;
          opacity: .9;
        }
        .sum-card .value {
          font-weight: 900;
          font-size: 1.4rem;
          margin-top: 8px;
        }

        .chip {
          display:inline-block;
          background:#eab308;
          color:#1f2937;
          border-radius:999px;
          padding:.15rem .55rem;
          font-size:.75rem;
          font-weight:700;
        }

        .year-grid {
          display:grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 12px;
        }
        .chart-block {
          background:#fff;
          border:1px solid #e5e7eb;
          border-radius:12px;
          padding:12px;
        }
        .bars {
          display:flex; align-items:flex-end; gap:8px; height:160px;
          margin-top:10px; padding:10px; background:#f9fafb; border-radius:10px;
        }
        .bar {
          flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; gap:6px;
        }
        .bar .rect {
          width: 100%;
          border-radius:8px;
          background: linear-gradient(180deg, rgba(99,102,241,0.95), rgba(59,130,246,0.9));
          box-shadow: 0 4px 10px rgba(59,130,246,0.25);
          transition: height .2s ease;
        }
        .bar .label {
          margin-top:6px;
          font-size:.75rem;
          color:#6b7280;
        }
        .tip {
          font-size:.8rem; color:#475569;
        }
      `}</style>
    </div>
  );
}

/* ====== Small components ====== */
function SummaryCard({ title, value, gradient, icon }) {
  return (
    <div className="sum-card" style={{ background: gradient }}>
      <div className="icon">{icon}</div>
      <div className="title">{title}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function ChartBlock({ title, children }) {
  return (
    <div className="chart-block">
      <div style={{ fontWeight: 800, marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );
}

/** กราฟแท่งแบบไม่พึ่งไลบรารี */
function Bars({ values = [], max = 1, labels = [], format = (v)=>v }) {
  return (
    <>
      <div className="bars">
        {values.map((v, i) => {
          const h = Math.max(2, Math.round((Number(v || 0) / max) * 140)); // สูงสุด ~140px
          return (
            <div key={i} className="bar" title={`${labels[i] ?? ''}: ${format(v)}`}>
              <div className="rect" style={{ height: h }} />
              <div className="label">{labels[i] ?? ''}</div>
            </div>
          );
        })}
      </div>
      <div className="tip" style={{ marginTop: 6 }}>
        รวมปี: {format(values.reduce((s, n) => s + Number(n || 0), 0))}
      </div>
    </>
  );
}
