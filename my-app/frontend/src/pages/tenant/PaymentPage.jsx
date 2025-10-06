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

  // helper to normalize axios / fetch-style responses
  function normalizeResponse(resp) {
    if (!resp) return null;
    // axios returns { data: ... }
    if (resp.data !== undefined) return resp.data;
    // fetch returns payload directly
    return resp;
  }

  const loadInvoices = async () => {
    try {
      setLoadingInv(true);
      setErr("");
      // axios http.get returns response object -> normalizeResponse -> actual data
      const resp = await http.get("/api/payments/my-invoices?limit=12");
      const payload = normalizeResponse(resp);
      // payload could be array or { data: [...] } depending on backend/service
      const list = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
      setInvoices(list);
    } catch (e) {
      // show helpful message
      const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || "โหลดบิลไม่สำเร็จ";
      setErr(msg);
      setInvoices([]);
      // optional: if unauthorized, redirect to login (if you have router here)
      // if (e?.response?.status === 401) navigate('/login')
    } finally {
      setLoadingInv(false);
    }
  };

  useEffect(() => { loadInvoices(); }, []);

  const isDebt = (s) => {
    const x = String(s || "").toLowerCase();
    return x !== "paid";
  };

  const debtLatest2 = useMemo(() => {
    const list = [...invoices].filter(r => isDebt(r.effective_status ?? r.status));
    list.sort((a,b) => {
      const aa = a.period_ym || (a.due_date ? String(a.due_date).slice(0,10) : "");
      const bb = b.period_ym || (b.due_date ? String(b.due_date).slice(0,10) : "");
      return aa < bb ? 1 : aa > bb ? -1 : 0;
    });
    return list.slice(0,2);
  }, [invoices]);

  const totalDebt = useMemo(() => debtLatest2.reduce((sum, r) => sum + Number(r.amount || 0), 0), [debtLatest2]);

  const targetInvoice = useMemo(() => {
    if (debtLatest2.length) return debtLatest2[0];
    if (!invoices.length) return null;
    return invoices[0];
  }, [debtLatest2, invoices]);

  const onFileChange = (e) => {
    const f = e.target.files?.[0] || null;
    setErr(""); setFile(null); setPreview(""); setServerSlipUrl("");
    if (!f) return;
    const ALLOW = ["image/jpeg","image/png","application/pdf"];
    const MAX = 5 * 1024 * 1024;
    if (!ALLOW.includes(f.type)) return setErr("รองรับเฉพาะ .jpg .png .pdf เท่านั้น");
    if (f.size > MAX) return setErr("ไฟล์ใหญ่เกิน 5MB");
    setFile(f);
    if (f.type.startsWith("image/")) setPreview(URL.createObjectURL(f));
  };
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!targetInvoice) return setErr("ไม่พบบิลสำหรับชำระ");
    if (!file) return setErr("กรุณาแนบสลิปก่อนกดส่ง");
    try {
      setUploading(true);
      setErr("");
      const res = await paymentApi.submit({
        invoice_id: targetInvoice.invoice_id,
        slip: file,
      });
      // normalize response: may return { slip_url: "..."} or { data: { slip_url: "..."} }
      const payload = res?.data ?? res;
      const slipUrl = payload?.slip_url ?? payload?.data?.slip_url ?? payload;
      if (typeof slipUrl === "string") setServerSlipUrl(slipUrl);
      // reload invoices to reflect updated status
      await loadInvoices();
    } catch (e2) {
      const api = e2?.response?.data || {};
      setErr(api?.error || api?.message || e2?.message || "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const qrSrc = "/img/qrcode.jpg";
  const isImage = (url="") => /\.(png|jpe?g|webp|gif)$/i.test(url);

  return (
    <>
      <h1 className="tn-title">ชำระเงิน</h1>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: "0 6px 16px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>สรุปสถานะหนี้</div>
            <div className="muted">ค้างชำระได้ไม่เกินสองเดือน</div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 14, color: "#374151" }}>
              เดือนที่ค้าง (สูงสุด 2 งวดล่าสุด):{" "}
              {debtLatest2.length ? debtLatest2.map(r => r.period_ym || "-").join(", ") : "ไม่มี"}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>ยอดค้างรวม: {totalDebt.toLocaleString()} บาท</div>
          </div>
        </div>
      </div>

      <div className="pay-wrap">
        <div className="pay-grid">
          <section className="card pay-card">
            <h2 className="pay-title">ใบแจ้งหนี้ที่ค้างชำระ (2 งวดล่าสุด)</h2>

            {loadingInv && <p className="muted">กำลังโหลด…</p>}
            {!loadingInv && debtLatest2.length === 0 && <p className="muted">ขณะนี้ไม่มีรายการค้างชำระ 🎉</p>}

            {!loadingInv && debtLatest2.length > 0 && (
              <table className="pay-table">
                <thead>
                  <tr>
                    <th>งวด</th>
                    <th style={{ textAlign: "right" }}>จำนวนเงิน (บาท)</th>
                    <th>ครบกำหนด</th>
                    <th>สถานะ</th>
                    <th>หลักฐาน</th>
                  </tr>
                </thead>
                <tbody>
                  {debtLatest2.map((r, idx) => (
                    <tr key={r.invoice_id} style={idx === 0 ? { background: "#f3f4f6" } : {}}>
                      <td>{r.period_ym || "-"}</td>
                      <td style={{ textAlign: "right" }}>{Number(r.amount || 0).toLocaleString()}</td>
                      <td>{r.due_date ? String(r.due_date).slice(0,10) : "-"}</td>
                      <td>{r.effective_status || r.status}</td>
                      <td>
                        {r.slip_url
                          ? (isImage(r.slip_url)
                              ? <a href={encodeURI(r.slip_url)} target="_blank" rel="noreferrer">ดูรูป</a>
                              : <a href={encodeURI(r.slip_url)} target="_blank" rel="noreferrer">เปิดไฟล์</a>)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card pay-card">
            <h2 className="pay-title">สแกนจ่ายค่าเช่าและแนบสลิป</h2>
            <img src={qrSrc} alt="QR สำหรับชำระค่าเช่า" className="pay-qr" />

            <form onSubmit={onSubmit}>
              <div className="pay-field">
                <label className="label">แนบสลิปโอน (.jpg/.png/.pdf) ≤ 5MB</label>
                <input type="file" className="input" accept=".jpg,.jpeg,.png,.pdf" onChange={onFileChange}/>
                <p className="help">ระบบจะผูกสลิปให้บิลงวดล่าสุดที่ยังค้าง</p>
              </div>

              {preview && <img src={preview} alt="พรีวิวสลิป" className="slip-preview" />}
              {!preview && file?.type === "application/pdf" && <p className="muted">ไฟล์ที่เลือก: {file.name}</p>}

              {serverSlipUrl && (
                <>
                  <p className="help" style={{ marginTop: 8 }}>บันทึกแล้ว: สลิปถูกอัปโหลด</p>
                  {isImage(serverSlipUrl)
                    ? <img src={encodeURI(serverSlipUrl)} alt="สลิปที่อัปโหลด" className="slip-preview" />
                    : <a href={encodeURI(serverSlipUrl)} target="_blank" rel="noreferrer" className="tn-link">เปิดไฟล์สลิป</a>}
                </>
              )}

              {err && <p className="help" style={{ color: "#b91c1c" }}>{err}</p>}

              <button className="btn-primary" disabled={!file || !targetInvoice || uploading}>
                {uploading ? "กำลังอัปโหลด..." : "ส่งหลักฐาน"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
