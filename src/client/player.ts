import Hls from 'hls.js';
import './tailwind.css';
import './antidev';
import { api, escapeHtml, formatDate, getCurrentUser } from './api';
import { renderAuthNav } from './main';
import { comment, btnOutline } from './ui';
import { confirmDialog } from './confirm';

declare global {
  interface Window {
    __videoUrl?: string;
  }
}

let playerVideo: HTMLVideoElement | null = null;
let hls: Hls | null = null;
let currentVideo: any = null;
let shareToken: string | undefined;
let pollTimer: number | null = null;
let isHlsMode = false;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Không thể tải trình phát'));
    document.head.appendChild(el);
  });
}

function destroyHls() {
  if (hls) {
    hls.destroy();
    hls = null;
  }
}

function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(
      () => alert('Đã sao chép link chia sẻ'),
      () => prompt('Sao chép link chia sẻ:', text),
    );
  } else {
    prompt('Sao chép link chia sẻ:', text);
  }
}

function qualityLabel(level: any) {
  if (!level || !level.height) return '';
  const p = level.height;
  return p >= 2160 ? '4K' : p >= 1440 ? '2K' : p >= 1080 ? '1080p' : p + 'p';
}

function renderQualityBar() {
  if (!hls) return;
  const bar = document.getElementById('quality-bar') as HTMLElement;
  bar.classList.remove('hidden');
  bar.classList.add('flex');
  const autoBtn = document.createElement('button');
  autoBtn.className = `${btnOutline} px-3 py-1.5 text-xs`;
  autoBtn.textContent = 'Tự động';
  autoBtn.addEventListener('click', () => {
    if (hls) hls.currentLevel = -1;
    bar.querySelectorAll('button').forEach(b => b.classList.remove('border-accent/50', 'text-accent', 'bg-accent/10'));
    autoBtn.classList.add('border-accent/50', 'text-accent', 'bg-accent/10');
  });
  bar.appendChild(autoBtn);
  autoBtn.classList.add('border-accent/50', 'text-accent', 'bg-accent/10');
  hls.levels.forEach((level, index) => {
    const label = qualityLabel(level);
    if (!label) return;
    const btnEl = document.createElement('button');
    btnEl.className = `${btnOutline} px-3 py-1.5 text-xs`;
    btnEl.textContent = label;
    btnEl.addEventListener('click', () => {
      if (hls) hls.currentLevel = index;
      bar.querySelectorAll('button').forEach(b => b.classList.remove('border-accent/50', 'text-accent', 'bg-accent/10'));
      btnEl.classList.add('border-accent/50', 'text-accent', 'bg-accent/10');
    });
    bar.appendChild(btnEl);
  });
}

function setupHls(url: string) {
  if (!playerVideo) return;
  const bar = document.getElementById('quality-bar') as HTMLElement;
  bar.classList.add('hidden');
  bar.classList.remove('flex');
  bar.innerHTML = '';
  isHlsMode = true;
  destroyHls();
  if (Hls.isSupported()) {
    hls = new Hls({ enableWorker: true, maxBufferLength: 30 });
    hls.loadSource(url);
    hls.attachMedia(playerVideo);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      renderQualityBar();
      playerVideo!.play().catch(() => {});
    });
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        hls!.startLoad();
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls!.recoverMediaError();
      } else if (window.__videoUrl) {
        destroyHls();
        setupNative(window.__videoUrl);
      }
    });
  } else if (playerVideo.canPlayType('application/vnd.apple.mpegurl')) {
    playerVideo.src = url;
    playerVideo.play().catch(() => {});
  } else if (window.__videoUrl) {
    setupNative(window.__videoUrl);
  }
}

function setupNative(url: string) {
  if (!playerVideo) return;
  destroyHls();
  isHlsMode = false;
  playerVideo.src = url;
  playerVideo.play().catch(() => {});
}

function showSwitchToHlsButton() {
  const bar = document.getElementById('quality-bar') as HTMLElement;
  if (!currentVideo || currentVideo.transcode_status !== 'ready' || isHlsMode) return;
  const switchBtn = document.createElement('button');
  switchBtn.className = `${btnOutline} px-3 py-1.5 text-xs`;
  switchBtn.textContent = 'Chuyển sang bản HLS (mượt hơn)';
  switchBtn.addEventListener('click', () => {
    if (!playerVideo) return;
    const keep = playerVideo.currentTime;
    const hlsUrl = `/api/videos/${currentVideo.id}/hls/${currentVideo.hls_master}`;
    setupHls(hlsUrl);
    playerVideo.addEventListener('loadedmetadata', () => {
      if (keep > 0 && keep < playerVideo!.duration) playerVideo!.currentTime = keep;
    }, { once: true });
  });
  bar.classList.remove('hidden');
  bar.classList.add('flex');
  bar.appendChild(switchBtn);
}

function renderSubtitleControls() {
  if (!currentVideo) return;
  playerVideo?.querySelectorAll('track').forEach(t => t.remove());
  const section = document.getElementById('subtitle-section') as HTMLElement;
  section.innerHTML = `
    <div class="flex flex-col gap-2.5">
      <h3 class="text-base font-bold">Phụ đề</h3>
      <div class="flex gap-2.5 flex-wrap" id="subtitle-list"></div>
      <div class="flex gap-2.5 items-center" id="subtitle-uploader"></div>
    </div>
  `;
  const list = document.getElementById('subtitle-list') as HTMLElement;
  api.get('/api/videos/' + currentVideo.id + '/subtitles').then((subs: any[]) => {
    if (!subs.length) {
      list.innerHTML = '<span class="text-[13px] text-dim">Chưa có phụ đề.</span>';
      return;
    }
    subs.forEach(sub => {
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = sub.label || sub.original_name;
      track.srclang = sub.language || 'vi';
      track.src = `/api/videos/${currentVideo.id}/subtitles/${sub.id}/file`;
      playerVideo?.appendChild(track);
      const btnEl = document.createElement('button');
      btnEl.className = `${btnOutline} px-3 py-1.5 text-xs`;
      btnEl.textContent = (sub.label || sub.original_name).slice(0, 24);
      btnEl.addEventListener('click', () => {
        for (let i = 0; i < (playerVideo?.textTracks.length || 0); i++) {
          const t = playerVideo!.textTracks[i];
          if (t.kind === 'subtitles') t.mode = t === track.track ? 'showing' : 'disabled';
        }
        list.querySelectorAll('button').forEach(b => b.classList.remove('border-accent/50', 'text-accent', 'bg-accent/10'));
        btnEl.classList.add('border-accent/50', 'text-accent', 'bg-accent/10');
      });
      list.appendChild(btnEl);
    });
  }).catch(() => {});

  const uploader = document.getElementById('subtitle-uploader') as HTMLElement;
  uploader.innerHTML = `
    <input type="file" id="subtitle-file" accept=".srt,.vtt" class="flex-1 text-[13px] text-dim">
    <input type="text" id="subtitle-label" placeholder="Tên phụ đề (tùy chọn)" class="flex-1 min-w-[120px] px-3 py-2 bg-canvas-soft border border-line rounded-[10px] text-ink text-sm">
    <button id="subtitle-upload-btn" class="${btnOutline} px-3 py-2 text-xs">Thêm phụ đề</button>
  `;
  uploader.querySelector('#subtitle-upload-btn')!.addEventListener('click', async () => {
    const fileInput = uploader.querySelector('#subtitle-file') as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return alert('Vui lòng chọn file .srt hoặc .vtt');
    const form = new FormData();
    form.append('subtitle', file);
    const labelInput = uploader.querySelector('#subtitle-label') as HTMLInputElement;
    if (labelInput.value.trim()) form.append('label', labelInput.value.trim());
    try {
      await fetch(`/api/videos/${currentVideo.id}/subtitles`, { method: 'POST', body: form, credentials: 'same-origin' });
      renderSubtitleControls();
    } catch (e: any) {
      alert(e.message || 'Upload phụ đề thất bại');
    }
  });
}

function renderActions() {
  if (!currentVideo) return;
  const actionsEl = document.getElementById('video-actions') as HTMLElement;
  getCurrentUser().then(user => {
    const isOwner = user && Number(currentVideo.uploader_id) === Number(user.id);
    const buttons: string[] = [
      `<button id="share-btn" class="${btnOutline}">Chia sẻ</button>`,
    ];
    if (isOwner) {
      buttons.push(
        `<button id="visibility-btn" class="${btnOutline}">${currentVideo.visibility === 'private' ? 'Đang riêng tư' : 'Đang công khai'}</button>`,
        `<button id="delete-video-btn" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] text-sm font-semibold cursor-pointer bg-danger/15 border border-danger/40 text-[#ff8a95] transition hover:bg-danger/25">Xóa video</button>`,
      );
    }
    actionsEl.innerHTML = `<div class="flex gap-2.5 flex-wrap">${buttons.join('')}</div>`;

    actionsEl.querySelector('#share-btn')!.addEventListener('click', async () => {
      if (isOwner) {
        try {
          const res = await api.post(`/api/videos/${currentVideo.id}/share`, {});
          copyText(location.origin + res.url);
        } catch (e: any) {
          alert(e.message);
        }
      } else {
        copyText(location.href.split('&t=')[0]);
      }
    });

    const visibilityBtn = actionsEl.querySelector('#visibility-btn') as HTMLButtonElement | null;
    if (visibilityBtn) {
      visibilityBtn.addEventListener('click', async () => {
        const next = currentVideo.visibility === 'private' ? 'public' : 'private';
        try {
          await api.post(`/api/videos/${currentVideo.id}/visibility`, { visibility: next });
          currentVideo.visibility = next;
          visibilityBtn.textContent = next === 'private' ? 'Đang riêng tư' : 'Đang công khai';
        } catch (e: any) {
          alert(e.message);
        }
      });
    }

    actionsEl.querySelector('#delete-video-btn')?.addEventListener('click', async () => {
      if (!(await confirmDialog('Video sẽ bị xóa vĩnh viễn, không thể khôi phục. Bạn có chắc muốn tiếp tục?'))) return;
      try {
        await api.del('/api/videos/' + currentVideo.id);
        location.href = '/index.html';
      } catch (e: any) {
        alert(e.message);
      }
    });

    const subtitleSection = document.getElementById('subtitle-section') as HTMLElement;
    subtitleSection.classList.toggle('hidden', !isOwner);
    if (isOwner) renderSubtitleControls();
  });
}

async function renderComments() {
  try {
    const comments = await api.get('/api/videos/' + currentVideo!.id + '/comments');
    const el = document.getElementById('comments')!;
    el.innerHTML = comments.length
      ? comments.map((c: any) => `
          <div class="${comment}">
            <div class="text-[13px] text-accent font-bold mb-1">${escapeHtml(c.username)}<span class="text-xs text-dim font-normal ml-2">${escapeHtml(formatDate(c.created_at))}</span></div>
            <div class="text-sm leading-relaxed">${escapeHtml(c.content)}</div>
          </div>
        `).join('')
      : '<div class="text-center text-dim py-5 text-[15px]">Chưa có bình luận nào.</div>';
  } catch (e: any) {
    document.getElementById('comments')!.innerHTML =
      `<div class="text-center text-dim py-5 text-[15px]">${escapeHtml(e.message || 'Không thể tải bình luận')}</div>`;
  }
}

(async () => {
  const params = new URLSearchParams(location.search);
  const videoId = params.get('id');
  shareToken = params.get('t') || undefined;

  if (!videoId) {
    document.getElementById('player-container')!.innerHTML = '<div class="text-center text-dim py-16 px-5 text-[15px]">Không có ID video</div>';
    return;
  }

  let video: any;
  try {
    video = await api.get('/api/videos/' + videoId + (shareToken ? '?t=' + encodeURIComponent(shareToken) : ''));
  } catch (e: any) {
    document.getElementById('player-container')!.innerHTML =
      `<div class="text-center text-dim py-16 px-5 text-[15px]">${escapeHtml(e.message || 'Không thể tải video')}</div>`;
    return;
  }
  currentVideo = video;
  document.getElementById('video-title')!.textContent = video.title;
  document.getElementById('video-meta')!.textContent =
    `Đăng bởi ${video.uploader || 'Ẩn danh'} · ${Number(video.views || 0).toLocaleString('vi-VN')} lượt xem · ${formatDate(video.created_at)}`;
  document.getElementById('video-desc')!.textContent = video.description;
  api.post('/api/videos/' + video.id + '/view', {}).catch(() => {});

  playerVideo = document.getElementById('player-video') as HTMLVideoElement;
  const status = video.transcode_status;

  await loadScript('/api/videos/' + videoId + '/player.js').catch(() => {});

  if (status === 'ready' && video.hls_master) {
    setupHls(`/api/videos/${video.id}/hls/${video.hls_master}`);
  } else {
    setupNative(window.__videoUrl || `/api/videos/${video.id}/stream`);
  }

  const user = await getCurrentUser();
  if (user) {
    try {
      const history = await api.get('/api/history');
      const item = history.find((h: any) => h.video_id === video.id);
      if (item && item.progress > 0) {
        const seekTo = () => {
          if (playerVideo && playerVideo.duration) playerVideo.currentTime = item.progress * playerVideo.duration;
        };
        if (playerVideo && playerVideo.readyState >= 1) seekTo();
        else playerVideo?.addEventListener('loadedmetadata', seekTo, { once: true });
      }
    } catch (e) {}
  }

  let lastSaved = 0;
  playerVideo.addEventListener('timeupdate', () => {
    const now = Date.now();
    if (user && now - lastSaved > 5000 && playerVideo && playerVideo.duration) {
      lastSaved = now;
      api.post('/api/history', {
        videoId: video.id,
        progress: playerVideo.currentTime / playerVideo.duration,
      }).catch(() => {});
    }
  });

  if (status === 'pending' || status === 'processing') {
    const poll = () => {
      pollTimer = window.setTimeout(async () => {
        try {
          const fresh = await api.get('/api/videos/' + video.id + (shareToken ? '?t=' + encodeURIComponent(shareToken) : ''));
          if (fresh.transcode_status === 'ready' && fresh.hls_master) {
            currentVideo = fresh;
            showSwitchToHlsButton();
            return;
          }
          if (fresh.transcode_status === 'failed') return;
          poll();
        } catch (e) {
          poll();
        }
      }, 8000);
    };
    poll();
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

  renderActions();
  renderComments();
})();

renderAuthNav();
