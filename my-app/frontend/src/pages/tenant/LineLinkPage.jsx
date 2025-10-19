// frontend/src/pages/tenant/LineLinkPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import http from "../../services/http";

export default function LineLinkPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [status, setStatus] = useState({
    linked: false,
    linkedAt: null,
    lineDisplayName: "",
  });

  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const [now, setNow] = useState(Date.now());

  const remainSec = useMemo(() => {
    if (!expiresAt) return 0;
    const ms = new Date(expiresAt).getTime() - now;
    return Math.max(0, Math.floor(ms / 1000));
  }, [expiresAt, now]);

  // นาฬิกานับถอยหลัง
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // เคลียร์โค้ดเมื่อหมดเวลา
  useEffect(() => {
    if (expiresAt && remainSec === 0) {
      setCode("");
      setExpiresAt(null);
    }
  }, [remainSec, expiresAt]);

  const loadStatus = async () => {
    setLoading(true);
    setErr("");
    try {
      const { data } = await http.get("/api/line/status"); // { linked, linkedAt?, lineDisplayName? }
      setStatus({
        linked: !!data?.linked,
        linkedAt: data?.linkedAt || null,
        lineDisplayName: data?.lineDisplayName || "",
      });
    } catch (e) {
      setErr(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          e?.message ||
          "โหลดสถานะไม่สำเร็จ"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const requestCode = async () => {
    setErr("");
    setBusy(true);
    try {
      const { data } = await http.post("/api/line/link-token"); // { code, expiresAt }
      setCode(data?.code || "");
      setExpiresAt(data?.expiresAt || null);
    } catch (e) {
      setErr(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          e?.message ||
          "ขอโค้ดไม่สำเร็จ"
      );
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      if (!code) return;
      await navigator.clipboard.writeText(code);
      alert("คัดลอกโค้ดแล้ว");
    } catch {
      alert("คัดลอกไม่สำเร็จ");
    }
  };

  return (
    <>
      <div className="line-link">
        <div className="ll-card">
          {/* ✅ หัวข้ออยู่บนสถานะในกล่องเดียวกัน */}
          <div className="ll-head" style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 8 }}>
            ผูกบัญชี LINE
          </div>

          {/* สถานะ */}
          {loading ? (
            <p className="muted">กำลังโหลดสถานะ…</p>
          ) : status.linked ? (
            <>
              <div className="ll-status">
                <span>สถานะ:</span>
                <span className="ll-badge-ok">ผูกเรียบร้อย</span>
              </div>
              {status.lineDisplayName && <p>บัญชี: {status.lineDisplayName}</p>}
              {status.linkedAt && (
                <p>ตั้งแต่: {new Date(status.linkedAt).toLocaleString()}</p>
              )}
              <p className="muted" style={{ marginTop: 8 }}>
                หากต้องการเปลี่ยนบัญชี LINE กรุณาติดต่อผู้ดูแลระบบ
              </p>
            </>
          ) : (
            <>
              <div className="ll-status">
                <span>สถานะ:</span>
                <span className="ll-badge-fail">ยังไม่ผูก</span>
              </div>
              <p className="muted">
                กด “ขอโค้ด” แล้วนำรหัส 6 ตัวไปพิมพ์ในแชทกับบอท เพื่อผูกบัญชี
              </p>
              <div className="ll-actions">
                <button className="btn-primary" onClick={requestCode} disabled={busy}>
                  {busy ? "กำลังขอโค้ด…" : "ขอโค้ดผูกบัญชี"}
                </button>
              </div>
            </>
          )}
        </div>

        {code && (
          <div className="ll-card" style={{ borderStyle: "dashed", borderColor: "#94a3b8" }}>
            <div className="ll-token">
              <div className="ll-title" style={{ fontSize: "1rem" }}>รหัสผูกบัญชี (6 ตัว)</div>
              <div className="ll-row">
                <div className="ll-token-box">{code}</div>
                <button className="btn-ghost" onClick={copy}>คัดลอก</button>
                <div className="ll-expire">
                  หมดอายุใน <b>{remainSec}</b> วินาที
                </div>
              </div>
              <ol className="ll-steps">
                <li>1) เปิดแชทกับบอทของหอพัก</li>
                <li>2) พิมพ์รหัสนี้ (ตัวพิมพ์ใหญ่-เล็กตรงกัน)</li>
                <li>3) สำเร็จแล้ว กลับมาหน้านี้ สถานะจะเปลี่ยนเป็น “ผูกเรียบร้อย”</li>
              </ol>
            </div>
          </div>
        )}

        {err && <div className="ll-alert">❗ {err}</div>}
      </div>
    </>
  );
}
