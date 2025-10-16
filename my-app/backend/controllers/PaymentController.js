/**
 * PATH: backend/controllers/paymentController.js
 * PURPOSE: จัดการชำระเงิน/สลิป ตามสคีมาปัจจุบันของโปรเจกต์
 */

const path = require('path');
const db = require('../config/db');

/* ------------------------------------------------------------------ */
/* Helper: หา tenant_id ของ user ปัจจุบัน                              */
/* ------------------------------------------------------------------ */
async function getTenantIdByUser(userId) {
  const [[row]] = await db.query(
    `SELECT tenant_id
       FROM tenants
      WHERE user_id = ?
        AND (is_deleted IS NULL OR is_deleted = 0)
      ORDER BY COALESCE(checkin_date, '0000-00-00') DESC, tenant_id DESC
      LIMIT 1`,
    [userId]
  );
  return row?.tenant_id || null;
}

/* ------------------------------------------------------------------ */
/* NEW: รีคำนวณตารางสรุปหนี้เฉพาะผู้เช่า (ถ้าใช้ summary table)     */
/* ------------------------------------------------------------------ */
async function recalcTenantDebt(conn, tenantId) {
  await conn.query(
    `
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
    WHERE i.tenant_id = ?`,
    [tenantId]
  );

  await conn.query(
    `
    REPLACE INTO tenant_debt_summary
      (tenant_id, outstanding, last_due, overdue_days, updated_at)
    SELECT
      i.tenant_id,
      SUM(
        GREATEST(
          CASE WHEN i.status='paid' THEN 0 ELSE IFNULL(i.amount,0) END - IFNULL(p.paid,0),
        0)
      ) AS outstanding,
      MAX(
        CASE
          WHEN (CASE WHEN i.status='paid' THEN 0 ELSE IFNULL(i.amount,0) END - IFNULL(p.paid,0)) > 0
          THEN i.due_date
        END
      ) AS last_due,
      CASE
        WHEN MAX(
               CASE
                 WHEN (CASE WHEN i.status='paid' THEN 0 ELSE IFNULL(i.amount,0) END - IFNULL(p.paid,0)) > 0
                 THEN i.due_date
               END
             ) < CURDATE()
        THEN DATEDIFF(
               CURDATE(),
               MAX(
                 CASE
                   WHEN (CASE WHEN i.status='paid' THEN 0 ELSE IFNULL(i.amount,0) END - IFNULL(p.paid,0)) > 0
                   THEN i.due_date
                 END
               )
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
    GROUP BY i.tenant_id`,
    [tenantId]
  );
}

/* ======================== ENDPOINTS ======================== */

/**
 * GET /api/payments/my-invoices?limit=3  (ต้องมี token)
 * ➜ เพิ่ม invoice_no ให้ frontend ใช้เลือก Dxxxx ได้
 */
async function getMyLastInvoices(req, res) {
  try {
    const limit = Math.max(1, Math.min(12, Number(req.query.limit) || 3));
    const userId = req.user?.id ?? req.user?.user_id ?? req.user?.uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const tenantId = await getTenantIdByUser(userId);
    if (!tenantId) {
      return res.status(404).json({ error: 'คุณยังไม่มีห้องที่ผูกกับบัญชีนี้' });
    }

    const [rows] = await db.query(
      `
      SELECT
         id           AS invoice_id,
         invoice_no,                          -- ⬅ เพิ่ม
         tenant_id,
         room_id,
         period_ym,
         amount,
         status,
         due_date,
         paid_at,
         slip_url,
         CASE
           WHEN status <> 'paid'
                AND due_date IS NOT NULL
                AND CURDATE() > due_date THEN 'overdue'
           ELSE status
         END AS effective_status
       FROM invoices
       WHERE tenant_id = ?
       ORDER BY period_ym DESC, id DESC
       LIMIT ?`,
      [tenantId, limit]
    );

    res.json(rows);
  } catch (e) {
    console.error('getMyLastInvoices error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}

/**
 * GET /api/payments/qr  (สาธารณะ)
 */
async function getActiveQR(_req, res) {
  try {
    const [[row]] = await db.query(
      `
      SELECT id, title, qr_path, created_at
        FROM payment_qr
       WHERE is_active = 1
       ORDER BY id DESC
       LIMIT 1`
    );
    if (!row) return res.json(null);

    const norm = String(row.qr_path || '').replace(/^\/+/, '');
    row.qr_url = `/uploads/${norm}`;
    res.json(row);
  } catch (e) {
    console.error('getActiveQR error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}

/**
 * POST /api/payments/submit (multipart/form-data)
 * body: { invoice_id? OR invoice_no?, transfer_date?, note? } + file 'slip'
 * ➜ รองรับทั้ง invoice_id และ invoice_no
 * ➜ ล็อกยอด payments = ยอดบิล, ตั้ง invoices.status='pending'
 */
async function submitPayment(req, res) {
  try {
    const userId = req.user?.id ?? req.user?.user_id ?? req.user?.uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { invoice_id, invoice_no, transfer_date, note } = req.body || {};
    if (!invoice_id && !invoice_no) {
      return res.status(400).json({ error: 'ระบุ invoice_id หรือ invoice_no' });
    }
    if (!req.file) {
      return res.status(400).json({ error: "กรุณาแนบไฟล์สลิป (field ต้องชื่อ 'slip')" });
    }

    const tenantId = await getTenantIdByUser(userId);
    if (!tenantId) return res.status(400).json({ error: 'ไม่พบ tenant ของผู้ใช้' });

    // ✅ ตรวจสอบจาก invoice_no ก่อน ถ้าไม่มี fallback เป็น id
    const [[inv]] = await db.query(
      `
      SELECT id, invoice_no, tenant_id, amount, status
        FROM invoices
       WHERE (${invoice_no ? 'invoice_no = ?' : 'id = ?'})
       LIMIT 1
      `,
      [invoice_no || invoice_id]
    );

    if (!inv || inv.tenant_id !== tenantId) {
      return res.status(400).json({ error: 'บิลไม่ถูกต้องหรือไม่พบในระบบ' });
    }
    if (inv.status === 'paid') {
      return res.status(400).json({ error: 'บิลนี้ชำระเสร็จแล้ว' });
    }

    const filename = req.file.filename || path.basename(req.file.path);
    const slip_url = `/uploads/slips/${filename}`;

    const payment_id =
      'PM' + new Date().toISOString().replace(/[-:TZ.]/g, '').slice(2, 12) +
      String(Math.floor(Math.random() * 90 + 10));

    await db.query(
      `
      INSERT INTO payments
         (payment_id, invoice_id, amount, payment_date, slip_url, verified_by, status, note)
      VALUES (?,?,?,?,?, NULL, 'pending', ?)
      `,
      [payment_id, inv.id, inv.amount, transfer_date ?? null, slip_url, note ?? null]
    );

    await db.query(
      `
      UPDATE invoices
         SET status = 'pending',
             slip_url = ?,
             paid_at = NULL,
             updated_at = NOW()
       WHERE id = ? AND tenant_id = ?
      `,
      [slip_url, inv.id, tenantId]
    );

    return res.status(201).json({
      message: 'ส่งคำขอชำระเงินแล้ว รอแอดมินตรวจสอบ',
      slip_url,
      status: 'pending',
      payment_id,
    });
  } catch (e) {
    console.error('submitPayment error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}


/**
 * PATCH /api/admin/payments/:id/approve
 */
async function approvePayment(req, res) {
  const paymentId = req.params.id;
  const conn = typeof db.getConnection === 'function' ? await db.getConnection() : db;

  try {
    if (conn.beginTransaction) await conn.beginTransaction();

    const [[pay]] = await conn.query(
      `SELECT p.id, p.invoice_id, p.amount, p.status
         FROM payments p
        WHERE p.id = ? FOR UPDATE`,
      [paymentId]
    );
    if (!pay) {
      if (conn.rollback) await conn.rollback();
      return res.status(404).json({ error: 'payment not found' });
    }
    if (pay.status === 'approved') {
      if (conn.rollback) await conn.rollback();
      return res.json({ ok: true });
    }

    await conn.query(
      `UPDATE payments
          SET status='approved',
              payment_date = COALESCE(payment_date, CURDATE())
        WHERE id=? AND status='pending'`,
      [paymentId]
    );

    const [[bal]] = await conn.query(
      `SELECT remaining, due_date FROM v_invoice_balance WHERE invoice_id=?`,
      [pay.invoice_id]
    );

    if (bal && Number(bal.remaining) === 0) {
      await conn.query(
        `UPDATE invoices SET status='paid', paid_at=NOW(), updated_at=NOW() WHERE id=?`,
        [pay.invoice_id]
      );
    } else {
      await conn.query(
        `UPDATE invoices
           SET status = CASE WHEN CURDATE() > due_date THEN 'overdue' ELSE 'unpaid' END,
               paid_at = NULL,
               updated_at = NOW()
         WHERE id=?`,
        [pay.invoice_id]
      );
    }

    const [[invTenant]] = await conn.query(`SELECT tenant_id FROM invoices WHERE id=?`, [pay.invoice_id]);
    if (invTenant?.tenant_id) {
      await recalcTenantDebt(conn, invTenant.tenant_id);
    }

    if (conn.commit) await conn.commit();
    return res.json({ ok: true });
  } catch (e) {
    if (conn.rollback) await conn.rollback();
    console.error('approvePayment error:', e);
    return res.status(400).json({ error: e.message || 'Server error' });
  } finally {
    if (conn.release) conn.release();
  }
}

/**
 * PATCH /api/admin/payments/:id/reject
 */
async function rejectPayment(req, res) {
  const paymentId = req.params.id;
  const conn = typeof db.getConnection === 'function' ? await db.getConnection() : db;

  try {
    if (conn.beginTransaction) await conn.beginTransaction();

    const [[pay]] = await conn.query(
      `SELECT p.id, p.invoice_id, p.status
         FROM payments p
        WHERE p.id = ? FOR UPDATE`,
      [paymentId]
    );
    if (!pay) {
      if (conn.rollback) await conn.rollback();
      return res.status(404).json({ error: 'payment not found' });
    }
    if (pay.status === 'rejected') {
      if (conn.rollback) await conn.rollback();
      return res.json({ ok: true });
    }

    await conn.query(
      `UPDATE payments SET status='rejected' WHERE id=? AND status='pending'`,
      [paymentId]
    );

    await conn.query(
      `UPDATE invoices
         SET status = CASE WHEN CURDATE() > due_date THEN 'overdue' ELSE 'unpaid' END,
             paid_at = NULL,
             updated_at = NOW()
       WHERE id=?`,
      [pay.invoice_id]
    );

    const [[invTenant]] = await conn.query(`SELECT tenant_id FROM invoices WHERE id=?`, [pay.invoice_id]);
    if (invTenant?.tenant_id) {
      await recalcTenantDebt(conn, invTenant.tenant_id);
    }

    if (conn.commit) await conn.commit();
    return res.json({ ok: true });
  } catch (e) {
    if (conn.rollback) await conn.rollback();
    console.error('rejectPayment error:', e);
    return res.status(400).json({ error: e.message || 'Server error' });
  } finally {
    if (conn.release) conn.release();
  }
}

module.exports = {
  getMyLastInvoices,
  getActiveQR,
  submitPayment,
  approvePayment,
  rejectPayment,
};
