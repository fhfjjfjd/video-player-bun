import { Film, Loader2, MonitorPlay, Search, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { HeaderActions } from "./HeaderActions";
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

export function HomePage({ user, onLogout, onLogin, search, onSearchChange, onOpenVideo }: HomePageProps) {
  const { videos, deleteVideo } = useVideoList(search, user ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadVideo = (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    const formData = new FormData();
    formData.append("video", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/videos");
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = async () => {
      setUploading(false);
      try {
        const data = JSON.parse(xhr.responseText) as { video?: Video; error?: string };
        if (xhr.status >= 200 && xhr.status < 300 && data.video) {
          onOpenVideo(data.video.id);
        } else {
          setUploadError(data.error ?? "Upload thất bại.");
        }
      } catch {
        setUploadError("Upload thất bại.");
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      setUploadError("Upload thất bại. Kiểm tra kết nối.");
    };
    xhr.send(formData);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) uploadVideo(file);
    event.target.value = "";
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center gap-3 border-b border-white/10 bg-zinc-900/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <MonitorPlay className="h-6 w-6 text-emerald-400" />
          <span className="hidden text-lg font-semibold tracking-tight sm:inline">Video Player</span>
        </div>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Tìm kiếm video…"
            className="h-9 w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none"
          />
        </div>
        {user && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-9 shrink-0 gap-2"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span className="hidden sm:inline">Tải lên</span>
            </Button>
            {uploading && (
              <div className="w-24 shrink-0">
                <div className="h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-[10px] tabular-nums text-zinc-400">{uploadProgress}%</p>
              </div>
            )}
          </>
        )}
        <HeaderActions user={user} onLogout={onLogout} onLogin={onLogin} />
      </header>

      <main className="flex w-full flex-1 flex-col items-center gap-6 p-4 sm:p-6">
        {uploadError && (
          <p className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {uploadError}
            <button type="button" onClick={() => setUploadError(null)} className="font-semibold underline">
              Đóng
            </button>
          </p>
        )}

        {videos.length === 0 ? (
          <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5 text-zinc-400">
              <Film className="h-10 w-10" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Chưa có video nào</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {user ? "Tải video lên ở góc trên bên phải để bắt đầu." : "Đăng nhập để tải video lên."}
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
    </div>
  );
}
