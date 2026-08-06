import { useCallback, useEffect, useState } from "react";
import type { Video } from "./types";

export function useVideoList(query: string, refreshKey: string) {
  const [videos, setVideos] = useState<Video[]>([]);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const response = await fetch(`/api/videos${query ? `?q=${encodeURIComponent(query)}` : ""}`);
        if (!response.ok) return;
        const data = (await response.json()) as { videos: Video[] };
        if (!cancelled) setVideos(data.videos);
      } catch {
        // bỏ qua lỗi mạng — danh sách sẽ tải lại khi có thao tác.
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, refreshKey]);

  const deleteVideo = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      if (response.ok) setVideos(prev => prev.filter(video => video.id !== id));
    } catch {
      // bỏ qua lỗi mạng.
    }
  }, []);

  return { videos, deleteVideo };
}
