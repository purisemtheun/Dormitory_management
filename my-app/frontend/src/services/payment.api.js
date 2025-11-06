// frontend/src/services/payment.api.js
import http from "./http";

/**
 * payload รองรับ:
 * - { invoice_no, slip: File }
 * - { invoice_id, slip: File }
 */
async function submit(payload) {
  const fd = new FormData();
  if (payload.invoice_no) fd.append("invoice_no", payload.invoice_no);
  if (payload.invoice_id) fd.append("invoice_id", payload.invoice_id);
  fd.append("slip", payload.slip); // ชื่อฟิลด์ต้องตรงกับ backend

  return http.post("/api/payments/submit", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export const paymentApi = { submit };
