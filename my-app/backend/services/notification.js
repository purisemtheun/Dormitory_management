// backend/services/notification.js
const db = require('../config/db');
const { pushLineAfterNotification } = require('./notifyAfterInsert');

/**
 * สร้าง notification แล้วพยายามส่ง LINE ทันที (แบบ non-blocking)
 * - ถ้ามี conn (อยู่ใน transaction) จะใช้ conn
 * - ไม่ throw ออกนอก ให้ caller ไม่พัง
 * @param {object} params
 *   - tenant_id: string
 *   - type: 'invoice_created'|'payment_approved'|'repair_started'|string
 *   - title: string
 *   - body?: string
 *   - created_by?: number | null
 * @param {object|null} conn Optional connection (เริ่มจาก transaction ภายนอก)
 * @returns {Promise<{ok:boolean, id?:number}>}
 */
async function createNotification(params, conn = null) {
  const { tenant_id, type, title, body = '', created_by = null } = params || {};
  if (!tenant_id || !type || !title) {
    return { ok: false, error: 'tenant_id, type, title are required' };
  }

  const runner = conn ?? db;

  try {
    const [ins] = await runner.query(
      `INSERT INTO notifications (tenant_id, type, title, body, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [tenant_id, type, title, body, created_by]
    );
    const id = ins.insertId || null;

    // ยิง LINE แบบ async และอัปเดตผลลัพธ์ไว้ในตาราง (ไม่ block response)
    (async () => {
      const res = await pushLineAfterNotification(conn, { tenant_id, type, title, body });
      try {
        if (res?.ok) {
          await runner.query(
            `UPDATE notifications
                SET sent_line_at = NOW(), line_status='ok', line_error=NULL
              WHERE id = ? LIMIT 1`,
            [id]
          );
        } else if (res?.reason === 'NO_LINE_LINK') {
          await runner.query(
            `UPDATE notifications
                SET line_status='unlinked', line_error=NULL
              WHERE id = ? LIMIT 1`,
            [id]
          );
        } else {
          await runner.query(
            `UPDATE notifications
                SET line_status='fail', line_error=?
              WHERE id = ? LIMIT 1`,
            [String(res?.error || res?.reason || 'unknown'), id]
          );
        }
      } catch (e) {
        // เงียบไว้ เพื่อไม่ให้กระทบ flow หลัก
        console.warn('[notification] update status failed:', e?.message || e);
      }
    })().catch(() => {});

    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

module.exports = { createNotification };
