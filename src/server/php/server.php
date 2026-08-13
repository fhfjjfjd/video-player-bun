<?php

declare(strict_types=1);

/*
 * server.php — PHP backend for the videohub app.
 *
 * Runs as the router script of PHP's built-in web server:
 *   php -S <hostname>:<port> src/server/php/server.php
 *
 * It replaces the previous native (C++) backend with an equivalent
 * implementation: same routes, same API contract, same SQLite schema, and
 * the same signed media tokens, so an existing data.db and existing
 * .media-secret keep working after the upgrade.
 *
 * The script handles every request itself (API, media streaming with Range
 * support, and static files with SPA fallback) so behavior matches the old
 * native server. It is started through scripts/start.ts (bun start).
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('output_buffering', '0');
ini_set('zlib.output_compression', '0');
ini_set('max_execution_time', '600');
@ini_set('upload_max_filesize', '1100M');
@ini_set('post_max_size', '1100M');
@ini_set('memory_limit', '512M');

const SESSION_COOKIE   = 'session';
const SESSION_TTL_SEC  = 2592000;          // 30 days
const MAX_UPLOAD_SIZE  = 1024 * 1024 * 1024; // 1GB

function server_root(): string {
    return dirname(__DIR__, 2);
}

require_once __DIR__ . '/crypto.php';
require_once __DIR__ . '/db.php';

/* ------------------------------------------------------------------ paths */

function dist_dir(): string {
    $d = getenv('DIST_DIR');
    return is_string($d) && $d !== '' ? $d : server_root() . '/dist';
}

function upload_dir(): string {
    $d = getenv('UPLOAD_DIR');
    return is_string($d) && $d !== '' ? $d : server_root() . '/uploads';
}

/* ---------------------------------------------------------------- helpers */

function mime_for_path(string $path): string {
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    switch ($ext) {
        case 'html': return 'text/html';
        case 'css':  return 'text/css';
        case 'js':   return 'application/javascript';
        case 'json':
        case 'map':  return 'application/json';
        case 'png':  return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'gif':  return 'image/gif';
        case 'svg':  return 'image/svg+xml';
        case 'ico':  return 'image/x-icon';
        case 'woff': return 'font/woff';
        case 'woff2':return 'font/woff2';
        case 'ttf':  return 'font/ttf';
        case 'mp4':  return 'video/mp4';
        case 'webm': return 'video/webm';
        case 'mkv':  return 'video/x-matroska';
        case 'avi':  return 'video/x-msvideo';
        case 'm3u8': return 'application/vnd.apple.mpegurl';
        case 'mpd':  return 'application/dash+xml';
        case 'mp3':  return 'audio/mpeg';
        case 'wav':  return 'audio/wav';
        case 'ogg':  return 'audio/ogg';
        case 'pdf':  return 'application/pdf';
        case 'zip':  return 'application/zip';
        case 'gz':   return 'application/gzip';
        case 'wasm': return 'application/wasm';
        case 'txt':  return 'text/plain';
        case 'xml':  return 'application/xml';
    }
    return 'application/octet-stream';
}

function apply_security_headers(): void {
    header('Content-Security-Policy: default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; media-src \'self\' blob:; font-src \'self\' data:; connect-src \'self\'; object-src \'none\'; base-uri \'self\'; frame-ancestors \'none\'; form-action \'self\'');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
}

function err(string $message): array {
    return ['error' => $message];
}

function respond_json(int $status, $data): void {
    $body = is_string($data) ? $data : json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($body === false) {
        $status = 500;
        $body   = '{"error":"Internal Server Error"}';
    }
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Length: ' . strlen($body));
    echo $body;
}

function request_cookie(string $name): ?string {
    $cookies = $_SERVER['HTTP_COOKIE'] ?? '';
    if ($cookies === '') return null;
    foreach (explode(';', $cookies) as $pair) {
        $pair = trim($pair);
        $eq = strpos($pair, '=');
        if ($eq === false) continue;
        if (strcasecmp(substr($pair, 0, $eq), $name) === 0) {
            return substr($pair, $eq + 1);
        }
    }
    return null;
}

function set_session_cookie(string $token): void {
    header('Set-Cookie: ' . SESSION_COOKIE . '=' . $token . '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' . SESSION_TTL_SEC);
}

function clear_session_cookie(): void {
    header('Set-Cookie: ' . SESSION_COOKIE . '=; Path=/; Max-Age=0');
}

/** Current logged-in user id, or 0 when not authenticated. */
function current_user_id(): int {
    $token = request_cookie(SESSION_COOKIE);
    if ($token === null || $token === '') return 0;
    $uid = validate_session_token($token, load_media_secret());
    return $uid ?? 0;
}

function json_body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function generate_uuid(): string {
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    $hex = bin2hex($b);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-'
        . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-'
        . substr($hex, 20, 12);
}

/** Build the wire-format video object used by list/detail/upload responses. */
function video_json(array $row, ?int $viewerId, string $secret): array {
    $thumb = isset($row['thumbnail_filename']) ? (string)$row['thumbnail_filename'] : '';
    return [
        'id'                => (int)$row['id'],
        'user_id'           => (int)$row['user_id'],
        'owner_id'          => (int)$row['user_id'],
        'title'             => (string)$row['title'],
        'filename'          => (string)$row['filename'],
        'url'               => mediatoken_sign((string)$row['filename'], $secret),
        'thumbnail_filename'=> $thumb,
        'thumbnail_url'     => $thumb !== '' ? mediatoken_sign($thumb, $secret) : null,
        'size'              => (int)$row['size'],
        'content_type'      => (string)$row['content_type'],
        'created_at'        => (string)$row['created_at'],
        'is_mine'           => $viewerId !== null && (int)$row['user_id'] === $viewerId,
    ];
}

/* ------------------------------------------------------------- API routes */

function handle_health(): void {
    respond_json(200, ['status' => 'ok', 'uptime' => time()]);
}

function handle_hello(string $method): void {
    respond_json(200, ['message' => 'Hello, world!', 'method' => $method]);
}

function handle_hello_name(string $name): void {
    respond_json(200, ['message' => 'Hello, ' . $name . '!']);
}

function handle_register(): void {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        respond_json(400, err('Body JSON không hợp lệ.'));
        return;
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        respond_json(400, err('Body JSON không hợp lệ.'));
        return;
    }

    $username = isset($data['username']) && is_string($data['username']) ? $data['username'] : null;
    $email    = isset($data['email']) && is_string($data['email']) ? $data['email'] : null;
    $password = isset($data['password']) && is_string($data['password']) ? $data['password'] : null;

    if ($username === null || $password === null) {
        respond_json(400, err('Thiếu username hoặc password.'));
        return;
    }

    if (preg_match('/^[A-Za-z0-9_]{3,32}$/', $username) !== 1) {
        respond_json(400, err('Username phải gồm 3–32 ký tự chữ, số hoặc gạch dưới.'));
        return;
    }

    if (strlen($password) < 6) {
        respond_json(400, err('Password phải có ít nhất 6 ký tự.'));
        return;
    }

    if ($email === null || strlen($email) < 1 || strpos($email, '@gmail.com') === false) {
        respond_json(400, err('Email phải là tài khoản Gmail hợp lệ (…@gmail.com).'));
        return;
    }

    if (find_user_by_username($username) !== null) {
        respond_json(409, err('Username đã tồn tại.'));
        return;
    }
    if (find_user_by_email($email) !== null) {
        respond_json(409, err('Email Gmail này đã được dùng để đăng ký.'));
        return;
    }

    $id = create_user($username, $email, hash_password($password));
    if ($id === null) {
        respond_json(500, err('Failed to create user'));
        return;
    }
    respond_json(201, ['ok' => true]);
}

function handle_login(): void {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        respond_json(400, err('Body JSON không hợp lệ.'));
        return;
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        respond_json(400, err('Body JSON không hợp lệ.'));
        return;
    }

    $identifier = isset($data['username']) && is_string($data['username']) ? $data['username'] : null;
    $password   = isset($data['password']) && is_string($data['password']) ? $data['password'] : null;

    if ($identifier === null || $password === null) {
        respond_json(400, err('Thiếu Gmail/username hoặc password.'));
        return;
    }

    if (strlen($password) < 6) {
        respond_json(400, err('Password phải có ít nhất 6 ký tự.'));
        return;
    }

    $user = find_user_by_identifier($identifier);
    if ($user === null || !verify_password($password, (string)$user['password_hash'])) {
        respond_json(401, err('Sai Gmail/username hoặc password.'));
        return;
    }

    $secret = load_media_secret();
    $token  = create_session_token((int)$user['id'], $secret);
    create_session((int)$user['id'], $token, (string)(time() + SESSION_TTL_SEC));

    set_session_cookie($token);
    respond_json(200, ['user' => [
        'id'       => (int)$user['id'],
        'username' => (string)$user['username'],
    ]]);
}

function handle_logout(): void {
    $token = request_cookie(SESSION_COOKIE);
    if ($token !== null) delete_session($token);
    clear_session_cookie();
    respond_json(200, ['ok' => true]);
}

function handle_me(): void {
    $uid = current_user_id();
    if ($uid <= 0) {
        respond_json(401, err('Chưa đăng nhập.'));
        return;
    }
    $user = find_user_by_id($uid);
    if ($user === null) {
        respond_json(404, err('User not found'));
        return;
    }
    respond_json(200, ['user' => [
        'id'       => (int)$user['id'],
        'username' => (string)$user['username'],
        'email'    => (string)$user['email'],
    ]]);
}

function handle_list_videos(): void {
    $q = $_GET['q'] ?? '';
    $rows = list_all_videos(is_string($q) ? $q : '');
    $uid = current_user_id();
    $viewer = $uid > 0 ? $uid : null;
    $secret = load_media_secret();
    $videos = array_map(static fn(array $row): array => video_json($row, $viewer, $secret), $rows);
    respond_json(200, ['videos' => $videos]);
}

function handle_upload_video(): void {
    $uid = current_user_id();
    if ($uid <= 0) {
        respond_json(401, err('Chưa đăng nhập.'));
        return;
    }

    $contentType = $_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? '');
    if (stripos($contentType, 'multipart/form-data') === false) {
        respond_json(400, err('Expected multipart/form-data'));
        return;
    }

    $video = $_FILES['video'] ?? $_FILES['file'] ?? null;
    if (!is_array($video)
        || ($video['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK
        || (int)($video['size'] ?? 0) <= 0) {
        respond_json(400, err('Thiếu file video trong request.'));
        return;
    }

    $size = (int)$video['size'];
    if ($size > MAX_UPLOAD_SIZE) {
        respond_json(400, err('File vượt quá giới hạn 1GB.'));
        return;
    }

    $videoContentType = isset($video['type']) && is_string($video['type']) ? $video['type'] : 'video/mp4';
    if (strpos($videoContentType, 'video/') !== 0) {
        respond_json(400, err('File không phải là video.'));
        return;
    }

    $origName = isset($video['name']) && is_string($video['name']) ? $video['name'] : '';
    $title = isset($_POST['title']) ? trim((string)$_POST['title']) : '';
    if ($title === '') {
        $title = $origName !== '' ? $origName : 'Video';
    }

    $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
    if ($ext === '' || strlen($ext) > 12) $ext = 'mp4';

    $upload = upload_dir();
    if (!is_dir($upload)) {
        @mkdir($upload, 0755, true);
    }

    $stored    = generate_uuid() . '.' . $ext;
    $finalPath = $upload . '/' . $stored;
    if (!move_uploaded_file($video['tmp_name'], $finalPath)) {
        respond_json(500, err('Failed to store video'));
        return;
    }

    $thumbStored = null;
    $thumb = $_FILES['thumbnail'] ?? null;
    if (is_array($thumb)
        && ($thumb['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK
        && (int)($thumb['size'] ?? 0) > 0) {
        $thumbName = generate_uuid() . '.jpg';
        if (move_uploaded_file($thumb['tmp_name'], $upload . '/' . $thumbName)) {
            $thumbStored = $thumbName;
        }
    } else {
        $thumbName = generate_uuid() . '.jpg';
        $thumbPath = $upload . '/' . $thumbName;
        $src = escapeshellarg($finalPath);
        $dst = escapeshellarg($thumbPath);
        exec('ffmpeg -y -ss 00:00:01 -i ' . $src . ' -vframes 1 -q:v 2 ' . $dst . ' 2>/dev/null', $o, $rc);
        if ($rc !== 0) {
            exec('ffmpeg -y -i ' . $src . ' -vframes 1 -q:v 2 ' . $dst . ' 2>/dev/null', $o, $rc);
        }
        if (is_file($thumbPath) && filesize($thumbPath) > 0) {
            $thumbStored = $thumbName;
        } else {
            @unlink($thumbPath);
        }
    }

    $videoId = create_video($uid, $title, $stored, $size, $videoContentType, $thumbStored);
    if ($videoId === null) {
        @unlink($finalPath);
        if ($thumbStored !== null) @unlink($upload . '/' . $thumbStored);
        respond_json(500, err('Failed to create video'));
        return;
    }

    $row = find_video_by_id($videoId) ?? [
        'id' => $videoId, 'user_id' => $uid, 'title' => $title, 'filename' => $stored,
        'size' => $size, 'content_type' => $videoContentType, 'thumbnail_filename' => $thumbStored ?? '',
        'created_at' => 'now',
    ];
    respond_json(201, ['video' => video_json($row, $uid, load_media_secret())]);
}

function handle_get_video(int $id): void {
    if ($id <= 0) {
        respond_json(400, err('ID video không hợp lệ.'));
        return;
    }
    $row = find_video_by_id($id);
    if ($row === null) {
        respond_json(404, err('Video không tồn tại.'));
        return;
    }
    $uid = current_user_id();
    respond_json(200, ['video' => video_json($row, $uid > 0 ? $uid : null, load_media_secret())]);
}

function handle_delete_video(int $id): void {
    $uid = current_user_id();
    if ($uid <= 0) {
        respond_json(401, err('Chưa đăng nhập.'));
        return;
    }
    if ($id <= 0) {
        respond_json(400, err('ID video không hợp lệ.'));
        return;
    }
    if (find_video_by_id_and_user($id, $uid) === null) {
        respond_json(404, err('Video không tồn tại.'));
        return;
    }
    delete_video($id);
    respond_json(200, ['ok' => true]);
}

function handle_media(): void {
    $token = $_GET['t'] ?? null;
    if (!is_string($token) || $token === '') {
        respond_json(400, err('Missing token'));
        return;
    }

    $filename = mediatoken_verify($token, load_media_secret());
    if ($filename === null) {
        respond_json(403, err('Forbidden'));
        return;
    }

    $path = upload_dir() . '/' . $filename;
    if (!is_file($path)) {
        respond_json(404, err('Not Found'));
        return;
    }

    $size = (int)filesize($path);
    $start = 0;
    $end = $size - 1;
    $hasRange = false;

    $range = $_SERVER['HTTP_RANGE'] ?? null;
    if (is_string($range) && strncmp($range, 'bytes=', 6) === 0) {
        $hasRange = true;
        $spec = substr($range, 6);
        $comma = strpos($spec, ',');
        if ($comma !== false) $spec = substr($spec, 0, $comma);
        $dash = strpos($spec, '-');
        if ($dash !== false) {
            $start = (int)substr($spec, 0, $dash);
            $endStr = substr($spec, $dash + 1);
            if ($endStr !== '') {
                $end = (int)$endStr;
            } else {
                $end = $size - 1;
            }
        } else {
            $start = (int)$spec;
        }
        if ($end < 0 || $end >= $size) $end = $size - 1;
    }

    if ($start >= $size) {
        http_response_code(416);
        header('Content-Range: bytes */' . $size);
        header('Content-Length: 0');
        return;
    }

    ignore_user_abort(true);
    http_response_code($hasRange ? 206 : 200);
    header('Content-Type: ' . mime_for_path($path));
    header('Accept-Ranges: bytes');
    header('Content-Length: ' . ($end - $start + 1));
    if ($hasRange) {
        header('Content-Range: bytes ' . $start . '-' . $end . '/' . $size);
    }

    $fp = @fopen($path, 'rb');
    if ($fp === false) return;
    if ($start > 0) fseek($fp, $start);
    $remaining = $end - $start + 1;
    while ($remaining > 0 && !feof($fp)) {
        $chunk = fread($fp, min(8192, $remaining));
        if ($chunk === false || $chunk === '') break;
        echo $chunk;
        $remaining -= strlen($chunk);
        flush();
    }
    fclose($fp);
}

/* ----------------------------------------------------------- static files */

function serve_static(string $path): void {
    $dist = dist_dir();

    if (str_contains($path, '..')) {
        respond_json(403, err('Forbidden'));
        return;
    }

    $rel = $path === '/' ? '/index.html' : $path;
    $file = $dist . $rel;
    if (!is_file($file)) {
        $file = $dist . '/index.html';
    }
    if (!is_file($file)) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        header('Content-Length: 9');
        echo 'Not Found';
        return;
    }

    ignore_user_abort(true);
    header('Content-Type: ' . mime_for_path($file));
    header('Accept-Ranges: bytes');
    header('Content-Length: ' . filesize($file));

    $fp = @fopen($file, 'rb');
    if ($fp === false) return;
    while (!feof($fp)) {
        $chunk = fread($fp, 65536);
        if ($chunk === false || $chunk === '') break;
        echo $chunk;
    }
    fclose($fp);
}

/* ----------------------------------------------------------------- router */

apply_security_headers();

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = (string)parse_url($uri, PHP_URL_PATH);
if ($path === '' || $path === false) $path = '/';
$path = rawurldecode($path);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($path === '/api/health' && $method === 'GET') {
    handle_health();
} elseif ($path === '/api/hello' && ($method === 'GET' || $method === 'PUT')) {
    handle_hello($method);
} elseif ($path === '/api/register' && $method === 'POST') {
    handle_register();
} elseif ($path === '/api/login' && $method === 'POST') {
    handle_login();
} elseif ($path === '/api/logout' && $method === 'POST') {
    handle_logout();
} elseif ($path === '/api/me' && $method === 'GET') {
    handle_me();
} elseif ($path === '/api/videos' && $method === 'GET') {
    handle_list_videos();
} elseif ($path === '/api/videos' && $method === 'POST') {
    handle_upload_video();
} elseif ($path === '/api/media' && $method === 'GET') {
    handle_media();
} elseif (preg_match('#^/api/videos/([^/]+)$#', $path, $m) && $method === 'GET') {
    handle_get_video((int)$m[1]);
} elseif (preg_match('#^/api/videos/([^/]+)$#', $path, $m) && $method === 'DELETE') {
    handle_delete_video((int)$m[1]);
} elseif (preg_match('#^/api/hello/([^/]+)$#', $path, $m) && $method === 'GET') {
    handle_hello_name($m[1]);
} elseif (str_starts_with($path, '/api/')) {
    respond_json(404, err('Not Found'));
} else {
    serve_static($path);
}

return true;
