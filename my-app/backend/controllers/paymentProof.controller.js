// controllers/paymentProof.controller.js
const db = require('../config/db.js');


// อนุมัติสลิป
async function approveProof(req, res) {
  const proofId = req.params.id;
  const adminId = req.user.id; // มาจาก middleware requireAdmin

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Lock แถวของ proof
    const [[proof]] = await conn.query(
      `SELECT invoice_id FROM payment_proofs WHERE id=? FOR UPDATE`,
      [proofId]
    );
    if (!proof) {
      await conn.rollback();
      return res.status(404).json({ message: 'ไม่พบสลิป' });
    }

    // เปลี่ยนสถานะสลิปเป็น approved
    await conn.query(
      `UPDATE payment_proofs
       SET status='approved', reviewed_by=?, reviewed_at=NOW()
       WHERE id=?`,
      [adminId, proofId]
    );

    // อัปเดต invoice เป็น paid
    await conn.query(
      `UPDATE invoices
       SET status='paid', paid_at=NOW()
       WHERE id=?`,
      [proof.invoice_id]
    );

    // อ่านข้อมูล invoice ที่ต้องใช้สร้าง payment และแจ้งเตือน
    const [[inv]] = await conn.query(
      `SELECT amount, tenant_id FROM invoices WHERE id=?`,
      [proof.invoice_id]
    );

    // สร้างรายการ payment ที่ยืนยันแล้ว
    await conn.query(
      `INSERT INTO payments(invoice_id, amount, method, status, created_at)
       VALUES(?, ?, 'manual-slip', 'success', NOW())`,
      [proof.invoice_id, inv.amount]
    );

    // แจ้งเตือนแอดมิน
    await conn.query(
      `INSERT INTO admin_notifications(type,title,body,ref_type,ref_id,status,created_at)
       VALUES('PAYMENT_SUCCESS','ชำระเงินสำเร็จ',?,
              'invoice', ?, 'unseen', NOW())`,
      [`Invoice #${proof.invoice_id}`, proof.invoice_id]
    );

    // แจ้งเตือนผู้เช่า
    await conn.query(
      `INSERT INTO notifications(tenant_id,type,title,body,ref_type,ref_id,channels,created_at)
       VALUES(?,?,?,?,?,?,JSON_ARRAY('inapp'),NOW())`,
      [
        inv.tenant_id,
        'PAYMENT_SUCCESS',
        'ชำระเงินสำเร็จ',
        `ใบแจ้งหนี้ #${proof.invoice_id} ชำระเรียบร้อยแล้ว ขอบคุณค่ะ`,
        'invoice',
        proof.invoice_id,
      ]
    );

    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ message: e.message });
  } finally {
    conn.release();
  }
}

// ปฏิเสธสลิป
async function rejectProof(req, res) {
  const proofId = req.params.id;
  const { reason } = req.body ?? {};
  const adminId = req.user.id;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[proof]] = await conn.query(
      `SELECT invoice_id FROM payment_proofs WHERE id=? FOR UPDATE`,
      [proofId]
    );
    if (!proof) {
      await conn.rollback();
      return res.status(404).json({ message: 'ไม่พบสลิป' });
    }

    // เปลี่ยนสถานะสลิปเป็น rejected
    await conn.query(
      `UPDATE payment_proofs
       SET status='rejected', rejected_reason=?, reviewed_by=?, reviewed_at=NOW()
       WHERE id=?`,
      [reason || 'ไม่ระบุ', adminId, proofId]
    );

    // เปลี่ยน invoice กลับไปเป็น unpaid (หรือจะ set 'rejected' ตามนโยบาย)
    await conn.query(
      `UPDATE invoices SET status='unpaid' WHERE id=?`,
      [proof.invoice_id]
    );

    // แจ้งเตือนผู้เช่า
    const [[inv]] = await conn.query(
      `SELECT tenant_id FROM invoices WHERE id=?`,
      [proof.invoice_id]
    );

    await conn.query(
      `INSERT INTO notifications(tenant_id,type,title,body,ref_type,ref_id,channels,created_at)
       VALUES(?,?,?,?,?,?,JSON_ARRAY('inapp'),NOW())`,
      [
        inv.tenant_id,
        'PAYMENT_REJECTED',
        'สลิปไม่ผ่านตรวจ',
        `ใบแจ้งหนี้ #${proof.invoice_id}: ${reason || 'กรุณาอัปสลิปใหม่ให้ชัดเจน'}`,
        'invoice',
        proof.invoice_id,
      ]
    );

    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ message: e.message });
  } finally {
    conn.release();
  }
}

module.exports = { approveProof, rejectProof };
