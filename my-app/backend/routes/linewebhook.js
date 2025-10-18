// routes/lineWebhook.js
const express = require('express');
const crypto = require('crypto');
const db = require('../config/db');

const router = express.Router();
const WEBHOOK_PATH = process.env.LINE_WEBHOOK_PATH || '/webhooks/line';

// helper: ส่งข้อความกลับ
async function replyText(replyToken, text) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  });
}

router.post(WEBHOOK_PATH, async (req, res) => {
  try {
    if (!process.env.CHANNEL_SECRET || !process.env.CHANNEL_ACCESS_TOKEN) {
      console.error('LINE webhook misconfigured: CHANNEL_SECRET/CHANNEL_ACCESS_TOKEN is missing');
      return res.status(200).end();
    }

    // เตรียม raw body สำหรับตรวจลายเซ็น
    const bodyStr = Buffer.isBuffer(req.body)
      ? req.body.toString()
      : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));

    const signature = req.get('x-line-signature') || '';
    const expected = crypto.createHmac('sha256', process.env.CHANNEL_SECRET)
      .update(bodyStr)
      .digest('base64');

    if (signature !== expected) return res.status(401).end();

    const payload = JSON.parse(bodyStr || '{}');
    const events = Array.isArray(payload.events) ? payload.events : [];

    for (const ev of events) {
      if (ev.type !== 'message' || ev.message?.type !== 'text') continue;

      const text = (ev.message.text || '').trim();
      const userId = ev.source?.userId;
      const replyToken = ev.replyToken;

      // โค้ดได้ทั้ง "LINK ABC123" / "ลิงก์ ABC123" / "ABC123"
      const match = text.match(/^(?:LINK|ลิงก์)?\s*([A-HJ-NP-Z2-9]{6})$/i);
      if (match) {
        const code = match[1].toUpperCase();

        // ดึงโค้ด — lookup ด้วย code โดยตรง
        const [rows] = await db.query(
          `SELECT tenant_id, expires_at, used_at
             FROM link_tokens
            WHERE code = ?
            LIMIT 1`,
          [code]
        );
        if (!rows.length) { await replyText(replyToken, '❌ โค้ดไม่ถูกต้องหรือไม่มีอยู่ในระบบ'); continue; }

        const token = rows[0];
        if (token.used_at) { await replyText(replyToken, '⚠️ โค้ดนี้ถูกใช้ไปแล้ว'); continue; }
        if (token.expires_at && new Date(token.expires_at) < new Date()) {
          await replyText(replyToken, '⏰ โค้ดหมดอายุแล้ว กรุณาขอใหม่'); continue;
        }

        // 🔻 แปลงให้เป็น tenants.tenant_id (เช่น 'T0001') ก่อน เพื่อให้ตรงกับ FK ของ tenant_line_links
        let tenantKey = token.tenant_id;
        const [[found]] = await db.query(
          `SELECT tenant_id 
             FROM tenants 
            WHERE id = ? OR tenant_id = ? 
            LIMIT 1`,
          [tenantKey, tenantKey]
        );
        if (!found) { await replyText(replyToken, '❌ ไม่พบผู้เช่าในระบบ'); continue; }
        tenantKey = found.tenant_id; // ← ค่านี้ตรงกับ FK

        // บันทึก mapping โดยใช้ tenantKey (เช่น 'T0001')
        await db.query(
          `INSERT INTO tenant_line_links(tenant_id, line_user_id, linked_at)
           VALUES (?, ?, NOW())
           ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), linked_at = NOW()`,
          [tenantKey, userId]
        );

        // ปิดโค้ดด้วย code (mark used)
        await db.query(
          'UPDATE link_tokens SET used_at = NOW() WHERE code = ? LIMIT 1',
          [code]
        );

        // ดึงข้อมูลแสดงผล
        const [[info]] = await db.query(
          `SELECT t.tenant_id, r.room_number, COALESCE(u.fullname, u.name) AS fullname
             FROM tenants t
             LEFT JOIN rooms r ON r.id = t.room_id
             LEFT JOIN users u ON u.id = t.user_id
            WHERE t.tenant_id = ?
            LIMIT 1`,
          [tenantKey]
        );

        await replyText(
          replyToken,
          `✅ ผูกบัญชีสำเร็จ\nผู้เช่า: ${info?.fullname || '-'}\nรหัส: ${tenantKey}\nห้อง: ${info?.room_number || '-'}`
        );
        continue;
      }

      // ข้อความทั่วไป (ไม่ใช่โค้ด)
      await replyText(replyToken, `รับแล้ว: ${text}`);
    }

    res.status(200).end();
  } catch (err) {
    console.error('LINE webhook error:', err?.stack || err);
    res.status(200).end();
  }
});

module.exports = router;
