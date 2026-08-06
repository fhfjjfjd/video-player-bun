import type { BunRequest } from "bun";
import { getAuthenticatedUser } from "../auth";
import { createFeedback, listFeedback, MAX_BODY_LENGTH, MAX_TITLE_LENGTH } from "../feedback";
import type { FeedbackType } from "../../types";

const jsonError = (status: number, message: string): Response =>
  Response.json({ error: message }, { status });

export function listFeedbackHandler(_req: BunRequest): Response {
  return Response.json({ feedback: listFeedback() });
}

export async function createFeedbackHandler(req: BunRequest): Promise<Response> {
  const user = getAuthenticatedUser(req);
  if (!user) return jsonError(401, "Chưa đăng nhập.");

  let payload: { type?: unknown; title?: unknown; body?: unknown };
  try {
    payload = (await req.json()) as { type?: unknown; title?: unknown; body?: unknown };
  } catch {
    return jsonError(400, "Dữ liệu không hợp lệ.");
  }

  if (payload.type !== "feature" && payload.type !== "bug" && payload.type !== "other") {
    return jsonError(400, "Loại góp ý không hợp lệ.");
  }

  if (typeof payload.title !== "string") return jsonError(400, "Thiếu tiêu đề.");
  const title = payload.title.trim();
  if (!title) return jsonError(400, "Tiêu đề không được để trống.");
  if (title.length > MAX_TITLE_LENGTH || title.includes("\n")) {
    return jsonError(400, `Tiêu đề tối đa ${MAX_TITLE_LENGTH} ký tự, một dòng duy nhất.`);
  }

  if (typeof payload.body !== "string") return jsonError(400, "Thiếu nội dung.");
  const body = payload.body.trim();
  if (!body) return jsonError(400, "Nội dung góp ý không được để trống.");
  if (body.length > MAX_BODY_LENGTH) {
    return jsonError(400, `Nội dung tối đa ${MAX_BODY_LENGTH} ký tự.`);
  }

  const item = createFeedback({
    type: payload.type as FeedbackType,
    title,
    body,
    author: user?.username,
  });
  return Response.json({ feedback: item }, { status: 201 });
}
