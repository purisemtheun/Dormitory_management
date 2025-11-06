// backend/controllers/techRepairController.js
const db = require("../config/db");
const STATUS = require("./repairStatus"); // Repair Status constants
const { createNotification } = require("../services/notification");
const { pushLineAfterNotification } = require("../services/notifyAfterInsert");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_BASE_URL =
  (process.env.PUBLIC_BASE_URL &&
    process.env.PUBLIC_BASE_URL.replace(/\/+$/, "")) ||
  `http://localhost:${PORT}`;

/* ================= Helpers (จากโค้ดใหม่) ================= */
async function getConn() {
  return typeof db.getConnection === "function" ? await db.getConnection() : db;
}

function pickTenantInput(req) {
  const b = req.body || {};
  const q = req.query || {};
  const candidates = [
    b.tenant_id, b.tenantId, b.tenant, b.tenantValue, b.selectedTenant,
    b.tenant_label, b.tenantLabel, b.label, b.display, b.text,
    b.user_id, b.userId, q.tenant_id, q.user_id
  ].map(v => (v == null ? "" : String(v).trim())).filter(Boolean);
  return candidates[0] || null;
}

async function getNextInvoiceNo(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS invoice_counter (
      id TINYINT PRIMARY KEY,
      last_no INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB
  `);
  await conn.query(`INSERT IGNORE INTO invoice_counter (id, last_no) VALUES (1, 0)`);
  await conn.query(`UPDATE invoice_counter SET last_no = last_no + 1 WHERE id = 1`);
  const [[{ last_no }]] = await conn.query(`SELECT last_no FROM invoice_counter WHERE id = 1`);
  return `D${String(last_no).padStart(4, "0")}`;
}

function computeDueDate(periodYm, dueDateDay) {
  const [yStr, mStr] = String(periodYm).split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) throw new Error("invalid period_ym");
  const daysInMonth = new Date(y, m, 0).getDate();
  let day = Number(dueDateDay || 0);
  if (!day || day < 1) day = daysInMonth;
  else if (day > daysInMonth) day = daysInMonth;
  const dd = String(day).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function extractNameAndRoom(label) {
  const text = String(label || "").trim();
  const m = text.match(/^(.+?)\s*—\s*ห้อง\s*([^\s]+)?/);
  if (m) return { name: m[1].trim(), room: (m[2] || "").trim() };
  const m2 = text.match(/^\s*(.+?)\s*(?:\(|\[)?T\d{3,5}(?:\)|\])?/i);
  return { name: (m2?.[1] || text).trim(), room: "" };
}

async function getLatestTenantByUser(conn, userId) {
  const [[row]] = await conn.query(
    `SELECT tenant_id
      FROM tenants
     WHERE user_id = ?
       AND (is_deleted = 0 OR is_deleted IS NULL)
     ORDER BY COALESCE(checkin_date,'1970-01-01') DESC,
              CAST(REPLACE(tenant_id,'T','') AS UNSIGNED) DESC
     LIMIT 1`,
    [userId]
  );
  return row?.tenant_id || null;
}

async function resolveTenantId(conn, input) {
  if (!input) return null;
  const raw = String(input).trim();

  if (/^T\d{3,5}$/i.test(raw)) return raw.toUpperCase();

  const embed = raw.match(/T\d{3,5}/i);
  if (embed) return embed[0].toUpperCase();

  if (/^\d+$/.test(raw)) return await getLatestTenantByUser(conn, Number(raw));

  const { name, room } = extractNameAndRoom(raw);
  if (!name) return null;

  const [users] = await conn.query(
    `SELECT id FROM users
      WHERE (name COLLATE utf8mb4_unicode_ci = ?
          OR fullname COLLATE utf8mb4_unicode_ci = ?
          OR name COLLATE utf8mb4_unicode_ci LIKE CONCAT('%',?,'%')
          OR fullname COLLATE utf8mb4_unicode_ci LIKE CONCAT('%',?,'%'))
      ORDER BY id ASC
      LIMIT 5`,
    [name, name, name, name]
  );

  async function pickForUser(uid) {
    if (room && room !== "-") {
      const [[tRoom]] = await conn.query(
        `SELECT t.tenant_id
            FROM tenants t
            JOIN rooms r ON r.room_id = t.room_id
          WHERE t.user_id = ?
            AND r.room_number COLLATE utf8mb4_unicode_ci = ?
            AND (t.is_deleted = 0 OR t.is_deleted IS NULL)
          ORDER BY COALESCE(t.checkin_date,'1970-01-01') DESC,
                   CAST(REPLACE(t.tenant_id,'T','') AS UNSIGNED) DESC
          LIMIT 1`,
        [uid, room]
      );
      if (tRoom?.tenant_id) return tRoom.tenant_id;
    }
    return await getLatestTenantByUser(conn, uid);
  }

  for (const u of users) {
    const tid = await pickForUser(u.id);
    if (tid) return tid;
  }

  if (room && room !== "-") {
    const [[t2]] = await conn.query(
      `SELECT t.tenant_id
          FROM tenants t
          JOIN rooms r ON r.room_id = t.room_id
          JOIN users u ON u.id = t.user_id
        WHERE (u.name COLLATE utf8mb4_unicode_ci LIKE CONCAT('%',?,'%')
            OR u.fullname COLLATE utf8mb4_unicode_ci LIKE CONCAT('%',?,'%'))
          AND r.room_number COLLATE utf8mb4_unicode_ci = ?
          AND (t.is_deleted = 0 OR t.is_deleted IS NULL)
        ORDER BY COALESCE(t.checkin_date,'1970-01-01') DESC,
                 CAST(REPLACE(t.tenant_id,'T','') AS UNSIGNED) DESC
        LIMIT 1`,
      [name, name, room]
    );
    if (t2?.tenant_id) return t2.tenant_id;
  }

  const [all] = await conn.query(
    `SELECT tenant_id FROM tenants WHERE (is_deleted=0 OR is_deleted IS NULL) LIMIT 2`
  );
  if (all.length === 1) return all[0].tenant_id;

  return null;
}

/* ================= Endpoints สำหรับ Repair (โค้ดเดิม) ================= */

/* 👷 ช่าง: ดูงานของตัวเอง (ASSIGNED + IN_PROGRESS) */
exports.myOpenRepairs = async (req, res) => {
  try {
    const techId = req.user.id;

    const [rows] = await db.query(
      `SELECT r.*,
              rm.room_number AS room_no,
              COALESCE(NULLIF(u.fullname,''), NULLIF(u.name,''), u.email) AS tenant_name
       FROM repairs r
       LEFT JOIN rooms   rm ON rm.room_id = r.room_id
       LEFT JOIN tenants t  ON t.tenant_id = r.tenant_id
       LEFT JOIN users   u  ON u.id       = t.user_id
       WHERE COALESCE(r.assigned_technician_id, r.assigned_to) = ?
         AND r.status IN (?, ?)
       ORDER BY r.updated_at DESC`,
      [techId, STATUS.ASSIGNED ?? "assigned", STATUS.IN_PROGRESS ?? "in_progress"]
    );

    const out = rows.map(r => ({ ...r, status: String(r.status || "").toLowerCase() }));
    res.json(out);
  } catch (err) {
    console.error("❌ myOpenRepairs error:", err);
    res.status(500).json({ message: "ไม่สามารถดึงงานของช่างได้", error: err.message });
  }
};

/* 🟨 ช่าง: เริ่มทำงาน */
exports.startRepair = async (req, res) => {
  try {
    const techId = req.user.id;
    const { id } = req.params;

    const [chk] = await db.query(
      "SELECT status FROM repairs WHERE repair_id = ? AND COALESCE(assigned_technician_id, assigned_to) = ? LIMIT 1",
      [id, techId]
    );
    if (!chk.length) return res.status(403).json({ message: "ไม่มีสิทธิ์ในงานนี้" });
    if (String(chk[0].status).toLowerCase() !== String(STATUS.ASSIGNED ?? "assigned"))
      return res.status(409).json({ message: "งานนี้ไม่อยู่สถานะพร้อมเริ่ม" });

    await db.query(
      `UPDATE repairs
       SET status = ?, started_at = NOW(), updated_at = NOW()
       WHERE repair_id = ?`,
      [STATUS.IN_PROGRESS ?? "in_progress", id]
    );

    // TODO: อาจเพิ่มการแจ้งเตือน
    
    res.json({ message: "เริ่มงานซ่อมเรียบร้อย", repair_id: id, status: STATUS.IN_PROGRESS ?? "in_progress" });
  } catch (err) {
    console.error("❌ startRepair error:", err);
    res.status(500).json({ message: "ไม่สามารถเริ่มงานได้", error: err.message });
  }
};

/* 🟩 ช่าง: เสร็จสิ้นงาน */
exports.completeRepair = async (req, res) => {
  try {
    const techId = req.user.id;
    const { id } = req.params;

    const [chk] = await db.query(
      "SELECT status FROM repairs WHERE repair_id = ? AND COALESCE(assigned_technician_id, assigned_to) = ? LIMIT 1",
      [id, techId]
    );
    if (!chk.length) return res.status(403).json({ message: "ไม่มีสิทธิ์ในงานนี้" });
    if (String(chk[0].status).toLowerCase() !== String(STATUS.IN_PROGRESS ?? "in_progress"))
      return res.status(409).json({ message: "งานนี้ยังไม่ได้เริ่ม หรือเสร็จแล้ว" });

    await db.query(
      `UPDATE repairs
       SET status = ?, completed_at = NOW(), updated_at = NOW()
       WHERE repair_id = ?`,
      [STATUS.DONE ?? "done", id]
    );

    // TODO: อาจเพิ่มการแจ้งเตือน
    
    res.json({ message: "เสร็จสิ้นงานซ่อมเรียบร้อย", repair_id: id, status: STATUS.DONE ?? "done" });
  } catch (err) {
    console.error("❌ completeRepair error:", err);
    res.status(500).json({ message: "ไม่สามารถอัปเดตงานเสร็จสิ้นได้", error: err.message });
  }
};

/* ================= Endpoints สำหรับ Invoice & Tenant (โค้ดใหม่) ================= */

async function listRecentInvoices(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);
    const [rows] = await db.query(
      `
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
    `,
      [limit]
    );

    const data = rows.map((r) => {
      const p = r.slip_url || null;
      const abs = p ? `${PUBLIC_BASE_URL}${encodeURI(p)}` : null;
      return { ...r, slip_abs: abs };
    });
    res.json(data);
  } catch (e) {
    console.error("listRecentInvoices error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
}

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
    console.error("getPendingInvoices error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
}

async function getTenantOptions(_req, res) {
  try {
    const [rows] = await db.query(`
      SELECT t.tenant_id AS value,
             CONCAT(COALESCE(u.fullname, u.name, u.email),
                     ' — ห้อง ', COALESCE(r.room_number,'-')) AS label
      FROM tenants t
      LEFT JOIN users u ON u.id = t.user_id
      LEFT JOIN rooms r ON r.room_id = t.room_id
      WHERE (t.is_deleted = 0 OR t.is_deleted IS NULL)
      ORDER BY t.tenant_id ASC
    `);
    res.json(rows);
  } catch (e) {
    console.error("getTenantOptions error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
}

async function createInvoice(req, res) {
  const conn = await getConn();
  try {
    const {
      period_ym,
      amount,
      due_date,
      rent_amount = 0,
      water_amount = 0,
      electric_amount = 0,
    } = req.body || {};

    if (!period_ym) {
      return res.status(400).json({ error: "period_ym required" });
    }

    if (conn.beginTransaction) await conn.beginTransaction();

    const tenantRaw = pickTenantInput(req);
    const effectiveTenantId = await resolveTenantId(conn, tenantRaw);

    if (!effectiveTenantId) {
      if (conn.rollback) await conn.rollback();
      return res.status(400).json({ error: "invalid tenant (กรุณาเลือกผู้เช่าที่ถูกต้อง)" });
    }

    const [[t]] = await conn.query(
      `SELECT tenant_id, room_id
          FROM tenants
        WHERE tenant_id = ?
          AND (is_deleted = 0 OR is_deleted IS NULL)
        LIMIT 1`,
      [effectiveTenantId]
    );
    if (!t) {
      if (conn.rollback) await conn.rollback();
      return res.status(400).json({ error: "tenant not found" });
    }

    const rent = Number(rent_amount) || 0;
    const water = Number(water_amount) || 0;
    const elec  = Number(electric_amount) || 0;
    const total = Number.isFinite(Number(amount)) ? Number(amount) : rent + water + elec;
    if (!(total > 0)) {
      if (conn.rollback) await conn.rollback();
      return res.status(400).json({ error: "invalid amount" });
    }

    const invoice_no = await getNextInvoiceNo(conn);
    const finalDue   = due_date || computeDueDate(period_ym, req.body?.due_date_day);

    const [ins] = await conn.query(
      `INSERT INTO invoices
          (invoice_no, tenant_id, room_id, period_ym,
           amount, due_date, status,
           rent_amount, water_amount, electric_amount,
           created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, NOW(), NOW())`,
      [invoice_no, effectiveTenantId, t.room_id || null, period_ym,
       total, finalDue, rent, water, elec]
    );

    const payload = {
      tenant_id: effectiveTenantId,
      type: "invoice_created",
      title: "📄 ใบแจ้งหนี้ใหม่",
      body: `รอบบิล ${period_ym}\nยอดชำระ ${total.toLocaleString()} บาท`,
      created_by: req.user?.id ?? null,
    };
    await createNotification(payload, conn);
    await pushLineAfterNotification(null, payload);

    if (conn.commit) await conn.commit();

    const [[created]] = await conn.query(
      `SELECT
          i.id AS invoice_id, i.invoice_no, i.tenant_id, i.room_id, i.period_ym,
          i.amount, i.status, i.due_date, i.paid_at, i.slip_url,
          i.rent_amount, i.water_amount, i.electric_amount,
          i.created_at, i.updated_at
        FROM invoices i WHERE i.id = ? LIMIT 1`,
      [ins.insertId]
    );

    res.status(201).json(created);
  } catch (e) {
    if (conn.rollback) await conn.rollback();
    console.error("createInvoice error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  } finally {
    if (conn.release) conn.release();
  }
}

async function generateMonth(req, res) {
  const { period_ym, amount_default, due_date_day, water_default, electric_default } =
    req.body || {};
  const month = period_ym || new Date().toISOString().slice(0, 7);

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const waterDef = toNum(water_default);
  const elecDef  = toNum(electric_default);

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

      const rent  = Number.isFinite(Number(amount_default))
        ? Number(amount_default)
        : toNum(t.price);

      const water = waterDef;
      const elec  = elecDef;

      const total = rent + water + elec;
      const due_date = computeDueDate(month, due_date_day ?? process.env.RENT_DUE_DAY);

      await conn.query(
        `INSERT INTO invoices
            (invoice_no, tenant_id, room_id, period_ym,
             amount, due_date, status,
             rent_amount, water_amount, electric_amount,
             created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, NOW(), NOW())`,
        [invoice_no, t.tenant_id, t.room_id || null, month, total, due_date, rent, water, elec]
      );
      createdCount++;

      const payload = {
        tenant_id: t.tenant_id,
        type: "invoice_generated",
        title: "ออกใบแจ้งหนี้ประจำงวด",
        body: `งวด ${month} | รหัสบิล ${invoice_no} | ยอด ${total.toLocaleString()} บาท | ครบกำหนด ${due_date}`,
        created_by: req.user?.id ?? null,
      };
      await createNotification(payload, conn);
      await pushLineAfterNotification(null, payload);
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

/* ========= ✅ อนุมัติ/ปฏิเสธ (ใช้เส้นทางเดิมของ Frontend) ========= */
async function decideInvoice(req, res) {
  const conn = await getConn();
  try {
    const invoiceId = req.params.id;
    const { action, approved_by } = req.body;
    if (!invoiceId || !["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "invalid input" });
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
      return res.status(404).json({ error: "invoice not found" });
    }

    if (action === "approve") {
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
          "PM" +
          new Date().toISOString().replace(/[-:TZ.]/g, "").slice(2, 12) +
          String(Math.floor(Math.random() * 90 + 10));

        await conn.query(
          `INSERT INTO payments
              (payment_id, invoice_id, amount, payment_date, slip_url, verified_by, status, note)
            VALUES (?,?,?,?,?,?, 'approved', NULL)`,
          [
            usedPaymentId,
            inv.id,
            inv.amount,
            new Date(),
            inv.slip_url ?? null,
            approved_by ?? req.user?.id ?? null,
          ]
        );
      }

      await conn.query(
        `UPDATE invoices
             SET status='paid', paid_at=NOW(), updated_at=NOW()
           WHERE id=?`,
        [invoiceId]
      );

      const payload = {
        tenant_id: inv.tenant_id,
        type: "payment_approved",
        title: "✅ ชำระเงินอนุมัติแล้ว",
        body: `บิล ${inv.invoice_no} | ยอด ${Number(inv.amount || 0).toLocaleString()} บาท | วันที่ ${new Date()
          .toISOString()
          .slice(0, 10)}`,
        created_by: req.user?.id ?? approved_by ?? null,
      };
      await createNotification(payload, conn);
      await pushLineAfterNotification(null, payload);

      if (conn.commit) await conn.commit();
      return res.json({
        ok: true,
        invoice_id: invoiceId,
        status: "paid",
        message: "อนุมัติการชำระเงินแล้ว",
        payment_id: usedPaymentId,
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

    const payload = {
      tenant_id: inv.tenant_id,
      type: "payment_rejected",
      title: "การชำระเงินถูกปฏิเสธ",
      body: `บิล ${inv.invoice_no} | โปรดอัปโหลดสลิปใหม่หรือชำระอีกครั้ง`,
      created_by: req.user?.id ?? null,
    };
    await createNotification(payload, conn);
    await pushLineAfterNotification(null, payload);

    if (conn.commit) await conn.commit();
    return res.json({
      ok: true,
      invoice_id: invoiceId,
      status: "rejected",
      message: "ปฏิเสธการชำระเงินแล้ว",
    });
  } catch (e) {
    if (conn.rollback) await conn.rollback();
    console.error("decideInvoice error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  } finally {
    if (conn.release) conn.release();
  }
}

async function cancelInvoice(req, res) {
  try {
    const key = req.params.id;
    const useInvoiceNo = /^[A-Za-z]/.test(String(key));

    const [found] = await db.query(
      `SELECT id, tenant_id, invoice_no
          FROM invoices
        WHERE ${useInvoiceNo ? "invoice_no" : "id"} = ?
        LIMIT 1`,
      [key]
    );
    if (!found.length) {
      return res.status(404).json({ error: "invoice not found" });
    }
    const inv = found[0];

    const [r] = await db.query(
      `UPDATE invoices
           SET status='canceled', updated_at = NOW()
         WHERE ${useInvoiceNo ? "invoice_no" : "id"} = ?
           AND status IN ('unpaid','pending','overdue')`,
      [key]
    );
    if (!r.affectedRows) {
      return res
        .status(404)
        .json({ error: "invoice not found or not cancellable" });
    }

    const payload = {
      tenant_id: inv.tenant_id,
      type: "invoice_canceled",
      title: "ยกเลิกใบแจ้งหนี้",
      body: `บิล ${inv.invoice_no} ถูกยกเลิกแล้ว`,
      created_by: req.user?.id ?? null,
    };
    await createNotification(payload);
    await pushLineAfterNotification(null, payload);

    res.json({ ok: true });
  } catch (e) {
    console.error("cancelInvoice error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
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
    if (!inv) return res.status(404).json({ error: "invoice not found" });

    const payload = {
      tenant_id: inv.tenant_id,
      type: "invoice_generated",
      title: "ออกใบแจ้งหนี้ประจำงวด",
      body: `งวด ${inv.period_ym} | รหัสบิล ${inv.invoice_no} | ยอด ${Number(
        inv.amount || 0
      ).toLocaleString()} บาท | ครบกำหนด ${inv.due_date ?? "-"}`,
      created_by: req.user?.id ?? null,
    };
    await createNotification(payload);
    await pushLineAfterNotification(null, payload);

    res.json({ ok: true });
  } catch (e) {
    console.error("resendInvoiceNotification error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
}

/* ================= Exports (รวมทั้งเก่าและใหม่) ================= */

module.exports = {
  // Repair Endpoints (จากโค้ดเดิม)
  myOpenRepairs: exports.myOpenRepairs,
  startRepair: exports.startRepair,
  completeRepair: exports.completeRepair,

  // Invoice Endpoints (จากโค้ดใหม่)
  listRecentInvoices,
  getPendingInvoices,
  getTenantOptions,
  createInvoice,
  generateMonth,
  decideInvoice,
  cancelInvoice,
  resendInvoiceNotification,
};พำ