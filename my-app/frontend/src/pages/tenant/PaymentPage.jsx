// frontend/src/pages/tenant/PaymentPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import http from "../../services/http";
import { paymentApi } from "../../services/payment.api";

export default function PaymentPage() {
  const [invoices, setInvoices] = useState([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const [err, setErr] = useState("");

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [serverSlipUrl, setServerSlipUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // ✅ เพิ่ม state สำหรับเลขใบแจ้งหนี้ที่เลือก
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState("");

  // ===== helper =====
  function normalizeResponse(resp) {
    if (!resp) return null;
    if (resp.data !== undefined) return resp.data;
    return resp;
  }

  // ===== โหลดใบแจ้งหนี้ =====
  const loadInvoices = async () => {
    try {
      setLoadingInv(true);
      setErr("");
      const resp = await http.get("/api/payments/my-invoices?limit=3");
      const payload = normalizeResponse(resp);
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : [];

      setInvoices(list);
      // ถ้าไม่มีค่าเลือกไว้ ให้ default เป็นใบแรกที่ยังค้างและมี invoice_no
      const firstNo =
        list.find(
          (r) =>
            (r.effective_status ?? r.status) !== "paid" && r.invoice_no?.length
        )?.invoice_no || "";
      setSelectedInvoiceNo((prev) => prev || firstNo);

      console.log("🧾 โหลดใบแจ้งหนี้สำเร็จ:", list);
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "โหลดบิลไม่สำเร็จ";
      setErr(msg);
      setInvoices([]);
      console.error("❌ โหลดบิลล้มเหลว:", e);
    } finally {
      setLoadingInv(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const isDebt = (s) => {
    const x = String(s || "").toLowerCase();
    return x !== "paid";
  };

  // ===== แสดงใบแจ้งหนี้ 3 เดือนล่าสุด (เฉพาะที่ยังค้าง) =====
  const latest3 = useMemo(() => {
    const list = [...invoices].filter((r) => isDebt(r.effective_status ?? r.status));
    list.sort((a, b) => {
      const aa =
        a.period_ym || (a.due_date ? String(a.due_date).slice(0, 10) : "");
      const bb =
        b.period_ym || (b.due_date ? String(b.due_date).slice(0, 10) : "");
      return aa < bb ? 1 : aa > bb ? -1 : 0;
    });
    return list.slice(0, 3);
  }, [invoices]);

  const totalDebt = useMemo(
    () => latest3.reduce((sum, r) => sum + Number(r.amount || 0), 0),
    [latest3]
  );

  // ✅ หา targetInvoice จากเลขที่ผู้ใช้เลือก (ถ้าเลือก), ไม่งั้น fallback เป็นอันแรกของ latest3
  const targetInvoice = useMemo(() => {
    if (selectedInvoiceNo) {
      return (
        invoices.find((r) => r.invoice_no === selectedInvoiceNo) ||
        latest3[0] ||
        null
      );
    }
    if (latest3.length) return latest3[0];
    if (!invoices.length) return null;
    return invoices[0];
  }, [selectedInvoiceNo, latest3, invoices]);

  // ===== อัปโหลดสลิป =====
  const onFileChange = (e) => {
    const f = e.target.files?.[0] || null;
    setErr("");
    setFile(null);
    setPreview("");
    setServerSlipUrl("");

    if (!f) return;
    const ALLOW = ["image/jpeg", "image/png", "application/pdf"];
    const MAX = 5 * 1024 * 1024;
    if (!ALLOW.includes(f.type))
      return setErr("รองรับเฉพาะ .jpg .png .pdf เท่านั้น");
    if (f.size > MAX) return setErr("ไฟล์ใหญ่เกิน 5MB");

    setFile(f);
    if (f.type.startsWith("image/")) setPreview(URL.createObjectURL(f));
  };

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!targetInvoice) return setErr("ไม่พบบิลสำหรับชำระ");
    if (!file) return setErr("กรุณาแนบสลิปก่อนกดส่ง");

    try {
      setUploading(true);
      setErr("");

      // ✅ ถ้ามีเลขบิล ให้ส่ง invoice_no ไป backend (ต้องมีการรองรับใน paymentController)
      const payload = selectedInvoiceNo?.length
        ? { invoice_no: selectedInvoiceNo, slip: file }
        : { invoice_id: targetInvoice.invoice_id, slip: file };

      const res = await paymentApi.submit(payload);
      const data = res?.data ?? res;
      const slipUrl = data?.slip_url ?? data?.data?.slip_url ?? data;

      if (typeof slipUrl === "string") setServerSlipUrl(slipUrl);
      await loadInvoices();
    } catch (e2) {
      const api = e2?.response?.data || {};
      setErr(api?.error || api?.message || e2?.message || "อัปโหลดไม่สำเร็จ");
      console.error("❌ Upload slip failed:", e2);
    } finally {
      setUploading(false);
    }
  };

  const qrSrc = "/img/qrcode.jpg";
  const isImage = (url = "") => /\.(png|jpe?g|webp|gif)$/i.test(url);

  return (
    <>
      <h1 className="tn-title">ชำระเงิน</h1>

      {/* ===== สรุปสถานะหนี้ ===== */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          boxShadow: "0 6px 16px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>สรุปสถานะหนี้</div>
            <div className="muted">ค้างชำระได้ไม่เกินสามเดือน</div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 14, color: "#374151" }}>
              เดือนที่ค้าง (สูงสุด 3 งวดล่าสุด):{" "}
              {latest3.length
                ? latest3.map((r) => r.period_ym || "-").join(", ")
                : "ไม่มี"}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              ยอดค้างรวม: {totalDebt.toLocaleString()} บาท
            </div>
          </div>
        </div>
      </div>

      {/* ===== ตารางใบแจ้งหนี้ + ฟอร์มสลิป ===== */}
      <div className="pay-wrap">
        <div className="pay-grid">
          {/* ตารางแสดงใบแจ้งหนี้ */}
          <section className="card pay-card">
            <h2 className="pay-title">ใบแจ้งหนี้ 3 งวดล่าสุด</h2>

            {loadingInv && <p className="muted">กำลังโหลด…</p>}

            {!loadingInv && invoices.length === 0 && (
              <p className="muted">ยังไม่มีข้อมูลใบแจ้งหนี้</p>
            )}

            {!loadingInv && invoices.length > 0 && latest3.length === 0 && (
              <p className="muted">ขณะนี้ไม่มีรายการค้างชำระ 🎉</p>
            )}

            {!loadingInv && latest3.length > 0 && (
              <table className="pay-table">
                <thead>
                  <tr>
                    <th>เลขบิล</th>
                    <th>งวด</th>
                    <th style={{ textAlign: "right" }}>จำนวนเงิน (บาท)</th>
                    <th>ครบกำหนด</th>
                    <th>สถานะ</th>
                    <th>หลักฐาน</th>
                  </tr>
                </thead>
                <tbody>
                  {latest3.map((r, idx) => (
                    <tr
                      key={r.invoice_id}
                      style={idx === 0 ? { background: "#f3f4f6" } : {}}
                    >
                      <td>{r.invoice_no || "-"}</td>
                      <td>{r.period_ym || "-"}</td>
                      <td style={{ textAlign: "right" }}>
                        {Number(r.amount || 0).toLocaleString()}
                      </td>
                      <td>
                        {r.due_date ? String(r.due_date).slice(0, 10) : "-"}
                      </td>
                      <td>{r.effective_status || r.status}</td>
                      <td>
                        {r.slip_url ? (
                          isImage(r.slip_url) ? (
                            <a
                              href={encodeURI(r.slip_url)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              ดูรูป
                            </a>
                          ) : (
                            <a
                              href={encodeURI(r.slip_url)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              เปิดไฟล์
                            </a>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* ส่วนแนบสลิป */}
          <section className="card pay-card">
            <h2 className="pay-title">สแกนจ่ายค่าเช่าและแนบสลิป</h2>
            <img src={qrSrc} alt="QR สำหรับชำระค่าเช่า" className="pay-qr" />

            {/* ✅ ช่องเลือกเลขบิล */}
            <div className="pay-field">
              <label className="label">
                เลือกเลขใบแจ้งหนี้ (ถ้ามีหลายใบค้าง)
              </label>
              <select
                className="input"
                value={selectedInvoiceNo}
                onChange={(e) => setSelectedInvoiceNo(e.target.value)}
              >
                <option value="">— เลือกอัตโนมัติ (งวดล่าสุด) —</option>
                {latest3.map((r) => (
                  <option key={r.invoice_id} value={r.invoice_no || ""}>
                    {r.invoice_no || "(ไม่มีเลข)"} • {r.period_ym} •{" "}
                    {Number(r.amount || 0).toLocaleString()} บาท
                  </option>
                ))}
              </select>
              <p className="help">
                ถ้าไม่เลือก ระบบจะจับคู่กับงวดล่าสุดที่ยังค้างโดยอัตโนมัติ
              </p>
            </div>

            <form onSubmit={onSubmit}>
              <div className="pay-field">
                <label className="label">
                  แนบสลิปโอน (.jpg/.png/.pdf) ≤ 5MB
                </label>
                <input
                  type="file"
                  className="input"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={onFileChange}
                />
                <p className="help">ระบบจะผูกสลิปกับเลขบิลที่เลือก</p>
              </div>

              {preview && (
                <img src={preview} alt="พรีวิวสลิป" className="slip-preview" />
              )}
              {!preview && file?.type === "application/pdf" && (
                <p className="muted">ไฟล์ที่เลือก: {file.name}</p>
              )}

              {serverSlipUrl && (
                <>
                  <p className="help" style={{ marginTop: 8 }}>
                    บันทึกแล้ว: สลิปถูกอัปโหลด
                  </p>
                  {isImage(serverSlipUrl) ? (
                    <img
                      src={encodeURI(serverSlipUrl)}
                      alt="สลิปที่อัปโหลด"
                      className="slip-preview"
                    />
                  ) : (
                    <a
                      href={encodeURI(serverSlipUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="tn-link"
                    >
                      เปิดไฟล์สลิป
                    </a>
                  )}
                </>
              )}

              {err && (
                <p className="help" style={{ color: "#b91c1c" }}>{err}</p>
              )}

              <button
                className="btn-primary"
                disabled={!file || !targetInvoice || uploading}
              >
                {uploading ? "กำลังอัปโหลด..." : "ส่งหลักฐาน"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
