// frontend/src/services/dashboard.api.js
import http from './http';

export const dashboardApi = {
  get: async () => (await http.get('/api/admin/dashboard')).data,
};

export default dashboardApi;
