import type { BunRequest } from "bun";
import path from "node:path";
import type { Video } from "../../types";
import { getAuthenticatedUser } from "../auth";
import { createVideo, deleteVideoRecord, findVideoByFilename, findVideoById, findVideoByIdAndUser, listAllVideos } from "../db";
import { MAX_UPLOAD_SIZE, UPLOAD_DIR } from "../storage";
import { createMediaToken, verifyMediaToken } from "../mediaToken";
import { dlopen } from "bun:ffi";

const cppLibPath = path.join(process.cwd(), "bin", `${process.platform}-${process.arch}`, `libvideos${process.platform === "win32" ? ".dll" : process.platform === "darwin" ? ".dylib" : ".so"}`);
const cppLib = dlopen(cppLibPath, {
  videos_generate_thumbnail: {
    returns: "pointer",
    arguments: ["pointer", "pointer", "size"],
  },
});

const jsonError = (status: number, message: string): Response =>
  Response.json({ error: message }, { status });

async function generateThumbnailWithFfmpeg(videoPath: string): Promise<string | null> {
  const output = Buffer.alloc(512);
  const ptr = cppLib.symbols.videos_generate_thumbnail(
    Buffer.alloc(0),
    Buffer.from(videoPath),
    output,
    output.length,
  );
  if (!ptr) return null;
  const thumbFilename = output.toString("utf8").split("\0")[0];
  return thumbFilename || null;
}

const toVideoDto = (
  row: {
    id: number;
    user_id: number;
    title: string;
    filename: string;
    size: number;
    content_type: string;
    thumbnail_filename: string | null;
    created_at: string;
  },
  viewerId?: number,
): Video => ({
  id: row.id,
  title: row.title,
  url: createMediaToken(row.filename),
  thumbnail_url: row.thumbnail_filename ? createMediaToken(row.thumbnail_filename) : undefined,
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
  const file = form?.get("video") ?? form?.get("file");
  if (!(file instanceof File)) return jsonError(400, "Thiếu file video trong request.");

  if (!file.type.startsWith("video/")) {
    return jsonError(400, "File không phải là video.");
  }
  if (file.size === 0) return jsonError(400, "File video rỗng.");
  if (file.size > MAX_UPLOAD_SIZE) return jsonError(400, "File vượt quá giới hạn 1GB.");

  const thumbnailFile = form?.get("thumbnail");
  let storedThumbnailName: string | null = null;
  if (thumbnailFile instanceof File && thumbnailFile.size > 0) {
    if (!thumbnailFile.type.startsWith("image/")) {
      return jsonError(400, "File ảnh thu nhỏ không hợp lệ.");
    }
    const thumbExt = path.extname(thumbnailFile.name).slice(0, 12) || ".jpg";
    storedThumbnailName = `${crypto.randomUUID()}${thumbExt}`;
    const thumbDestination = path.join(UPLOAD_DIR, storedThumbnailName);
    await Bun.write(thumbDestination, thumbnailFile);
  }

  const customTitle = form?.get("title");
  const title = (typeof customTitle === "string" && customTitle.trim()) || file.name || "Video";

  const extension = path.extname(file.name).slice(0, 12);
  const storedName = `${crypto.randomUUID()}${extension}`;
  const destination = path.join(UPLOAD_DIR, storedName);

  await Bun.write(destination, file);

  if (!storedThumbnailName) {
    storedThumbnailName = await generateThumbnailWithFfmpeg(destination);
  }

  const row = createVideo(user.id, title, storedName, file.size, file.type, storedThumbnailName);
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
  if (video.thumbnail_filename) {
    await Bun.file(path.join(UPLOAD_DIR, video.thumbnail_filename)).delete().catch(() => {});
  }
  deleteVideoRecord(id);
  return Response.json({ ok: true });
}

import { SECURITY_HEADERS } from "../security";

export const serveMedia: (req: BunRequest) => Promise<Response> = Object.assign(
  async function serveMedia(req: BunRequest): Promise<Response> {
    const token = new URL(req.url).searchParams.get("t");
    if (!token) return new Response("Bad Request", { status: 400 });

    const filename = verifyMediaToken(token);
    if (!filename) return new Response("Forbidden", { status: 403 });

    const video = findVideoByFilename(filename);
    const file = Bun.file(path.join(UPLOAD_DIR, filename));
    if (!(await file.exists())) return new Response("Not Found", { status: 404 });

    // Return the Bun.file directly so Bun auto-handles Range/ETag/304 requests.
    // Security headers must be set in the constructor here (the secureRoutes
    // wrapper skips this handler via the skipSecurity marker).
    const headers: Record<string, string> = { ...SECURITY_HEADERS, "Accept-Ranges": "bytes" };
    if (video?.content_type) headers["Content-Type"] = video.content_type;
    return new Response(file, { headers });
  },
  { skipSecurity: true },
);
