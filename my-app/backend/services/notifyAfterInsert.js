// backend/services/notifyAfterInsert.js
const db = require('../config/db');
const { pushMessage } = require('./lineService');

/**
 * ใช้หลังจาก INSERT ลง notifications แล้ว
 * - connOrDb: ส่ง conn (ในทรานแซกชัน) ถ้ามี; ไม่มีก็ปล่อยว่าง ให้ fallback เป็น db ปกติ
 * - payload: { tenant_id, type, title, body }
 */
async function pushLineAfterNotification(connOrDb, { tenant_id, type, title, body }) {
  const sql = (connOrDb && typeof connOrDb.query === 'function') ? connOrDb : db;

  const [[ll]] = await sql.query(
    `SELECT line_user_id FROM line_links WHERE tenant_id=? LIMIT 1`,
    [tenant_id]
  );
  if (!ll?.line_user_id) return;

  try {
    await pushMessage(ll.line_user_id, `${title}\n${body}`);
    await sql.query(
      `INSERT INTO line_push_logs (tenant_id, line_user_id, type, title, body, status)
       VALUES (?,?,?,?,?,'success')`,
      [tenant_id, ll.line_user_id, type, title, body]
    );
  } catch (e) {
    await sql.query(
      `INSERT INTO line_push_logs (tenant_id, line_user_id, type, title, body, status, error_msg)
       VALUES (?,?,?,?,?,'failed',?)`,
      [tenant_id, ll.line_user_id, type, title, body, e.message]
    );
  }
}

module.exports = { pushLineAfterNotification };
