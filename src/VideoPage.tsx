import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "./BrandLogo";
import { HeaderActions } from "./HeaderActions";
import { VideoLibrary } from "./VideoLibrary";
import { VideoPlayer } from "./VideoPlayer";
import { useVideoList } from "./useVideoList";
import type { Video } from "./types";

interface VideoPageProps {
  videoId: number;
  user: string | null;
  onLogout: () => void;
  onLogin: () => void;
  search: string;
  onOpenVideo: (id: number) => void;
  onBack: () => void;
}

export function VideoPage({ videoId, user, onLogout, onLogin, search, onOpenVideo, onBack }: VideoPageProps) {
  const [video, setVideo] = useState<Video | null>(null);
  const [notFound, setNotFound] = useState(false);
  const { videos, deleteVideo } = useVideoList(search, user ?? "");

  useEffect(() => {
    let cancelled = false;
    setVideo(null);
    setNotFound(false);
    fetch(`/api/videos/${videoId}`)
      .then(async response => {
        if (cancelled) return;
        if (!response.ok) {
          setNotFound(true);
          return;
        }
        const data = (await response.json()) as { video: Video };
        setVideo(data.video);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const handleDelete = async (id: number) => {
    if (id === videoId) onBack();
    await deleteVideo(id);
  };

  const thumbUrl = video?.thumbnail_url ? `/api/media?t=${encodeURIComponent(video.thumbnail_url)}` : null;

  return (
    <div className="flex min-h-screen flex-col text-zinc-100">
      <header className="sticky top-0 z-40 flex items-center gap-2 sm:gap-3 border-b border-white/10 bg-zinc-950/80 px-3 sm:px-6 py-3 backdrop-blur-xl">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Quay lại"
          className="h-10 w-10 shrink-0 rounded-full text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex min-w-0 items-center gap-2.5 flex-1">
          <BrandLogo className="h-8 w-8 shrink-0" />
          <span className="truncate text-sm font-bold tracking-tight sm:text-lg">
            {video?.title ?? "Đang tải video…"}
          </span>
        </div>
        <HeaderActions user={user} onLogout={onLogout} onLogin={onLogin} />
      </header>

      <main className="flex w-full flex-1 flex-col items-center gap-8 p-3 sm:p-6">
        {notFound ? (
          <div className="flex w-full max-w-md flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-red-500/20 bg-red-500/10 text-red-400">
              <Loader2 className="h-10 w-10 animate-spin" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Video không tồn tại</h2>
              <p className="mt-1 text-sm text-zinc-400">Video này đã bị xóa hoặc liên kết không đúng.</p>
            </div>
            <Button type="button" variant="brand" onClick={onBack} className="rounded-full px-6">
              Về trang chủ
            </Button>
          </div>
        ) : video ? (
          <>
            <div className="relative w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-[0_30px_80px_-30px_rgb(16_185_129/0.25)]">
              {thumbUrl && (
                <div className="pointer-events-none absolute inset-0 z-0 scale-110 opacity-30 blur-3xl">
                  <img src={thumbUrl} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                </div>
              )}
              <div className="relative z-10 p-2 sm:p-3">
                <VideoPlayer src={`/api/media?t=${encodeURIComponent(video.url)}`} />
              </div>
            </div>
            <div className="w-full max-w-6xl px-1">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{video.title}</h1>
            </div>
            <VideoLibrary
              videos={videos}
              activeVideoId={video.id}
              onPlay={next => onOpenVideo(next.id)}
              onDelete={handleDelete}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
          </div>
        )}
      </main>
    </div>
  );
}
