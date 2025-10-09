const cron = require('node-cron');
const db = require('../config/db.js');

function startMonthlyReminders() {
  // รันทุกวันที่ 1 เวลา 09:00 (Asia/Bangkok)
  cron.schedule('0 9 1 * *', async () => {
    try {
      const [rows] = await db.query(`
        SELECT i.id, i.tenant_id, i.amount, i.due_date,
               DATE_FORMAT(i.period_ym, '%Y-%m') AS period
        FROM invoices i
        WHERE i.status='unpaid'
          AND i.period_ym = DATE_FORMAT(CURDATE(), '%Y-%m')
          AND (i.reminded_at IS NULL OR DATE(i.reminded_at) <> CURDATE())
      `);

      for (const r of rows) {
        await db.query(
          `INSERT INTO notifications
             (tenant_id, type, title, body, ref_type, ref_id, channels, status, created_at)
           VALUES
             (?, 'INVOICE_DUE', 'แจ้งเตือนชำระเงินค่าห้อง',
              ?, 'invoice', ?, JSON_ARRAY('inapp'), 'pending', NOW())`,
          [
            r.tenant_id,
            `บิลเดือน ${r.period} ยอด ${Number(r.amount).toLocaleString()} บาท กำหนด ${r.due_date ? r.due_date.toISOString().slice(0,10) : '-'}`,
            r.id,
          ]
        );

        await db.query(`UPDATE invoices SET reminded_at=NOW() WHERE id=?`, [r.id]);
      }
    } catch (e) {
      console.error('Monthly reminders tick error:', e.message);
    }
  }, { timezone: 'Asia/Bangkok' });
}

module.exports = startMonthlyReminders;
