import { Code2, Film, MessageSquare, Search, Sparkles, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "./BrandLogo";
import { HeaderActions } from "./HeaderActions";
import { UploadModal } from "./UploadModal";
import { VideoLibrary } from "./VideoLibrary";
import { useVideoList } from "./useVideoList";
import type { Video } from "./types";

interface HomePageProps {
  user: string | null;
  onLogout: () => void;
  onLogin: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  onOpenVideo: (id: number) => void;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export function HomePage({ user, onLogout, onLogin, search, onSearchChange, onOpenVideo }: HomePageProps) {
  const { videos, deleteVideo } = useVideoList(search, user ?? "");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const featured: Video | null = videos[0] ?? null;
  const thumbUrl = featured?.thumbnail_url
    ? `/api/media?t=${encodeURIComponent(featured.thumbnail_url)}`
    : null;

  return (
    <div className="flex min-h-screen flex-col text-zinc-100">
      <header className="sticky top-0 z-40 flex items-center gap-2 sm:gap-3 border-b border-white/10 bg-zinc-950/80 px-3 sm:px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 shrink-0">
          <BrandLogo className="h-9 w-9 drop-shadow-[0_4px_16px_rgb(45_212_191/0.4)]" />
          <span className="hidden text-base font-bold tracking-tight sm:inline">
            Video<span className="text-brand-gradient">Player</span>
          </span>
        </div>

        <div className="relative min-w-0 flex-1 max-w-xl mx-auto">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Tìm kiếm video…"
            className="h-10 w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-400/60 focus:bg-white/[0.08] focus:outline-none focus:ring-[3px] focus:ring-emerald-400/15 transition-all"
          />
        </div>

        {user && (
          <>
            <Button
              type="button"
              variant="brand"
              size="sm"
              onClick={() => setUploadModalOpen(true)}
              className="h-10 shrink-0 gap-2 rounded-lg px-4"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Tải lên</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => window.open("https://github.com/fhfjjfjd/video-player-bun/issues", "_blank")}
              className="hidden h-10 shrink-0 gap-2 rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white md:inline-flex"
            >
              <MessageSquare className="h-4 w-4" />
              Góp ý
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => window.open("https://github.com/fhfjjfjd/video-player-bun", "_blank")}
          className="hidden h-10 shrink-0 gap-2 rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white md:inline-flex"
        >
          <Code2 className="h-4 w-4" />
          Nguồn
        </Button>
        <HeaderActions user={user} onLogout={onLogout} onLogin={onLogin} />
      </header>

      <main className="flex w-full flex-1 flex-col items-center gap-8 p-3 sm:p-6">
        {featured && !search && (
          <section className="relative w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-2xl">
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpenVideo(featured.id)}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenVideo(featured.id);
                }
              }}
              aria-label={`Phát ${featured.title}`}
              className="relative flex h-56 sm:h-80 cursor-pointer flex-col justify-end overflow-hidden"
            >
              {thumbUrl ? (
                <>
                  <img
                    src={thumbUrl}
                    alt={featured.title}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/55 to-transparent" />
                  <div className="absolute inset-0 bg-brand-gradient-soft opacity-40 mix-blend-screen" />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-500/15 via-zinc-900 to-cyan-500/10">
                  <Film className="h-20 w-20 text-emerald-400/40" />
                </div>
              )}

              <div className="relative flex items-end justify-between gap-4 p-5 sm:p-8">
                <div className="min-w-0">
                  <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 backdrop-blur">
                    <Sparkles className="h-3.5 w-3.5" />
                    Video nổi bật
                  </span>
                  <h1 className="line-clamp-2 text-2xl font-bold tracking-tight drop-shadow-lg sm:text-4xl">
                    {featured.title}
                  </h1>
                  <p className="mt-1.5 text-xs text-zinc-300 sm:text-sm">
                    {formatBytes(featured.size)} · {featured.is_mine ? "Video của bạn" : "Thư viện"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="brand"
                  size="lg"
                  className="hidden shrink-0 rounded-full px-6 sm:inline-flex"
                >
                  Xem ngay
                </Button>
              </div>
            </div>
          </section>
        )}

        {videos.length === 0 ? (
          <div className="flex w-full max-w-md flex-col items-center gap-5 py-16 text-center">
            <div className="relative">
              <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-brand-gradient-soft blur-2xl" />
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-white/10 bg-white/5 shadow-inner">
                <Film className="h-11 w-11 text-emerald-400" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Chưa có video nào</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {user
                  ? "Nhấn 'Tải lên' ở góc trên để bắt đầu thêm video và ảnh thu nhỏ."
                  : "Đăng nhập để tải video lên."}
              </p>
            </div>
            {user && (
              <Button type="button" variant="brand" onClick={() => setUploadModalOpen(true)} className="gap-2 rounded-full px-6">
                <Upload className="h-4 w-4" />
                Tải video đầu tiên
              </Button>
            )}
          </div>
        ) : (
          <VideoLibrary
            videos={videos}
            onPlay={video => onOpenVideo(video.id)}
            onDelete={deleteVideo}
          />
        )}
      </main>

      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploaded={videoId => onOpenVideo(videoId)}
      />
    </div>
  );
}
