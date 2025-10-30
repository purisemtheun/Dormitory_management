const db = require("../config/db");

/* ========= Helper ========= */
async function makeTenantId() {
  const [[row]] = await db.query(
    "SELECT MAX(CAST(REPLACE(tenant_id,'T','') AS UNSIGNED)) AS maxn FROM tenants"
  );
  const next = (row?.maxn || 0) + 1;
  return "T" + String(next).padStart(4, "0");
}

/* ========= Normalizer (ใช้กับหน้าแอดมินที่ยังต้องการ 2 สถานะ) ========= */
function normalizeStatus(status) {
  const k = String(status || "").toLowerCase();
  // สำหรับกรณีรับมาจากตาราง rooms ให้เหลือสองค่านี้เท่านั้น
  return k === "available" ? "available" : "occupied";
}

/* ========= Admin/Staff: ดึงห้องทั้งหมด (คงเดิม: 2 สถานะ) ========= */
// ========= Admin/Staff: ดึงห้องทั้งหมด (คำนวณสถานะจาก tenants + reservations) =========
exports.listRooms = async (req, res) => {
  try {
    // listRooms (ย่อใจความ)
const [rows] = await db.query(`
  SELECT
    r.room_id, r.room_number, r.price,
    CASE
      WHEN EXISTS (SELECT 1 FROM tenants t WHERE t.room_id=r.room_id AND t.is_deleted=0)
        THEN 'occupied'
      WHEN EXISTS (SELECT 1 FROM room_reservations x WHERE x.room_id=r.room_id AND x.status='pending')
        THEN 'reserved'
      ELSE 'available'
    END AS status,
    r.has_fan, r.has_aircon, r.has_fridge
  FROM rooms r
  ORDER BY CAST(r.room_number AS UNSIGNED), r.room_id ASC
`);
res.json(rows);

  } catch (e) {
    console.error("listRooms error:", e);
    res.status(500).json({ error: e.message || "Internal server error" });
  }
};


/* ========= Admin/Staff: สร้างห้อง ========= */
exports.createRoom = async (req, res) => {
  try {
    const {
      room_id,
      room_number,
      price,
      status = "available",
      has_fan = false,
      has_aircon = false,
      has_fridge = false,
    } = req.body;

    if (!room_id || !room_number) {
      return res.status(400).json({ error: "room_id และ room_number จำเป็นต้องมี" });
    }

    await db.query(
      `
      INSERT INTO rooms
        (room_id, room_number, price, status, has_fan, has_aircon, has_fridge)
      VALUES (?,?,?,?,?,?,?)
      `,
      [room_id, room_number, price ?? null, normalizeStatus(status), !!has_fan, !!has_aircon, !!has_fridge]
    );

    res.status(201).json({ message: "created" });
  } catch (e) {
    console.error("createRoom error:", e);
    res.status(500).json({ error: e.message || "Internal server error" });
  }
};

/* ========= Admin/Staff: อัปเดตห้อง ========= */
exports.updateRoom = async (req, res) => {
  try {
    const id = req.params.id;
    const { room_number, price, status, has_fan, has_aircon, has_fridge } = req.body;

    const [ret] = await db.query(
      `
      UPDATE rooms SET
        room_number = COALESCE(?, room_number),
        price       = COALESCE(?, price),
        status      = COALESCE(?, status),
        has_fan     = COALESCE(?, has_fan),
        has_aircon  = COALESCE(?, has_aircon),
        has_fridge  = COALESCE(?, has_fridge)
      WHERE room_id = ?
      `,
      [
        room_number ?? null,
        price ?? null,
        status != null ? normalizeStatus(status) : null,
        has_fan,
        has_aircon,
        has_fridge,
        id,
      ]
    );

    if (ret.affectedRows === 0) return res.status(404).json({ error: "Room not found" });
    res.json({ message: "updated" });
  } catch (e) {
    console.error("updateRoom error:", e);
    res.status(500).json({ error: e.message || "Internal server error" });
  }
};

/* ========= Admin/Staff: ลบห้อง ========= */
exports.deleteRoom = async (req, res) => {
  try {
    const id = req.params.id;

    // กันลบถ้ามีผู้เช่าอ้างอิง
    const [[{ count }]] = await db.query(
      "SELECT COUNT(*) AS count FROM tenants WHERE room_id = ? AND is_deleted = 0",
      [id]
    );
    if (count > 0) {
      return res
        .status(400)
        .json({ error: "ไม่สามารถลบได้เนื่องจากมีผู้เช่าใช้งานห้องนี้อยู่ โปรดลบผู้เช่าก่อน" });
    }

    const [ret] = await db.query("DELETE FROM rooms WHERE room_id = ?", [id]);
    if (ret.affectedRows === 0) return res.status(404).json({ error: "Room not found" });

    res.json({ message: "deleted" });
  } catch (e) {
    res.status(500).json({ error: e.message || "Internal server error" });
  }
};

/* ========= Admin/Staff: ผูกห้องให้ผู้เช่า (Check-in) ========= */
exports.bookRoomForTenant = async (req, res) => {
  try {
    const roomId = req.params.id;
    const { userId, checkin_date } = req.body;
    if (!userId) return res.status(400).json({ error: "ต้องมี userId" });

    const today = new Date().toISOString().slice(0, 10);
    const checkinDate = checkin_date || today;

    const [[room]] = await db.query("SELECT room_id, status FROM rooms WHERE room_id = ?", [roomId]);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (normalizeStatus(room.status) === "occupied")
      return res.status(400).json({ error: "Room already occupied" });

    const [[user]] = await db.query("SELECT id, role FROM users WHERE id = ?", [userId]);
    if (!user) return res.status(404).json({ error: "User not found" });

    const [roomTenant] = await db.query(
      "SELECT tenant_id FROM tenants WHERE room_id = ? AND is_deleted = 0 LIMIT 1",
      [roomId]
    );
    if (roomTenant.length) return res.status(400).json({ error: "Room already has a tenant" });

    const [existAssigned] = await db.query(
      "SELECT tenant_id FROM tenants WHERE user_id = ? AND room_id IS NOT NULL AND is_deleted = 0 LIMIT 1",
      [userId]
    );
    if (existAssigned.length) return res.status(400).json({ error: "User already checked-in" });

    const [upd] = await db.query(
      `
      UPDATE tenants
         SET room_id = ?, checkin_date = COALESCE(?, checkin_date), is_deleted = 0
       WHERE user_id = ?
         AND (room_id IS NULL OR room_id = '')
       LIMIT 1
      `,
      [roomId, checkinDate, userId]
    );

    let tenantId;
    let mode;

    if (upd.affectedRows > 0) {
      const [[row]] = await db.query(
        "SELECT tenant_id FROM tenants WHERE user_id = ? AND room_id = ? AND is_deleted = 0 LIMIT 1",
        [userId, roomId]
      );
      tenantId = row?.tenant_id || null;
      mode = "updated";
    } else {
      const tenantIdNew = await makeTenantId();
      await db.query(
        "INSERT INTO tenants (tenant_id, user_id, room_id, checkin_date, is_deleted) VALUES (?,?,?,?,0)",
        [tenantIdNew, userId, roomId, checkinDate]
      );
      tenantId = tenantIdNew;
      mode = "inserted";
    }

    await db.query("UPDATE rooms SET status = ? WHERE room_id = ?", ["occupied", roomId]);
    return res.status(201).json({ message: "Check-in success", tenant_id: tenantId, mode });
  } catch (err) {
    console.error("bookRoomForTenant error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};

/* ========= Tenant: ดึงห้องของฉัน ========= */
exports.getMyRoom = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.user_id ?? req.user?.uid ?? null;
    if (!userId) return res.status(401).json({ error: "Unauthorized", code: "NO_USER_ID" });

    const [rows] = await db.query(
      `
      SELECT r.room_id, r.room_number, r.price, r.status,
             r.has_fan, r.has_aircon, r.has_fridge
      FROM rooms r
      JOIN tenants t ON r.room_id = t.room_id
      WHERE t.user_id = ? AND t.is_deleted = 0
      `,
      [userId]
    );

    const data = rows.map((r) => ({ ...r, status: normalizeStatus(r.status) }));
    res.json(data); // คืน array
  } catch (e) {
    console.error("getMyRoom error:", e);
    res.status(500).json({ error: e.message || "Internal server error" });
  }
};

/* ========= (ใหม่) Board: ผังสถานะห้อง — คืน 3 สถานะ (available/reserved/occupied) ========= */
exports.getRoomBoard = async (req, res) => {
  try {
    const myId = req.user?.id ?? req.user?.user_id ?? null;

    const [rows] = await db.query(`
      SELECT
        r.room_id,
        r.room_number,
        r.price,
        r.has_fan, r.has_aircon, r.has_fridge,

        /* ผู้เช่าปัจจุบัน (ถ้ามี) */
        (SELECT t.user_id
           FROM tenants t
          WHERE t.room_id = r.room_id AND t.is_deleted = 0
          LIMIT 1) AS current_tenant_user_id,

        /* ผู้ที่จองค้าง (pending) คนแรก (ถ้ามี) */
        (SELECT rr.user_id
           FROM room_reservations rr
          WHERE rr.room_id = r.room_id AND rr.status = 'pending'
          ORDER BY rr.created_at ASC
          LIMIT 1) AS reserved_user_id,

        /* สถานะรวม 3 ค่า: occupied / reserved / available */
        CASE
          WHEN EXISTS (SELECT 1 FROM tenants t WHERE t.room_id = r.room_id AND t.is_deleted = 0)
            THEN 'occupied'
          WHEN EXISTS (SELECT 1 FROM room_reservations rr WHERE rr.room_id = r.room_id AND rr.status = 'pending')
            THEN 'reserved'
          ELSE 'available'
        END AS status
      FROM rooms r
      ORDER BY CAST(r.room_number AS UNSIGNED), r.room_id ASC
    `);

    const data = rows.map((r) => {
      const st = String(r.status || "").toLowerCase(); // 'available' | 'reserved' | 'occupied'
      const reservedByMe =
        !!myId && r.reserved_user_id != null && Number(r.reserved_user_id) === Number(myId);

      return {
        room_id: r.room_id,
        room_number: r.room_number,
        price: r.price,
        status: st,
        current_tenant_user_id: r.current_tenant_user_id
          ? Number(r.current_tenant_user_id)
          : null,
        reserved_user_id: r.reserved_user_id ? Number(r.reserved_user_id) : null,
        reserved_by_me: reservedByMe,
        highlights: [
          r.has_fan ? "พัดลม" : null,
          r.has_aircon ? "แอร์" : null,
          r.has_fridge ? "ตู้เย็น" : null,
        ].filter(Boolean),
      };
    });

    res.json(data);
  } catch (e) {
    console.error("getRoomBoard error:", e);
    res.status(500).json({ error: e.message || "Internal server error" });
  }
};
