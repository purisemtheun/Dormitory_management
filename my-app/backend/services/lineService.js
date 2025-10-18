// backend/services/lineService.js
const crypto = require('crypto');
const db = require('../config/db');
const { dec } = require('../utils/crypto');

const LINE_API_BASE = 'https://api.line.me/v2/bot';

let _cache = { loadedAt: 0, settings: null };

async function loadSettingsFromDB() {
  const [rows] = await db.query(
    'SELECT channel_id, channel_secret, access_token, updated_by, updated_at FROM line_settings ORDER BY id DESC LIMIT 1'
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    channel_id: row.channel_id || null,
    channel_secret: row.channel_secret ? dec(row.channel_secret) : null,
    access_token: row.access_token ? dec(row.access_token) : null,
    updated_by: row.updated_by,
    updated_at: row.updated_at,
  };
}

async function getSettings(forceReload = false) {
  const now = Date.now();
  if (!forceReload && _cache.settings && now - _cache.loadedAt < 30000) {
    return _cache.settings;
  }
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
  const token = s?.access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    const err = new Error('LINE access token not configured');
    err.code = 'LINE_TOKEN_MISSING';
    err.status = 500;
    throw err;
  }
  const res = await fetch(`${LINE_API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`LINE API ${path} ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 200 ? res.json().catch(() => ({})) : {};
}

async function pushMessage(to, text) {
  return _postJSON('/message/push', {
    to,
    messages: [{ type: 'text', text: String(text ?? '') }],
  });
}

async function replyMessage(replyToken, text) {
  return _postJSON('/message/reply', {
    replyToken,
    messages: [{ type: 'text', text: String(text ?? '') }],
  });
}

async function broadcastMessage(text) {
  return _postJSON('/message/broadcast', {
    messages: [{ type: 'text', text: String(text ?? '') }],
  });
}

async function verifySignature(rawBody, signatureFromHeader) {
  const s = await getSettings();
  const secret = s?.channel_secret || process.env.LINE_CHANNEL_SECRET || null;
  if (!secret || !signatureFromHeader) return false;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const signature = hmac.digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureFromHeader), Buffer.from(signature));
  } catch {
    return false;
  }
}

module.exports = {
  getSettings,
  refreshSettings,
  pushMessage,
  replyMessage,
  broadcastMessage,
  verifySignature,
};
