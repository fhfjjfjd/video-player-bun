const KEY = "video-player-node-key-2026";

function xorCipher(input: string): string {
  let output = "";
  for (let i = 0; i < input.length; i++) {
    output += String.fromCharCode(input.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
  }
  return output;
}

export function encodeVideoUrl(path: string): string {
  return Buffer.from(xorCipher(path), "binary").toString("base64");
}
