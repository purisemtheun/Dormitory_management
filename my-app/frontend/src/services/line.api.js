// frontend/src/services/line.api.js
import http from "./http";

export const lineApi = {
  // สถานะการผูกบัญชีของผู้ใช้ปัจจุบัน
  getStatus: async () => (await http.get("/api/line/status")).data,
  // ขอรหัส 6 ตัว (อายุ ~10 นาที ตามที่ backend กำหนด)
  requestLinkToken: async () => (await http.post("/api/line/link-token")).data,
};

export default lineApi;
