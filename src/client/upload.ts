import './tailwind.css';
import './antidev';
import { api, getCurrentUser } from './api';
import { renderAuthNav } from './main';
import { msgError, msgSuccess } from './ui';

(async () => {
  const user = await getCurrentUser();
  if (!user) {
    location.href = '/login.html';
    return;
  }

  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const dropZone = document.getElementById('file-drop') as HTMLElement | null;
  const fileInfo = document.getElementById('file-info')!;
  const message = document.getElementById('message')!;
  const progressWrap = document.getElementById('progress-wrap')!;
  const progressBar = document.getElementById('progress-bar') as HTMLElement;
  const uploadBtn = document.getElementById('upload-btn') as HTMLButtonElement;

  let selectedFile: File | null = null;

  function showMessage(type: 'error' | 'success', text: string) {
    message.className = type === 'error' ? msgError : msgSuccess;
    message.textContent = text;
  }

  function setDropActive(active: boolean) {
    if (dropZone) dropZone.dataset.active = String(active);
  }

  function selectFile(file: File | undefined) {
    if (!file) return;
    const okType = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|ogv|m4v|3gp)$/i.test(file.name || '');
    if (!okType) return showMessage('error', 'Chỉ chấp nhận file video');
    selectedFile = file;
    fileInfo.textContent = `${file.name || 'video'} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
    if (!(document.getElementById('title') as HTMLInputElement).value) {
      (document.getElementById('title') as HTMLInputElement).value = (file.name || '').replace(/\.[^.]+$/, '');
    }
    showMessage('success', 'Đã chọn file, sẵn sàng upload');
  }

  fileInput.addEventListener('change', () => {
    if (fileInput.files!.length) selectFile(fileInput.files![0]);
  });

  if (dropZone && window.matchMedia('(hover: hover)').matches) {
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      setDropActive(true);
    });
    dropZone.addEventListener('dragleave', () => setDropActive(false));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      setDropActive(false);
      if (e.dataTransfer!.files.length) selectFile(e.dataTransfer!.files[0]);
    });
  }

  uploadBtn.addEventListener('click', () => {
    if (!selectedFile) {
      fileInput.click();
      return showMessage('error', 'Vui lòng chọn file video');
    }
    const form = new FormData();
    form.append('video', selectedFile);
    form.append('title', (document.getElementById('title') as HTMLInputElement).value);
    form.append('description', (document.getElementById('description') as HTMLTextAreaElement).value);

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Đang upload...';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/videos');
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        progressWrap.classList.remove('hidden');
        progressBar.style.width = (e.loaded / e.total * 100) + '%';
      }
    });
    xhr.onload = () => {
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Upload';
      let data: any = {};
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch (e) {}
      if (xhr.status >= 200 && xhr.status < 300) {
        showMessage('success', 'Upload thành công! Đang chuyển hướng...');
        setTimeout(() => location.href = '/player.html?id=' + data.id, 1200);
      } else {
        showMessage('error', data.error || 'Upload thất bại');
      }
    };
    xhr.onerror = () => {
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Upload';
      showMessage('error', 'Lỗi kết nối khi upload');
    };
    xhr.send(form);
  });

  renderAuthNav();
})();
