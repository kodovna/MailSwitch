const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  uploadCsv(file) {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE}/upload`, { method: 'POST', body: form }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.join(', ') || data.error || 'Upload failed');
      return data;
    });
  },

  testConnection(host, port) {
    return request('/jobs/test-connection', {
      method: 'POST',
      body: JSON.stringify({ host, port: Number(port) }),
    });
  },

  testAuth(host, port, email, password) {
    return request('/jobs/test-auth', {
      method: 'POST',
      body: JSON.stringify({ host, port: Number(port), email, password }),
    });
  },

  createJob(accounts, mode = 'full', syncInterval = 300, serverConfig = {}) {
    return request('/jobs', {
      method: 'POST',
      body: JSON.stringify({ accounts, mode, syncInterval, serverConfig }),
    });
  },

  getJobs() {
    return request('/jobs');
  },

  getJob(id) {
    return request(`/jobs/${id}`);
  },

  startJob(id) {
    return request(`/jobs/${id}/start`, { method: 'POST' });
  },

  pauseJob(id) {
    return request(`/jobs/${id}/pause`, { method: 'POST' });
  },

  cancelJob(id) {
    return request(`/jobs/${id}/cancel`, { method: 'POST' });
  },

  retryFailed(id) {
    return request(`/jobs/${id}/retry-failed`, { method: 'POST' });
  },

  resyncJob(id) {
    return request(`/jobs/${id}/resync`, { method: 'POST' });
  },

  toggleSync(id) {
    return request(`/jobs/${id}/sync`, { method: 'POST' });
  },

  getAccount(id) {
    return request(`/accounts/${id}`);
  },

  getAccountErrors(id, limit = 100, offset = 0) {
    return request(`/accounts/${id}/errors?limit=${limit}&offset=${offset}`);
  },

  retryAccount(id) {
    return request(`/accounts/${id}/retry`, { method: 'POST' });
  },
};
