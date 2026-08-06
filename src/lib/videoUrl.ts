const KEY = "video-player-node-key-2026";

export function decodeVideoUrl(token: string): string {
  const decoded = atob(token);
  let output = "";
  for (let i = 0; i < decoded.length; i++) {
    output += String.fromCharCode(decoded.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
  }
  return output;
}
