// routes/adminRoutes.js
const express = require('express');
const router = express.Router();

// --- ตัวอย่างข้อมูลจำลอง (เอาออกเมื่อเชื่อม DB) ---
const SAMPLE_TENANTS = [
  { tenant_id: 1, full_name: 'สมชาย', room_id: 'A101', is_deleted: 0 },
  { tenant_id: 2, full_name: 'สมหญิง', room_id: 'B201', is_deleted: 0 },
];

// GET /api/admin/tenants
router.get('/tenants', async (req, res, next) => {
  try {
    // ในของจริงให้เรียก DB แทน sample
    const tenants = SAMPLE_TENANTS.filter(t => (t.is_deleted ?? 0) === 0);
    return res.json(tenants);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/invoices/pending
router.get('/invoices/pending', async (req, res, next) => {
  try {
    // ของจริง: query DB หา pending invoices
    const pending = []; // ตัวอย่างว่าง
    return res.json(pending);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/invoices
router.post('/invoices', async (req, res, next) => {
  try {
    const body = req.body || {};

    // ตรวจ presence (อนุรักษ์นิยม: ตรวจ null/undefined)
    if (body.tenant_id == null || !body.period_ym || body.amount == null) {
      return res.status(400).json({ error: 'กรอกข้อมูลไม่ครบ: tenant_id / period_ym / amount' });
    }

    // แปลงชนิดข้อมูลและตรวจความถูกต้องขั้นต้น
    const tenant_id = Number(body.tenant_id);
    const amount = Number(body.amount);
    const period_ym = String(body.period_ym);
    const due_date = body.due_date ? String(body.due_date) : null;

    if (!Number.isFinite(tenant_id) || !Number.isFinite(amount)) {
      return res.status(400).json({ error: 'tenant_id หรือ amount ไม่ถูกต้อง' });
    }

    // TODO: แทนที่ด้วย logic บันทึกจริงลง DB
    const newInvoice = {
      invoice_id: Math.floor(Math.random() * 1000000),
      tenant_id,
      period_ym,
      amount,
      due_date,
      created_at: new Date().toISOString(),
    };

    // ส่งกลับ 201
    return res.status(201).json({ invoice_id: newInvoice.invoice_id, created: newInvoice });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
