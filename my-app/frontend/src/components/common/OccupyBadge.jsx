// src/components/common/OccupyBadge.jsx
import React from "react";

/**
 * ป้ายแสดงสถานะห้อง + รองรับคลิกเพื่อจอง
 * props:
 * - room: { status, current_tenant_user_id }
 * - myUserId: id ผู้ใช้ปัจจุบัน
 * - onClick: ฟังก์ชันคลิก (ถ้ามีจะแสดงเป็นปุ่ม)
 */
export default function OccupyBadge({ room = {}, myUserId = null, onClick }) {
  const status = String(room?.status || "").toLowerCase();
  const isMine =
    myUserId &&
    room?.current_tenant_user_id &&
    Number(myUserId) === Number(room.current_tenant_user_id);

  // เริ่มต้น = ว่าง (เขียวอ่อน)
  let theme = {
    cls: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    text: "ว่าง",
  };

  // ถูกจอง = เหลืองโปร่ง
  if (status === "reserved" || status === "pending") {
    theme = {
      cls: "bg-amber-500/80 text-white ring-amber-400/40", // fallback: bg-amber-500 bg-opacity-80 text-white ring-amber-400
      text: "ถูกจอง",
    };
  }

  // มีผู้เช่า = เขียวโปร่ง (ตามที่ขอ)
  if (status === "occupied") {
    theme = {
      // โปร่ง ~70–80%, ตัวหนังสือสีขาว
      cls: "bg-emerald-600/70 text-white ring-emerald-500/30", // fallback: bg-emerald-600 bg-opacity-70 text-white ring-emerald-500
      text: "มีผู้อาศัย",
    };
  }

  const base =
    `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ring-1 ${theme.cls}`;

  if (onClick) {
    return (
      <button
        type="button"
        className={base + " hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-offset-2"}
        onClick={onClick}
        title="คลิกเพื่อจอง"
      >
        {theme.text}
      </button>
    );
  }

  return <span className={base}>{theme.text}</span>;
}