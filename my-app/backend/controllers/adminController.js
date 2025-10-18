const db = require('../config/db');
const { pushLineAfterNotification } = require('../services/notifyAfterInsert');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_BASE_URL =
  (process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.replace(/\/+$/, '')) ||
  `http://localhost:${PORT}`;

/* ------------------------------------------------------------------ */
/* Helper: เปิด connection (รองรับ pool.getConnection)                */
/* ------------------------------------------------------------------ */
async function getConn() {
  return typeof db.getConnection === 'function' ? await db.getConnection() : db;
}

/* ------------------------------------------------------------------ */
/* Helper: เลขที่ใบแจ้งหนี้ (ต้องมีตาราง invoice_counter (id=1))     */
/* ------------------------------------------------------------------ */
async function getNextInvoiceNo(conn) {
  await conn.query(`UPDATE invoice_counter SET last_no = last_no + 1 WHERE id = 1`);
  const [[{ last_no }]] = await conn.query(`SELECT last_no FROM invoice_counter WHERE id = 1`);
  return `D${String(last_no).padStart(4, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Helper: บันทึก Notification ภายในทรานแซกชันเดียวกัน               */
/* NOTE: ตาราง notifications ควรมี ENUM type ตามนี้เท่านั้น:
   ('invoice_issued','invoice_generated','payment_approved','payment_rejected','invoice_canceled','repair_updated')
/* ------------------------------------------------------------------ */
async function notifyTx(conn, { tenantId, type, title, body, refType = null, refId = null }) {
  await conn.query(
    `INSERT INTO notifications
       (tenant_id, type, title, body, ref_type, ref_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'unread', NOW())`,
    [tenantId, type, title, body, refType, refId]
  );
}

/* ------------------------------------------------------------------ */
/* helper: คำนวณ due_date จาก period_ym (YYYY-MM)
 * - ถ้า body ส่ง due_date_day มา จะใช้วันนั้น (แต่ไม่เกินจำนวนวันของเดือน)
 * - ถ้าไม่ส่ง จะใช้วันสุดท้ายของเดือน
/* ------------------------------------------------------------------ */
function computeDueDate(periodYm, dueDateDay) {
  // periodYm: '2025-10'
  const [yStr, mStr] = String(periodYm).split('-');
  const y = Number(yStr);
  const m = Number(mStr); // 1-12
  if (!y || !m) throw new Error('invalid period_ym');

  // จำนวนวันของเดือน
  const daysInMonth = new Date(y, m, 0).getDate(); // new Date(y, m, 0) = last day of month (m is 1-12)
  let day = Number(dueDateDay || 0);

  if (!day || day < 1) {
    day = daysInMonth; // default: last day of month
  } else if (day > daysInMonth) {
    day = daysInMonth; // clamp
  }

  const dd = String(day).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/* ------------------------------------------------------------------ */
/* GET /api/admin/invoices/pending                                    */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* POST /api/admin/invoices  (ออกบิลรายคน + แจ้งเตือน + ยิง LINE)     */
/* ------------------------------------------------------------------ */
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
    const finalDue = due_date || computeDueDate(period_ym, req.body?.due_date_day);

    const [ins] = await conn.query(
      `INSERT INTO invoices
         (invoice_no, tenant_id, room_id, period_ym, amount, due_date, status, created_at)
       VALUES
         (?, ?, ?, ?, ?, ?, 'unpaid', NOW())`,
      [invoice_no, tenant_id, t.room_id || null, period_ym, amount, finalDue]
    );
    const newInvoiceId = ins.insertId;

    // แจ้งเตือนภายในระบบ
    const type  = 'invoice_issued';
    const title = 'ใบแจ้งหนี้ใหม่';
    const body  = `รหัสบิล ${invoice_no} | ยอด ${Number(amount).toFixed(2)} | ครบกำหนด ${finalDue ?? '-'}`;
    await notifyTx(conn, {
      tenantId: tenant_id,
      type, title, body,
      refType: 'invoice', refId: newInvoiceId
    });

    // ยิง LINE
    await pushLineAfterNotification(conn, { tenant_id, type, title, body });

    if (conn.commit) await conn.commit();
    res.status(201).json({ ok: true, invoice_id: newInvoiceId, invoice_no });
  } catch (e) {
    if (conn.rollback) await conn.rollback();
    console.error('createInvoice error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  } finally {
    if (conn.release) conn.release();
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/admin/invoices/generate-month (ออกบิลทั้งเดือน + แจ้ง)   */
/* ------------------------------------------------------------------ */
async function generateMonth(req, res) {
  const { period_ym, amount_default, due_date_day } = req.body || {};
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
      const amt = amount_default ?? t.price ?? 0;
      const due_date = computeDueDate(month, due_date_day ?? process.env.RENT_DUE_DAY);

      const [ins] = await conn.query(
        `INSERT INTO invoices (invoice_no, tenant_id, room_id, period_ym, amount, due_date, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'unpaid', NOW())`,
        [invoice_no, t.tenant_id, t.room_id || null, month, amt, due_date]
      );
      const invId = ins.insertId;
      createdCount++;

      // แจ้งเตือน + ยิง LINE รายคน
      const type  = 'invoice_generated';
      const title = 'ออกใบแจ้งหนี้ประจำงวด';
      const body  = `งวด ${month} | รหัสบิล ${invoice_no} | ยอด ${Number(amt).toFixed(2)} | ครบกำหนด ${due_date}`;

      await notifyTx(conn, {
        tenantId: t.tenant_id, type, title, body, refType: 'invoice', refId: invId
      });
      await pushLineAfterNotification(conn, {
        tenant_id: t.tenant_id, type, title, body
      });
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

/* ------------------------------------------------------------------ */
/* PATCH /api/admin/invoices/:id/decide (approve/reject) + แจ้งเตือน   */
/* ------------------------------------------------------------------ */
async function decideInvoice(req, res) {
  const conn = typeof db.getConnection === 'function' ? await db.getConnection() : db;

  try {
    const invoiceId = req.params.id;
    const { action, approved_by } = req.body;

    if (!invoiceId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'invalid input' });
    }

    if (conn.beginTransaction) await conn.beginTransaction();

    // ล็อกบิล
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
      // หา payment pending
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
          [approved_by ?? null, usedPaymentId]
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
          [usedPaymentId, inv.id, inv.amount, new Date(), inv.slip_url ?? null, approved_by ?? null]
        );
      }

      await conn.query(
        `UPDATE invoices
            SET status='paid', paid_at=NOW(), updated_at=NOW()
          WHERE id=?`,
        [invoiceId]
      );

      // แจ้งเตือน + LINE
      const type  = 'payment_approved';
      const title = 'ชำระเงินอนุมัติแล้ว';
      const body  = `บิล ${inv.invoice_no} | ยอด ${Number(inv.amount).toFixed(2)} | วันที่ ${new Date().toISOString().slice(0,10)}`;

      await notifyTx(conn, {
        tenantId: inv.tenant_id, type, title, body, refType: 'invoice', refId: inv.id
      });
      await pushLineAfterNotification(conn, {
        tenant_id: inv.tenant_id, type, title, body
      });

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

    const type  = 'payment_rejected';
    const title = 'การชำระเงินถูกปฏิเสธ';
    const body  = `บิล ${inv.invoice_no} | โปรดอัปโหลดสลิปใหม่หรือชำระอีกครั้ง`;

    await notifyTx(conn, {
      tenantId: inv.tenant_id, type, title, body, refType: 'invoice', refId: inv.id
    });
    await pushLineAfterNotification(conn, {
      tenant_id: inv.tenant_id, type, title, body
    });

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

/* ------------------------------------------------------------------ */
/* PATCH /api/admin/invoices/:id/cancel (ยกเลิกบิล) + แจ้งเตือน + LINE */
/* ------------------------------------------------------------------ */
async function cancelInvoice(req, res) {
  try {
    const key = req.params.id; // อาจเป็น id หรือรหัสบิล D0001
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

    // แจ้งเตือน + LINE (นอกทรานแซกชัน)
    const type  = 'invoice_canceled';
    const title = 'ยกเลิกใบแจ้งหนี้';
    const body  = `บิล ${inv.invoice_no} ถูกยกเลิกแล้ว`;

    await db.query(
      `INSERT INTO notifications
         (tenant_id, type, title, body, ref_type, ref_id, status, created_at)
       VALUES
         (?, ?, ?, ?, 'invoice', ?, 'unread', NOW())`,
      [inv.tenant_id, type, title, body, inv.id]
    );
    await pushLineAfterNotification(null, { tenant_id: inv.tenant_id, type, title, body });

    res.json({ ok: true });
  } catch (e) {
    console.error('cancelInvoice error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}

/* ------------------------------------------------------------------ */
async function listDebts(_req, res) {
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

    res.json(rows);
  } catch (e) {
    console.error('listDebts error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}
async function resendInvoiceNotification(req, res) {
  try {
    const id = req.params.id;
    const [[inv]] = await db.query(
      `SELECT id, tenant_id, invoice_no, amount, period_ym, due_date
         FROM invoices WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!inv) return res.status(404).json({ error: 'invoice not found' });

    const type  = 'invoice_generated';
    const title = 'ออกใบแจ้งหนี้ประจำงวด';
    const body  = `งวด ${inv.period_ym} | รหัสบิล ${inv.invoice_no} | ยอด ${Number(inv.amount).toFixed(2)} | ครบกำหนด ${inv.due_date ?? '-'}`;

    await db.query(
      `INSERT INTO notifications
         (tenant_id, type, title, body, ref_type, ref_id, status, created_at)
       VALUES (?, ?, ?, ?, 'invoice', ?, 'unread', NOW())`,
      [inv.tenant_id, type, title, body, inv.id]
    );

    const { pushLineAfterNotification } = require('../services/notifyAfterInsert');
    await pushLineAfterNotification(null, { tenant_id: inv.tenant_id, type, title, body });

    res.json({ ok: true });
  } catch (e) {
    console.error('resendInvoiceNotification error:', e);
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
  resendInvoiceNotification,
};
