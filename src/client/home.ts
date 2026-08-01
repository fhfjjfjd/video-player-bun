import './tailwind.css';
import './antidev';
import { api, escapeHtml, getCurrentUser } from './api';
import { renderAuthNav } from './main';
import { card, thumb, info } from './ui';

const grid = document.getElementById('video-grid') as HTMLElement;
const emptyMsg = document.getElementById('empty-msg') as HTMLElement;

(async () => {
  try {
    const [videos, user] = await Promise.all([api.get('/api/videos'), getCurrentUser()]);
    emptyMsg.classList.toggle('hidden', videos.length > 0);
    grid.innerHTML = videos.map((v: any) => `
      <div class="relative">
        <a href="/player.html?id=${v.id}" class="${card}">
          <div class="${thumb}">▶ <span class="text-[13px] text-dim">${escapeHtml(v.original_name)}</span></div>
          <div class="${info}">
            <h3 class="text-[15px] mb-1.5 truncate">${escapeHtml(v.title)}</h3>
            <p class="text-[13px] text-dim leading-relaxed line-clamp-2">${escapeHtml(v.uploader || 'Ẩn danh')} · ${Number(v.views || 0).toLocaleString('vi-VN')} lượt xem · ${escapeHtml((v.description || '').slice(0, 60))}</p>
          </div>
        </a>
        ${user && Number(v.uploader_id) === Number(user.id) ? `
          <button class="absolute top-2 right-2 z-10 px-2.5 py-1.5 rounded-[8px] text-xs font-semibold text-white bg-danger/90 hover:bg-danger cursor-pointer" data-video-id="${v.id}">Xóa</button>
        ` : ''}
      </div>
    `).join('');
    grid.querySelectorAll('button[data-video-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const item = (btn as HTMLElement).closest('.relative') as HTMLElement;
        if (!confirm('Bạn có chắc muốn xóa video này?')) return;
        try {
          await api.del('/api/videos/' + (btn as HTMLElement).dataset.videoId);
          item.remove();
          if (!grid.querySelector('a[href^="/player.html"]')) emptyMsg.classList.toggle('hidden', false);
        } catch (err: any) {
          alert(err.message);
        }
      });
    });
  } catch (e: any) {
    emptyMsg.classList.toggle('hidden', false);
    emptyMsg.textContent = 'Không thể tải danh sách video: ' + (e.message || 'lỗi mạng');
  }
})();

(async () => {
  try {
    const user = await getCurrentUser();
    if (!user) return;
    const history = await api.get('/api/history');
    if (!history.length) return;
    const section = document.getElementById('history-section') as HTMLElement;
    section.classList.remove('hidden');
    document.getElementById('history-grid')!.innerHTML = history.map((h: any) => `
      <a href="/player.html?id=${h.video_id}" class="${card}">
        <div class="${thumb}">▶ <span class="text-[13px] text-dim">${escapeHtml(h.original_name)}</span></div>
        <div class="${info}">
          <h3 class="text-[15px] mb-1.5 truncate">${escapeHtml(h.title)}</h3>
          <p class="text-[13px] text-dim leading-relaxed line-clamp-2">Đã xem ${Math.floor((h.progress || 0) * 100)}% · ${escapeHtml(h.watched_at)}</p>
        </div>
      </a>
    `).join('');
  } catch (e) {}
})();

renderAuthNav();
