import type { BunRequest } from "bun";
import path from "node:path";
import type { Video } from "../../types";
import { getAuthenticatedUser } from "../auth";
import { createVideo, deleteVideoRecord, findVideoById, findVideoByIdAndUser, listAllVideos } from "../db";
import { MAX_UPLOAD_SIZE, UPLOAD_DIR } from "../storage";
import { encodeVideoUrl } from "../videoUrl";

const jsonError = (status: number, message: string): Response =>
  Response.json({ error: message }, { status });

const toVideoDto = (
  row: {
    id: number;
    user_id: number;
    title: string;
    filename: string;
    size: number;
    content_type: string;
    created_at: string;
  },
  viewerId?: number,
): Video => ({
  id: row.id,
  title: row.title,
  url: encodeVideoUrl(`/uploads/${row.filename}`),
  size: row.size,
  content_type: row.content_type,
  created_at: row.created_at,
  owner_id: row.user_id,
  is_mine: viewerId != null && row.user_id === viewerId,
});

export function listVideos(req: BunRequest): Response {
  const user = getAuthenticatedUser(req);
  const query = new URL(req.url).searchParams.get("q") ?? "";
  return Response.json({ videos: listAllVideos(query.trim()).map(row => toVideoDto(row, user?.id)) });
}

export async function uploadVideo(req: BunRequest): Promise<Response> {
  const user = getAuthenticatedUser(req);
  if (!user) return jsonError(401, "Chưa đăng nhập.");

  const form = await req.formData().catch(() => null);
  const file = form?.get("video");
  if (!(file instanceof File)) return jsonError(400, "Thiếu file video trong request.");

  if (!file.type.startsWith("video/")) {
    return jsonError(400, "File không phải là video.");
  }
  if (file.size === 0) return jsonError(400, "File video rỗng.");
  if (file.size > MAX_UPLOAD_SIZE) return jsonError(400, "File vượt quá giới hạn 1GB.");

  const extension = path.extname(file.name).slice(0, 12);
  const storedName = `${crypto.randomUUID()}${extension}`;
  const destination = path.join(UPLOAD_DIR, storedName);

  await Bun.write(destination, file);

  const row = createVideo(user.id, file.name || storedName, storedName, file.size, file.type);
  return Response.json({ video: toVideoDto(row, user.id) }, { status: 201 });
}

export function getVideo(req: BunRequest<"/api/videos/:id">): Response {
  const user = getAuthenticatedUser(req);

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return jsonError(400, "ID video không hợp lệ.");

  const video = findVideoById(id);
  if (!video) return jsonError(404, "Video không tồn tại.");

  return Response.json({ video: toVideoDto(video, user?.id) });
}

export async function deleteVideo(req: BunRequest<"/api/videos/:id">): Promise<Response> {
  const user = getAuthenticatedUser(req);
  if (!user) return jsonError(401, "Chưa đăng nhập.");

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return jsonError(400, "ID video không hợp lệ.");

  const video = findVideoByIdAndUser(id, user.id);
  if (!video) return jsonError(404, "Video không tồn tại.");

  await Bun.file(path.join(UPLOAD_DIR, video.filename)).delete().catch(() => {});
  deleteVideoRecord(id);
  return Response.json({ ok: true });
}

export async function serveUpload(req: BunRequest<"/uploads/:filename">): Promise<Response> {
  const filename = req.params.filename;
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return new Response("Not Found", { status: 404 });
  }

  const file = Bun.file(path.join(UPLOAD_DIR, filename));
  if (await file.exists()) return new Response(file);
  return new Response("Not Found", { status: 404 });
}
