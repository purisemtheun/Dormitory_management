// backend/controllers/paymentController.js
const path = require('path');
const db = require('../config/db');
const { slipUpload } = require('../middlewares/upload');

// ===== Helper: หา tenant_id ของ user ปัจจุบัน =====
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

// ===== GET /api/payments/my-invoices?limit=3  (ต้องมี token) =====
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
           WHEN status <> 'paid' AND CURDATE() > due_date THEN 'overdue'
           ELSE status
         END AS effective_status
       FROM invoices
       WHERE tenant_id = ?
       ORDER BY period_ym DESC
       LIMIT ?`,
      [tenantId, limit]
    );

    res.json(rows);
  } catch (e) {
    console.error('getMyLastInvoices error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}

// ===== GET /api/payments/qr  (สาธารณะ) =====
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

    // qr_path แนะนำเก็บแบบ 'qrs/xxx.jpg' → เสิร์ฟผ่าน /uploads แล้ว
    const norm = row.qr_path.replace(/^\/+/, '');
    row.qr_url = `/uploads/${norm}`;
    res.json(row);
  } catch (e) {
    console.error('getActiveQR error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}

// ===== POST /api/payments/submit (multipart/form-data) =====
// body: { invoice_id, amount_paid?, transfer_date?, note? } + file 'slip'
async function submitPayment(req, res) {
  try {
    const userId = req.user?.id ?? req.user?.user_id ?? req.user?.uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { invoice_id, amount_paid, transfer_date, note } = req.body;
    if (!invoice_id) return res.status(400).json({ error: 'ระบุ invoice_id' });
    if (!req.file)   return res.status(400).json({ error: 'กรุณาแนบไฟล์สลิป' });

    const tenantId = await getTenantIdByUser(userId);
    if (!tenantId) return res.status(400).json({ error: 'ไม่พบ tenant ของผู้ใช้' });

    const [[inv]] = await db.query(
      `SELECT id, tenant_id FROM invoices WHERE id = ? LIMIT 1`,
      [invoice_id]
    );
    if (!inv || inv.tenant_id !== tenantId) {
      return res.status(400).json({ error: 'บิลไม่ถูกต้อง' });
    }

    // สร้าง path/URL ของสลิป
    const filename = req.file.filename || path.basename(req.file.path);
    const slip_path = `slips/${filename}`;
    const slip_url = slipUpload.toPublicUrl(filename); // => /uploads/slips/<filename>

    // (ถ้ามีตาราง payments แยก) บันทึกประวัติการส่งสลิป
    try {
      await db.query(
        `INSERT INTO payments
           (invoice_id, tenant_id, amount_paid, transfer_date, slip_path, note, status)
         VALUES (?,?,?,?,?,?, 'pending')`,
        [
          invoice_id,
          tenantId,
          amount_paid ?? null,
          transfer_date ?? null,
          slip_path,
          note || null,
        ]
      );
    } catch (_) {
      // ถ้าไม่มีตาราง payments ให้ข้ามได้ (ไม่ throw)
    }

    // อัปเดตใบแจ้งหนี้เป็นรอตรวจสอบ + เก็บ URL รูปไว้ที่ใบแจ้งหนี้ด้วย
    await db.query(
      `UPDATE invoices
          SET status='pending',
              slip_url=?,
              paid_at = NULL
        WHERE id=? AND tenant_id=?`,
      [slip_url, invoice_id, tenantId]
    );

    return res.status(201).json({
      message: 'ส่งคำขอชำระเงินแล้ว รอแอดมินตรวจสอบ',
      slip_url,
      status: 'pending',
    });
  } catch (e) {
    console.error('submitPayment error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}

module.exports = {
  getMyLastInvoices,
  getActiveQR,
  submitPayment,
};
