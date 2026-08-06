import { ArrowLeft, Loader2, MonitorPlay } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 flex items-center gap-2 sm:gap-3 border-b border-white/10 bg-zinc-900/90 px-3 sm:px-6 py-3 backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Quay lại"
          className="h-10 w-10 shrink-0 text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex min-w-0 items-center gap-2 flex-1">
          <MonitorPlay className="h-6 w-6 shrink-0 text-emerald-400" />
          <span className="truncate text-sm font-semibold tracking-tight sm:text-lg">{video?.title ?? "Đang tải video…"}</span>
        </div>
        <HeaderActions user={user} onLogout={onLogout} onLogin={onLogin} />
      </header>

      <main className="flex w-full flex-1 flex-col items-center gap-6 p-3 sm:p-6">
        {notFound ? (
          <div className="flex w-full max-w-md flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
              <Loader2 className="h-10 w-10 animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Video không tồn tại</h2>
              <p className="mt-1 text-sm text-zinc-400">Video này đã bị xóa hoặc liên kết không đúng.</p>
            </div>
            <Button type="button" variant="secondary" onClick={onBack} className="h-10 bg-white/10 text-white hover:bg-white/2">
              Về trang chủ
            </Button>
          </div>
        ) : video ? (
          <>
            <VideoPlayer src={`/api/media?t=${encodeURIComponent(video.url)}`} />
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
