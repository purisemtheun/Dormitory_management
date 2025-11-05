// backend/routes/lineWebhook.js
"use strict";
const express = require("express");
const db = require("../config/db");
const { verifySignature, replyMessage, refreshSettings } = require("../services/lineService");
const { ensureLineTables } = require("../controllers/lineController");

const router = express.Router();

function getRawBodyString(req) {
  if (Buffer.isBuffer(req.body)) return req.body.toString();
  if (typeof req.body === "string") return req.body;
  // ถ้า middleware แปลงเป็น object แล้ว เราจะ stringify ใหม่ (อาจทำให้ verify ล้มเหลวได้)
  // กรณี production แนะนำใช้ express.raw() สำหรับ path นี้
  return JSON.stringify(req.body || {});
}

router.post("/", async (req, res) => {
  const t0 = Date.now();
  try {
    await ensureLineTables().catch(() => {});
    await refreshSettings().catch(() => {});

    const raw = getRawBodyString(req);
    console.log(`[LINE webhook] hit len=${raw.length} ct=${req.get("content-type")} ua=${req.get("user-agent")}`);

    let sigOK = false;
    if (process.env.LINE_SKIP_VERIFY === "1") {
      sigOK = true;
      console.warn("[LINE webhook] WARNING: LINE_SKIP_VERIFY=1 (signature check is skipped)");
    } else {
      sigOK = await verifySignature(raw, req.get("x-line-signature") || "");
    }
    if (!sigOK) {
      console.warn("[LINE webhook] sig=NG (signature mismatch). Check Channel secret!");
      return res.status(401).end();
    }

    const payload = JSON.parse(raw || "{}");
    const events = Array.isArray(payload.events) ? payload.events : [];

    for (const ev of events) {
      if (ev.type !== "message" || ev.message?.type !== "text") continue;

      const text = String(ev.message.text || "").trim();
      const userId = ev.source?.userId;
      const replyToken = ev.replyToken;
      console.log(`[LINE webhook] from=${userId} text="${text}"`);

      // quick ping
      if (/^ping$/i.test(text)) {
        await replyMessage(replyToken, "pong ✅");
        continue;
      }
      // show my id
      if (/^(myid|ไอดี)$/i.test(text)) {
        await replyMessage(replyToken, `Your LINE userId: ${userId || "-"}`);
        continue;
      }

      // LINK code: "LINK ABC123" / "ลิงก์ ABC123" / "ABC123"
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
        if (!rows.length) { await replyMessage(replyToken, "❌ โค้ดไม่ถูกต้องหรือไม่มีอยู่ในระบบ"); continue; }

        const token = rows[0];
        if (token.used_at) { await replyMessage(replyToken, "⚠️ โค้ดนี้ถูกใช้ไปแล้ว"); continue; }
        if (token.expires_at && new Date(token.expires_at) < new Date()) {
          await replyMessage(replyToken, "⏰ โค้ดหมดอายุแล้ว กรุณาขอใหม่"); continue;
        }

        // 2) ยืนยัน tenant
        const tenantKey = token.tenant_id;
        const [[found]] = await db.query(
          `SELECT t.tenant_id, t.user_id, t.room_id, r.room_number
             FROM tenants t
        LEFT JOIN rooms r ON r.room_id = t.room_id
            WHERE t.tenant_id = ?
            LIMIT 1`,
          [tenantKey]
        );
        if (!found) { await replyMessage(replyToken, "❌ ไม่พบผู้เช่าในระบบ"); continue; }

        // 3) บันทึก mapping 1:1 (unique ทั้ง tenant_id และ line_user_id)
        await db.query(
          `INSERT INTO tenant_line_links (tenant_id, line_user_id, linked_at)
           VALUES (?, ?, NOW())
           ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id),
                                   line_user_id = VALUES(line_user_id),
                                   linked_at = NOW()`,
          [tenantKey, userId]
        );

        // 4) ปิดโค้ด
        await db.query("UPDATE link_tokens SET used_at = NOW(), used = 1 WHERE code = ? LIMIT 1", [code]);

        // 5) ตอบกลับ
        const [[info]] = await db.query(
          `SELECT t.tenant_id, COALESCE(u.fullname, u.name) AS fullname, r.room_number
             FROM tenants t
        LEFT JOIN users u ON u.id = t.user_id
        LEFT JOIN rooms r ON r.room_id = t.room_id
            WHERE t.tenant_id = ?
            LIMIT 1`,
          [tenantKey]
        );

        await replyMessage(
          replyToken,
          `✅ ผูกบัญชีสำเร็จ\nผู้เช่า: ${info?.fullname || "-"}\nรหัส: ${tenantKey}\nห้อง: ${info?.room_number || "-"}`
        );
        continue;
      }

      // echo ทั่วไป
      await replyMessage(replyToken, `รับแล้ว: ${text}`);
    }

    console.log(`[LINE webhook] ok in ${Date.now() - t0}ms`);
    res.status(200).end(); // ตอบ 200 เสมอ กัน LINE ยิงซ้ำ
  } catch (err) {
    console.error("LINE webhook error:", err?.stack || err);
    res.status(200).end(); // กัน retry
  }
});

module.exports = router;
