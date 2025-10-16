import http from "./http";

export const paymentApi = {
  myInvoices: async (limit = 3) =>
    (await http.get(`/api/payments/my-invoices?limit=${limit}`)).data,

  getQR: async () => (await http.get("/api/payments/qr")).data,

  submit: async ({ invoice_id, invoice_no, amount_paid, transfer_date, slip, note }) => {
    const fd = new FormData();

    // ✅ ส่งทั้ง invoice_id และ invoice_no ไป เผื่อฝั่ง backend ใช้อันใดอันหนึ่ง
    if (invoice_id != null) fd.append("invoice_id", String(invoice_id));
    if (invoice_no) fd.append("invoice_no", invoice_no);

    if (amount_paid != null) fd.append("amount_paid", String(amount_paid));
    if (transfer_date) fd.append("transfer_date", transfer_date);
    if (note) fd.append("note", note);

    // ✅ ชื่อ field ต้องตรงกับ upload.single('slip')
    if (slip instanceof File || slip instanceof Blob) {
      fd.append("slip", slip, slip.name ?? "slip.jpg");
    } else {
      throw new Error("กรุณาแนบสลิป (field ต้องชื่อ 'slip')");
    }

    // ไม่ต้องตั้ง header multipart เอง ให้ browser ทำ
    const { data } = await http.post("/api/payments/submit", fd);
    return data;
  },
};

export default paymentApi;
