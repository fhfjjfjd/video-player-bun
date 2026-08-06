export interface ServerConfig {
  hostname: string;
  port: number;
  isDevelopment: boolean;
}

const DEFAULT_PORT = 3000;

export function loadConfig(): ServerConfig {
  const rawPort = process.env.PORT ?? String(DEFAULT_PORT);
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT "${rawPort}" — expected an integer between 0 and 65535`);
  }

  return {
    hostname: process.env.HOSTNAME ?? "127.0.0.1",
    port,
    isDevelopment: process.env.NODE_ENV !== "production",
  };
}
