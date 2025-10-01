import http from "./http";

export const roomApi = {
  // สำหรับ admin
  list: async () => (await http.get("/api/rooms")).data,

  // สำหรับ tenant (ใช้ใน RoomInfoPage)
  getMine: async () => (await http.get("/api/rooms/mine")).data,

  get: async (room_id) => (await http.get(`/api/rooms/${room_id}`)).data,
  create: async (payload) => (await http.post("/api/rooms", payload)).data,
  update: async (room_id, payload) => (await http.patch(`/api/rooms/${room_id}`, payload)).data,
  remove: async (room_id) => (await http.delete(`/api/rooms/${room_id}`)).data,
  bookForTenant: async (room_id, { userId, checkin_date }) =>
    (await http.post(`/api/rooms/${room_id}/book`, { userId, checkin_date })).data,
};
