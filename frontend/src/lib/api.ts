const BASE_URL = '/api';

export class ApiError extends Error {
  statusCode: number;
  data: any;

  constructor(message: string, statusCode: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Automatically sends HTTP-only session cookies
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMsg =
      (typeof data === 'object' && data?.message) ||
      (typeof data === 'string' && data) ||
      'An error occurred during request processing';
    throw new ApiError(errorMsg, response.status, data);
  }

  return data;
}

export const api = {
  // Auth
  auth: {
    register: (body: any) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body: any) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    verifyMfa: (body: any) => request('/auth/verify-mfa', { method: 'POST', body: JSON.stringify(body) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    logoutAll: () => request('/auth/logout-all', { method: 'POST' }),
    me: () => request('/auth/me'),
    setupMfa: () => request('/auth/mfa/setup', { method: 'POST' }),
    enableMfa: (body: any) => request('/auth/mfa/enable', { method: 'POST', body: JSON.stringify(body) }),
    disableMfa: (body: any) => request('/auth/mfa/disable', { method: 'POST', body: JSON.stringify(body) }),
    getSessions: () => request('/auth/sessions'),
    revokeSession: (sessionId: string) => request(`/auth/sessions/${sessionId}`, { method: 'DELETE' }),
    forgotPassword: (body: any) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify(body) }),
    resetPassword: (body: any) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),
  },

  // Files
  files: {
    list: (params: Record<string, any> = {}) => {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
      }
      return request(`/files?${q.toString()}`);
    },
    get: (id: string) => request(`/files/${id}`),
    upload: (formData: FormData) => request('/files/upload', { method: 'POST', body: formData }),
    update: (id: string, body: any) => request(`/files/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request(`/files/${id}`, { method: 'DELETE' }),
    restore: (id: string) => request(`/files/${id}/restore`, { method: 'POST' }),
    listTrash: () => request('/files/trash/list'),
    emptyTrash: () => request('/files/trash/empty', { method: 'DELETE' }),
    getSignedUrl: (id: string, expiresIn = 300) => request(`/files/${id}/signed-url?expiresIn=${expiresIn}`),
    getDownloadUrl: (id: string, inline = false) => `${BASE_URL}/files/${id}/download?inline=${inline}`,
  },

  // Folders
  folders: {
    list: (parentId?: string | null) => {
      const q = parentId !== undefined ? `?parentId=${parentId || 'root'}` : '';
      return request(`/folders${q}`);
    },
    create: (body: any) => request('/folders', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => request(`/folders/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request(`/folders/${id}`, { method: 'DELETE' }),
  },

  // Shares
  shares: {
    create: (body: any) => request('/shares', { method: 'POST', body: JSON.stringify(body) }),
    myShares: () => request('/shares/my-shares'),
    sharedWithMe: () => request('/shares/shared-with-me'),
    revoke: (id: string) => request(`/shares/${id}/revoke`, { method: 'PATCH' }),
    delete: (id: string) => request(`/shares/${id}`, { method: 'DELETE' }),
    getPublic: (token: string) => request(`/shares/public/${token}`),
    verifyPassword: (token: string, password: string) =>
      request(`/shares/public/${token}/verify-password`, { method: 'POST', body: JSON.stringify({ password }) }),
    getPublicDownloadUrl: (token: string, accessToken?: string, inline = false) => {
      const q = new URLSearchParams();
      if (accessToken) q.append('accessToken', accessToken);
      if (inline) q.append('inline', 'true');
      const queryString = q.toString() ? `?${q.toString()}` : '';
      return `${BASE_URL}/shares/public/${token}/download${queryString}`;
    },
  },

  // Personal Audit Logs
  audit: {
    list: (params: Record<string, any> = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/audit-logs${q ? `?${q}` : ''}`);
    },
  },

  // Admin
  admin: {
    stats: () => request('/admin/stats'),
    users: (params: Record<string, any> = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/admin/users${q ? `?${q}` : ''}`);
    },
    updateRole: (userId: string, role: string) =>
      request(`/admin/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    updateQuota: (userId: string, storageLimit: number) =>
      request(`/admin/users/${userId}/quota`, { method: 'PATCH', body: JSON.stringify({ storageLimit }) }),
    auditLogs: (params: Record<string, any> = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/admin/audit-logs${q ? `?${q}` : ''}`);
    },
    quarantined: () => request('/admin/quarantined'),
    quarantineAction: (fileId: string, decision: 'RELEASE' | 'PURGE') =>
      request(`/admin/quarantined/${fileId}/action`, { method: 'POST', body: JSON.stringify({ decision }) }),
  },
};
