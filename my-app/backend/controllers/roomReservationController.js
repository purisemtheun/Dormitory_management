// backend/controllers/roomReservationController.js
const db = require("../config/db");

/* ===== สร้างรหัสจองถัดไป: RS0001, RS0002, ... ===== */
async function nextReservationCode() {
  const [[row]] = await db.query(
    `SELECT MAX(CAST(SUBSTRING(reservation_code, 3) AS UNSIGNED)) AS maxn
       FROM room_reservations
      WHERE reservation_code LIKE 'RS%'`
  );
  const n = (row?.maxn || 0) + 1;
  return "RS" + String(n).padStart(4, "0");
}

/** ========== POST /rooms/:roomId/reservations (TENANT) ==========
 * body: { note? }
 * - ตรวจห้องว่าง (อิง tenants เป็นหลัก)
 * - ห้ามผู้ใช้ที่มีห้องอยู่แล้วจองซ้ำ
 * - บันทึก room_reservations (status='pending')
 */
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

    // สร้างคำขอ
    const code = await nextReservationCode();            // ← ใช้ฟังก์ชันที่ถูกต้อง
    const note = String(req.body?.note || "").slice(0, 500) || null;

    const [ins] = await db.query(
      `INSERT INTO room_reservations
         (reservation_code, user_id, room_id, note, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [code, userId, roomId, note]
    );

    return res
      .status(201)
      .json({ ok: true, reservation_id: ins.insertId, reservation_code: code });
  } catch (e) {
    console.error("createReservation error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
};

/** ================= GET /rooms/reservations (ADMIN) ================= */
exports.listReservationsPending = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize || "10", 10)));
    const offset = (page - 1) * pageSize;

    const countSql = `SELECT COUNT(*) AS total FROM room_reservations r WHERE r.status = 'pending'`;
    const dataSql = `
      SELECT
        r.reservation_id,
        r.reservation_code,
        r.user_id,
        r.room_id,
        r.status,
        r.created_at,
        u.name         AS user_name,  -- แสดงชื่อผู้ใช้
        u.email        AS email,
        rm.room_number AS room_number
      FROM room_reservations r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN rooms rm ON rm.room_id = r.room_id
      WHERE r.status = 'pending'
      ORDER BY r.created_at DESC, r.reservation_id DESC
      LIMIT ? OFFSET ?
    `;

    const [[{ total }], [rows]] = await Promise.all([
      db.query(countSql),
      db.query(dataSql, [pageSize, offset]),
    ]);

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

    if (conn.beginTransaction) await conn.beginTransaction();

    const [[rv]] = await conn.query(
      `SELECT reservation_id, user_id, room_id, status
         FROM room_reservations
        WHERE reservation_id = ? FOR UPDATE`,
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
      await conn.query(
        `UPDATE room_reservations SET status='rejected', updated_at=NOW() WHERE reservation_id=?`,
        [id]
      );
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

    await conn.query(
      `UPDATE room_reservations SET status='approved', updated_at=NOW() WHERE reservation_id=?`,
      [id]
    );

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
