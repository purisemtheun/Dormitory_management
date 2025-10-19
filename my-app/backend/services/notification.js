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

  // ใช้ runner สำหรับ "insert" เท่านั้น (อาจเป็น conn ในทรานแซกชัน)
  const runner = conn ?? db;

  try {
    const [ins] = await runner.query(
      `INSERT INTO notifications (tenant_id, type, title, body, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [tenant_id, type, title, body, created_by]
    );
    const id = ins?.insertId ?? null;

    // ยิง LINE แบบ async ด้วย pool หลักเสมอ (ไม่ใช้ conn เดิม)
    setTimeout(async () => {
      try {
        const res = await pushLineAfterNotification(null, { tenant_id, type, title, body });
        if (!id) return; // ถ้าไม่มี id ก็ไม่ต้องอัปเดตสถานะ

        if (res?.ok) {
          await db.query(
            `UPDATE notifications
               SET sent_line_at = NOW(), line_status='ok', line_error=NULL
             WHERE id = ? LIMIT 1`,
            [id]
          );
        } else if (res?.reason === 'NO_LINE_LINK') {
          await db.query(
            `UPDATE notifications
               SET line_status='unlinked', line_error=NULL
             WHERE id = ? LIMIT 1`,
            [id]
          );
        } else {
          await db.query(
            `UPDATE notifications
               SET line_status='fail', line_error=?
             WHERE id = ? LIMIT 1`,
            [String(res?.error || res?.reason || 'unknown'), id]
          );
        }
      } catch (err) {
        // ถ้า push/อัปเดตพัง ให้ติดธง fail ไว้เพื่อ debug
        if (id) {
          try {
            await db.query(
              `UPDATE notifications
                 SET line_status='fail', line_error=?
               WHERE id = ? LIMIT 1`,
              [String(err?.message || err), id]
            );
          } catch (_) { /* กลืน เพื่อไม่ให้กระทบผู้ใช้ */ }
        }
        console.warn('[notification] async push failed:', err?.message || err);
      }
    }, 0);

    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}


module.exports = { createNotification };
