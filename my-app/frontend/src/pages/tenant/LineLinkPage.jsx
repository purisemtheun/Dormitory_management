// frontend/src/pages/tenant/LineLinkPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import http from "../../services/http";
import qrImg from "../../assets/QRBOT.jpg"; // ✅ รูป QR (อยู่ที่ src/assets/QRBOT.jpg)

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
      // ควรมี endpoint นี้ให้คืน { linked, linkedAt?, lineDisplayName? }
      const { data } = await http.get("/api/line/status");
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
      // ควรมี endpoint นี้ให้คืน { code, expiresAt }
      const { data } = await http.post("/api/line/link-token");
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
      <div className="line-link" style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
        <div className="ll-card" style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 8px rgba(0,0,0,.06)", marginBottom: 16 }}>
          {/* หัวข้อ */}
          <div className="ll-head" style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 8 }}>
            ผูกบัญชี LINE
          </div>

          {/* สถานะ */}
          {loading ? (
            <p className="muted">กำลังโหลดสถานะ…</p>
          ) : status.linked ? (
            <>
              <div className="ll-status" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span>สถานะ:</span>
                <span className="ll-badge-ok" style={{ background: "#16a34a", color: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: 12 }}>
                  ผูกเรียบร้อย
                </span>
              </div>
              {status.lineDisplayName && <p>บัญชี: {status.lineDisplayName}</p>}
              {status.linkedAt && <p>ตั้งแต่: {new Date(status.linkedAt).toLocaleString()}</p>}
              <p className="muted" style={{ marginTop: 8, color: "#64748b" }}>
                หากต้องการเปลี่ยนบัญชี LINE กรุณาติดต่อผู้ดูแลระบบ
              </p>
            </>
          ) : (
            <>
              <div className="ll-status" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span>สถานะ:</span>
                <span className="ll-badge-fail" style={{ background: "#ef4444", color: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: 12 }}>
                  ยังไม่ผูก
                </span>
              </div>
              <p className="muted" style={{ color: "#64748b" }}>
                กด “ขอโค้ด” แล้วนำรหัส 6 ตัวไปพิมพ์ในแชทกับบอท เพื่อผูกบัญชี
              </p>
              <div className="ll-actions" style={{ marginTop: 8 }}>
                <button
                  className="btn-primary"
                  onClick={requestCode}
                  disabled={busy}
                  style={{ background: "#2563eb", color: "#fff", padding: "8px 12px", borderRadius: 8 }}
                >
                  {busy ? "กำลังกำเนินการ…" : "ขอโค้ดผูกบัญชี"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ✅ การ์ด QR (แค่เอารูปมาโชว์สแกน) */}
        <div className="ll-card" style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 8px rgba(0,0,0,.06)", marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>สแกน QR เพื่อเพิ่มเพื่อนบอท</div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <img
              src={qrImg}
              alt="QR เพิ่มเพื่อน LINE บอท"
              style={{
                width: 192,
                height: 192,
                objectFit: "contain",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
              }}
            />
            <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
              <div>1) สแกน QR เพื่อเพิ่มเพื่อนบอท</div>
              <div>2) พิมพ์โค้ด <b>6 ตัว</b> ที่ได้รับ (เช่น <code>LINK ABC123</code> หรือพิมพ์ <code>ABC123</code> อย่างเดียวก็ได้)</div>
              <div>3) กลับมาหน้านี้ กดเช็คสถานะหรือรีเฟรช จะขึ้น “ผูกเรียบร้อย”</div>
            </div>
          </div>
        </div>

        {code && (
          <div className="ll-card" style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 8px rgba(0,0,0,.06)", borderStyle: "dashed", borderColor: "#94a3b8", marginBottom: 16 }}>
            <div className="ll-token">
              <div className="ll-title" style={{ fontSize: "1rem", fontWeight: 600 }}>รหัสผูกบัญชี (6 ตัว)</div>
              <div className="ll-row" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <div className="ll-token-box" style={{ fontFamily: "ui-monospace, monospace", fontSize: 24, letterSpacing: 2, padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#f8fafc" }}>
                  {code}
                </div>
                <button
                  className="btn-ghost"
                  onClick={copy}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}
                >
                  คัดลอก
                </button>
                <div className="ll-expire" style={{ marginLeft: "auto", color: "#475569" }}>
                  หมดอายุใน <b>{remainSec}</b> วินาที
                </div>
              </div>
              <ol className="ll-steps" style={{ color: "#475569", marginTop: 8 }}>
                <li>1) เปิดแชทกับบอทของหอพัก</li>
                <li>2) พิมพ์รหัสนี้ (ตัวพิมพ์ใหญ่-เล็กตรงกัน)</li>
                <li>3) สำเร็จแล้ว กลับมาหน้านี้ สถานะจะเปลี่ยนเป็น “ผูกเรียบร้อย”</li>
              </ol>
            </div>
          </div>
        )}

        {err && (
          <div className="ll-alert" style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: 12, borderRadius: 8 }}>
            ❗ {err}
          </div>
        )}
      </div>
    </>
  );
}
