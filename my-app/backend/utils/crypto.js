// backend/utils/crypto.js
const crypto = require('crypto');

function parseKeyFromEnv() {
  let raw = process.env.MASTER_KEY || '';
  let buf = null;

  try {
    if (!raw) throw new Error('empty');

    if (raw.startsWith('base64:')) {
      buf = Buffer.from(raw.slice(7), 'base64');
    } else if (raw.startsWith('hex:')) {
      buf = Buffer.from(raw.slice(4), 'hex');
    } else {
      try {
        buf = Buffer.from(raw, 'base64');
      } catch {}
      if (!buf || buf.length === 0) {
        if (/^[0-9a-fA-F]{64}$/.test(raw)) {
          buf = Buffer.from(raw, 'hex');
        }
      }
      if ((!buf || buf.length === 0) && raw.length === 32) {
        buf = Buffer.from(raw, 'utf8');
      }
    }
  } catch {
    buf = null;
  }

  if (!buf || buf.length !== 32) {
    console.warn(
      '[crypto] MASTER_KEY invalid or missing → using DEV fallback key (DO NOT use in production).'
    );
    buf = crypto
      .createHash('sha256')
      .update('dev-fallback-master-key')
      .digest();
  }
  return buf;
}

const key = parseKeyFromEnv();

function enc(plain) {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([
    cipher.update(String(plain), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64'); // iv(12)|tag(16)|data
}

function dec(b64) {
  if (!b64) return null;
  const raw = Buffer.from(b64, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

module.exports = { enc, dec };
