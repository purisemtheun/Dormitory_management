// src/services/repair.services.js
import http from "./http";

export const repairsService = {
  // data = { title, description, room_id?, due_date?, image_url?, imageFile? }
  create: async (data) => {
    const { imageFile, ...rest } = data;

    if (imageFile) {
      const fd = new FormData();
      Object.entries(rest).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim() !== "") {
          fd.append(k, v);
        }
      });
      fd.append("image", imageFile); // ต้องตรงกับ upload.single('image')

      const res = await http.post("/api/repairs", fd, {
        // ปล่อยให้ browser ตั้ง multipart/form-data; boundary=... เอง
        transformRequest: [
          (form, headers) => {
            if (typeof headers.delete === "function") headers.delete("Content-Type");
            else delete headers["Content-Type"];
            return form;
          },
        ],
      });
      return res.data;
    }

    // โหมด JSON (ไม่มีไฟล์)
    const res = await http.post("/api/repairs", rest);
    return res.data;
  },

  // ✅ ดึงรายชื่อช่างสำหรับ dropdown (admin/staff)
  // server คุณรองรับทั้ง /api/repairs/technicians และ /api/technicians
  listTechnicians: async () => {
    try {
      const res = await http.get("/api/repairs/technicians");
      return res.data;
    } catch (err) {
      // fallback เผื่อบางสภาพแวดล้อมเปิด alias /api/technicians
      if (err?.response?.status === 404) {
        const res2 = await http.get("/api/technicians");
        return res2.data;
      }
      throw err?.response?.data || err;
    }
  },
};
