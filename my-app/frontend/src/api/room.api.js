// frontend/src/api/room.api.js
import http from "../services/http";

const API_PREFIX = "/api";

export const roomApi = {
  /* Admin */
  list: async () => {
    const { data } = await http.get(`${API_PREFIX}/rooms`);
    return Array.isArray(data) ? data : [];
  },

  /* Tenant */
  getMine: async () => (await http.get(`${API_PREFIX}/rooms/mine`)).data,

  /* Board (ใหม่) */
  listBoard: async () => (await http.get(`${API_PREFIX}/rooms/board`)).data,

  get: async (room_id) => (await http.get(`${API_PREFIX}/rooms/${room_id}`)).data,
  create: async (payload) => (await http.post(`${API_PREFIX}/rooms`, payload)).data,
  update: async (room_id, payload) =>
    (await http.patch(`${API_PREFIX}/rooms/${room_id}`, payload)).data,
  remove: async (room_id) => (await http.delete(`${API_PREFIX}/rooms/${room_id}`)).data,

  /* Admin book for tenant (ของเดิม) */
  bookForTenant: async (room_id, { userId, checkin_date }) =>
    (await http.post(`${API_PREFIX}/rooms/${room_id}/book`, { userId, checkin_date })).data,

  /* ✅ Tenant reserve room (ใหม่) */
  reserve: async (room_id, note = "") =>
    (await http.post(`${API_PREFIX}/rooms/${room_id}/reservations`, { note })).data,
};
