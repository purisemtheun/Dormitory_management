// backend/routes/lineWebhook.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifySignature, replyMessage } = require('../services/lineService');

const WEBHOOK_PATH = process.env.LINE_WEBHOOK_PATH || '/webhooks/line';

// ใช้ body parser ที่เก็บ raw body ไว้ตรวจลายเซ็น
router.post(
  WEBHOOK_PATH,
  express.json({
    verify: (req, _res, buf) => { req.rawBody = buf; },
  }),
  async (req, res) => {
    try {
      // 1) ตรวจลายเซ็น ก่อนทำงานใด ๆ
      const ok = await verifySignature(req.rawBody, req.headers['x-line-signature']);
      if (!ok) return res.status(401).end();

      const events = Array.isArray(req.body?.events) ? req.body.events : [];

      // 2) วนลูปทุกอีเวนต์
      for (const ev of events) {
        // รองรับ follow เพื่อทักทายตอนแอดบอท
        if (ev.type === 'follow') {
          await replyMessage(ev.replyToken, {
            type: 'text',
            text: 'สวัสดีครับ 👋\nหากต้องการเชื่อมบัญชี กรุณาพิมพ์: ผูก <โค้ด> หรือ LINK:<โค้ด>',
          });
          continue;
        }

        if (ev.type !== 'message' || ev.message?.type !== 'text') {
          // ไม่ใช่ข้อความ → ข้ามไป
          continue;
        }

        const text = String(ev.message.text || '').trim();
        const replyToken = ev.replyToken;
        const lineUserId = ev.source?.userId;

        // 3) แยก 2 รูปแบบคำสั่ง: "ผูก <code>" หรือ "LINK:<code>"
        let code = null;

        // รูปแบบไทย: ผูก CODE
        const m1 = text.match(/^ผูก\s+([A-Za-z0-9_-]{4,32})$/i);
        if (m1) code = m1[1];

        // รูปแบบอังกฤษ: LINK:CODE
        const m2 = text.match(/^LINK:([A-Za-z0-9_-]{4,32})$/i);
        if (!code && m2) code = m2[1];

        if (!code) {
          // ไม่รู้จักคำสั่ง → ตอบข้อความช่วยเหลือ
          await replyMessage(replyToken, {
            type: 'text',
            text: 'พิมพ์: ผูก <โค้ด> หรือ LINK:<โค้ด> เพื่อเชื่อมบัญชีเข้ากับระบบหอพัก',
          });
          continue;
        }

        // 4) ตรวจโค้ดจากตาราง pairing_codes (ยังไม่หมดอายุ และยังไม่ใช้)
        const [[p]] = await db.query(
          `SELECT code, user_id, tenant_id
             FROM pairing_codes
            WHERE code = ?
              AND (expire_at IS NULL OR expire_at > NOW())
              AND used_at IS NULL
            LIMIT 1`,
          [code]
        );

        if (!p) {
          await replyMessage(replyToken, { type: 'text', text: 'โค้ดไม่ถูกต้อง หรือหมดอายุแล้ว' });
          continue;
        }

        // 5) ผูก line_user_id กับ tenant_id (และ user_id ถ้ามี) — upsert
        await db.query(
          `INSERT INTO line_links (tenant_id, user_id, line_user_id, linked_at)
           VALUES (?,?,?,NOW())
           ON DUPLICATE KEY UPDATE
             user_id = VALUES(user_id),
             line_user_id = VALUES(line_user_id),
             linked_at = NOW()`,
          [p.tenant_id, p.user_id || null, lineUserId]
        );

        // 6) mark โค้ดว่าใช้แล้ว
        await db.query(`UPDATE pairing_codes SET used_at = NOW() WHERE code = ?`, [code]);

        // 7) ตอบกลับสำเร็จ
        await replyMessage(replyToken, {
          type: 'text',
          text: 'เชื่อมบัญชีสำเร็จ ✅\nคุณจะได้รับการแจ้งเตือนผ่าน LINE อัตโนมัติ',
        });
      }

      // LINE ต้องการ 200 ตอบกลับไว ๆ
      res.json({ ok: true });
    } catch (e) {
      console.error('LINE webhook error:', e);
      // ต้องตอบ 200 แม้จะ fail บาง event (เพื่อไม่ให้ LINE รีไทรซ้ำมาก)
      res.status(200).json({ ok: false });
    }
  }
);

module.exports = router;
