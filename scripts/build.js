const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const VITE = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

const REQUIRED_IDS = {
  'index.html': ['auth-nav', 'video-grid', 'empty-msg', 'history-section', 'history-grid'],
  'player.html': ['auth-nav', 'player-container', 'video', 'video-title', 'video-meta', 'video-desc', 'comment-input', 'comment-btn', 'comments'],
  'login.html': ['message', 'toggle', 'auth-title', 'submit-btn', 'username', 'password'],
  'upload.html': ['auth-nav', 'file-input', 'file-info', 'message', 'progress-wrap', 'progress-bar', 'upload-btn', 'title', 'description'],
};

function run(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'inherit', 'inherit'] });
  if (res.status !== 0) throw new Error(`Lenh that bai (exit ${res.status})`);
}

function checkHtml(file) {
  const content = fs.readFileSync(file, 'utf8');
  const errors = [];

  const ids = [...content.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (dupes.length) errors.push('id trùng lặp: ' + dupes.join(', '));

  for (const m of content.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const ref = m[1];
    if (!ref || ref.startsWith('http://') || ref.startsWith('https://') ||
        ref.startsWith('#') || ref.startsWith('mailto:') || ref.startsWith('data:') ||
        ref.startsWith('javascript:') || ref.startsWith('/api/') ||
        ref.includes('${') || ref.includes('?')) continue;
    const rel = ref.startsWith('/') ? ref.slice(1) : path.join(path.dirname(file), ref);
    const targets = [
      path.join(ROOT, rel),
      path.join(ROOT, 'public', rel),
    ];
    if (!targets.some(t => fs.existsSync(t))) errors.push('thiếu file tham chiếu: ' + ref);
  }

  const required = REQUIRED_IDS[path.basename(file)];
  if (required) {
    const missing = required.filter(id => !ids.includes(id));
    if (missing.length) errors.push('thiếu id bắt buộc: ' + missing.join(', '));
  }

  return errors;
}

function checkCss(file) {
  const content = fs.readFileSync(file, 'utf8');
  let depth = 0;
  for (const ch of content) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth < 0) break;
  }
  return depth === 0 ? [] : ['dấu ngoặc nhọn không cân bằng'];
}

try {
  if (fs.existsSync(path.join(ROOT, 'dist'))) {
    fs.rmSync(path.join(ROOT, 'dist'), { recursive: true, force: true });
  }

  console.log('[1/5] Bien dich server (tsc -> dist/server)');
  run('node', [TSC, '-p', 'tsconfig.server.json']);

  console.log('[2/5] Kiem tra type client (tsc --noEmit)');
  run('node', [TSC, '-p', 'tsconfig.client.json', '--noEmit']);

  console.log('[3/5] Build frontend (vite -> dist/public)');
  run('node', [VITE, 'build']);

  console.log('[4/5] Kiem tra HTML/CSS');
  let ok = true;
  for (const name of Object.keys(REQUIRED_IDS)) {
    const errors = checkHtml(path.join(ROOT, name));
    if (errors.length) {
      ok = false;
      console.error('LOI ' + name);
      for (const err of errors) console.error('     - ' + err);
    } else {
      console.log('OK  ' + name);
    }
  }
  const cssErrors = checkCss(path.join(ROOT, 'src', 'client', 'tailwind.css'));
  if (cssErrors.length) {
    ok = false;
    console.error('LOI src/client/tailwind.css');
    for (const err of cssErrors) console.error('     - ' + err);
  } else {
    console.log('OK  src/client/tailwind.css');
  }
  if (!ok) throw new Error('HTML/CSS loi');

  console.log('[5/5] Load test server (dist/server/server.js)');
  const res = spawnSync('node', ['-e', 'require(process.argv[1]); process.exit(0)', path.join(ROOT, 'dist', 'server', 'server.js')], {
    encoding: 'utf8',
    env: { ...process.env, PORT: '0' },
  });
  if (res.status !== 0) {
    const lines = (res.stderr || res.stdout || '').trim().split('\n');
    const err = lines.find(l => l.includes('Error')) || lines[0] || '';
    throw new Error('loi runtime khi load server: ' + err);
  }
  console.log('OK  dist/server/server.js');

  console.log('\nBuild hoan tat: server TS + typecheck client + Vite frontend + kiem tra HTML/CSS + load test.');
} catch (e) {
  console.error('\nBuild that bai: ' + e.message);
  process.exit(1);
}
