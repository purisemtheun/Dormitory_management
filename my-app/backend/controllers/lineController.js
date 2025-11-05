// backend/controllers/lineController.js
"use strict";
const db = require("../config/db");

/* ========= bootstraps: สร้างตารางที่จำเป็น (ถ้ายังไม่มี) ========= */
async function ensureLineTables() {
  // ใช้ collation/charset เดียวกับ session
  const CHARSET = "utf8mb4";
  const COLLATE = "utf8mb4_unicode_ci";

  // 1) ตาราง mapping ผู้เช่า ↔ LINE user
  await db.query(`
    CREATE TABLE IF NOT EXISTS tenant_line_links (
      tenant_id     VARCHAR(16)  NOT NULL,
      line_user_id  VARCHAR(64)  NOT NULL,
      linked_at     DATETIME     NOT NULL,
      PRIMARY KEY (tenant_id),
      UNIQUE KEY uniq_line_user (line_user_id),
      KEY idx_linked_at (linked_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATE};
  `);

  // 2) ตารางโค้ดจับคู่ (6 ตัว) สำหรับผูกบัญชี
  await db.query(`
    CREATE TABLE IF NOT EXISTS link_tokens (
      code        CHAR(6)     NOT NULL,
      user_id     BIGINT      NOT NULL,
      tenant_id   VARCHAR(16) NOT NULL,
      expires_at  DATETIME    NULL,
      used        TINYINT     NOT NULL DEFAULT 0,
      used_at     DATETIME    NULL,
      created_at  DATETIME    NOT NULL,
      PRIMARY KEY (code),
      KEY idx_tenant (tenant_id),
      KEY idx_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATE};
  `);

  // 3) ตารางตั้งค่า LINE (เก็บแบบเข้ารหัส ถ้ามี)
  await db.query(`
    CREATE TABLE IF NOT EXISTS line_settings (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      channel_id     VARCHAR(64) NULL,
      channel_secret VARBINARY(255) NULL,
      access_token   VARBINARY(4096) NULL,
      updated_by     VARCHAR(128) NULL,
      updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                       ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATE};
  `);
}

/* ========= helpers ========= */
function randomCode6() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ตัด 0,O,1,I
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function getTenantIdByUser(userId) {
  const [[row]] = await db.query(
    `SELECT tenant_id
       FROM tenants
      WHERE user_id = ?
        AND (is_deleted IS NULL OR is_deleted = 0)
      ORDER BY COALESCE(checkin_date,'0000-00-00') DESC, tenant_id DESC
      LIMIT 1`,
    [userId]
  );
  return row?.tenant_id || null;
}

/* ========= GET /api/line/status ========= */
async function getLineStatus(req, res) {
  try {
    const userId = req.user?.id ?? req.user?.user_id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await ensureLineTables();

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

    const [rows] = await db.query(
      `SELECT tenant_id, line_user_id, linked_at
         FROM tenant_line_links
        WHERE tenant_id = ?
        ORDER BY linked_at DESC
        LIMIT 1`,
      [ten.tenant_id]
    );

    if (!rows.length) return res.json({ linked: false });

    const r = rows[0];
    return res.json({
      linked: true,
      linkedAt: r.linked_at,
      lineDisplayName: null, // ไม่มีคอลัมน์ display name ในตาราง — เว้นไว้ก่อน
    });
  } catch (e) {
    console.error("getLineStatus error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
}

/* ========= POST /api/line/link-token ========= */
async function postLinkToken(req, res) {
  try {
    const userId = req.user?.id ?? req.user?.user_id;
    const role = (req.user?.role || "").toLowerCase();
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // ปกติจำกัดเฉพาะ tenant
    if (!["tenant"].includes(role)) return res.status(403).json({ error: "Forbidden" });

    await ensureLineTables();

    const tenantId = await getTenantIdByUser(userId);
    if (!tenantId) return res.status(400).json({ error: "ไม่พบ tenant ของผู้ใช้" });

    const code = randomCode6();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // อายุ 10 นาที

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

module.exports = { ensureLineTables, getLineStatus, postLinkToken };
