import { Archive, ArrowUpRight, X } from "lucide-react";
import { useState } from "react";

const NEW_PROJECT_URL = "https://github.com/fhfjjfjd/video-player-php";
const DISMISS_KEY = "videoplayer-migrate-dismissed";

export function MigrationBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore storage errors */
    }
    setDismissed(true);
  };

  return (
    <div className="relative z-50 border-b border-amber-400/20 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 px-3 py-2.5 sm:px-6 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5 text-zinc-100">
          <Archive className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
          <p className="truncate text-xs leading-snug sm:text-sm">
            Phiên bản này đã <span className="font-semibold text-amber-200">ngừng phát triển</span> và
            chuyển sang lưu trữ. Hãy dùng phiên bản mới{" "}
            <a
              href={NEW_PROJECT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-amber-300 underline decoration-amber-300/40 underline-offset-2 hover:text-amber-200"
            >
              video-player-php
            </a>
            .
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={NEW_PROJECT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/20 sm:inline-flex"
          >
            Chuyển sang phiên bản mới
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Đóng thông báo"
            className="rounded-full p-1 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
