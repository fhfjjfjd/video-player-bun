const path = require('path');
const os = require('os');
const { DatabaseSync } = require('node:sqlite');
const { Pool } = require('pg');

const ROOT = path.join(__dirname, '..');
const sqlite = new DatabaseSync(path.join(ROOT, 'data.db'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${os.userInfo().username}@localhost:5432/video_player`,
});

const TABLES = ['users', 'videos', 'comments', 'history', 'sessions'];

function rows(table, cols) {
  return sqlite.prepare(`SELECT ${cols} FROM ${table}`).all();
}

async function insertAll(table, cols, rows) {
  const colList = cols.join(', ');
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  for (const r of rows) {
    const values = cols.map(c => (r[c] === undefined ? null : r[c]));
    await pool.query(
      `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
      values,
    );
  }
}

async function resetSequence(table) {
  await pool.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${table}))`, [table]);
}

async function main() {
  const { initDb } = require(path.join(ROOT, 'dist', 'server', 'db.js'));
  await initDb();

  for (const table of TABLES) {
    const existing = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
    if (existing.rows[0].n > 0) {
      console.log(`Bo qua ${table}: da co ${existing.rows[0].n} dong`);
      continue;
    }
    const sqliteCount = sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
    if (sqliteCount === 0) {
      console.log(`Bo qua ${table}: data.db trong`);
      continue;
    }
    let cols;
    switch (table) {
      case 'users':
        cols = ['id', 'username', 'password_hash', 'created_at'];
        break;
      case 'videos':
        cols = ['id', 'title', 'description', 'filename', 'original_name', 'size', 'duration', 'uploader_id', 'views', 'created_at'];
        break;
      case 'comments':
        cols = ['id', 'video_id', 'user_id', 'content', 'created_at'];
        break;
      case 'history':
        cols = ['id', 'user_id', 'video_id', 'watched_at', 'progress'];
        break;
      case 'sessions':
        cols = ['token', 'user_id', 'created_at'];
        break;
    }
    const data = rows(table, cols.join(', '));
    await pool.query('BEGIN');
    try {
      await insertAll(table, cols, data);
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
    if (table !== 'sessions') await resetSequence(table);
    console.log(`Da chuyen ${table}: ${data.length} dong`);
  }

  await pool.query(
    `UPDATE videos SET transcode_status = 'none', visibility = 'public', hls_dir = NULL, hls_master = NULL, share_token = NULL`,
  );
  console.log('Video cu: transcode_status = none (chi video moi duoc chuyen ma HLS)');
  console.log('Migrate hoan tat.');
  await pool.end();
}

main().catch(err => {
  console.error('Migrate that bai:', err.message);
  process.exit(1);
});
