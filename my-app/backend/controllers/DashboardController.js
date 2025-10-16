// backend/controllers/dashboardController.js
const db = require('../config/db');

function firstDayOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function monthIndex(ym) {
  // ym: '2025-01' -> 0..11
  const m = Number(String(ym).slice(5, 7));
  return isNaN(m) ? null : m - 1;
}

exports.getAdminDashboard = async (_req, res) => {
  try {
    const startMonth = firstDayOfMonth();
    const thisYear = new Date().getFullYear();

    // --- ตัวเลขสรุปหลัก ---
    const [[totals]] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM rooms) AS rooms_total,
        (SELECT COUNT(*) FROM tenants WHERE is_deleted IS NULL OR is_deleted=0) AS tenants_total,
        (SELECT COUNT(*) FROM invoices WHERE status IN ('unpaid','pending','overdue')) AS invoices_open,
        (SELECT COALESCE(SUM(remaining),0) FROM v_invoice_balance WHERE remaining > 0) AS outstanding_total,
        (SELECT COUNT(*) FROM payments WHERE status='pending') AS payments_pending
    `);

    // --- รายได้เดือนนี้ ---
    const [[rev]] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS revenue_this_month
         FROM payments
        WHERE status='approved'
          AND payment_date >= ?`,
      [startMonth]
    );

    // --- บิลที่ออกเดือนนี้ ---
    const [[invMonth]] = await db.query(
      `SELECT COUNT(*) AS invoices_count,
              COALESCE(SUM(amount),0) AS invoices_amount
         FROM invoices
        WHERE created_at >= ?`,
      [startMonth]
    );

    // --- ลูกหนี้ Top 5 (อิงยอดคงเหลือจริง) ---
    const [topDebtors] = await db.query(`
      SELECT
        t.tenant_id,
        COALESCE(NULLIF(u.fullname,''), NULLIF(u.name,''), CONCAT('Tenant#', t.tenant_id)) AS tenant_name,
        COALESCE(r.room_id, t.room_id) AS room_no,
        SUM(vb.remaining) AS outstanding,
        MAX(vb.due_date)  AS last_due
      FROM v_invoice_balance vb
      JOIN tenants t ON t.tenant_id = vb.tenant_id
      LEFT JOIN users u ON u.id = t.user_id
      LEFT JOIN rooms r ON r.room_id = t.room_id
      WHERE vb.remaining > 0
      GROUP BY t.tenant_id, u.fullname, u.name, r.room_id, t.room_id
      ORDER BY outstanding DESC
      LIMIT 5
    `);

    // ========== สรุปรายปี (12 เดือนของปีปัจจุบัน) ==========

    // รายได้ตามเดือน (เฉพาะ approved)
    const [revYearRows] = await db.query(
      `SELECT DATE_FORMAT(payment_date, '%Y-%m') AS ym, COALESCE(SUM(amount),0) AS total
         FROM payments
        WHERE status='approved' AND YEAR(payment_date)=?
        GROUP BY ym
        ORDER BY ym`,
      [thisYear]
    );
    const revenueByMonth = Array(12).fill(0);
    for (const r of revYearRows) {
      const idx = monthIndex(r.ym);
      if (idx != null) revenueByMonth[idx] = Number(r.total || 0);
    }

    // จำนวนบิลออก/ยอดบิลต่อเดือน
    const [invYearRows] = await db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym,
              COUNT(*) AS count_docs,
              COALESCE(SUM(amount),0) AS sum_amount
         FROM invoices
        WHERE YEAR(created_at)=?
        GROUP BY ym
        ORDER BY ym`,
      [thisYear]
    );
    const invoicesCountByMonth = Array(12).fill(0);
    const invoicesAmountByMonth = Array(12).fill(0);
    for (const r of invYearRows) {
      const idx = monthIndex(r.ym);
      if (idx != null) {
        invoicesCountByMonth[idx] = Number(r.count_docs || 0);
        invoicesAmountByMonth[idx] = Number(r.sum_amount || 0);
      }
    }

    // ตอบกลับ
    return res.json({
      ok: true,
      data: {
        rooms_total: totals.rooms_total,
        tenants_total: totals.tenants_total,
        invoices_open: totals.invoices_open,
        outstanding_total: Number(totals.outstanding_total || 0),
        payments_pending: totals.payments_pending,

        revenue_this_month: Number(rev.revenue_this_month || 0),
        invoices_this_month: {
          count: invMonth.invoices_count,
          amount: Number(invMonth.invoices_amount || 0),
        },

        top_debtors: topDebtors.map(r => ({
          tenant_id: r.tenant_id,
          tenant_name: r.tenant_name,
          room_no: r.room_no,
          outstanding: Number(r.outstanding || 0),
          last_due: r.last_due
        })),

        // ==== Yearly ====
        year: thisYear,
        revenue_by_month: revenueByMonth,          // [12]
        invoices_count_by_month: invoicesCountByMonth, // [12]
        invoices_amount_by_month: invoicesAmountByMonth, // [12]
      }
    });
  } catch (e) {
    console.error('getAdminDashboard error:', e);
    res.status(500).json({ ok: false, message: e.message || 'Internal error' });
  }
};
