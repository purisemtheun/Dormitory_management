// src/api/room.api.js
import http from "../services/http";

export const roomApi = {
  /* Admin */
  list: async () => (await http.get("/api/rooms")).data,

  /* Tenant */
  getMine: async () => (await http.get("/api/rooms/mine")).data,

  /* Board (ใหม่) */
  listBoard: async () => (await http.get("/api/rooms/board")).data,

  get: async (room_id) => (await http.get(`/api/rooms/${room_id}`)).data,
  create: async (payload) => (await http.post("/api/rooms", payload)).data,
  update: async (room_id, payload) => (await http.patch(`/api/rooms/${room_id}`, payload)).data,
  remove: async (room_id) => (await http.delete(`/api/rooms/${room_id}`)).data,

  /* Admin book for tenant (ของเดิม) */
  bookForTenant: async (room_id, { userId, checkin_date }) =>
    (await http.post(`/api/rooms/${room_id}/book`, { userId, checkin_date })).data,

  /* ✅ Tenant reserve room (ใหม่) */
  reserve: async (room_id, note = "") =>
    (await http.post(`/api/rooms/${room_id}/reservations`, { note })).data,
};
