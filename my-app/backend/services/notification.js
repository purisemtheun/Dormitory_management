// backend/services/notification.js
const db = require('../config/db');
const { pushLineAfterNotification } = require('./notifyAfterInsert');

/* สร้าง/อัปเกรดตาราง notifications ให้ครบฟิลด์ที่ใช้ */
async function ensureNotificationsTable(conn = db) {
  // 1) สร้างถ้ายังไม่มี (โครงครบชุด)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      tenant_id VARCHAR(32) NOT NULL,
      type VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      body TEXT NULL,
      ref_type VARCHAR(32) NULL,
      ref_id VARCHAR(64) NULL,
      status ENUM('unread','read') NOT NULL DEFAULT 'unread',
      sent_line_at DATETIME NULL,
      line_status ENUM('ok','fail','unlinked') NULL,
      line_error TEXT NULL,
      created_by BIGINT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME NULL,
      PRIMARY KEY (id),
      KEY idx_tenant_created (tenant_id, created_at),
      KEY idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 2) กรณีมีตารางอยู่แล้วแต่ขาดคอลัมน์ → เติมให้ครบ
  await conn.query(`ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS sent_line_at DATETIME NULL AFTER status,
    ADD COLUMN IF NOT EXISTS line_status ENUM('ok','fail','unlinked') NULL AFTER sent_line_at,
    ADD COLUMN IF NOT EXISTS line_error  TEXT NULL AFTER line_status
  `).catch(() => {}); // ถ้า engine เก่าไม่รองรับ IF NOT EXISTS จะข้ามไป (ไม่ทำให้พัง)

  // fallback แบบแยก ๆ สำหรับบาง MySQL ที่ไม่รองรับ IF NOT EXISTS ใน ALTER หลายคอลัมน์
  try { await conn.query(`ALTER TABLE notifications ADD COLUMN sent_line_at DATETIME NULL`); } catch {}
  try { await conn.query(`ALTER TABLE notifications ADD COLUMN line_status ENUM('ok','fail','unlinked') NULL`); } catch {}
  try { await conn.query(`ALTER TABLE notifications ADD COLUMN line_error TEXT NULL`); } catch {}
}

/** สร้าง notification แล้วพยายามส่ง LINE แบบ async */
async function createNotification(params, conn = null) {
  const { tenant_id, type, title, body = '', created_by = null } = params || {};
  if (!tenant_id || !type || !title) {
    return { ok: false, error: 'tenant_id, type, title are required' };
  }

  const runner = conn ?? db;

  try {
    await ensureNotificationsTable(runner);

    const [ins] = await runner.query(
      `INSERT INTO notifications (tenant_id, type, title, body, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [tenant_id, type, title, body, created_by]
    );
    const id = ins?.insertId ?? null;

    // ส่ง LINE แบบ async ด้วย pool หลัก
    setTimeout(async () => {
      try {
        const res = await pushLineAfterNotification(null, { tenant_id, type, title, body });
        if (!id) return;

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
        if (id) {
          try {
            await db.query(
              `UPDATE notifications
                 SET line_status='fail', line_error=?
               WHERE id = ? LIMIT 1`,
              [String(err?.message || err), id]
            );
          } catch {}
        }
        console.warn('[notification] async push failed:', err?.message || err);
      }
    }, 0);

    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

module.exports = { createNotification, ensureNotificationsTable };
