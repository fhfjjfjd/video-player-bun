import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { query, UPLOAD_DIR, HLS_DIR } from './db';

interface ProbeInfo {
  width: number;
  hasAudio: boolean;
  duration: number;
}

function probeVideo(filePath: string): ProbeInfo {
  const res = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=codec_type,width,height',
    '-show_entries', 'format=duration',
    '-of', 'json',
    filePath,
  ], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error('Không thể phân tích video');
  const data = JSON.parse(res.stdout || '{}');
  const streams: { codec_type?: string; width?: number }[] = data.streams || [];
  const video = streams.find((s: any) => s.codec_type === 'video');
  const width = Number(video?.width) || 0;
  const hasAudio = streams.some((s: any) => s.codec_type === 'audio');
  const duration = Number(data.format?.duration) || 0;
  return { width, hasAudio, duration };
}

interface Rendition {
  width: number;
  vrate: number;
  arate: number;
}

function buildRenditions(width: number): Rendition[] {
  if (width >= 1280) {
    return [
      { width: Math.min(1280, width), vrate: 2500, arate: 128 },
      { width: Math.min(854, width), vrate: 1100, arate: 96 },
    ];
  }
  if (width >= 854) {
    return [
      { width: Math.min(854, width), vrate: 1200, arate: 96 },
      { width: Math.min(640, width), vrate: 700, arate: 64 },
    ];
  }
  return [{ width: Math.max(width, 320), vrate: 800, arate: 64 }];
}

function buildArgs(input: string, outDir: string, renditions: Rendition[], hasAudio: boolean): string[] {
  const n = renditions.length;
  const parts: string[] = [];
  const maps: string[] = [];
  const videoFlags: string[] = [];
  const audioFlags: string[] = [];
  const streamMaps: string[] = [];

  if (n === 1) {
    parts.push(`[0:v]scale=w=${renditions[0].width}:h=-2[vout]`);
    maps.push('[vout]');
  } else {
    const splitNames = renditions.map((_, i) => `[v${i}]`).join('');
    parts.push(`[0:v]split=${n}${splitNames}`);
    renditions.forEach((r, i) => {
      parts.push(`[v${i}]scale=w=${r.width}:h=-2[v${i}out]`);
    });
  }

  renditions.forEach((r, i) => {
    if (hasAudio) {
      maps.push(`[v${n === 1 ? 'out' : i + 'out'}]`, '0:a?');
    } else {
      maps.push(`[v${n === 1 ? 'out' : i + 'out'}]`);
    }
    videoFlags.push(`-b:v:${i}`, `${r.vrate}k`, `-maxrate:v:${i}`, `${Math.round(r.vrate * 1.2)}k`, `-bufsize:v:${i}`, `${Math.round(r.vrate * 1.6)}k`);
    if (hasAudio) audioFlags.push(`-b:a:${i}`, `${r.arate}k`);
    streamMaps.push(hasAudio ? `v:${i},a:${i}` : `v:${i}`);
  });

  const args = ['-y', '-i', input];
  args.push('-filter_complex', parts.join(';'));
  args.push(...maps.flatMap(m => ['-map', m]));
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-g', '48', '-keyint_min', '48', '-sc_threshold', '0', '-pix_fmt', 'yuv420p');
  args.push(...videoFlags);
  if (hasAudio) args.push('-c:a', 'aac', '-ac', '2', ...audioFlags);
  args.push('-f', 'hls', '-hls_time', '4', '-hls_playlist_type', 'vod');
  if (n === 1) {
    args.push('-hls_segment_filename', path.join(outDir, 'seg_%03d.ts'), path.join(outDir, 'index.m3u8'));
  } else {
    args.push('-hls_segment_filename', path.join(outDir, 'v%v_%03d.ts'));
    args.push('-var_stream_map', streamMaps.join(' '), '-master_pl_name', 'master.m3u8', path.join(outDir, 'v%v.m3u8'));
  }
  return args;
}

let queue: Promise<void> = Promise.resolve();

export function transcodeVideo(videoId: number, filename: string): Promise<void> {
  queue = queue.then(() => doTranscode(videoId, filename)).catch(() => {});
  return queue;
}

async function doTranscode(videoId: number, filename: string): Promise<void> {
  const input = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(input)) {
    await query('UPDATE videos SET transcode_status = $1 WHERE id = $2', ['failed', videoId]);
    return;
  }

  let info: ProbeInfo;
  try {
    info = probeVideo(input);
  } catch (e) {
    await query('UPDATE videos SET transcode_status = $1 WHERE id = $2', ['failed', videoId]);
    return;
  }

  if (!info.width) {
    await query('UPDATE videos SET transcode_status = $1 WHERE id = $2', ['failed', videoId]);
    return;
  }

  const renditions = buildRenditions(info.width);
  const outDir = path.join(HLS_DIR, String(videoId));
  fs.mkdirSync(outDir, { recursive: true });

  await query('UPDATE videos SET transcode_status = $1 WHERE id = $2', ['processing', videoId]);

  const args = buildArgs(input, outDir, renditions, info.hasAudio);
  const master = renditions.length === 1 ? 'index.m3u8' : 'master.m3u8';

  await new Promise<void>((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let errBuf = '';
    proc.stderr.on('data', (d: Buffer) => {
      errBuf = (errBuf + d.toString()).slice(-4000);
    });
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code !== 0) {
        const msg = (errBuf.match(/Error[^\n]*/g) || [errBuf.trim()]).slice(-1)[0];
        reject(new Error(msg || 'Chuyển mã thất bại'));
      } else {
        resolve();
      }
    });
  });

  const relDir = path.join('hls', String(videoId)).split(path.sep).join('/');
  await query(
    'UPDATE videos SET transcode_status = $1, hls_dir = $2, hls_master = $3, duration = $4 WHERE id = $5',
    ['ready', relDir, master, info.duration, videoId],
  );
}
