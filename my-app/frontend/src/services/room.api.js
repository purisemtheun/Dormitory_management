import http from "./http";

// ผู้เช่าเรียกใช้ -> ได้เฉพาะห้องตัวเอง (ตาม token)
export async function getMyRooms() {
  const { data } = await http.get("/api/rooms");
  // backend ฝั่ง tenant ส่งกลับ r.* (array) อาจมี 0 หรือ >1 ห้อง
  return Array.isArray(data) ? data : [];
}
