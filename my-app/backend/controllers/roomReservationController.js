// backend/controllers/roomReservationController.js
const db = require("../config/db");

/* ---------- Schema detector & mapper ---------- */
let RESV_SCHEMA_CACHE = null;
async function getResvSchema(conn = db) {
  if (RESV_SCHEMA_CACHE) return RESV_SCHEMA_CACHE;
  const [cols] = await conn.query(`SHOW COLUMNS FROM room_reservations`);
  const names = new Set(cols.map(c => c.Field.toLowerCase()));

  // legacy (localhost): reservation_id, reservation_code, updated_at
  // new (Aiven dump):  id, (no code), decided_at/decided_by
  const isLegacy = names.has("reservation_id");
  const hasCode  = names.has("reservation_code");

  RESV_SCHEMA_CACHE = {
    isLegacy,
    hasCode,
    // primary key column
    pk: isLegacy ? "reservation_id" : "id",
    // time columns
    hasUpdatedAt: names.has("updated_at"),
    hasDecided: names.has("decided_at") || names.has("decided_by"),
    // common columns we rely on
    hasNote: names.has("note"),
    // columns list for safety
    cols: names
  };
  return RESV_SCHEMA_CACHE;
}

/* ===== next reservation code (only when table supports it) ===== */
async function nextReservationCode() {
  const schema = await getResvSchema();
  if (!schema.hasCode) return null; // new schema ไม่มี code
  const [[row]] = await db.query(
    `SELECT MAX(CAST(SUBSTRING(reservation_code, 3) AS UNSIGNED)) AS maxn
       FROM room_reservations
      WHERE reservation_code LIKE 'RS%'`
  );
  const n = (row?.maxn || 0) + 1;
  return "RS" + String(n).padStart(4, "0");
}

/** ========== POST /rooms/:roomId/reservations (TENANT) ========== */
exports.createReservation = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "unauthorized" });

    const roomId = req.params.roomId;
    if (!roomId) return res.status(400).json({ error: "missing room id" });

    // ผู้ใช้นี้มีห้องอยู่แล้วไหม?
    const [[mine]] = await db.query(
      `SELECT tenant_id
         FROM tenants
        WHERE user_id=? AND (is_deleted=0 OR is_deleted IS NULL)
        LIMIT 1`,
      [userId]
    );
    if (mine) {
      return res.status(409).json({ error: "คุณมีห้องอยู่แล้ว ไม่สามารถจองซ้ำได้" });
    }

    // ห้องนี้ยังว่างไหม?
    const [[rm]] = await db.query(
      `
      SELECT r.room_id,
             CASE
               WHEN EXISTS (SELECT 1 FROM tenants t WHERE t.room_id=r.room_id AND t.is_deleted=0)
                 THEN 'occupied'
               WHEN EXISTS (SELECT 1 FROM room_reservations x WHERE x.room_id=r.room_id AND x.status='pending')
                 THEN 'reserved'
               ELSE 'available'
             END AS occupancy
        FROM rooms r
       WHERE r.room_id = ?
      `,
      [roomId]
    );
    if (!rm) return res.status(404).json({ error: "ไม่พบห้อง" });
    if (rm.occupancy !== "available") {
      return res.status(409).json({ error: "ห้องนี้ไม่ว่างแล้ว" });
    }

    const schema = await getResvSchema();
    const code = await nextReservationCode();
    const note = String(req.body?.note || "").slice(0, 500) || null;

    // สร้าง SQL insert ให้เข้ากับ schema
    let sql, params;
    if (schema.isLegacy) {
      // legacy: มี reservation_code, updated_at
      sql = `INSERT INTO room_reservations
               (reservation_code, user_id, room_id, note, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'pending', NOW(), NOW())`;
      params = [code, userId, roomId, note];
    } else {
      // new: ไม่มี code/updated_at, มี decided_at/by (ปล่อย NULL)
      if (schema.hasNote) {
        sql = `INSERT INTO room_reservations
                 (user_id, room_id, note, status, created_at)
               VALUES (?, ?, ?, 'pending', NOW())`;
        params = [userId, roomId, note];
      } else {
        sql = `INSERT INTO room_reservations
                 (user_id, room_id, status, created_at)
               VALUES (?, ?, 'pending', NOW())`;
        params = [userId, roomId];
      }
    }

    const [ins] = await db.query(sql, params);
    const insertedId = schema.isLegacy ? ins.insertId : ins.insertId;

    return res
      .status(201)
      .json({
        ok: true,
        reservation_id: insertedId,
        reservation_code: code, // อาจเป็น null ใน schema ใหม่ (ฟรอนต์ควรทนได้)
      });
  } catch (e) {
    console.error("createReservation error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
};

/** ================= GET /rooms/reservations (ADMIN) =================
 * query: ?status=pending|approved|rejected|canceled|all  (default 'pending')
 *         &page=1&pageSize=10
 */
exports.listReservationsPending = async (req, res) => {
  try {
    const statusQ = String(req.query.status || "pending").toLowerCase();
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize || "10", 10)));
    const offset = (page - 1) * pageSize;

    const schema = await getResvSchema();

    const isAll = statusQ === "all";
    const where = isAll ? "1=1" : "r.status = ?";
    const whereParams = isAll ? [] : [statusQ];

    const countSql = `SELECT COUNT(*) AS total FROM room_reservations r WHERE ${where}`;
    const [countRows] = await db.query(countSql, whereParams);
    const total = countRows[0]?.total || 0;

    // สร้าง select ให้ได้ฟิลด์ที่ฟรอนต์ใช้ โดย map ชื่อคอลัมน์ตาม schema
    const pk = schema.pk; // reservation_id หรือ id
    const codeSel = schema.hasCode ? "r.reservation_code" : "NULL AS reservation_code";
    const updatedSel = schema.hasUpdatedAt ? "r.updated_at" : "r.created_at AS updated_at";

    const dataSql = `
      SELECT
        r.${pk}           AS reservation_id,
        ${codeSel},
        r.user_id,
        r.room_id,
        r.status,
        r.created_at,
        ${updatedSel},
        u.name            AS user_name,
        u.email           AS email,
        rm.room_number    AS room_number
      FROM room_reservations r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN rooms rm ON rm.room_id = r.room_id
      WHERE ${where}
      ORDER BY r.created_at DESC, r.${pk} DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(dataSql, [...whereParams, pageSize, offset]);

    res.json({ data: rows, total, page, pageSize });
  } catch (err) {
    console.error("listReservationsPending error:", err);
    res.status(500).json({ error: "Failed to fetch reservations" });
  }
};

/** ===== PATCH /rooms/reservations/:id/decision (ADMIN) ===== */
exports.decideReservation = async (req, res) => {
  const conn = typeof db.getConnection === "function" ? await db.getConnection() : db;
  try {
    const id = req.params.id;
    const action = String(req.body?.action || "").toLowerCase();
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "action ต้องเป็น 'approve' หรือ 'reject'" });
    }

    const schema = await getResvSchema(conn);
    const pk = schema.pk;

    if (conn.beginTransaction) await conn.beginTransaction();

    const [[rv]] = await conn.query(
      `SELECT ${pk} AS reservation_id, user_id, room_id, status
         FROM room_reservations
        WHERE ${pk} = ? FOR UPDATE`,
      [id]
    );
    if (!rv) {
      if (conn.rollback) await conn.rollback();
      return res.status(404).json({ error: "reservation not found" });
    }
    if (String(rv.status).toLowerCase() !== "pending") {
      if (conn.rollback) await conn.rollback();
      return res.status(409).json({ error: "คำขอไม่ได้อยู่ในสถานะรออนุมัติ" });
    }

    if (action === "reject") {
      const base = `UPDATE room_reservations SET status='rejected'`;
      const tail = schema.hasUpdatedAt ? `, updated_at=NOW()` : (schema.hasDecided ? `, decided_at=NOW()` : ``);
      await conn.query(`${base}${tail} WHERE ${pk}=?`, [id]);
      if (conn.commit) await conn.commit();
      return res.json({ ok: true, status: "rejected" });
    }

    // approve → ตรวจห้องยังว่าง
    const [[rm]] = await conn.query(
      `
      SELECT r.room_id,
             CASE
               WHEN EXISTS (SELECT 1 FROM tenants t WHERE t.room_id = r.room_id AND t.is_deleted = 0)
                 THEN 'occupied'
               ELSE 'available'
             END AS occupancy
        FROM rooms r
       WHERE r.room_id = ? FOR UPDATE
      `,
      [rv.room_id]
    );
    if (!rm) {
      if (conn.rollback) await conn.rollback();
      return res.status(400).json({ error: "ไม่พบห้องที่จอง" });
    }
    if (rm.occupancy !== "available") {
      if (conn.rollback) await conn.rollback();
      return res.status(409).json({ error: "ห้องถูกใช้งานแล้ว" });
    }

    // สร้าง tenant_id ใหม่
    const [[row]] = await conn.query(
      "SELECT MAX(CAST(REPLACE(tenant_id,'T','') AS UNSIGNED)) AS maxn FROM tenants"
    );
    const next = (row?.maxn || 0) + 1;
    const tenantId = "T" + String(next).padStart(4, "0");

    await conn.query(
      `INSERT INTO tenants (tenant_id, user_id, room_id, checkin_date, is_deleted)
       VALUES (?, ?, ?, CURDATE(), 0)`,
      [tenantId, rv.user_id, rv.room_id]
    );

    await conn.query(`UPDATE rooms SET updated_at = NOW() WHERE room_id = ?`, [rv.room_id]);

    const base = `UPDATE room_reservations SET status='approved'`;
    const tail = schema.hasUpdatedAt
      ? `, updated_at=NOW()`
      : (schema.hasDecided ? `, decided_at=NOW(), decided_by=?` : ``);

    const params = schema.hasDecided ? [req.user?.id ?? null, id] : [id];
    await conn.query(`${base}${tail} WHERE ${pk}=?`, params);

    if (conn.commit) await conn.commit();
    return res.json({ ok: true, status: "approved", tenant_id: tenantId });
  } catch (e) {
    if (conn.rollback) await conn.rollback();
    console.error("decideReservation error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  } finally {
    if (conn.release) conn.release();
  }
};
