// backend/controllers/adminController.js
const db = require('../config/db');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_BASE_URL =
  (process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.replace(/\/+$/, '')) ||
  `http://localhost:${PORT}`;

/* ------------------------------------------------------------------ */
/* Helper: ออกเลขที่ใบแจ้งหนี้ลำดับถัดไป -> D0001, D0002, ...        */
/* ต้องมีตาราง invoice_counter (id=1, last_no) ตามที่เราคุยกันไว้     */
/* ------------------------------------------------------------------ */
async function getConn() {
  return typeof db.getConnection === 'function' ? await db.getConnection() : db;
}

async function getNextInvoiceNo(conn) {
  // เพิ่มเลข (ล็อกด้วย UPDATE row เดียว เพื่อลดโอกาสชน)
  await conn.query(`UPDATE invoice_counter SET last_no = last_no + 1 WHERE id = 1`);
  const [[{ last_no }]] = await conn.query(`SELECT last_no FROM invoice_counter WHERE id = 1`);
  return `D${String(last_no).padStart(4, '0')}`;
}

/**
 * GET /api/admin/invoices/pending
 * แสดงใบแจ้งหนี้สถานะ unpaid/pending พร้อมชื่อผู้เช่า และ URL สลิปแบบ absolute
 * NOTE: เปลี่ยนจาก u.name -> u.fullname และดึง i.invoice_no เพิ่ม
 */
async function getPendingInvoices(_req, res) {
  try {
    const [rows] = await db.query(`
      SELECT
        i.id        AS invoice_id,
        i.invoice_no,
        i.tenant_id,
        t.room_id   AS tenant_room,
        i.period_ym,
        i.amount,
        i.status,
        i.due_date,
        i.paid_at,
        i.slip_url,
        COALESCE(u.fullname, CONCAT('Tenant#', i.tenant_id)) AS tenant_name
      FROM invoices i
      LEFT JOIN tenants t ON t.tenant_id = i.tenant_id
      LEFT JOIN users   u ON u.id       = t.user_id
       WHERE i.status = 'pending'
       AND i.slip_url IS NOT NULL
      ORDER BY i.created_at DESC, i.id DESC
    `);

    const data = rows.map((r) => {
      const p = r.slip_url || null;
      const abs = p ? `${PUBLIC_BASE_URL}${encodeURI(p)}` : null;
      return { ...r, slip_abs: abs };
    });

    res.json(data);
  } catch (e) {
    console.error('getPendingInvoices error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}

/**
 * POST /api/admin/invoices
 * ออกใบแจ้งหนี้รายบุคคล + สร้างเลขใบแจ้งหนี้อัตโนมัติ (invoice_no)
 */
async function createInvoice(req, res) {
  const conn = await getConn();
  try {
    const { tenant_id, period_ym, amount, due_date } = (req.body || {});

    if (!tenant_id || !period_ym || typeof amount === 'undefined') {
      return res.status(400).json({ error: 'tenant_id, period_ym, amount required' });
    }

    if (conn.beginTransaction) await conn.beginTransaction();

    const [[t]] = await conn.query(
      `SELECT tenant_id, room_id
         FROM tenants
        WHERE tenant_id = ?
          AND (is_deleted = 0 OR is_deleted IS NULL)
        LIMIT 1`,
      [tenant_id]
    );
    if (!t) {
      if (conn.rollback) await conn.rollback();
      return res.status(400).json({ error: 'tenant not found' });
    }

    const invoice_no = await getNextInvoiceNo(conn);

    const [result] = await conn.query(
      `INSERT INTO invoices (invoice_no, tenant_id, room_id, period_ym, amount, due_date, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'unpaid', NOW())`,
      [invoice_no, tenant_id, t.room_id || null, period_ym, amount, due_date]
    );

    if (conn.commit) await conn.commit();
    res.status(201).json({ ok: true, invoice_id: result.insertId, invoice_no });
  } catch (e) {
    if (conn.rollback) await conn.rollback();
    console.error('createInvoice error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  } finally {
    if (conn.release) conn.release();
  }
}

/**
 * POST /api/admin/invoices/generate-month
 * สร้างใบแจ้งหนี้อัตโนมัติทั้งเดือน (หนึ่งใบต่อผู้เช่า) + ใส่ invoice_no ให้อัตโนมัติ
 */
async function generateMonth(req, res) {
  const { period_ym, amount_default } = req.body || {};
  const month = period_ym || new Date().toISOString().slice(0, 7);

  const conn = await getConn();
  try {
    if (conn.beginTransaction) await conn.beginTransaction();

    const [tenants] = await conn.query(
      `SELECT t.tenant_id, t.room_id, r.price
         FROM tenants t
         LEFT JOIN rooms r ON r.room_id = t.room_id
        WHERE (t.is_deleted = 0 OR t.is_deleted IS NULL)
          AND NOT EXISTS (
            SELECT 1
              FROM invoices i
             WHERE i.tenant_id = t.tenant_id
               AND i.period_ym = ?
          )`,
      [month]
    );

    if (!tenants.length) {
      if (conn.commit) await conn.commit();
      return res.json({ ok: true, created: 0, skipped: 0 });
    }

    let createdCount = 0;
    for (const t of tenants) {
      const invoice_no = await getNextInvoiceNo(conn);
      const amt = amount_default ?? t.price ?? 0;

      await conn.query(
        `INSERT INTO invoices (invoice_no, tenant_id, room_id, period_ym, amount, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'unpaid', NOW())`,
        [invoice_no, t.tenant_id, t.room_id || null, month, amt]
      );
      createdCount++;
    }

    if (conn.commit) await conn.commit();
    res.json({ ok: true, created: createdCount, skipped: 0 });
  } catch (e) {
    if (conn.rollback) await conn.rollback();
    console.error('generateMonth error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  } finally {
    if (conn.release) conn.release();
  }
}

// backend/controllers/adminController.js

async function decideInvoice(req, res) {
  // ใช้ transaction ถ้ามี
  const conn = typeof db.getConnection === 'function' ? await db.getConnection() : db;

  try {
    const invoiceId = req.params.id; // <-- อันนี้คือ invoices.id มีอยู่จริง
    const { action, approved_by } = req.body;

    if (!invoiceId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'invalid input' });
    }

    if (conn.beginTransaction) await conn.beginTransaction();

    // ล็อกแถวบิล
    const [[inv]] = await conn.query(
      `SELECT id, tenant_id, amount, due_date, status, slip_url
         FROM invoices
        WHERE id = ? FOR UPDATE`,
      [invoiceId]
    );
    if (!inv) {
      if (conn.rollback) await conn.rollback();
      return res.status(404).json({ error: 'invoice not found' });
    }

    if (action === 'approve') {
      // 1) หา payment แบบ pending ของบิลนี้ (อิง payment_id แทน id)
      const [pending] = await conn.query(
        `SELECT payment_id
           FROM payments
          WHERE invoice_id = ?
            AND status = 'pending'
          ORDER BY payment_date DESC, payment_id DESC
          LIMIT 1`,
        [invoiceId]
      );

      if (pending.length) {
        // มีอยู่แล้ว -> อนุมัติแถวนี้
        await conn.query(
          `UPDATE payments
              SET status = 'approved',
                  payment_date = COALESCE(payment_date, CURDATE()),
                  verified_by = ?
            WHERE payment_id = ?`,
          [approved_by ?? null, pending[0].payment_id]
        );
      } else {
        // ไม่มี -> สร้าง payment ใหม่ที่อนุมัติเลย (amount = ยอดบิล)
        const payment_id =
          'PM' +
          new Date().toISOString().replace(/[-:TZ.]/g, '').slice(2, 12) +
          String(Math.floor(Math.random() * 90 + 10));

        await conn.query(
          `INSERT INTO payments
             (payment_id, invoice_id, amount, payment_date, slip_url, verified_by, status, note)
           VALUES (?,?,?,?,?,?, 'approved', NULL)`,
          [payment_id, inv.id, inv.amount, new Date(), inv.slip_url ?? null, approved_by ?? null]
        );
      }

      // 2) ตั้งสถานะบิลให้เป็น paid
      await conn.query(
        `UPDATE invoices
            SET status='paid', paid_at=NOW(), updated_at=NOW()
          WHERE id=?`,
        [invoiceId]
      );

      if (conn.commit) await conn.commit();
      return res.json({
        ok: true,
        invoice_id: invoiceId,
        status: 'paid',
        message: 'อนุมัติการชำระเงินแล้ว',
      });
    } else {
      // action === 'reject'
      // 1) ปฏิเสธ payment pending ทั้งหมดของบิลนี้ (อิง payment_id)
      await conn.query(
        `UPDATE payments
            SET status='rejected'
          WHERE invoice_id = ?
            AND status = 'pending'`,
        [invoiceId]
      );

      // 2) คืนสถานะบิลตามจริง
      await conn.query(
        `UPDATE invoices
            SET status = CASE WHEN CURDATE() > due_date THEN 'overdue' ELSE 'unpaid' END,
                paid_at = NULL,
                updated_at = NOW()
          WHERE id=?`,
        [invoiceId]
      );

      if (conn.commit) await conn.commit();
      return res.json({
        ok: true,
        invoice_id: invoiceId,
        status: 'rejected',
        message: 'ปฏิเสธการชำระเงินแล้ว',
      });
    }
  } catch (e) {
    if (conn.rollback) await conn.rollback();
    console.error('decideInvoice error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  } finally {
    if (conn.release) conn.release();
  }
}


/**
 * PATCH /api/admin/invoices/:id/cancel
 * PATCH /api/admin/invoices/no/:id/cancel
 * ยกเลิกใบแจ้งหนี้ (ลบหนี้ออก) — รับได้ทั้ง id (ตัวเลข) หรือ invoice_no (เช่น D0001)
 */
async function cancelInvoice(req, res) {
  try {
    const key = req.params.id; // อาจเป็นตัวเลข id หรือรหัสบิล D0001
    const useInvoiceNo = /^[A-Za-z]/.test(String(key));

    const [r] = await db.query(
      `
      UPDATE invoices
         SET status='canceled', updated_at = NOW()
       WHERE ${useInvoiceNo ? 'invoice_no' : 'id'} = ?
         AND status IN ('unpaid','pending','overdue')
      `,
      [key]
    );

    if (!r.affectedRows) {
      return res
        .status(404)
        .json({ error: 'invoice not found or not cancellable' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('cancelInvoice error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}
// ตัวอย่าง listDebts ใหม่ (ใช้ MySQL 8+)
async function listDebts(req, res) {
  try {
    const [rows] = await db.query(`
      WITH x AS (
        SELECT
          i.tenant_id,
          COALESCE(u.fullname, CONCAT('Tenant#', i.tenant_id)) AS tenant_name,
          u.phone,
          r.room_no,
          i.due_date,
          vb.remaining,
          ROW_NUMBER() OVER (PARTITION BY i.tenant_id ORDER BY i.due_date DESC, i.id DESC) AS rn
        FROM invoices i
        JOIN v_invoice_balance vb ON vb.invoice_id = i.id
        LEFT JOIN tenants t ON t.tenant_id = i.tenant_id
        LEFT JOIN users   u ON u.id = t.user_id
        LEFT JOIN rooms   r ON r.room_id = t.room_id
        WHERE vb.remaining > 0
      )
      SELECT
        tenant_id,
        tenant_name,
        phone,
        room_no,
        SUM(remaining) AS outstanding,
        MAX(due_date) AS last_due,
        CASE
          WHEN MAX(due_date) < CURDATE() THEN DATEDIFF(CURDATE(), MAX(due_date))
          ELSE 0
        END AS overdue_days
      FROM x
      WHERE rn <= 3
      GROUP BY tenant_id, tenant_name, phone, room_no
      ORDER BY outstanding DESC, last_due DESC
    `);

    // ถ้าต้องมีเพจิเนชัน ค่อยห่อ rows และตัดหน้าอีกชั้น
    res.json(rows);
  } catch (e) {
    console.error('listDebts error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}

module.exports = {
  getPendingInvoices,
  createInvoice,
  generateMonth,
  decideInvoice,
  cancelInvoice,
  listDebts,
};
