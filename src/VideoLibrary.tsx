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
  activeVideoId?: number | null;
  onPlay: (video: Video) => void;
  onDelete: (id: number) => void;
}

export function VideoLibrary({ videos, activeVideoId, onPlay, onDelete }: VideoLibraryProps) {
  if (videos.length === 0) {
    return (
      <div className="w-full rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center text-sm text-zinc-500">
        Chưa có video nào.
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Thư viện video
          <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] tracking-normal text-zinc-300">
            {videos.length}
          </span>
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map(video => {
          const isActive = activeVideoId === video.id;
          const thumbUrl = video.thumbnail_url ? `/api/media?t=${encodeURIComponent(video.thumbnail_url)}` : null;

          return (
            <div
              key={video.id}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border bg-white/[0.03] backdrop-blur transition-all duration-300",
                "hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-white/[0.06] hover:shadow-[0_20px_60px_-20px_rgb(16_185_129/0.35)]",
                isActive
                  ? "border-emerald-400/60 bg-emerald-400/5 ring-2 ring-emerald-400/30"
                  : "border-white/10",
              )}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => onPlay(video)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPlay(video);
                  }
                }}
                aria-label={`Phát ${video.title}`}
                className="relative aspect-video w-full cursor-pointer overflow-hidden bg-zinc-950 focus:outline-none"
              >
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={video.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 text-zinc-600 transition duration-500 group-hover:from-emerald-500/10 group-hover:to-cyan-500/10 group-hover:text-emerald-400/80">
                    <Film className="h-12 w-12" />
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-90" />

                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition duration-300 group-hover:opacity-100">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-zinc-950 shadow-brand transition-transform duration-300 group-hover:scale-110">
                    <Play className="ml-0.5 h-6 w-6 fill-current" />
                  </div>
                </div>

                {isActive && (
                  <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-brand-gradient px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-950 shadow-lg">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zinc-950/70 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-zinc-950" />
                    </span>
                    Đang phát
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <h3
                    title={video.title}
                    className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-100 transition group-hover:text-emerald-300"
                  >
                    {video.title}
                  </h3>
                  <p className="mt-1.5 flex items-center gap-2 text-xs text-zinc-400">
                    <span>{formatBytes(video.size)}</span>
                    <span className="h-0.5 w-0.5 rounded-full bg-zinc-600" />
                    <span>{formatDate(video.created_at)}</span>
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onPlay(video)}
                    className="h-9 gap-1.5 rounded-lg text-xs text-zinc-200 hover:bg-brand-gradient hover:text-zinc-950 hover:shadow-brand"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Xem ngay
                  </Button>

                  {video.is_mine && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(video.id)}
                      aria-label={`Xóa ${video.title}`}
                      className="h-9 w-9 text-zinc-500 hover:bg-red-500/15 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
