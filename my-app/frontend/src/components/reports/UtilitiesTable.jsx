// src/components/reports/UtilitiesTable.jsx
import React, { useEffect, useMemo, useState } from "react";
import { reportApi } from "../../api/reports.api";

const val = (v, d = 0) => (v === null || v === undefined || v === "" ? d : v);
const num = (v) => Number(val(v, 0)) || 0;

const normalizeMode = (r) => {
  const m = String(r.mode ?? r.billing_mode ?? "").toLowerCase();
  if (m === "flat" || m === "package" || m === "fixed") return "flat";
  return "meter";
};

const roomLabel = (r) => {
  const id = r.room_id ?? r.roomId ?? r.room_code ?? r.roomCode ?? "";
  const no = r.room_number ?? r.roomNumber ?? r.room_no ?? r.number ?? "";
  if (id && no) return `${no}`;
  return String((r.room ?? r.room_no ?? id) || "-");
};

const monthLabel = (ym) => {
  if (!ym) return "-";
  const [y, m] = ym.split("-");
  const dt = new Date(`${y}-${m}-01T00:00:00`);
  return dt.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
};

export default function UtilitiesTable({ data = [], period = "", setPeriod }) {
  const [rows, setRows] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => setRows(data ?? []), [data]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        const mode = normalizeMode(r);

        if (mode === "flat") {
          const w = num(r.flat_water_amount ?? r.water_flat);
          const e = num(r.flat_electric_amount ?? r.electric_flat);
          acc.waterAmount += w;
          acc.elecAmount += e;
        } else {
          const wPrev = num(r.water_prev);
          const wCurr = num(r.water_curr);
          const ePrev = num(r.electric_prev);
          const eCurr = num(r.electric_curr);
          const wUnits = Math.max(0, wCurr - wPrev);
          const eUnits = Math.max(0, eCurr - ePrev);
          const wAmt = wUnits * num(r.water_rate);
          const eAmt = eUnits * num(r.electric_rate);
          acc.waterUnits += wUnits;
          acc.elecUnits += eUnits;
          acc.waterAmount += wAmt;
          acc.elecAmount += eAmt;
        }
        return acc;
      },
      { waterUnits: 0, elecUnits: 0, waterAmount: 0, elecAmount: 0 }
    );
  }, [rows]);

  const handleMonthChange = (e) => setPeriod?.(e.target.value);

  const updateLocal = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.room_id === id ? { ...r, ...patch } : r)));
  };

  const saveRow = async (r) => {
    try {
      const mode = normalizeMode(r);

      if (
        mode === "meter" &&
        (num(r.water_curr) < num(r.water_prev) ||
         num(r.electric_curr) < num(r.electric_prev))
      ) {
        setMsg("บันทึกล้มเหลว: เลขมิเตอร์เดือนนี้ต้องไม่ต่ำกว่าเดือนก่อน");
        setTimeout(() => setMsg(""), 2200);
        return;
      }

      setSavingId(r.room_id);
      setMsg("");

      const payload = {
        room_id: r.room_id,
        period_ym: period,
        mode,
      };

      if (mode === "flat") {
        payload.flat_water_amount = num(r.flat_water_amount ?? r.water_flat);
        payload.flat_electric_amount = num(r.flat_electric_amount ?? r.electric_flat);
      } else {
        payload.water_prev = num(r.water_prev);
        payload.water_curr = num(r.water_curr);
        payload.electric_prev = num(r.electric_prev);
        payload.electric_curr = num(r.electric_curr);
        // ถ้ามี rate ในตารางก็ส่งแนบไปด้วย (ไม่จำเป็นก็ได้)
        payload.water_rate = num(r.water_rate);
        payload.electric_rate = num(r.electric_rate);
      }

      const res = await reportApi.meterSaveReading(payload);
      if (res && typeof res === "object") {
        updateLocal(r.room_id, res);
      }
      setMsg("บันทึกแล้ว");
      setTimeout(() => setMsg(""), 1600);
    } catch (e) {
      setMsg(`บันทึกล้มเหลว: ${e.message || "กรุณาลองอีกครั้ง"}`);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <label>เลือกงวด (เดือน): </label>
        <input
          type="month"
          value={period || ""}
          onChange={handleMonthChange}
          style={{ width: 180 }}
        />
      </div>

      <div
        style={{
          padding: 12,
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          color: "#7c2d12",
          marginBottom: 10,
          borderRadius: 8,
        }}
      >
        <div><b>สรุปยอด {monthLabel(period)}</b></div>
        <div style={{ marginTop: 6 }}>
          หน่วยน้ำรวม: {summary.waterUnits.toLocaleString()} หน่วย (
          {summary.waterAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท)
          &nbsp;&nbsp;•&nbsp;&nbsp;
          หน่วยไฟรวม: {summary.elecUnits.toLocaleString()} หน่วย (
          {summary.elecAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท)
        </div>
      </div>

      {msg && (
        <div
          style={{
            marginBottom: 10,
            color: msg.startsWith("บันทึกแล้ว") ? "#065f46" : "#991b1b",
            background: msg.startsWith("บันทึกแล้ว") ? "#ecfdf5" : "#fef2f2",
            border: `1px solid ${msg.startsWith("บันทึกแล้ว") ? "#a7f3d0" : "#fecaca"}`,
            padding: 10,
            borderRadius: 8,
          }}
        >
          {msg}
        </div>
      )}

      <div className="table-wrap" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>ห้อง</th>
              <th>ผู้เช่า</th>

              <th>เลขมิเตอร์น้ำ (เดือนก่อน)</th>
              <th>เลขมิเตอร์น้ำ (เดือนนี้)</th>
              <th>หน่วยน้ำ</th>
              <th>ค่าน้ำ (บาท)</th>

              <th>เลขมิเตอร์ไฟ (เดือนก่อน)</th>
              <th>เลขมิเตอร์ไฟ (เดือนนี้)</th>
              <th>หน่วยไฟ</th>
              <th>ค่าไฟ (บาท)</th>

              <th>รวม (บาท)</th>
              <th>บันทึก</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r) => {
                const mode = normalizeMode(r);

                // ทำให้ prev/curr เป็นอินพุตเมื่อเป็น "มิเตอร์"
                const wPrev = num(r.water_prev);
                const wCurr = num(r.water_curr);
                const ePrev = num(r.electric_prev);
                const eCurr = num(r.electric_curr);
                const wRate = num(r.water_rate) || 0;
                const eRate = num(r.electric_rate) || 0;

                const wUnits = Math.max(0, wCurr - wPrev);
                const eUnits = Math.max(0, eCurr - ePrev);
                const wAmount = mode === "flat"
                  ? num(r.flat_water_amount ?? r.water_flat)
                  : wUnits * wRate;
                const eAmount = mode === "flat"
                  ? num(r.flat_electric_amount ?? r.electric_flat)
                  : eUnits * eRate;

                const total = wAmount + eAmount;

                const invalidWater = mode === "meter" && wCurr < wPrev;
                const invalidElec  = mode === "meter" && eCurr < ePrev;

                return (
                  <tr key={r.room_id}>
                    <td>{roomLabel(r)}</td>
                    <td>{r.tenant_name ?? r.tenant ?? "-"}</td>

                    {/* WATER PREV */}
                    <td>
                      {mode === "flat" ? "-" : (
                        <input
                          type="number"
                          step="1"
                          value={r.water_prev ?? ""}
                          onChange={(e) =>
                            updateLocal(r.room_id, { water_prev: e.target.value })
                          }
                          style={{ width: 110 }}
                        />
                      )}
                    </td>

                    {/* WATER CURR */}
                    <td>
                      {mode === "flat" ? "-" : (
                        <input
                          type="number"
                          step="1"
                          value={r.water_curr ?? ""}
                          onChange={(e) =>
                            updateLocal(r.room_id, { water_curr: e.target.value })
                          }
                          style={{
                            width: 110,
                            borderColor: invalidWater ? "#dc2626" : undefined,
                          }}
                          title={invalidWater ? "เลขเดือนนี้ต้องมากกว่าหรือเท่ากับเดือนก่อน" : ""}
                        />
                      )}
                    </td>

                    <td className="num">{mode === "flat" ? "-" : wUnits}</td>
                    <td className="num">
                      {wAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2, maximumFractionDigits: 2,
                      })}
                    </td>

                    {/* ELEC PREV */}
                    <td>
                      {mode === "flat" ? "-" : (
                        <input
                          type="number"
                          step="1"
                          value={r.electric_prev ?? ""}
                          onChange={(e) =>
                            updateLocal(r.room_id, { electric_prev: e.target.value })
                          }
                          style={{ width: 110 }}
                        />
                      )}
                    </td>

                    {/* ELEC CURR */}
                    <td>
                      {mode === "flat" ? "-" : (
                        <input
                          type="number"
                          step="1"
                          value={r.electric_curr ?? ""}
                          onChange={(e) =>
                            updateLocal(r.room_id, { electric_curr: e.target.value })
                          }
                          style={{
                            width: 110,
                            borderColor: invalidElec ? "#dc2626" : undefined,
                          }}
                          title={invalidElec ? "เลขเดือนนี้ต้องมากกว่าหรือเท่ากับเดือนก่อน" : ""}
                        />
                      )}
                    </td>

                    <td className="num">{mode === "flat" ? "-" : eUnits}</td>
                    <td className="num">
                      {eAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2, maximumFractionDigits: 2,
                      })}
                    </td>

                    <td className="num">
                      <b>
                        {total.toLocaleString(undefined, {
                          minimumFractionDigits: 2, maximumFractionDigits: 2,
                        })}
                      </b>
                    </td>

                    <td>
                      <button
                        className="btn btn-primary"
                        disabled={savingId === r.room_id}
                        onClick={() => saveRow(r)}
                      >
                        {savingId === r.room_id ? "กำลังบันทึก…" : "บันทึก"}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={12} style={{ textAlign: "center", padding: 20 }}>
                  ไม่พบข้อมูลค่าน้ำ/ค่าไฟสำหรับงวด {period || "-"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
