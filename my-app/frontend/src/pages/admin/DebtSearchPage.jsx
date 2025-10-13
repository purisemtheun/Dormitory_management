import { useEffect, useMemo, useState } from 'react';
import { fetchDebtSummary, searchDebts } from '../../services/debtService';

const defaultFilters = {
  query: '',
  room: '',
  status: 'unpaid',
  minOverdue: 0,
  page: 1,
  limit: 20,
  sort: 'overdue_days:desc',
};

export default function DebtSearchPage() {
  const [filters, setFilters] = useState(defaultFilters);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDebtSummary()
      .then((res) => setSummary(res?.data?.data || null))
      .catch(() => setSummary(null));
  }, []);

  const load = async (override = {}) => {
    const params = { ...filters, ...override };
    setLoading(true);
    setError('');
    try {
      const { data } = await searchDebts(params);
      setRows(data?.data || []);
      setMeta({
        page: data?.page || 1,
        limit: data?.limit || params.limit,
        total: data?.total || 0,
      });
      setFilters(params);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
      setFirstLoadDone(true);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = useMemo(() => {
    if (!meta.total) return 1;
    return Math.max(1, Math.ceil(meta.total / meta.limit));
  }, [meta.total, meta.limit]);

  const gotoPage = (p) => {
    if (p < 1 || p > totalPages) return;
    load({ page: p });
  };

  const onSubmitSearch = (e) => {
    e?.preventDefault?.();
    load({ page: 1 });
  };

  const onClear = () => {
    setFilters(defaultFilters);
    load({ ...defaultFilters });
  };

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '-');
  const fmtMoney = (n) =>
    Number(n || 0).toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="ad-main">
      {/* Header */}
      <div className="ad-header">
        <h1 style={{ fontWeight: 800, fontSize: '1.4rem' }}>ค้นหาหนี้ผู้เช่า</h1>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 12 }}>
        <SummaryCard title="ผู้เช่าทั้งหมด" value={summary?.tenants_total ?? '-'} />
        <SummaryCard title="มียอดค้าง" value={summary?.tenants_debtors ?? '-'} />
        <SummaryCard title="ยอดค้างรวม" value={summary ? fmtMoney(summary.outstanding_total) : '-'} />
        <SummaryCard title="ยอดเกินกำหนด" value={summary ? fmtMoney(summary.overdue_total) : '-'} />
        <SummaryCard title="เกินกำหนดสูงสุด (วัน)" value={summary?.max_overdue_days ?? '-'} />
      </div>

      {/* Filters panel */}
      <div className="ad-panel" style={{ marginBottom: 12 }}>
        <form onSubmit={onSubmitSearch}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
            <Field label="ชื่อ/เบอร์โทร">
              <input
                className="input"
                placeholder="พิมพ์ชื่อหรือเบอร์"
                value={filters.query}
                onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              />
            </Field>
            <Field label="เลขห้อง">
              <input
                className="input"
                placeholder="เช่น A101"
                value={filters.room}
                onChange={(e) => setFilters((f) => ({ ...f, room: e.target.value }))}
              />
            </Field>
            <Field label="สถานะ">
              <select
                className="input"
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="">ทั้งหมด</option>
                <option value="unpaid">ค้างชำระ</option>
                <option value="partial">ค้างบางส่วน</option>
                <option value="cleared">เคลียร์แล้ว</option>
              </select>
            </Field>
            <Field label="เกินกำหนดขั้นต่ำ (วัน)">
              <input
                className="input"
                type="number"
                min="0"
                placeholder="0"
                value={filters.minOverdue}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, minOverdue: e.target.value ? Number(e.target.value) : 0 }))
                }
              />
            </Field>
            <Field label="เรียงตาม">
              <select
                className="input"
                value={filters.sort}
                onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}
              >
                <option value="overdue_days:desc">เกินกำหนดมากสุด</option>
                <option value="outstanding:desc">ยอดค้างมากสุด</option>
                <option value="last_due:asc">ใกล้ครบกำหนด</option>
                <option value="tenant_name:asc">ชื่อ (ก-ฮ)</option>
                <option value="room_no:asc">เลขห้อง</option>
              </select>
            </Field>
            <div style={{ display: 'flex', gap: 8, alignSelf: 'end' }}>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'กำลังค้นหา…' : 'ค้นหา'}
              </button>
              <button className="btn btn-outline" type="button" onClick={onClear} disabled={loading}>
                ล้าง
              </button>
            </div>
          </div>
        </form>
        {error && (
          <div style={{ marginTop: 10, padding: 12, borderLeft: '4px solid var(--red-500)', background: '#fff1f2' }}>
            {error}
          </div>
        )}
      </div>

      {/* Table panel */}
      <div className="ad-panel">
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>ผู้เช่า</th>
                <th>เบอร์โทร</th>
                <th>ห้อง</th>
                <th style={{ textAlign: 'right' }}>ยอดค้าง</th>
                <th>ครบกำหนดล่าสุด</th>
                <th style={{ textAlign: 'center' }}>เกินกำหนด (วัน)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && firstLoadDone && !loading && (
                <tr>
                  <td colSpan="7" style={{ padding: 16, textAlign: 'center', color: 'var(--gray-500)' }}>
                    ไม่พบข้อมูล
                  </td>
                </tr>
              )}

              {rows.map((r) => (
                <tr key={r.tenant_id}>
                  <td>{r.tenant_name}</td>
                  <td>{r.phone || '-'}</td>
                  <td>{r.room_no}</td>
                  <td style={{ textAlign: 'right' }}>{fmtMoney(r.outstanding)}</td>
                  <td>{fmtDate(r.last_due)}</td>
                  <td style={{ textAlign: 'center' }}>{r.overdue_days ?? 0}</td>
                  <td>
                    <a className="ad-sublink" href={`/admin/tenants/${r.tenant_id}`}>
                      ดูรายละเอียด
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <div style={{ marginRight: 'auto', color: 'var(--gray-500)', fontSize: '.9rem' }}>
            ทั้งหมด {meta.total} รายการ | หน้า {meta.page} / {totalPages}
          </div>

          <button
            className="btn"
            disabled={meta.page <= 1 || loading}
            onClick={() => gotoPage(meta.page - 1)}
          >
            ก่อนหน้า
          </button>

          <select
            className="input"
            style={{ width: 90 }}
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
            className="btn"
            disabled={meta.page >= totalPages || loading}
            onClick={() => gotoPage(meta.page + 1)}
          >
            ถัดไป
          </button>

          <select
            className="input"
            style={{ width: 110 }}
            value={meta.limit}
            onChange={(e) => load({ page: 1, limit: Number(e.target.value) })}
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
  );
}

/* ===== Small UI helpers (เข้ากับธีม) ===== */
function SummaryCard({ title, value }) {
  return (
    <div className="ad-panel" style={{ padding: 12 }}>
      <div style={{ fontSize: '.8rem', color: 'var(--gray-500)' }}>{title}</div>
      <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
