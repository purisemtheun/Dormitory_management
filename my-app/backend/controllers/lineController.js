const db = require("../config/db");

function randomCode6() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0,O,1,I
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function getTenantIdByUser(userId) {
  const [[row]] = await db.query(
    `SELECT tenant_id FROM tenants
      WHERE user_id = ? AND (is_deleted IS NULL OR is_deleted = 0)
      ORDER BY COALESCE(checkin_date, '0000-00-00') DESC, tenant_id DESC
      LIMIT 1`,
    [userId]
  );
  return row?.tenant_id || null;
}

async function getLineStatus(req, res) {
  try {
    const userId = req.user?.id ?? req.user?.user_id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // หา tenant_id ของ user
    const [[ten]] = await db.query(
      `SELECT tenant_id
         FROM tenants
        WHERE user_id = ?
          AND (is_deleted IS NULL OR is_deleted = 0)
        ORDER BY COALESCE(checkin_date,'0000-00-00') DESC, tenant_id DESC
        LIMIT 1`,
      [userId]
    );
    if (!ten) return res.json({ linked: false });

    // ตารางของคุณมี: tenant_id, line_user_id, linked_at (ไม่มี id/created_at/display_name)
    const [rows] = await db.query(
      `SELECT tenant_id, line_user_id, linked_at
         FROM tenant_line_links
        WHERE tenant_id = ?
        ORDER BY linked_at DESC
        LIMIT 1`,
      [ten.tenant_id]  // NOTE: ของคุณ tenant_id เป็นสตริงเช่น "T0001"
    );

    if (!rows.length) return res.json({ linked: false });

    const r = rows[0];
    return res.json({
      linked: true,
      linkedAt: r.linked_at,
      lineDisplayName: null, // ยังไม่มีคอลัมน์ชื่อ → เว้นไว้ก่อน
    });
  } catch (e) {
    console.error("getLineStatus error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
}

/** POST /api/line/link-token */
async function postLinkToken(req, res) {
  try {
    const userId = req.user?.id ?? req.user?.user_id;
    const role = (req.user?.role || "").toLowerCase();
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // 👉 ปกติควรจำกัดเฉพาะ tenant:
    if (!["tenant"].includes(role)) {
      // ช่วงทดสอบจะยอม admin ก็ได้: if (!["tenant","admin","staff"].includes(role)) ...
      return res.status(403).json({ error: "Forbidden" });
    }

    const tenantId = await getTenantIdByUser(userId);
    if (!tenantId) return res.status(400).json({ error: "ไม่พบ tenant ของผู้ใช้" });

    const code = randomCode6();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 นาที

    await db.query(
      `INSERT INTO link_tokens
         (user_id, tenant_id, code, expires_at, used, created_at)
       VALUES (?,?,?,?,0,NOW())`,
      [userId, tenantId, code, expiresAt]
    );

    res.status(201).json({ code, expiresAt: expiresAt.toISOString() });
  } catch (e) {
    console.error("postLinkToken error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
}

module.exports = { getLineStatus, postLinkToken };
