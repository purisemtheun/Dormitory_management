// my-app/backend/check-db-size.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./config/db');

(async () => {
  try {
    const [[r]] = await db.query(`
      SELECT ROUND(SUM(data_length + index_length)/1024/1024, 2) AS mb
      FROM information_schema.tables
    `);
    const used = r.mb || 0;
    console.log(`Used: ${used} MB / 1024 MB  (Remaining ~ ${(1024 - used).toFixed(2)} MB)`);
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
