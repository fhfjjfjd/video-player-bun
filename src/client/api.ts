export const api = {
  async request(path: string, options: RequestInit = {}): Promise<any> {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra');
    return data;
  },
  get(path: string) {
    return this.request(path);
  },
  post(path: string, body: unknown) {
    return this.request(path, { method: 'POST', body: JSON.stringify(body) });
  },
  del(path: string) {
    return this.request(path, { method: 'DELETE' });
  },
};

export async function getCurrentUser() {
  try {
    return await api.get('/api/me');
  } catch (e) {
    return null;
  }
}

export function escapeHtml(text: unknown) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

export function formatDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value || '');
  if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
  const dt = new Date(value);
  if (!isNaN(dt.getTime())) return dt.toLocaleString('vi-VN');
  return value;
}
