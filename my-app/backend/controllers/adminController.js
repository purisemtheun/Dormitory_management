// backend/controllers/adminController.js  (invoice-related handlers)
const db = require('../config/db');
const { createNotification } = require('../services/notification');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_BASE_URL =
  (process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.replace(/\/+$/, '')) ||
  `http://localhost:${PORT}`;

/* ===== Helpers ===== */
async function getConn() {
  return typeof db.getConnection === 'function' ? await db.getConnection() : db;
}

// ปรับให้ self-init ตาราง/แถว counter และเพิ่มเลขแบบ atomic
async function getNextInvoiceNo(conn) {
  // สร้างตารางถ้ายังไม่มี
  await conn.query(`
    CREATE TABLE IF NOT EXISTS invoice_counter (
      id TINYINT PRIMARY KEY,
      last_no INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB
  `);
  // ใส่แถว default ถ้ายังไม่มี
  await conn.query(`INSERT IGNORE INTO invoice_counter (id, last_no) VALUES (1, 0)`);
  // เพิ่มเลข
  await conn.query(`UPDATE invoice_counter SET last_no = last_no + 1 WHERE id = 1`);
  const [[{ last_no }]] = await conn.query(`SELECT last_no FROM invoice_counter WHERE id = 1`);
  return `D${String(last_no).padStart(4, '0')}`;
}

function computeDueDate(periodYm, dueDateDay) {
  const [yStr, mStr] = String(periodYm).split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) throw new Error('invalid period_ym');
  const daysInMonth = new Date(y, m, 0).getDate();
  let day = Number(dueDateDay || 0);
  if (!day || day < 1) day = daysInMonth;
  else if (day > daysInMonth) day = daysInMonth;
  const dd = String(day).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/* ====== Endpoints ====== */

// GET /api/admin/invoices?limit=10
async function listRecentInvoices(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);

    const [rows] = await db.query(`
      SELECT
        i.id            AS invoice_id,
        i.invoice_no,
        i.tenant_id,
        i.room_id,
        i.period_ym,
        i.amount,
        i.status,
        i.due_date,
        i.paid_at,
        i.slip_url,
        i.created_at,
        i.updated_at,
        COALESCE(u.fullname, u.name, u.email, CONCAT('Tenant#', i.tenant_id)) AS tenant_name
      FROM invoices i
      LEFT JOIN tenants t ON t.tenant_id = i.tenant_id
      LEFT JOIN users   u ON u.id       = t.user_id
      ORDER BY i.created_at DESC, i.id DESC
      LIMIT ?
    `, [limit]);

    // เติม absolute url ของสลิป (ถ้ามี)
    const data = rows.map(r => {
      const p = r.slip_url || null;
      const abs = p ? `${PUBLIC_BASE_URL}${encodeURI(p)}` : null;
      return { ...r, slip_abs: abs };
    });

    res.json(data);
  } catch (e) {
    console.error('listRecentInvoices error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}

// (A) บิลรออนุมัติ/ตรวจสลิป
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
        COALESCE(u.fullname, u.name, u.email, CONCAT('Tenant#', i.tenant_id)) AS tenant_name
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

// (B) ออกบิลรายคน + แจ้งเตือน  — เวอร์ชันใหม่ รองรับ rent/water/electric
async function createInvoice(req, res) {
  const conn = await getConn();
  try {
    const {
      tenant_id,
      period_ym,
      amount,           // อนุโลมให้ส่งมาก็ได้
      due_date,
      rent_amount = 0,
      water_amount = 0,
      electric_amount = 0,
    } = (req.body || {});

    if (!tenant_id || !period_ym) {
      return res.status(400).json({ error: 'tenant_id, period_ym required' });
    }

    const rent  = Number(rent_amount) || 0;
    const water = Number(water_amount) || 0;
    const elec  = Number(electric_amount) || 0;

    // ถ้า amount ไม่ส่งมา → ใช้ผลรวม rent+water+electric
    const total = Number.isFinite(Number(amount)) ? Number(amount) : (rent + water + elec);
    if (!(total > 0)) return res.status(400).json({ error: 'invalid amount' });

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
    const finalDue   = due_date || computeDueDate(period_ym, req.body?.due_date_day);

    const [ins] = await conn.query(
      `
      INSERT INTO invoices
        (invoice_no, tenant_id, room_id, period_ym,
         amount, due_date, status,
         rent_amount, water_amount, electric_amount,
         created_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, NOW(), NOW())
      `,
      [
        invoice_no,
        tenant_id,
        t.room_id || null,
        period_ym,
        total,
        finalDue,
        rent,
        water,
        elec,
      ]
    );
    const invoiceId = ins.insertId;

    await createNotification(
      {
        tenant_id,
        type: 'invoice_created',
        title: '📄 ใบแจ้งหนี้ใหม่',
        body: `รอบบิล ${period_ym}\nยอดชำระ ${total.toLocaleString()} บาท`,
        created_by: req.user?.id ?? null,
      },
      conn
    );

    if (conn.commit) await conn.commit();

    const [[created]] = await conn.query(
      `SELECT
         i.id AS invoice_id, i.invoice_no, i.tenant_id, i.room_id, i.period_ym,
         i.amount, i.status, i.due_date, i.paid_at, i.slip_url,
         i.rent_amount, i.water_amount, i.electric_amount,
         i.created_at, i.updated_at
       FROM invoices i WHERE i.id = ? LIMIT 1`,
      [invoiceId]
    );

    res.status(201).json(created);
  } catch (e) {
    if (conn.rollback) await conn.rollback();
    console.error('createInvoice error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  } finally {
    if (conn.release) conn.release();
  }
}
// (C) ออกบิลทั้งเดือน + แจ้งเตือนรายคน
async function generateMonth(req, res) {
  const { period_ym, amount_default, due_date_day, water_default, electric_default } = req.body || {};
  const month = period_ym || new Date().toISOString().slice(0, 7);

  // helper แปลงเป็นตัวเลขปลอดภัย
  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const waterDef = toNum(water_default);     // ถ้าไม่ส่งมา = 0
  const elecDef  = toNum(electric_default);  // ถ้าไม่ส่งมา = 0

  const conn = await getConn();
  try {
    if (conn.beginTransaction) await conn.beginTransaction();

    const [tenants] = await conn.query(
      `SELECT t.tenant_id, t.room_id, r.price
         FROM tenants t
         LEFT JOIN rooms r ON r.room_id = t.room_id
        WHERE (t.is_deleted = 0 OR t.is_deleted IS NULL)
          AND NOT EXISTS (
                SELECT 1 FROM invoices i
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

      // ถ้า admin ส่ง amount_default มา → ใช้เป็นค่า “ค่าเช่า”
      // ไม่งั้นใช้ r.price จากห้อง (ถ้ามี)
      const rent = Number.isFinite(Number(amount_default))
        ? Number(amount_default)
        : toNum(t.price);

      const water = waterDef;   // สามารถส่งมาจาก body ได้ (ไม่ส่ง = 0)
      const elec  = elecDef;    // สามารถส่งมาจาก body ได้ (ไม่ส่ง = 0)

      const total = rent + water + elec;

      const due_date = computeDueDate(month, due_date_day ?? process.env.RENT_DUE_DAY);

      // บันทึกยอดย่อย + ยอดรวม
      await conn.query(
        `INSERT INTO invoices
           (invoice_no, tenant_id, room_id, period_ym,
            amount, due_date, status,
            rent_amount, water_amount, electric_amount,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, NOW(), NOW())`,
        [
          invoice_no,
          t.tenant_id,
          t.room_id || null,
          month,
          total,
          due_date,
          rent,
          water,
          elec,
        ]
      );
      createdCount++;

      // แจ้งเตือน
      await createNotification(
        {
          tenant_id: t.tenant_id,
          type: "invoice_generated",
          title: "ออกใบแจ้งหนี้ประจำงวด",
          body: `งวด ${month} | รหัสบิล ${invoice_no} | ยอด ${total.toLocaleString()} บาท | ครบกำหนด ${due_date}`,
          created_by: req.user?.id ?? null,
        },
        conn
      );
    }

    if (conn.commit) await conn.commit();
    res.json({ ok: true, created: createdCount, skipped: 0 });
  } catch (e) {
    if (conn.rollback) await conn.rollback();
    console.error("generateMonth error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  } finally {
    if (conn.release) conn.release();
  }
}

// (D) ตัดสินใจอนุมัติ/ปฏิเสธ + แจ้งเตือน
async function decideInvoice(req, res) {
  const conn = await getConn();
  try {
    const invoiceId = req.params.id;
    const { action, approved_by } = req.body;
    if (!invoiceId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'invalid input' });
    }

    if (conn.beginTransaction) await conn.beginTransaction();

    const [[inv]] = await conn.query(
      `SELECT id, tenant_id, invoice_no, amount, due_date, status, slip_url
         FROM invoices
        WHERE id = ? FOR UPDATE`,
      [invoiceId]
    );
    if (!inv) {
      if (conn.rollback) await conn.rollback();
      return res.status(404).json({ error: 'invoice not found' });
    }

    if (action === 'approve') {
      const [pending] = await conn.query(
        `SELECT payment_id
           FROM payments
          WHERE invoice_id = ?
            AND status = 'pending'
          ORDER BY payment_date DESC, payment_id DESC
          LIMIT 1`,
        [invoiceId]
      );

      let usedPaymentId = null;

      if (pending.length) {
        usedPaymentId = pending[0].payment_id;
        await conn.query(
          `UPDATE payments
              SET status = 'approved',
                  payment_date = COALESCE(payment_date, CURDATE()),
                  verified_by = ?
            WHERE payment_id = ?`,
          [approved_by ?? req.user?.id ?? null, usedPaymentId]
        );
      } else {
        usedPaymentId =
          'PM' +
          new Date().toISOString().replace(/[-:TZ.]/g, '').slice(2, 12) +
          String(Math.floor(Math.random() * 90 + 10));

        await conn.query(
          `INSERT INTO payments
             (payment_id, invoice_id, amount, payment_date, slip_url, verified_by, status, note)
           VALUES (?,?,?,?,?,?, 'approved', NULL)`,
          [usedPaymentId, inv.id, inv.amount, new Date(), inv.slip_url ?? null, approved_by ?? req.user?.id ?? null]
        );
      }

      await conn.query(
        `UPDATE invoices
            SET status='paid', paid_at=NOW(), updated_at=NOW()
          WHERE id=?`,
        [invoiceId]
      );

      await createNotification({
        tenant_id: inv.tenant_id,
        type: 'payment_approved',
        title: '✅ ชำระเงินอนุมัติแล้ว',
        body: `บิล ${inv.invoice_no} | ยอด ${Number(inv.amount || 0).toLocaleString()} บาท | วันที่ ${new Date().toISOString().slice(0,10)}`,
        created_by: req.user?.id ?? approved_by ?? null,
      }, conn);

      if (conn.commit) await conn.commit();
      return res.json({
        ok: true,
        invoice_id: invoiceId,
        status: 'paid',
        message: 'อนุมัติการชำระเงินแล้ว',
        payment_id: usedPaymentId
      });
    }

    // reject
    await conn.query(
      `UPDATE payments
          SET status='rejected'
        WHERE invoice_id = ?
          AND status = 'pending'`,
      [invoiceId]
    );

    await conn.query(
      `UPDATE invoices
          SET status = CASE WHEN CURDATE() > due_date THEN 'overdue' ELSE 'unpaid' END,
              paid_at = NULL,
              updated_at = NOW()
        WHERE id=?`,
      [invoiceId]
    );

    await createNotification({
      tenant_id: inv.tenant_id,
      type: 'payment_rejected',
      title: 'การชำระเงินถูกปฏิเสธ',
      body: `บิล ${inv.invoice_no} | โปรดอัปโหลดสลิปใหม่หรือชำระอีกครั้ง`,
      created_by: req.user?.id ?? null,
    }, conn);

    if (conn.commit) await conn.commit();
    return res.json({
      ok: true,
      invoice_id: invoiceId,
      status: 'rejected',
      message: 'ปฏิเสธการชำระเงินแล้ว',
    });
  } catch (e) {
    if (conn.rollback) await conn.rollback();
    console.error('decideInvoice error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  } finally {
    if (conn.release) conn.release();
  }
}

// (E) ยกเลิกบิล + แจ้งเตือน (นอกทรานแซกชัน)
async function cancelInvoice(req, res) {
  try {
    const key = req.params.id; // id หรือ invoice_no
    const useInvoiceNo = /^[A-Za-z]/.test(String(key));

    const [found] = await db.query(
      `SELECT id, tenant_id, invoice_no
         FROM invoices
        WHERE ${useInvoiceNo ? 'invoice_no' : 'id'} = ?
        LIMIT 1`,
      [key]
    );
    if (!found.length) {
      return res.status(404).json({ error: 'invoice not found' });
    }
    const inv = found[0];

    const [r] = await db.query(
      `UPDATE invoices
          SET status='canceled', updated_at = NOW()
        WHERE ${useInvoiceNo ? 'invoice_no' : 'id'} = ?
          AND status IN ('unpaid','pending','overdue')`,
      [key]
    );
    if (!r.affectedRows) {
      return res.status(404).json({ error: 'invoice not found or not cancellable' });
    }

    await createNotification({
      tenant_id: inv.tenant_id,
      type: 'invoice_canceled',
      title: 'ยกเลิกใบแจ้งหนี้',
      body: `บิล ${inv.invoice_no} ถูกยกเลิกแล้ว`,
      created_by: req.user?.id ?? null,
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('cancelInvoice error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}

// (F) ส่งแจ้งเตือนของบิลเดิมซ้ำอีกครั้ง
async function resendInvoiceNotification(req, res) {
  try {
    const id = req.params.id;
    const [[inv]] = await db.query(
      `SELECT id, tenant_id, invoice_no, amount, period_ym, due_date
         FROM invoices WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!inv) return res.status(404).json({ error: 'invoice not found' });

    await createNotification({
      tenant_id: inv.tenant_id,
      type: 'invoice_generated',
      title: 'ออกใบแจ้งหนี้ประจำงวด',
      body: `งวด ${inv.period_ym} | รหัสบิล ${inv.invoice_no} | ยอด ${Number(inv.amount || 0).toLocaleString()} บาท | ครบกำหนด ${inv.due_date ?? '-'}`,
      created_by: req.user?.id ?? null,
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('resendInvoiceNotification error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}

module.exports = {
  listRecentInvoices,
  getPendingInvoices,
  createInvoice,
  generateMonth,
  decideInvoice,
  cancelInvoice,
  resendInvoiceNotification,
};