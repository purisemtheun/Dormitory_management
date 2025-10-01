import React, { useEffect, useState } from "react";

import { paymentApi } from "../../services/payment.api"; // ⬅️ เพิ่ม

export default function PaymentPage() {
  const qrSrc = "/img/qrcode.jpg";

  // พรีวิว/ข้อผิดพลาด/ไฟล์
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [err, setErr] = useState("");

  // ⬇️ เพิ่ม: ระบุบิลที่จะผูกสลิป + สถานะอัปโหลด + URL จากเซิร์ฟเวอร์
  const [invoiceId, setInvoiceId] = useState("");   // ใส่ id บิลจริงของผู้ใช้
  const [loading, setLoading] = useState(false);
  const [serverSlipUrl, setServerSlipUrl] = useState("");

  // เลือกไฟล์ → ตรวจชนิด/ขนาด + ทำพรีวิวถ้าเป็นภาพ
  const onFileChange = (e) => {
    const f = e.target.files?.[0] || null;
    setErr(""); setFile(null); setPreview(""); setServerSlipUrl("");

    if (!f) return;

    const ALLOW = ["image/jpeg", "image/png", "application/pdf"];
    const MAX = 5 * 1024 * 1024; // 5MB

    if (!ALLOW.includes(f.type)) { setErr("รองรับเฉพาะ .jpg .png .pdf เท่านั้น"); return; }
    if (f.size > MAX) { setErr("ไฟล์ใหญ่เกิน 5MB"); return; }

    setFile(f);
    if (f.type.startsWith("image/")) setPreview(URL.createObjectURL(f));
  };

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // ⬇️ กดส่ง → อัปโหลดไป backend และรับ slip_url กลับมา
  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setErr("กรุณาแนบสลิปก่อนกดส่ง");
    if (!invoiceId) return setErr("กรุณากรอกรหัสใบแจ้งหนี้ (invoice_id)");

    try {
      setLoading(true);
      setErr("");
      const res = await paymentApi.submit({
        invoice_id: invoiceId,
        amount_paid: undefined,     // ไม่จำเป็น ส่งได้เป็น undefined
        transfer_date: undefined,   // ไม่จำเป็น
        note: undefined,
        slip: file,                 // ⬅️ ไฟล์จริง
      });
      if (res?.slip_url) setServerSlipUrl(res.slip_url);
    } catch (e2) {
      const api = e2?.response?.data;
      setErr(api?.error || api?.message || "อัปโหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="tn-title">ชำระเงิน</h1>
      <p className="muted">สแกน QR เพื่อชำระค่าเช่า แล้วแนบสลิปยืนยัน</p>

      <div className="pay-wrap">
        <div className="pay-grid">
          {/* ซ้าย: บิล 3 เดือนล่าสุด (ตัวอย่างเดิม) */}
          <section className="card pay-card">
            <h2 className="pay-title">บิล 3 เดือนล่าสุด</h2>
            <table className="pay-table">
              <thead>
                <tr>
                  <th>เดือน</th>
                  <th>จำนวนเงิน (บาท)</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>กันยายน 2025</td><td>3,500</td><td><span className="muted">ค้างชำระ</span></td></tr>
                <tr><td>สิงหาคม 2025</td><td>3,500</td><td>ชำระแล้ว</td></tr>
                <tr><td>กรกฎาคม 2025</td><td>3,500</td><td>ชำระแล้ว</td></tr>
              </tbody>
            </table>
          </section>

          {/* ขวา: QR + แนบสลิป */}
          <section className="card pay-card">
            <h2 className="pay-title">สแกนจ่ายค่าเช่าและแนบสลิป</h2>

            <img src={qrSrc} alt="QR สำหรับชำระค่าเช่า" className="pay-qr" />

            <form onSubmit={onSubmit}>
              {/* ช่องกรอก invoice_id (จำเป็นเพื่อผูกสลิปเข้าบิล) */}
              <div className="pay-field">
                <label className="label">รหัสใบแจ้งหนี้ (invoice_id)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="เช่น 1"
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value)}
                />
              </div>

              <div className="pay-field">
                <label className="label">แนบสลิปโอน (.jpg/.png/.pdf) ≤ 5MB</label>
                <input
                  type="file"
                  className="input"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={onFileChange}
                />
                <p className="help">เลือกไฟล์แล้วดูตัวอย่างก่อนส่ง</p>
              </div>

              {preview && <img src={preview} alt="พรีวิวสลิป" className="slip-preview" />}
              {!preview && file?.type === "application/pdf" && (
                <p className="muted">ไฟล์ที่เลือก: {file.name}</p>
              )}

              {/* แสดงรูปจากเซิร์ฟเวอร์เมื่ออัปโหลดสำเร็จ */}
              {serverSlipUrl && (
                <>
                  <p className="help" style={{ marginTop: 8 }}>บันทึกแล้ว: สลิปถูกอัปโหลด</p>
                  {/* ถ้าเป็น pdf จะไม่พรีวิวเป็นรูป */}
                  {/\.jpe?g$|\.png$/i.test(serverSlipUrl)
                    ? <img src={serverSlipUrl} alt="สลิปที่อัปโหลด" className="slip-preview" />
                    : <a href={serverSlipUrl} target="_blank" rel="noreferrer" className="tn-link">เปิดไฟล์สลิป</a>}
                </>
              )}

              {err && <p className="help" style={{ color: "#b91c1c" }}>{err}</p>}

              <button className="btn-primary" disabled={!file || !invoiceId || loading}>
                {loading ? "กำลังอัปโหลด..." : "ส่งหลักฐาน"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
