import { Film, MessageSquare, MonitorPlay, Search, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FeedbackDialog } from "./FeedbackDialog";
import { HeaderActions } from "./HeaderActions";
import { UploadModal } from "./UploadModal";
import { VideoLibrary } from "./VideoLibrary";
import { useVideoList } from "./useVideoList";

interface HomePageProps {
  user: string | null;
  onLogout: () => void;
  onLogin: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  onOpenVideo: (id: number) => void;
}

export function HomePage({ user, onLogout, onLogin, search, onSearchChange, onOpenVideo }: HomePageProps) {
  const { videos, deleteVideo } = useVideoList(search, user ?? "");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 flex items-center gap-2 sm:gap-3 border-b border-white/10 bg-zinc-900/90 px-3 sm:px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-2 shrink-0">
          <MonitorPlay className="h-6 w-6 text-emerald-400" />
          <span className="hidden font-semibold tracking-tight sm:inline">Video Player</span>
        </div>

        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Tìm kiếm video…"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none"
          />
        </div>

        {user && (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setUploadModalOpen(true)}
              className="h-10 shrink-0 gap-2 bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Tải lên</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setFeedbackOpen(true)}
              className="h-10 shrink-0 gap-2 text-white hover:bg-white/10"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Góp ý</span>
            </Button>
          </>
        )}
        <HeaderActions user={user} onLogout={onLogout} onLogin={onLogin} />
      </header>

      <main className="flex w-full flex-1 flex-col items-center gap-6 p-3 sm:p-6">
        {videos.length === 0 ? (
          <div className="flex w-full max-w-md flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5 text-zinc-400">
              <Film className="h-10 w-10 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Chưa có video nào</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {user ? "Nhấn 'Tải lên' ở góc trên để bắt đầu thêm video và ảnh thu nhỏ." : "Đăng nhập để tải video lên."}
              </p>
            </div>
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

      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
