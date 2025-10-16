import http from './http';

// สรุปหัวการ์ด
export function fetchDebtSummary() {
  // เดิม: return http.get('/api/debts/summary');
  return http.get('/api/admin/debts/summary');
}

// ค้นหาในตาราง
export function searchDebts(params) {
  // เดิม: return http.get('/api/debts/search', { params });
  return http.get('/api/admin/debts/search', { params });
}
