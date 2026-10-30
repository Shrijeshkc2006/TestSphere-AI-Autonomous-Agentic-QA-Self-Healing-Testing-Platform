/**
 * Centralized API client for TestSphere.
 * All requests go through here — auth token is injected automatically.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(path, options = {}) {
  const token = localStorage.getItem('ts_token');
  const headers = {
    ...(options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body instanceof FormData
      ? options.body
      : options.body
      ? JSON.stringify(options.body)
      : undefined,
  });

  let data;
  const ct = response.headers.get('Content-Type') || '';
  if (ct.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const msg = data?.detail || data?.message || `HTTP ${response.status}`;
    throw new ApiError(
      typeof msg === 'string' ? msg : JSON.stringify(msg),
      response.status,
      data,
    );
  }

  return data;
}

const get  = (path, options)  => request(path, { ...options, method: 'GET' });
const post = (path, body, options) => request(path, { ...options, method: 'POST', body });
const patch = (path, body, options) => request(path, { ...options, method: 'PATCH', body });
const del  = (path, options)  => request(path, { ...options, method: 'DELETE' });

// ── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => post('/api/auth/register', data),
  login:    (data) => post('/api/auth/login', data),
  me:       ()     => get('/api/auth/me'),
};

// ── Projects ────────────────────────────────────────────────────────────────
export const projectsApi = {
  list:      (search) => get(`/api/projects${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  create:    (data)   => post('/api/projects', data),
  get:       (id)     => get(`/api/projects/${id}`),
  update:    (id, d)  => patch(`/api/projects/${id}`, d),
  delete:    (id)     => del(`/api/projects/${id}`),
  dashboard: ()       => get('/api/projects/dashboard'),
};

// ── Uploads ─────────────────────────────────────────────────────────────────
export const uploadsApi = {
  upload: (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    // Use XMLHttpRequest for progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const token = localStorage.getItem('ts_token');
      xhr.open('POST', `${BASE_URL}/api/uploads`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new ApiError(data.detail || `HTTP ${xhr.status}`, xhr.status, data));
        } catch {
          reject(new ApiError('Parse error', xhr.status, xhr.responseText));
        }
      };
      xhr.onerror = () => reject(new ApiError('Network error', 0));
      xhr.send(formData);
    });
  },
  get: (id) => get(`/api/uploads/${id}`),
};

// ── Test Plans ───────────────────────────────────────────────────────────────
export const plansApi = {
  listForProject: (projectId) => get(`/api/test-plans/project/${projectId}`),
  create:         (data)      => post('/api/test-plans', data),
  generate:       (data)      => post('/api/test-plans/generate', data),
  get:            (id)        => get(`/api/test-plans/${id}`),
  approve:        (id)        => patch(`/api/test-plans/${id}/approve`),
  updateStep:     (planId, stepId, data) => patch(`/api/test-plans/${planId}/steps/${stepId}`, data),
  generateCode:   (planId)    => post(`/api/test-plans/${planId}/generate-code`),
  delete:         (id)        => del(`/api/test-plans/${id}`),
};

// ── Test Runs ────────────────────────────────────────────────────────────────
export const runsApi = {
  listForProject: (projectId, limit = 20, offset = 0) =>
    get(`/api/test-runs/project/${projectId}?limit=${limit}&offset=${offset}`),
  create:  (data) => post('/api/test-runs', data),
  get:     (id)   => get(`/api/test-runs/${id}`),
  cancel:  (id)   => post(`/api/test-runs/${id}/cancel`),
};

// ── Artifacts ────────────────────────────────────────────────────────────────
export const artifactsApi = {
  listForRun:  (runId) => get(`/api/artifacts/run/${runId}`),
  get:         (id)    => get(`/api/artifacts/${id}`),
  downloadUrl: (id)    => `${BASE_URL}/api/artifacts/${id}/download`,
};

// ── WebSocket ────────────────────────────────────────────────────────────────
export function connectRunSocket(runId, onMessage, onClose) {
  const token = localStorage.getItem('ts_token');
  let wsUrl;
  if (BASE_URL.startsWith('http')) {
    wsUrl = `${BASE_URL.replace(/^http/, 'ws')}/ws/run/${runId}?token=${token || ''}`;
  } else if (typeof window !== 'undefined' && window.location?.host) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${proto}//${window.location.host}${BASE_URL}/ws/run/${runId}?token=${token || ''}`;
  } else {
    wsUrl = `ws://localhost:8000/ws/run/${runId}?token=${token || ''}`;
  }

  let ws;
  try {
    ws = new WebSocket(wsUrl);
  } catch {
    onClose?.();
    return { close: () => {} };
  }

  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch {
      // ignore parse errors
    }
  };

  ws.onclose = () => onClose?.();
  ws.onerror = () => {
    try { ws.close(); } catch {}
  };

  return ws;
}

export { ApiError };
export default { authApi, projectsApi, uploadsApi, plansApi, runsApi, artifactsApi };
