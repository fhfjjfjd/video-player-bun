const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NODEMON = path.join(ROOT, 'node_modules', 'nodemon', 'bin', 'nodemon.js');
const VITE = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

const children = [
  { name: 'backend', proc: spawn('node', [NODEMON], { stdio: 'inherit', cwd: ROOT }) },
  { name: 'frontend', proc: spawn('node', [VITE], { stdio: 'inherit', cwd: ROOT }) },
];

let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { proc } of children) {
    if (proc.exitCode === null) proc.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 300);
}

for (const { name, proc } of children) {
  proc.on('exit', code => {
    console.log(`[dev] ${name} stopped (exit ${code})`);
    if (!shuttingDown) {
      shuttingDown = true;
      const other = children.find(c => c.proc !== proc && c.proc.exitCode === null);
      if (other) other.proc.kill('SIGTERM');
      process.exit(code ?? 0);
    }
  });
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

console.log('[dev] backend  -> http://localhost:3000 (API, nodemon + tsx)');
console.log('[dev] frontend -> http://localhost:5173 (Vite, auto proxy /api -> 3000)');
