// backend/services/notifyService.js
"use strict";
const db = require("../config/db");
const { pushMessage } = require("./lineService");

/**
 * ตารางที่ใช้:
 *  - notifications(id, tenant_id, title, message, created_at, read_at)
 *  - tenant_line_links(tenant_id, line_user_id, linked_at)
 *  - line_push_logs(id, line_user_id, message, status, error, pushed_at)
 *
 * ถ้ายังไม่มี จะสร้างให้ใน ensureTables()
 */

async function ensureTables() {
  const CHARSET = "utf8mb4", COLLATE = "utf8mb4_unicode_ci";

  await db.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      tenant_id VARCHAR(16) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME NULL,
      KEY idx_tenant (tenant_id),
      KEY idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATE};
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS line_push_logs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      line_user_id VARCHAR(64) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(32) NOT NULL,
      error TEXT NULL,
      pushed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_line (line_user_id),
      KEY idx_time (pushed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATE};
  `);

  // tenant_line_links ถูกสร้างแล้วจาก lineController.ensureLineTables()
}

/** in-app notification */
async function createInApp(tenantId, title, message) {
  await ensureTables();
  await db.query(
    `INSERT INTO notifications (tenant_id, title, message) VALUES (?,?,?)`,
    [tenantId, String(title || ""), String(message || "")]
  );
}

/** คืนรายชื่อ LINE user ของ tenant */
async function getLineUsers(tenantId) {
  const [rows] = await db.query(
    `SELECT line_user_id FROM tenant_line_links WHERE tenant_id = ? LIMIT 5`,
    [tenantId]
  );
  return rows.map(r => r.line_user_id).filter(Boolean);
}

/** ส่ง LINE + log */
async function pushLineWithLog(lineUserId, text) {
  try {
    await pushMessage(lineUserId, text);
    await db.query(
      `INSERT INTO line_push_logs (line_user_id, message, status) VALUES (?,?,?)`,
      [lineUserId, text, "OK"]
    );
  } catch (e) {
    await db.query(
      `INSERT INTO line_push_logs (line_user_id, message, status, error) VALUES (?,?,?,?)`,
      [lineUserId, text, "ERR", e?.message || String(e)]
    );
  }
}

/**
 * ฟังก์ชันหลัก: แจ้งผู้เช่า 1 คน
 * options = { inapp: true, line: true }
 */
async function notifyTenant(tenantId, title, message, options = {}) {
  const opt = { inapp: true, line: true, ...options };

  if (opt.inapp) await createInApp(tenantId, title, message);

  if (opt.line) {
    const ids = await getLineUsers(tenantId);
    if (ids.length) {
      // ส่งเรียงทีละคน (กัน rate limit / error ล้มครืน)
      for (const uid of ids) {
        await pushLineWithLog(uid, `🔔 ${title}\n${message || ""}`.trim());
        await new Promise(r => setTimeout(r, 250)); // หน่วงเล็กน้อย
      }
    }
  }
}

module.exports = {
  notifyTenant,
  ensureTables,
};
