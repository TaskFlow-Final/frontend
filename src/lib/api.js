const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

export function getToken() {
  return localStorage.getItem('taskflow_token');
}

export function clearSession() {
  localStorage.removeItem('taskflow_token');
  localStorage.removeItem('taskflow_session');
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401) {
    clearSession();
    window.dispatchEvent(new Event('taskflow:unauthorized'));
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || payload.detail || `Request failed (${response.status})`);
  }
  if (response.status === 204 || !response.headers.get('content-type')?.includes('json')) return null;
  return response.json();
}

export const authApi = {
  login: (credentials) => api('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  me: () => api('/api/auth/me'),
  updateMe: (profile) => api('/api/auth/me', { method: 'PUT', body: JSON.stringify(profile) }),
};

export const boardApi = {
  list: () => api('/api/boards'),
  detail: (id) => api(`/api/boards/${id}`),
  create: (board) => api('/api/boards', { method: 'POST', body: JSON.stringify(board) }),
  update: (id, board) => api(`/api/boards/${id}`, { method: 'PUT', body: JSON.stringify(board) }),
  addColumn: (boardId, column) => api(`/api/boards/${boardId}/columns`, { method: 'POST', body: JSON.stringify(column) }),
  updateColumn: (id, column) => api(`/api/columns/${id}`, { method: 'PUT', body: JSON.stringify(column) }),
  moveColumn: (id, position) => api(`/api/columns/${id}/move`, { method: 'POST', body: JSON.stringify({ position }) }),
  deleteColumn: (id) => api(`/api/columns/${id}`, { method: 'DELETE' }),
  createTask: (boardId, task) => api(`/api/boards/${boardId}/tasks`, { method: 'POST', body: JSON.stringify(task) }),
  moveTask: (id, move) => api(`/api/tasks/${id}/move`, { method: 'POST', body: JSON.stringify(move) }),
  updateTask: (id, task) => api(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(task) }),
  deleteTask: (id) => api(`/api/tasks/${id}`, { method: 'DELETE' }),
  comments: (id) => api(`/api/tasks/${id}/comments`),
  addComment: (id, content) => api(`/api/tasks/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
  mine: () => api('/api/tasks/me'),
  created: () => api('/api/tasks/created'),
  overview: () => api('/api/tasks/overview'),
};

export const userApi = {
  list: () => api('/api/users'),
  create: (user) => api('/api/users', { method: 'POST', body: JSON.stringify(user) }),
  update: (id, user) => api(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(user) }),
};

export const notificationApi = {
  list: () => api('/api/notifications'),
  readAll: () => api('/api/notifications/read-all', { method: 'PATCH' }),
  read: (id) => api(`/api/notifications/${id}/read`, { method: 'PATCH' }),
};

export const meetingApi = {
  list: () => api('/api/meetings'),
  create: (meeting) => api('/api/meetings', { method: 'POST', body: JSON.stringify(meeting) }),
  delete: (id) => api(`/api/meetings/${id}`, { method: 'DELETE' }),
  token: (roomId) => api(`/api/meet/${roomId}/token`),
};

export const chatApi = {
  groups: () => api('/api/chat/groups'),
  createGroup: (group) => api('/api/chat/groups', { method: 'POST', body: JSON.stringify(group) }),
  updateGroup: (id, group) => api(`/api/chat/groups/${id}`, { method: 'PUT', body: JSON.stringify(group) }),
  messages: (groupId) => api(`/api/chat/groups/${groupId}/messages`),
  send: (groupId, message) => api(`/api/chat/groups/${groupId}/messages`, { method: 'POST', body: JSON.stringify(message) }),
  search: (groupId, q) => api(`/api/chat/groups/${groupId}/search?q=${encodeURIComponent(q)}`),
  markRead: (groupId, state) => api(`/api/chat/groups/${groupId}/read`, { method: 'PATCH', body: JSON.stringify(state) }),
};

export async function uploadApi(file, folder = 'taskflow') {
  const form = new FormData();
  form.append('file', file);
  return api(`/api/uploads?folder=${encodeURIComponent(folder)}`, { method: 'POST', body: form });
}

export { API_URL };
