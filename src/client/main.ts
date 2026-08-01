import { api, escapeHtml, getCurrentUser } from './api';
import { btnOutline } from './ui';

export async function renderAuthNav() {
  const nav = document.getElementById('auth-nav');
  if (!nav) return;
  const user = await getCurrentUser();
  if (user) {
    nav.innerHTML = `
      <a class="${btnOutline}" href="/upload.html">Upload video</a>
      <a class="${btnOutline}" href="/index.html">Lịch sử</a>
      <button class="${btnOutline}" id="logout-btn">Đăng xuất (${escapeHtml(user.username)})</button>
    `;
    document.getElementById('logout-btn')!.addEventListener('click', async () => {
      await api.post('/api/logout', {});
      location.reload();
    });
  } else {
    nav.innerHTML = `<a class="${btnOutline}" href="/login.html">Đăng nhập</a>`;
  }
}

renderAuthNav();
