export const getHealth = (): Response =>
  Response.json({ status: "ok", uptime: process.uptime() });
