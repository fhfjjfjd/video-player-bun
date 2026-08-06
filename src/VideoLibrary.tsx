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
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Thư viện video ({videos.length})
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
                "group relative flex flex-col overflow-hidden rounded-2xl border bg-zinc-900/80 transition duration-300 hover:border-emerald-500/50 hover:shadow-xl",
                isActive ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/30" : "border-white/10",
              )}
            >
              {/* Thumbnail Container */}
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
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 text-zinc-600 transition group-hover:text-emerald-400/70">
                    <Film className="h-12 w-12" />
                  </div>
                )}

                {/* Overlay Play Button on Hover / Mobile */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition duration-300 group-hover:opacity-100">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-zinc-950 shadow-lg transition transform group-hover:scale-110">
                    <Play className="ml-0.5 h-6 w-6 fill-current" />
                  </div>
                </div>

                {isActive && (
                  <span className="absolute top-2.5 left-2.5 rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-950 shadow">
                    Đang phát
                  </span>
                )}
              </div>

              {/* Details & Actions */}
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
                    <span>·</span>
                    <span>{formatDate(video.created_at)}</span>
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onPlay(video)}
                    className="h-9 gap-1.5 bg-white/10 text-xs text-white hover:bg-emerald-500 hover:text-zinc-950"
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
                      className="h-9 w-9 text-zinc-400 hover:bg-red-500/15 hover:text-red-400"
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
