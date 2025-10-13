import api from './api';

export const fetchDebtSummary = () => api.get('/debts/summary');
export const searchDebts = (params) => api.get('/debts/search', { params });
export const getTenantDebtDetail = (tenantId) => api.get(`/debts/tenant/${tenantId}`);
