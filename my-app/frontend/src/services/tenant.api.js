import http from "./http";

// คาดหวัง API: GET /api/admin/tenants  (คืนรายการ tenants join users+rooms)
export const tenantsApi = {
  list: async () => (await http.get("/api/admin/tenants")).data,
};
