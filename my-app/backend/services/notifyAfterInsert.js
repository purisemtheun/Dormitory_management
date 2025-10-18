// backend/services/notifyAfterInsert.js
// ส่ง LINE หลังจากสร้าง notification แล้ว
// - ไม่ throw ออกนอกฟังก์ชัน เพื่อไม่ให้ transaction หลุด
// - log ให้ดูง่ายใน console เสมอ

const db = require('../config/db');
const { pushMessage } = require('./lineService');

/** หา line_user_id ล่าสุดจาก tenant_id */
async function getLineIdByTenant(tenantId, conn) {
  const runner = conn ?? db;
  const [[link]] = await runner.query(
    `SELECT line_user_id
       FROM tenant_line_links
      WHERE tenant_id = ?
      ORDER BY linked_at DESC
      LIMIT 1`,
    [tenantId]
  );
  return link?.line_user_id ? String(link.line_user_id).trim() : null;
}

/**
 * ส่ง LINE ตาม notification ที่เพิ่งสร้าง
 * @param {object|null} conn - connection ปัจจุบัน (จะใช้ conn ถ้ามี)
 * @param {object} p
 * @param {string} p.tenant_id
 * @param {string} p.type
 * @param {string} p.title
 * @param {string} [p.body]
 */
async function pushLineAfterNotification(conn, { tenant_id, type, title, body }) {
  try {
    if (!tenant_id) {
      console.warn('[LINE][notifyAfterInsert] missing tenant_id');
      return { ok: false, reason: 'NO_TENANT' };
    }
    const to = await getLineIdByTenant(tenant_id, conn);
    if (!to) {
      console.warn(`[LINE][notifyAfterInsert] tenant ${tenant_id} has no linked LINE user`);
      return { ok: false, reason: 'NO_LINE_LINK' };
    }

    // รูปแบบข้อความ (สั้น กระชับ)
    const text = body ? `${title}\n${body}` : String(title ?? '');

    console.log('[LINE][push] to:', to, '| title:', title);
    await pushMessage(to, text);

    // ถ้ามีตาราง log ก็เขียนเพิ่มได้ (optional)
    // const runner = conn ?? db;
    // await runner.query(
    //   `INSERT INTO line_message_logs (tenant_id, line_user_id, title, body, type, sent_at, status)
    //    VALUES (?,?,?,?,?,NOW(),'ok')`,
    //   [tenant_id, to, title, body ?? '', type]
    // );

    return { ok: true, to };
  } catch (e) {
    console.error('[LINE][notifyAfterInsert] error:', e?.stack || e);

    // optional: log ลง DB ถ้าต้องการ
    // try {
    //   const runner = conn ?? db;
    //   await runner.query(
    //     `INSERT INTO line_message_logs (tenant_id, line_user_id, title, body, type, sent_at, status, error)
    //      VALUES (?,?,?,?,?,NOW(),'fail',?)`,
    //     [tenant_id, null, title, body ?? '', type, String(e.message || e)]
    //   );
    // } catch {}

    return { ok: false, error: e.message || String(e) };
  }
}

module.exports = { pushLineAfterNotification };
