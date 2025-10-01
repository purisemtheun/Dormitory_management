// frontend/src/services/payment.api.js
import http from "./http";

export const paymentApi = {
  myInvoices: async (limit = 3) =>
    (await http.get(`/api/payments/my-invoices?limit=${limit}`)).data,

  getQR: async () => (await http.get("/api/payments/qr")).data,

  submit: async ({ invoice_id, amount_paid, transfer_date, slip, note }) => {
    const fd = new FormData();
    fd.append("invoice_id", String(invoice_id));
    if (amount_paid != null) fd.append("amount_paid", String(amount_paid));
    if (transfer_date) fd.append("transfer_date", transfer_date); // ISO/`YYYY-MM-DDTHH:mm`
    if (note) fd.append("note", note);

    // แนบเฉพาะตอนมีไฟล์จริง และเป็นชนิดที่ยอมรับ
    if (slip instanceof File || slip instanceof Blob) {
      fd.append("slip", slip, slip.name ?? "slip");
    }

    const { data } = await http.post("/api/payments/submit", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data; 
  },
};
