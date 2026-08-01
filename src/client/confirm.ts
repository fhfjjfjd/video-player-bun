import { escapeHtml } from './api';
import { btnOutline } from './ui';

export function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/70 backdrop-blur-sm';
    overlay.innerHTML = `
      <div class="w-full max-w-[360px] bg-surface border border-line rounded-[16px] p-5 shadow-card">
        <h3 class="text-base font-bold mb-2">Xóa video</h3>
        <p class="text-sm text-dim leading-relaxed mb-5">${escapeHtml(message)}</p>
        <div class="flex gap-2.5 justify-end">
          <button data-action="cancel" class="${btnOutline}">Hủy</button>
          <button data-action="confirm" class="inline-flex items-center justify-center px-4 py-2.5 rounded-[10px] text-sm font-semibold cursor-pointer no-underline bg-danger text-white transition hover:opacity-90">Xóa</button>
        </div>
      </div>
    `;
    const close = (result: boolean) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });
    overlay.querySelector('[data-action="cancel"]')!.addEventListener('click', () => close(false));
    overlay.querySelector('[data-action="confirm"]')!.addEventListener('click', () => close(true));
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  });
}
