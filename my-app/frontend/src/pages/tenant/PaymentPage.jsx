// frontend/src/pages/tenant/PaymentPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import http from "../../services/http";
import { paymentApi } from "../../services/payment.api";
import { Wallet, FileUp, ReceiptText, Hash, QrCode } from "lucide-react";

/**
 * PaymentPage (UI 10/10 demo)
 * - ตารางใบแจ้งหนี้จัดแนวซ้ายทุกคอลัมน์ (รวม period_ym / due_date) และใช้ "tabular-nums" ให้ตัวเลขเรียงเสาเป๊ะ
 * - ขยายตัวอักษร / ระยะห่าง / badge ให้ชัด
 * - โครงหน้าเดี่ยว: ตารางแนวนอนก่อน แล้วตามด้วยสแกนจ่าย + อัปโหลด
 * - QR โหลดจาก API ถ้าไม่มี fallback ไปที่ /public/img/Qrcode.jpg (ชื่อตรงตามที่คุณวาง)
 */

export default function PaymentPage() {
  const [invoices, setInvoices] = useState([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const [err, setErr] = useState("");

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [serverSlipUrl, setServerSlipUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState("");

  // 🆕 QR จาก API; ถ้า error ใช้ไฟล์ public/img/Qrcode.jpg (ระวังตัวพิมพ์)
  const DEFAULT_QR = "/img/Qrcode.jpg";
  const [qrUrl, setQrUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(true);

  const normalizeResponse = (resp) => (resp?.data !== undefined ? resp.data : resp);
  const isDebt = (s) => String(s || "").toLowerCase() !== "paid";
  const isImage = (url = "") => /\.(png|jpe?g|webp|gif)$/i.test(url);

  async function loadQR() {
    try {
      setQrLoading(true);
      const r = await http.get("/api/payments/qr");
      const data = normalizeResponse(r);
      const url = data?.qr_url || data?.qrPath || "";
      setQrUrl(url || DEFAULT_QR);
    } catch {
      setQrUrl(DEFAULT_QR);
    } finally {
      setQrLoading(false);
    }
  }

  async function loadInvoices() {
    try {
      setLoadingInv(true);
      const resp = await http.get("/api/payments/my-invoices?limit=5");
      const payload = normalizeResponse(resp);
      const list = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
      setInvoices(list);

      const firstNo =
        list.find((r) => isDebt(r.effective_status ?? r.status) && r.invoice_no?.length)?.invoice_no || "";
      setSelectedInvoiceNo((prev) => prev || firstNo);
    } catch (e) {
      const msg =
        e?.response?.data?.error || e?.response?.data?.message || e?.message || "โหลดบิลไม่สำเร็จ";
      setErr(msg);
      setInvoices([]);
    } finally {
      setLoadingInv(false);
    }
  }

  useEffect(() => {
    loadInvoices();
    loadQR();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latest3 = useMemo(() => {
    const list = invoices.filter((r) => isDebt(r.effective_status ?? r.status));
    list.sort((a, b) => {
      const aa = a.period_ym || (a.due_date ? String(a.due_date).slice(0, 10) : "");
      const bb = b.period_ym || (b.due_date ? String(b.due_date).slice(0, 10) : "");
      return aa < bb ? 1 : aa > bb ? -1 : 0;
    });
    return list.slice(0, 3);
  }, [invoices]);

  const totalDebt = useMemo(
    () => latest3.reduce((sum, r) => sum + Number(r.amount || 0), 0),
    [latest3]
  );

  const targetInvoice = useMemo(() => {
    if (selectedInvoiceNo) {
      return invoices.find((r) => r.invoice_no === selectedInvoiceNo) || latest3[0] || null;
    }
    if (latest3.length) return latest3[0];
    if (!invoices.length) return null;
    return invoices[0];
  }, [selectedInvoiceNo, latest3, invoices]);

  const statusLabel = (inv) => {
    const raw = String(inv?.status || "").toLowerCase();
    if (raw === "paid")
      return { label: "ชำระเสร็จสิ้น", color: "text-emerald-700 bg-emerald-50 ring-emerald-200" };
    if (inv?.slip_url && raw !== "paid")
      return { label: "รออนุมัติชำระเงิน", color: "text-amber-700 bg-amber-50 ring-amber-200" };
    return { label: "ค้างชำระ", color: "text-rose-700 bg-rose-50 ring-rose-200" };
  };

  const onFileChange = (e) => {
    const f = e.target.files?.[0] || null;
    setErr("");
    setFile(null);
    setPreview("");
    setServerSlipUrl("");
    if (!f) return;

    const ALLOW = ["image/jpeg", "image/png", "application/pdf"];
    const MAX = 5 * 1024 * 1024;
    if (!ALLOW.includes(f.type)) return setErr("รองรับเฉพาะ .jpg .png .pdf เท่านั้น");
    if (f.size > MAX) return setErr("ไฟล์ใหญ่เกิน 5MB");

    setFile(f);
    if (f.type.startsWith("image/")) setPreview(URL.createObjectURL(f));
  };

  useEffect(() => {
    return () => preview && URL.revokeObjectURL(preview);
  }, [preview]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!targetInvoice) return setErr("ไม่พบบิลสำหรับชำระ");
    if (!file) return setErr("กรุณาแนบสลิปก่อนกดส่ง");

    try {
      setUploading(true);
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
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-10">

        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-7 shadow-lg mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-white/15 rounded-xl p-2.5">
              <Wallet className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">ชำระเงินค่าเช่า</h1>
              <p className="text-white/80 text-sm sm:text-base mt-1">ดูใบแจ้งหนี้งวดล่าสุดและอัปโหลดหลักฐานการโอน</p>
            </div>
            <div className="ml-auto text-right">
              <div className="text-xs sm:text-sm text-white/80">ยอดค้างรวม</div>
              <div className="text-3xl sm:text-4xl font-black tabular-nums">
                {totalDebt.toLocaleString()} <span className="text-white/90 text-xl font-semibold">บาท</span>
              </div>
            </div>
          </div>
        </div>

        {/* ตารางใบแจ้งหนี้ */}
        <section className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 sm:p-8 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <ReceiptText className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-semibold text-slate-800">ใบแจ้งหนี้ 3 งวดล่าสุด</h2>
          </div>

          {loadingInv && <p className="text-lg text-slate-500">กำลังโหลด…</p>}
          {!loadingInv && latest3.length === 0 && (
            <p className="text-lg text-slate-500">ไม่มีรายการค้างชำระ 🎉</p>
          )}

          {!loadingInv && latest3.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-base border-separate [border-spacing:0]">
                <thead>
                  <tr className="text-slate-600">
                    <th className="py-3 px-3 text-left">เลขบิล</th>
                    <th className="py-3 px-3 text-left">งวด</th>
                    <th className="py-3 px-3 text-left">ค่าเช่า</th>
                    <th className="py-3 px-3 text-left">ค่าน้ำ</th>
                    <th className="py-3 px-3 text-left">ค่าไฟ</th>
                    <th className="py-3 px-3 text-left">ยอดรวม</th>
                    <th className="py-3 px-3 text-left">ครบกำหนด</th>
                    <th className="py-3 px-3 text-left">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {latest3.map((r, idx) => {
                    const st = statusLabel(r);
                    return (
                      <tr
                        key={r.invoice_id}
                        className={`hover:bg-purple-50/30 transition ${
                          idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                        }`}
                      >
                        <td className="py-3 px-3 font-semibold text-slate-800">{r.invoice_no}</td>
                        {/* ใช้ tabular-nums + font-mono ให้เลขเรียงเสาเท่ากัน */}
                        <td className="py-3 px-3 font-mono tabular-nums text-slate-700">{r.period_ym}</td>
                        <td className="py-3 px-3 font-mono tabular-nums">{Number(r.rent_amount || 0).toLocaleString()}</td>
                        <td className="py-3 px-3 font-mono tabular-nums">{Number(r.water_amount || 0).toLocaleString()}</td>
                        <td className="py-3 px-3 font-mono tabular-nums">{Number(r.electric_amount || 0).toLocaleString()}</td>
                        <td className="py-3 px-3 font-bold text-slate-900 font-mono tabular-nums">
                          {Number(r.amount || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums">
                          {r.due_date ? String(r.due_date).slice(0, 10) : "-"}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`text-sm px-3 py-1.5 rounded-full ring-1 ${st.color} font-semibold`}>
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* สแกนจ่าย + อัปโหลด */}
        <section className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 sm:p-8">
          {/* QR */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <QrCode className="w-6 h-6 text-purple-600" />
              <h3 className="text-xl font-semibold text-slate-800">สแกนจ่าย (พร้อมเพย์/บัญชี)</h3>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 flex items-center justify-center">
              {!qrLoading ? (
                <img
                  src={qrUrl || DEFAULT_QR}
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_QR;
                  }}
                  alt="QR สำหรับชำระเงิน"
                  className="w-full max-w-sm sm:max-w-md max-h-96 object-contain rounded-lg shadow-lg"
                />
              ) : (
                <div className="text-base text-slate-500">กำลังโหลด QR…</div>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-500">
              ระบบจะพยายามใช้ QR ล่าสุดจากฐานข้อมูล; ถ้าไม่มีจะแสดงไฟล์จาก <code>/public/img/Qrcode.jpg</code>
            </p>
          </div>

          {/* Upload form */}
          <div className="flex items-center gap-3 mb-4 pt-4 border-t border-slate-200">
            <FileUp className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-semibold text-slate-800">อัปโหลดหลักฐานการโอน</h2>
          </div>

          <div className="mb-4">
            <label className="block text-base font-medium text-slate-700 mb-1">เลือกใบแจ้งหนี้</label>
            <select
              className="w-full h-12 rounded-xl border border-slate-300 px-4 text-base focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none bg-white transition"
              value={selectedInvoiceNo}
              onChange={(e) => setSelectedInvoiceNo(e.target.value)}
            >
              <option value="">— เลือกอัตโนมัติ (งวดล่าสุด) —</option>
              {latest3.map((r) => (
                <option key={r.invoice_id} value={r.invoice_no || ""}>
                  {r.invoice_no} • {r.period_ym} • {Number(r.amount || 0).toLocaleString()} บาท
                </option>
              ))}
            </select>

            {targetInvoice && (
              <div className="mt-3 text-base text-slate-700">
                <Hash className="inline w-5 h-5 text-slate-400 mr-1" />
                บิลที่เลือก: {targetInvoice.invoice_no} · งวด {targetInvoice.period_ym} ·{" "}
                <strong className="text-purple-700">
                  {Number(targetInvoice.amount || 0).toLocaleString()} บาท
                </strong>
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-base font-medium text-slate-700 mb-1">
                แนบสลิปโอน (.jpg/.png/.pdf) ≤ 5MB
              </label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={onFileChange}
                className="block w-full text-base file:mr-4 file:py-2.5 file:px-5 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700
                           border border-slate-300 rounded-xl h-12 px-3 bg-white cursor-pointer"
              />
            </div>

            {preview && (
              <img
                src={preview}
                alt="พรีวิวสลิป"
                className="block w-full max-h-96 object-contain rounded-lg border border-slate-300"
              />
            )}

            {serverSlipUrl && (
              <div className="text-base text-slate-600">
                ✅ อัปโหลดแล้ว:{" "}
                {isImage(serverSlipUrl) ? (
                  <a
                    href={encodeURI(serverSlipUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-purple-700 font-medium hover:underline"
                  >
                    ดูสลิป
                  </a>
                ) : (
                  <a
                    href={encodeURI(serverSlipUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-purple-700 font-medium hover:underline"
                  >
                    เปิดไฟล์
                  </a>
                )}
              </div>
            )}

            {err && <p className="text-base text-rose-600 font-medium">{err}</p>}

            <button
              className="w-full h-12 rounded-xl bg-purple-600 text-white text-lg font-bold shadow-lg shadow-purple-200 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!file || !targetInvoice || uploading}
            >
              {uploading ? "กำลังอัปโหลด..." : "ส่งหลักฐาน"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
