const express = require('express');
const db = require('../config/db');
const { verifySignature, replyMessage, refreshSettings } = require('../services/lineService');

const router = express.Router();

function getRawBodyString(req) {
  if (Buffer.isBuffer(req.body)) return req.body.toString();
  if (typeof req.body === 'string') return req.body;
  return JSON.stringify(req.body || {});
}

router.post('/', async (req, res) => {
  const t0 = Date.now();
  try {
    await refreshSettings().catch(() => {});
    const raw = getRawBodyString(req);

    // === DEBUG LOG: เห็นทุกครั้งที่ LINE ยิงเข้า ===
    console.log(`[LINE webhook] hit len=${raw.length} ct=${req.get('content-type')} ua=${req.get('user-agent')}`);

    let sigOK = false;
    if (process.env.LINE_SKIP_VERIFY === '1') {
      sigOK = true;
      console.warn('[LINE webhook] WARNING: LINE_SKIP_VERIFY=1 (signature check is skipped)');
    } else {
      sigOK = await verifySignature(raw, req.get('x-line-signature') || '');
    }
    if (!sigOK) {
      console.warn('[LINE webhook] sig=NG (signature mismatch). Check Channel secret!');
      return res.status(401).end();
    }

    const payload = JSON.parse(raw || '{}');
    const events = Array.isArray(payload.events) ? payload.events : [];

    for (const ev of events) {
      if (ev.type !== 'message' || ev.message?.type !== 'text') continue;

      const text = String(ev.message.text || '').trim();
      const userId = ev.source?.userId;
      const replyToken = ev.replyToken;
      console.log(`[LINE webhook] from=${userId} text="${text}"`);

      // ===== quick command: MYID / ไอดี =====
      if (/^(myid|ไอดี)$/i.test(text)) {
        await replyMessage(replyToken, `Your LINE userId: ${userId || '-'}`);
        continue;
      }

      // ===== link code: "LINK 3Q96DG" / "ลิงก์ 3Q96DG" / "3Q96DG" =====
      const m = text.match(/^(?:LINK|ลิงก์)?\s*([A-HJ-NP-Z2-9]{6})$/i);
      if (m) {
        const code = m[1].toUpperCase();

        // 1) หาโค้ด
        const [rows] = await db.query(
          `SELECT tenant_id, expires_at, used_at
             FROM link_tokens
            WHERE code = ?
            LIMIT 1`,
          [code]
        );
        if (!rows.length) { await replyMessage(replyToken, '❌ โค้ดไม่ถูกต้องหรือไม่มีอยู่ในระบบ'); continue; }

        const token = rows[0];
        if (token.used_at) { await replyMessage(replyToken, '⚠️ โค้ดนี้ถูกใช้ไปแล้ว'); continue; }
        if (token.expires_at && new Date(token.expires_at) < new Date()) {
          await replyMessage(replyToken, '⏰ โค้ดหมดอายุแล้ว กรุณาขอใหม่'); continue;
        }

        // 2) ยืนยัน tenant
        const tenantKey = token.tenant_id;
        const [[found]] = await db.query(
          `SELECT tenant_id, user_id, room_id
             FROM tenants
            WHERE tenant_id = ?
            LIMIT 1`,
          [tenantKey]
        );
        if (!found) { await replyMessage(replyToken, '❌ ไม่พบผู้เช่าในระบบ'); continue; }

        // 3) บันทึก mapping (1:1)
        await db.query(
          `INSERT INTO tenant_line_links (line_user_id, tenant_id, linked_at)
           VALUES (?, ?, NOW())
           ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), linked_at = NOW()`,
          [userId, tenantKey]
        );

        // 4) ปิดโค้ด
        await db.query('UPDATE link_tokens SET used_at = NOW() WHERE code = ? LIMIT 1', [code]);

        // 5) ตอบกลับ
        const [[info]] = await db.query(
          `SELECT t.tenant_id, COALESCE(u.fullname, u.name) AS fullname, t.room_id AS room_label
             FROM tenants t
        LEFT JOIN users u ON u.id = t.user_id
            WHERE t.tenant_id = ?
            LIMIT 1`,
          [tenantKey]
        );

        await replyMessage(
          replyToken,
          `✅ ผูกบัญชีสำเร็จ\nผู้เช่า: ${info?.fullname || '-'}\nรหัส: ${tenantKey}\nห้อง: ${info?.room_label || '-'}`
        );
        continue;
      }

      // echo ทั่วไป
      await replyMessage(replyToken, `รับแล้ว: ${text}`);
    }

    console.log(`[LINE webhook] ok in ${Date.now()-t0}ms`);
    res.status(200).end(); // ตอบ 200 เสมอ กัน LINE ยิงซ้ำ
  } catch (err) {
    console.error('LINE webhook error:', err?.stack || err);
    res.status(200).end(); // กัน retry
  }
});

module.exports = router;