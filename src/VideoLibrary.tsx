import { Film, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Video } from "./types";

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("vi-VN");
};

interface VideoLibraryProps {
  videos: Video[];
  activeUrl?: string | null;
  onPlay: (video: Video) => void;
  onDelete: (id: number) => void;
}

export function VideoLibrary({ videos, activeUrl, onPlay, onDelete }: VideoLibraryProps) {
  if (videos.length === 0) {
    return (
      <div className="w-full rounded-xl border border-dashed border-white/15 px-6 py-8 text-center text-sm text-zinc-500">
        Chưa có video nào.
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Video ({videos.length})
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map(video => {
          const isActive = activeUrl === new URL(video.url, window.location.origin).href;
          return (
            <li
              key={video.id}
              className={cn(
                "group flex items-center gap-3 rounded-xl border bg-white/5 p-3 transition",
                isActive ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/10 hover:border-white/25",
              )}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10 text-zinc-300">
                <Film className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100" title={video.title}>
                  {video.title}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatBytes(video.size)} · {formatDate(video.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => onPlay(video)}
                  aria-label={`Phát ${video.title}`}
                  className={cn(
                    "h-8 w-8 text-white hover:bg-white/10 hover:text-white",
                    isActive && "text-emerald-300",
                  )}
                >
                  <Play className="h-4 w-4 fill-current" />
                </Button>
                {video.is_mine && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => onDelete(video.id)}
                    aria-label={`Xóa ${video.title}`}
                    className="h-8 w-8 text-zinc-400 hover:bg-red-500/15 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
