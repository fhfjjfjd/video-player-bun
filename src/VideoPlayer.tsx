import { Film, Loader2, Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type HlsInstance = import("hls.js").default;

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

const formatTime = (time: number): string => {
  if (!Number.isFinite(time) || time < 0) return "0:00";
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor(time % 60);
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  return `${hours > 0 ? `${hours}:` : ""}${mm}:${String(seconds).padStart(2, "0")}`;
};

interface VideoPlayerProps {
  src: string | null;
}

export function VideoPlayer({ src }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<HlsInstance | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [dragTime, setDragTime] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const loadVideo = (rawUrl: string) => {
    let url: URL;
    try {
      url = new URL(rawUrl.trim(), window.location.origin);
    } catch {
      setError("Đã xảy ra lỗi, vui lòng thử lại sau.");
      return;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setError(null);
    setCurrentUrl(url.href);
    setCurrentTime(0);
    setDragTime(null);
    setDuration(0);
    setIsPlaying(false);
    setIsBuffering(false);
  };

  useEffect(() => {
    if (src) {
      loadVideo(src);
    } else {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      setError(null);
      setCurrentUrl(null);
      setCurrentTime(0);
      setDragTime(null);
      setDuration(0);
      setIsPlaying(false);
      setIsBuffering(false);
    }
  }, [src]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => setError("Không thể tự động phát video."));
    } else {
      video.pause();
    }
  };

  const toggleMute = () => setMuted(m => !m);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  };

  const seekBy = (delta: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.min(Math.max(video.currentTime + delta, 0), video.duration);
  };

  const handlersRef = useRef({ togglePlay, toggleMute, toggleFullscreen, seekBy });
  useEffect(() => {
    handlersRef.current = { togglePlay, toggleMute, toggleFullscreen, seekBy };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      switch (event.key) {
        case " ":
          event.preventDefault();
          handlersRef.current.togglePlay();
          break;
        case "ArrowLeft":
          event.preventDefault();
          handlersRef.current.seekBy(-5);
          break;
        case "ArrowRight":
          event.preventDefault();
          handlersRef.current.seekBy(5);
          break;
        case "f":
          handlersRef.current.toggleFullscreen();
          break;
        case "m":
          handlersRef.current.toggleMute();
          break;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentUrl) return;

    const onTimeUpdate = () => {
      if (!isDraggingRef.current) setCurrentTime(video.currentTime);
    };
    const onLoadedMetadata = () => setDuration(video.duration || 0);
    const onDurationChange = () => setDuration(video.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onEnded = () => setIsPlaying(false);
    const onError = () => setError("Không thể tải video này. Kiểm tra kết nối và thử lại.");

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);

    video.volume = volume;
    video.muted = muted;

    video.pause();
    video.removeAttribute("src");
    video.load();

    const url = currentUrl;
    const isHls = url.endsWith(".m3u8");
    let cancelled = false;

    if (isHls) {
      void (async () => {
        const { default: Hls } = await import("hls.js");
        if (cancelled) return;
        if (Hls.isSupported()) {
          const instance = new Hls();
          hlsRef.current = instance;
          instance.loadSource(url);
          instance.attachMedia(video);
          instance.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              instance.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              instance.recoverMediaError();
            } else {
              instance.destroy();
              hlsRef.current = null;
              setError("Không thể phát HLS stream này.");
            }
          });
          video.play().catch(() => {});
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          video.play().catch(() => {});
        } else {
          setError("Trình duyệt này không hỗ trợ phát HLS.");
        }
      })();
    } else {
      video.src = url;
      video.play().catch(() => {});
    }

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
    };
  }, [currentUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    const video = videoRef.current;
    if (video && !video.paused) {
      hideTimeoutRef.current = window.setTimeout(() => setControlsVisible(false), 3000);
    }
  }, []);

  useEffect(() => {
    showControls();
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [currentUrl, showControls]);

  const seekFromEvent = (clientX: number) => {
    const bar = seekBarRef.current;
    const video = videoRef.current;
    if (!bar || !video || !Number.isFinite(video.duration) || video.duration === 0) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const time = ratio * video.duration;
    setDragTime(time);
    video.currentTime = time;
  };

  const onSeekPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    isDraggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekFromEvent(event.clientX);
  };

  const onSeekPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    seekFromEvent(event.clientX);
  };

  const onSeekPointerUp = () => {
    isDraggingRef.current = false;
    setDragTime(null);
    showControls();
  };

  const progress = duration > 0 ? ((dragTime ?? currentTime) / duration) * 100 : 0;
  const controlsHidden = isPlaying && !controlsVisible;

  return (
    <div className="flex w-full flex-1 flex-col items-center gap-6 p-4 sm:p-6">
      {currentUrl ? (
        <div
          ref={containerRef}
          onMouseMove={showControls}
          onTouchStart={showControls}
          onClick={() => showControls()}
          className={cn(
            "group relative overflow-hidden bg-black shadow-2xl select-none",
            isFullscreen ? "h-full w-full" : "aspect-video w-full max-w-5xl rounded-xl",
            controlsHidden && "cursor-none",
          )}
        >
          <video ref={videoRef} className="h-full w-full object-contain" onClick={togglePlay} />

          {isBuffering && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-14 w-14 animate-spin text-white/90" />
            </div>
          )}

          {!isPlaying && !isBuffering && (
            <button
              type="button"
              onClick={togglePlay}
              aria-label="Phát"
              className="absolute inset-0 m-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-xl transition hover:scale-105"
            >
              <Play className="ml-1 h-10 w-10 fill-current" />
            </button>
          )}

          {error && (
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 bg-red-600/90 px-4 py-3 text-sm">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="font-semibold underline">
                Đóng
              </button>
            </div>
          )}

          <div
            className={cn(
              "absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent pb-2 pt-10 transition-opacity duration-300",
              controlsHidden ? "pointer-events-none opacity-0" : "opacity-100",
            )}
          >
            <div
              ref={seekBarRef}
              role="slider"
              aria-label="Tiến độ video"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={dragTime ?? currentTime}
              className="group/seek relative h-5 w-full cursor-pointer touch-none"
              onPointerDown={onSeekPointerDown}
              onPointerMove={onSeekPointerMove}
              onPointerUp={onSeekPointerUp}
              onPointerCancel={onSeekPointerUp}
            >
              <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-emerald-400"
                  style={{ width: `${progress}%` }}
                />
                <div
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-emerald-400 shadow transition-opacity group-hover/seek:opacity-100"
                  style={{ left: `${progress}%`, opacity: isDraggingRef.current ? 1 : undefined }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 pb-1.5 text-sm">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                aria-label={isPlaying ? "Tạm dừng" : "Phát"}
                className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
              >
                {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
              </Button>

              <span className="min-w-[90px] text-center font-mono tabular-nums text-zinc-200">
                {formatTime(dragTime ?? currentTime)}
                <span className="text-zinc-400"> / {formatTime(duration)}</span>
              </span>

              <div className="flex-1" />

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  aria-label={muted ? "Bật tiếng" : "Tắt tiếng"}
                  className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
                >
                  {muted || volume === 0 ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={event => {
                    const value = Number(event.target.value);
                    setVolume(value);
                    setMuted(value === 0);
                  }}
                  aria-label="Âm lượng"
                  className="h-1 w-20 cursor-pointer accent-emerald-400"
                />
              </div>

              <Select value={String(playbackRate)} onValueChange={value => setPlaybackRate(Number(value))}>
                <SelectTrigger aria-label="Tốc độ phát" className="h-9 w-16 border-white/15 bg-white/10 text-white hover:bg-white/15">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 text-zinc-100">
                  {PLAYBACK_RATES.map(rate => (
                    <SelectItem key={rate} value={String(rate)}>
                      {rate}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
                className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
              >
                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
          {error && (
            <p className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
              <button type="button" onClick={() => setError(null)} className="font-semibold underline">
                Đóng
              </button>
            </p>
          )}
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5 text-zinc-400">
            <Film className="h-10 w-10" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Chưa có video nào</h2>
            <p className="mt-1 text-sm text-zinc-400">Chọn một video để bắt đầu xem.</p>
          </div>
        </div>
      )}
    </div>
  );
}
