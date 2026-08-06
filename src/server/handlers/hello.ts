import type { BunRequest } from "bun";

const GREETING = "Hello, world!";

const hello = (method: string): Response =>
  Response.json({ message: GREETING, method });

export const getHello = (_req: BunRequest<"/api/hello">): Response => hello("GET");

export const putHello = (_req: BunRequest<"/api/hello">): Response => hello("PUT");

export const getHelloByName = (req: BunRequest<"/api/hello/:name">): Response =>
  Response.json({ message: `Hello, ${req.params.name}!` });
