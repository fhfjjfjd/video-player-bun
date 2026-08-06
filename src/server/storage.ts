import { mkdir } from "node:fs/promises";
import path from "node:path";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
export const MAX_UPLOAD_SIZE = 1024 * 1024 * 1024; // 1GB

await mkdir(UPLOAD_DIR, { recursive: true });
