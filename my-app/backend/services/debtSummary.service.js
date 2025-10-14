// backend/services/debtSummary.service.js
// ใช้กับ mysql2/promise – รับ "conn" จาก pool.getConnection()

const recalcTenantDebt = async (conn, tenantId) => {
  // 1) อัปเดตสถานะ invoice ของ tenant นี้ จากยอดที่ "approved" แล้ว
  await conn.query(`
    UPDATE invoices i
    LEFT JOIN (
      SELECT invoice_id, SUM(amount) AS paid
      FROM payments
      WHERE status='approved'
      GROUP BY invoice_id
    ) p ON p.invoice_id = i.id
    SET i.status = CASE
      WHEN IFNULL(p.paid,0) >= IFNULL(i.amount,0) THEN 'paid'
      WHEN IFNULL(p.paid,0) > 0 THEN 'partial'
      ELSE 'unpaid'
    END
    WHERE i.tenant_id = ?
  `, [tenantId]);

  // 2) คำนวณสรุปเฉพาะ tenant นี้แล้ว REPLACE เข้า summary
  await conn.query(`
    REPLACE INTO tenant_debt_summary
      (tenant_id, outstanding, last_due, overdue_days, updated_at)
    SELECT
      i.tenant_id,
      SUM(GREATEST(
            CASE WHEN i.status='paid' THEN 0 ELSE IFNULL(i.amount,0) END
            - IFNULL(p.paid,0), 0
          )) AS outstanding,
      MAX(CASE
            WHEN (CASE WHEN i.status='paid' THEN 0 ELSE IFNULL(i.amount,0) END - IFNULL(p.paid,0)) > 0
            THEN i.due_date
          END) AS last_due,
      CASE
        WHEN MAX(CASE
                   WHEN (CASE WHEN i.status='paid' THEN 0 ELSE IFNULL(i.amount,0) END - IFNULL(p.paid,0)) > 0
                   THEN i.due_date
                 END) < CURDATE()
        THEN DATEDIFF(
               CURDATE(),
               MAX(CASE
                     WHEN (CASE WHEN i.status='paid' THEN 0 ELSE IFNULL(i.amount,0) END - IFNULL(p.paid,0)) > 0
                     THEN i.due_date
                   END)
             )
        ELSE 0
      END AS overdue_days,
      NOW() AS updated_at
    FROM invoices i
    LEFT JOIN (
      SELECT invoice_id, SUM(amount) AS paid
      FROM payments
      WHERE status='approved'
      GROUP BY invoice_id
    ) p ON p.invoice_id = i.id
    WHERE i.tenant_id = ?
    GROUP BY i.tenant_id
  `, [tenantId]);
};

module.exports = { recalcTenantDebt };
