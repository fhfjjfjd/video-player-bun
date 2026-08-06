import { ImagePlus, Loader2, Upload, X, Film } from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploaded: (videoId: number) => void;
}

export function UploadModal({ open, onClose, onUploaded }: UploadModalProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleVideoSelect = (file: File) => {
    setVideoFile(file);
    if (!title) {
      // Remove extension for default title
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setTitle(nameWithoutExt);
    }
  };

  const handleThumbSelect = (file: File) => {
    setThumbnailFile(file);
    const objectUrl = URL.createObjectURL(file);
    setThumbnailPreview(objectUrl);
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) {
      setError("Vui lòng chọn file video.");
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append("video", videoFile);
    if (thumbnailFile) {
      formData.append("thumbnail", thumbnailFile);
    }
    if (title.trim()) {
      formData.append("title", title.trim());
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/videos");
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      setUploading(false);
      try {
        const data = JSON.parse(xhr.responseText) as { video?: { id: number }; error?: string };
        if (xhr.status >= 200 && xhr.status < 300 && data.video) {
          onUploaded(data.video.id);
          onClose();
        } else {
          setError(data.error ?? "Tải lên thất bại.");
        }
      } catch {
        setError("Tải lên thất bại.");
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      setError("Lỗi kết nối mạng khi tải lên.");
    };
    xhr.send(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tải lên video"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/15 bg-zinc-900 text-zinc-100 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Upload className="h-5 w-5 text-emerald-400" />
            Tải lên video mới
          </h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} disabled={uploading} aria-label="Đóng" className="h-8 w-8 text-white hover:bg-white/10">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleUpload} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          {error && <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>}

          {/* Video file selection */}
          <div className="flex flex-col gap-2">
            <Label className="text-zinc-300">File video (.mp4, .webm, m3u8…)</Label>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleVideoSelect(f);
              }}
            />
            {videoFile ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="flex items-center gap-3 truncate">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                    <Film className="h-5 w-5" />
                  </div>
                  <div className="truncate">
                    <p className="truncate text-sm font-medium text-zinc-100">{videoFile.name}</p>
                    <p className="text-xs text-zinc-400">{(videoFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={uploading}
                  className="text-xs text-zinc-300 hover:text-white"
                >
                  Đổi file
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 py-8 transition hover:border-emerald-500/50 hover:bg-white/10"
              >
                <Upload className="h-8 w-8 text-emerald-400" />
                <span className="text-sm font-medium text-zinc-200">Nhấn để chọn video</span>
                <span className="text-xs text-zinc-500">Hỗ trợ tối đa 1GB</span>
              </button>
            )}
          </div>

          {/* Thumbnail image selection */}
          <div className="flex flex-col gap-2">
            <Label className="text-zinc-300">Ảnh thu nhỏ / Thumbnail (Tùy chọn)</Label>
            <input
              ref={thumbInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleThumbSelect(f);
              }}
            />
            {thumbnailPreview ? (
              <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 p-3">
                <div className="flex items-center gap-3 truncate">
                  <img src={thumbnailPreview} alt="Thumbnail preview" className="h-12 w-20 shrink-0 rounded-lg object-cover" />
                  <div className="truncate">
                    <p className="truncate text-sm font-medium text-zinc-100">{thumbnailFile?.name}</p>
                    <p className="text-xs text-zinc-400">Ảnh thu nhỏ đã chọn</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => thumbInputRef.current?.click()}
                  disabled={uploading}
                  className="text-xs text-zinc-300 hover:text-white"
                >
                  Đổi ảnh
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => thumbInputRef.current?.click()}
                className="flex items-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/5 p-3 transition hover:border-emerald-500/50 hover:bg-white/10"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-zinc-400">
                  <ImagePlus className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-zinc-200">Thêm ảnh thu nhỏ (Thumbnail)</p>
                  <p className="text-xs text-zinc-500">JPG, PNG, WebP</p>
                </div>
              </button>
            )}
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="video-title" className="text-zinc-300">Tiêu đề video</Label>
            <Input
              id="video-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề video…"
              required
              disabled={uploading}
              className="h-10 border-white/15 bg-white/5 text-zinc-100"
            />
          </div>

          {uploading && (
            <div className="flex flex-col gap-2 rounded-xl bg-white/5 p-3">
              <div className="flex justify-between text-xs text-zinc-300">
                <span>Đang tải lên…</span>
                <span className="font-mono tabular-nums">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-emerald-400 transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="mt-2 flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={uploading} className="flex-1 h-10 text-zinc-300">
              Hủy
            </Button>
            <Button type="submit" disabled={uploading || !videoFile} className="flex-1 h-10 bg-emerald-500 text-zinc-950 hover:bg-emerald-400">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tải lên ngay"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
