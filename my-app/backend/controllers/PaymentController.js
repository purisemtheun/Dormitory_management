// backend/controllers/paymentController.js
const path = require('path');
const db = require('../config/db');

/* ------------------------------------------------------------------ */
/* Helper: หา tenant_id ของ user ปัจจุบัน (คงเดิม)                   */
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
/* NEW: รีคำนวณตารางสรุปหนี้เฉพาะผู้เช่า (ใช้กับ schema ปัจจุบัน) */
/* ------------------------------------------------------------------ */
async function recalcTenantDebt(conn, tenantId) {
  // 1) อัปเดตสถานะ invoices ของ tenant นี้ ให้สอดคล้องกับยอดที่ "approved" แล้วใน payments
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

  // 2) REPLACE summary ของ tenant นี้ทันที
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
}

/* ======================== EXISTING ENDPOINTS (เดิม) ======================== */

// GET /api/payments/my-invoices?limit=3  (ต้องมี token)
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
      `SELECT
         id           AS invoice_id,
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

// GET /api/payments/qr  (สาธารณะ)
async function getActiveQR(_req, res) {
  try {
    const [[row]] = await db.query(
      `SELECT id, title, qr_path, created_at
         FROM payment_qr
        WHERE is_active = 1
        ORDER BY id DESC
        LIMIT 1`
    );
    if (!row) return res.json(null);

    const norm = String(row.qr_path || '').replace(/^\/+/, '');
    row.qr_url = `/uploads/${norm}`; // เสิร์ฟจาก /uploads
    res.json(row);
  } catch (e) {
    console.error('getActiveQR error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}

// POST /api/payments/submit (multipart/form-data)
// body: { invoice_id, amount_paid?, transfer_date?, note? } + file 'slip'
// ====== submitPayment: ล็อกยอดตามบิล ======
async function submitPayment(req, res) {
  try {
    const userId = req.user?.id ?? req.user?.user_id ?? req.user?.uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { invoice_id, /* amount_paid, */ transfer_date, note } = req.body;
    if (!invoice_id) return res.status(400).json({ error: 'ระบุ invoice_id' });
    if (!req.file)    return res.status(400).json({ error: "กรุณาแนบไฟล์สลิป (field ต้องชื่อ 'slip')" });

    const tenantId = await getTenantIdByUser(userId);
    if (!tenantId) return res.status(400).json({ error: 'ไม่พบ tenant ของผู้ใช้' });

    const [[inv]] = await db.query(
      `SELECT id, tenant_id, amount, status FROM invoices WHERE id = ? LIMIT 1`,
      [invoice_id]
    );
    if (!inv || inv.tenant_id !== tenantId) {
      return res.status(400).json({ error: 'บิลไม่ถูกต้อง' });
    }
    // ไม่ให้ส่งซ้ำบิลที่จ่ายแล้ว
    if (inv.status === 'paid') {
      return res.status(400).json({ error: 'บิลนี้ชำระเสร็จแล้ว' });
    }

    const filename = req.file.filename || path.basename(req.file.path);
    const slip_url = `/uploads/slips/${filename}`;

    // ✅ ยอดที่บันทึกไปที่ payments = ยอดของบิล (ล็อกไว้)
    const payment_id =
      'PM' + new Date().toISOString().replace(/[-:TZ.]/g, '').slice(2, 12) + String(Math.floor(Math.random()*90+10));

    await db.query(
      `INSERT INTO payments
         (payment_id, invoice_id, amount, payment_date, slip_url, verified_by, status)
       VALUES (?,?,?,?,?, NULL, 'pending')`,
      [payment_id, invoice_id, inv.amount, transfer_date ?? null, slip_url]
    );

    await db.query(
      `UPDATE invoices
          SET status='pending', slip_url=?, paid_at=NULL
        WHERE id=? AND tenant_id=?`,
      [slip_url, invoice_id, tenantId]
    );

    return res.status(201).json({
      message: 'ส่งคำขอชำระเงินแล้ว รอแอดมินตรวจสอบ',
      slip_url,
      status: 'pending',
      payment_id
    });
  } catch (e) {
    console.error('submitPayment error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}

// ====== approvePayment: ตรวจยอดต้องตรงก่อนอนุมัติ ======
async function approvePayment(req, res) {
  const { payment_id, approved_by } = req.body;
  if (!payment_id) return res.status(400).json({ success:false, message:'payment_id is required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[pay]] = await conn.query(
      `SELECT p.payment_id, p.status, p.invoice_id, p.amount AS paid_amount,
              i.tenant_id, i.amount AS invoice_amount
         FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
        WHERE p.payment_id = ? FOR UPDATE`,
      [payment_id]
    );
    if (!pay) throw new Error('Payment not found');

    // ❗ ยอดต้องเท่ากันเท่านั้น
    if (Number(pay.paid_amount) !== Number(pay.invoice_amount)) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: `ยอดสลิป (${pay.paid_amount}) ไม่ตรงกับยอดบิล (${pay.invoice_amount})`
      });
    }

    if (pay.status !== 'approved') {
      await conn.query(
        `UPDATE payments
            SET status='approved',
                payment_date = COALESCE(payment_date, CURDATE()),
                verified_by = ?
          WHERE payment_id = ?`,
        [approved_by ?? null, payment_id]
      );
    }

    await recalcTenantDebt(conn, pay.tenant_id);
    await conn.commit();
    res.json({ success:true });
  } catch (e) {
    await conn.rollback();
    console.error('approvePayment error:', e);
    res.status(500).json({ success:false, message:e.message || 'Server error' });
  } finally {
    conn.release();
  }
}

// ====== (ใหม่) rejectPayment: ปฏิเสธแล้วให้ยังนับเป็นหนี้ ======
async function rejectPayment(req, res) {
  const { payment_id, reason } = req.body;
  if (!payment_id) return res.status(400).json({ success:false, message:'payment_id is required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[pay]] = await conn.query(
      `SELECT p.payment_id, p.status, p.invoice_id, i.tenant_id
         FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
        WHERE p.payment_id = ? FOR UPDATE`,
      [payment_id]
    );
    if (!pay) throw new Error('Payment not found');

    await conn.query(
      `UPDATE payments SET status='rejected' WHERE payment_id=?`,
      [payment_id]
    );
    // อัปเดตสถานะบิลกลับให้ไม่นับเป็น paid
    await conn.query(
      `UPDATE invoices SET status='unpaid' WHERE id=?`,
      [pay.invoice_id]
    );

    await recalcTenantDebt(conn, pay.tenant_id);
    await conn.commit();
    res.json({ success:true });
  } catch (e) {
    await conn.rollback();
    console.error('rejectPayment error:', e);
    res.status(500).json({ success:false, message:e.message || 'Server error' });
  } finally {
    conn.release();
  }
}

module.exports = {
  getMyLastInvoices,
  getActiveQR,
  submitPayment,
  approvePayment,
  rejectPayment, // ⬅ เพิ่มออก route ด้วย
};

