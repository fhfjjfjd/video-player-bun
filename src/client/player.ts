import './tailwind.css';
import './antidev';
import { api, escapeHtml, formatDate, getCurrentUser } from './api';
import { renderAuthNav } from './main';
import { comment } from './ui';
import { confirmDialog } from './confirm';

declare const Player: any;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Không thể tải trình phát'));
    document.head.appendChild(el);
  });
}

(async () => {
  const params = new URLSearchParams(location.search);
  const videoId = params.get('id');

  if (!videoId) {
    document.getElementById('player-container')!.innerHTML = '<div class="text-center text-dim py-16 px-5 text-[15px]">Không có ID video</div>';
    return;
  }

  let video: any;
  try {
    video = await api.get('/api/videos/' + videoId);
  } catch (e: any) {
    document.getElementById('player-container')!.innerHTML =
      `<div class="text-center text-dim py-16 px-5 text-[15px]">${escapeHtml(e.message || 'Không thể tải video')}</div>`;
    return;
  }
  document.getElementById('video-title')!.textContent = video.title;
  document.getElementById('video-meta')!.textContent =
    `Đăng bởi ${video.uploader || 'Ẩn danh'} · ${Number(video.views || 0).toLocaleString('vi-VN')} lượt xem · ${formatDate(video.created_at)}`;
  document.getElementById('video-desc')!.textContent = video.description;

  await loadScript('/api/videos/' + videoId + '/player.js');

  const player = new Player({
    id: 'video',
    url: (window as any).__videoUrl,
    fluid: true,
    playsinline: true,
    download: false,
  });

  const user = await getCurrentUser();
  if (user) {
    try {
      const history = await api.get('/api/history');
      const item = history.find((h: any) => h.video_id === video.id);
      if (item && item.progress > 0) {
        const seekTo = () => {
          player.currentTime = item.progress * player.duration;
        };
        if (player.duration && player.duration > 0) {
          seekTo();
        } else {
          player.once('loadedmetadata', seekTo);
        }
      }
    } catch (e) {}
  }

  let lastSaved = 0;
  player.on('timeupdate', () => {
    const now = Date.now();
    if (user && now - lastSaved > 5000) {
      lastSaved = now;
      api.post('/api/history', {
        videoId: video.id,
        progress: player.duration ? player.currentTime / player.duration : 0,
      }).catch(() => {});
    }
  });

  if (user && Number(video.uploader_id) === Number(user.id)) {
    const actionsEl = document.getElementById('video-actions') as HTMLElement;
    actionsEl.innerHTML = `
      <button id="delete-video-btn" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-sm font-semibold cursor-pointer bg-danger/15 border border-danger/40 text-[#ff8a95] transition hover:bg-danger/25">Xóa video</button>
    `;
    actionsEl.querySelector('#delete-video-btn')!.addEventListener('click', async () => {
      if (!(await confirmDialog('Video sẽ bị xóa vĩnh viễn, không thể khôi phục. Bạn có chắc muốn tiếp tục?'))) return;
      try {
        await api.del('/api/videos/' + videoId);
        location.href = '/index.html';
      } catch (e: any) {
        alert(e.message);
      }
    });
  }

  async function renderComments() {
    try {
      const comments = await api.get('/api/videos/' + videoId + '/comments');
      const el = document.getElementById('comments')!;
      el.innerHTML = comments.length
        ? comments.map((c: any) => `
            <div class="${comment}">
              <div class="text-[13px] text-accent font-bold mb-1">${escapeHtml(c.username)}<span class="text-xs text-dim font-normal ml-2">${escapeHtml(c.created_at)}</span></div>
              <div class="text-sm leading-relaxed">${escapeHtml(c.content)}</div>
            </div>
          `).join('')
        : '<div class="text-center text-dim py-5 text-[15px]">Chưa có bình luận nào.</div>';
    } catch (e: any) {
      document.getElementById('comments')!.innerHTML =
        `<div class="text-center text-dim py-5 text-[15px]">${escapeHtml(e.message || 'Không thể tải bình luận')}</div>`;
    }
  }

  document.getElementById('comment-btn')!.addEventListener('click', async () => {
    const currentUser = await getCurrentUser();
    if (!currentUser) return location.href = '/login.html';
    const input = document.getElementById('comment-input') as HTMLInputElement;
    try {
      await api.post('/api/videos/' + videoId + '/comments', { content: input.value });
      input.value = '';
      renderComments();
    } catch (e: any) {
      alert(e.message);
    }
  });

  renderComments();
})();

renderAuthNav();
