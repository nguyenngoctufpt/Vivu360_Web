const apiBaseUrl = (process.env.VIVU360_API_URL || process.env.API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(5000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || `Vivu360 API ${response.status}`);
  return payload;
}

async function getReports(status = 'pending') {
  const query = status === 'all' ? '' : `?status=${encodeURIComponent(status)}`;
  const payload = await request(`/reports${query}`);
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function updateReportStatus(reportId, status) {
  return request(`/reports/${encodeURIComponent(reportId)}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
  });
}

async function deleteReportedPost(reportId) {
  return request(`/reports/${encodeURIComponent(reportId)}/post`, { method: 'DELETE' });
}

module.exports = { getReports, updateReportStatus, deleteReportedPost };
