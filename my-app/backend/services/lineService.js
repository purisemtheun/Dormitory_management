// backend/services/lineService.js
"use strict";
const crypto = require("crypto");
const db = require("../config/db");
const { dec } = require("../utils/crypto");

const LINE_API_BASE = "https://api.line.me/v2/bot";

let _cache = { loadedAt: 0, settings: null };

function pickEnv(...keys) {
  for (const k of keys) if (process.env[k]) return process.env[k];
  return null;
}
function safeDec(v) {
  if (!v) return null;
  try { return dec(v, process.env.MASTER_KEY); } catch { return null; }
}

async function loadSettingsFromDB() {
  try {
    const [rows] = await db.query(
      `SELECT channel_id, channel_secret, access_token, updated_by, updated_at
         FROM line_settings
        ORDER BY updated_at DESC
        LIMIT 1`
    );
    if (!rows.length) return null;
    const row = rows[0];
    return {
      channel_id: row.channel_id || null,
      channel_secret: safeDec(row.channel_secret), // ถอดไม่ได้จะเป็น null → fallback env
      access_token:   safeDec(row.access_token),
      updated_by: row.updated_by,
      updated_at: row.updated_at,
    };
  } catch (e) {
    // ถ้าไม่มีตาราง/อ่านไม่ได้ ก็ให้ fallback env
    return null;
  }
}

async function getSettings(forceReload = false) {
  const now = Date.now();
  if (!forceReload && _cache.settings && now - _cache.loadedAt < 30000) return _cache.settings;
  const s = await loadSettingsFromDB();
  _cache.settings = s;
  _cache.loadedAt = Date.now();
  return s;
}
async function refreshSettings() {
  _cache.loadedAt = 0;
  return getSettings(true);
}

async function _postJSON(path, body) {
  const s = await getSettings();
  const token = s?.access_token || pickEnv("CHANNEL_ACCESS_TOKEN", "LINE_CHANNEL_ACCESS_TOKEN");
  if (!token) {
    console.error("[LINE] missing access token (env or DB)");
    const err = new Error("LINE access token not configured");
    err.code = "LINE_TOKEN_MISSING";
    err.status = 500;
    throw err;
  }
  const url = `${LINE_API_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    console.error(`[LINE] POST ${url} -> ${res.status} ${text}`);
    const err = new Error(`LINE API ${path} ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  try { return JSON.parse(text); } catch { return {}; }
}

async function pushMessage(to, text) {
  return _postJSON("/message/push", { to, messages: [{ type: "text", text: String(text ?? "") }] });
}
async function replyMessage(replyToken, text) {
  return _postJSON("/message/reply", { replyToken, messages: [{ type: "text", text: String(text ?? "") }] });
}
async function broadcastMessage(text) {
  return _postJSON("/message/broadcast", { messages: [{ type: "text", text: String(text ?? "") }] });
}

async function verifySignature(rawBody, signatureFromHeader) {
  if (process.env.LINE_SKIP_VERIFY === "1") return true;
  const s = await getSettings();
  const secret = s?.channel_secret || pickEnv("CHANNEL_SECRET", "LINE_CHANNEL_SECRET");
  if (!secret || !signatureFromHeader) {
    console.warn("[LINE] signature verify skipped: secret or header missing");
    return false;
  }
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody)));
  const expected = hmac.digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureFromHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

// debug helpers
function isValidLineRecipient(id) { return /^[URC][0-9a-fA-F]{32}$/.test(String(id || "")); }
async function getBotInfo() {
  const s = await getSettings();
  const token = s?.access_token || pickEnv("CHANNEL_ACCESS_TOKEN", "LINE_CHANNEL_ACCESS_TOKEN");
  if (!token) throw new Error("LINE access token not configured");
  const res = await fetch("https://api.line.me/v2/bot/info", { headers: { Authorization: `Bearer ${token}` }});
  if (!res.ok) throw new Error(`GET /bot/info error ${res.status}`);
  return res.json();
}
async function getUserProfile(userId) {
  const s = await getSettings();
  const token = s?.access_token || pickEnv("CHANNEL_ACCESS_TOKEN", "LINE_CHANNEL_ACCESS_TOKEN");
  if (!token) throw new Error("LINE access token not configured");
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, { headers:{ Authorization:`Bearer ${token}` }});
  if (!res.ok) throw new Error(`GET /bot/profile error ${res.status}`);
  return res.json();
}

module.exports = {
  getSettings, refreshSettings,
  pushMessage, replyMessage, broadcastMessage,
  verifySignature, isValidLineRecipient, getBotInfo, getUserProfile,
};
