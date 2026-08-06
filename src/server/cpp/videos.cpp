#include "videos.h"
#include "mediatoken.h"
#include <sqlite3.h>
#include <cstring>
#include <string>
#include <sstream>
#include <fstream>
#include <cstdio>
#include <cstdlib>
#include <sys/stat.h>
#include <unistd.h>
#include <random>
#include <iomanip>

static std::string g_upload_dir;
static sqlite3* g_db = nullptr;

static std::string get_media_secret() {
    const char* from_env = std::getenv("MEDIA_URL_SECRET");
    if (from_env && strlen(from_env) > 0) return from_env;
    const char* from_file_env = std::getenv("MEDIA_SECRET_FILE");
    std::string file_path = from_file_env ? from_file_env : ".media-secret";
    std::ifstream f(file_path);
    if (f.is_open()) {
        std::stringstream ss;
        ss << f.rdbuf();
        std::string secret = ss.str();
        while (!secret.empty() && (secret.back() == '\n' || secret.back() == '\r')) secret.pop_back();
        if (!secret.empty()) return secret;
    }
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(0, 255);
    std::stringstream ss;
    for (int i = 0; i < 32; i++) ss << std::hex << std::setw(2) << std::setfill('0') << dis(gen);
    return ss.str();
}

static std::string generate_uuid() {
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(0, 15);
    std::uniform_int_distribution<> dis2(0, 255);
    std::stringstream ss;
    ss << std::hex;
    for (int i = 0; i < 4; i++) { ss << dis(gen); ss << dis(gen); ss << dis(gen); ss << dis(gen); if (i < 3) ss << "-"; }
    ss << "-";
    for (int i = 0; i < 4; i++) { ss << dis(gen); ss << dis(gen); ss << dis(gen); ss << dis(gen); if (i < 3) ss << "-"; }
    ss << "-";
    ss << "4";
    for (int i = 0; i < 3; i++) ss << dis(gen); ss << dis(gen); ss << dis(gen); ss << dis(gen);
    ss << "-";
    ss << "89ab"[dis(gen) % 4];
    for (int i = 0; i < 3; i++) ss << dis(gen); ss << dis(gen); ss << dis(gen); ss << dis(gen);
    ss << "-";
    for (int i = 0; i < 6; i++) { ss << dis(gen); ss << dis(gen); ss << dis(gen); ss << dis(gen); ss << dis(gen); ss << dis(gen); ss << dis(gen); ss << dis(gen); }
    return ss.str();
}

VideoHandle videos_init(const char* upload_dir) {
    if (!upload_dir) return nullptr;
    g_upload_dir = upload_dir;

    const char* db_path_env = std::getenv("DATABASE_PATH");
    std::string db_path = db_path_env ? db_path_env : "data.db";

    int rc = sqlite3_open(db_path.c_str(), &g_db);
    if (rc != SQLITE_OK || !g_db) return nullptr;

    sqlite3_exec(g_db, "PRAGMA journal_mode = WAL;", nullptr, nullptr, nullptr);

    sqlite3_exec(g_db,
        "CREATE TABLE IF NOT EXISTS videos ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "user_id INTEGER NOT NULL,"
        "title TEXT NOT NULL,"
        "filename TEXT NOT NULL UNIQUE,"
        "size INTEGER NOT NULL,"
        "content_type TEXT NOT NULL,"
        "thumbnail_filename TEXT,"
        "created_at TEXT NOT NULL DEFAULT (datetime('now')));",
        nullptr, nullptr, nullptr);

    return reinterpret_cast<VideoHandle>(g_db);
}

void videos_close(VideoHandle handle) {
    if (g_db) {
        sqlite3_close(g_db);
        g_db = nullptr;
    }
}

static std::string escape_sqlite(const char* input) {
    std::string s = input;
    size_t pos = 0;
    while ((pos = s.find("'", pos)) != std::string::npos) {
        s.replace(pos, 1, "''");
        pos += 2;
    }
    return s;
}

const char* videos_generate_thumbnail(VideoHandle handle, const char* video_path, char* output, size_t output_len) {
    if (!video_path || !output) return nullptr;

    std::string thumb_name = std::string(generate_uuid()) + ".jpg";
    std::string thumb_path = g_upload_dir + "/" + thumb_name;

    std::string cmd = "ffmpeg -y -ss 00:00:01 -i \"" + std::string(video_path) + "\" -vframes 1 -q:v 2 \"" + thumb_path + "\" 2>/dev/null";
    int ret = system(cmd.c_str());

    if (ret != 0) {
        cmd = "ffmpeg -y -i \"" + std::string(video_path) + "\" -vframes 1 -q:v 2 \"" + thumb_path + "\" 2>/dev/null";
        ret = system(cmd.c_str());
    }

    struct stat st;
    if (stat(thumb_path.c_str(), &st) != 0 || st.st_size == 0) {
        unlink(thumb_path.c_str());
        return nullptr;
    }

    if (thumb_name.size() + 1 > output_len) return nullptr;
    strcpy(output, thumb_name.c_str());
    return output;
}

const char* videos_upload(VideoHandle handle, const char* video_path, const char* thumbnail_path, const char* title, const char* content_type, int user_id, char* output, size_t output_len) {
    if (!video_path || !title || !content_type || !output) return nullptr;

    std::string stored_name = std::string(generate_uuid()) + std::string(strrchr(video_path, '.') ? strrchr(video_path, '.') : ".mp4");
    std::string dest = g_upload_dir + "/" + stored_name;

    std::ifstream src(video_path, std::ios::binary);
    std::ofstream dst(dest, std::ios::binary);
    dst << src.rdbuf();
    src.close();
    dst.close();

    struct stat st;
    stat(dest.c_str(), &st);
    long long file_size = st.st_size;

    std::string thumb_filename;
    if (thumbnail_path && strlen(thumbnail_path) > 0) {
        std::string thumb_name = std::string(generate_uuid()) + std::string(strrchr(thumbnail_path, '.') ? strrchr(thumbnail_path, '.') : ".jpg");
        std::string thumb_dest = g_upload_dir + "/" + thumb_name;
        std::ifstream tsrc(thumbnail_path, std::ios::binary);
        std::ofstream tdst(thumb_dest, std::ios::binary);
        tdst << tsrc.rdbuf();
        tsrc.close();
        tdst.close();
        thumb_filename = thumb_name;
    } else {
        char thumb_buf[512];
        if (videos_generate_thumbnail(handle, dest.c_str(), thumb_buf, sizeof(thumb_buf))) {
            thumb_filename = thumb_buf;
        }
    }

    sqlite3_stmt* stmt;
    const char* sql = "INSERT INTO videos (user_id, title, filename, size, content_type, thumbnail_filename) VALUES (?, ?, ?, ?, ?, ?)";
    if (sqlite3_prepare_v2(g_db, sql, -1, &stmt, nullptr) != SQLITE_OK) return nullptr;

    sqlite3_bind_int(stmt, 1, user_id);
    sqlite3_bind_text(stmt, 2, title, -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 3, stored_name.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_int64(stmt, 4, file_size);
    sqlite3_bind_text(stmt, 5, content_type, -1, SQLITE_TRANSIENT);
    if (!thumb_filename.empty()) {
        sqlite3_bind_text(stmt, 6, thumb_filename.c_str(), -1, SQLITE_TRANSIENT);
    } else {
        sqlite3_bind_null(stmt, 6);
    }

    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE) return nullptr;

    int video_id = static_cast<int>(sqlite3_last_insert_rowid(g_db));

    char token[1024];
    mediatoken_sign(stored_name.c_str(), get_media_secret().c_str(), token, sizeof(token));

    std::stringstream ss;
    ss << "{\"id\":" << video_id
       << ",\"title\":\"" << escape_sqlite(title) << "\""
       << ",\"filename\":\"" << stored_name << "\""
       << ",\"size\":" << file_size
       << ",\"content_type\":\"" << content_type << "\""
       << ",\"thumbnail_filename\":\"" << (thumb_filename.empty() ? "" : thumb_filename) << "\""
       << ",\"url\":\"" << token << "\"}";

    std::string result = ss.str();
    if (result.size() + 1 > output_len) return nullptr;
    strcpy(output, result.c_str());
    return output;
}

const char* videos_get(VideoHandle handle, int id, char* output, size_t output_len) {
    if (!output) return nullptr;

    sqlite3_stmt* stmt;
    const char* sql = "SELECT id, user_id, title, filename, size, content_type, thumbnail_filename, created_at FROM videos WHERE id = ?";
    if (sqlite3_prepare_v2(g_db, sql, -1, &stmt, nullptr) != SQLITE_OK) return nullptr;

    sqlite3_bind_int(stmt, 1, id);

    int rc = sqlite3_step(stmt);
    if (rc == SQLITE_ROW) {
        int vid = sqlite3_column_int(stmt, 0);
        int uid = sqlite3_column_int(stmt, 1);
        const char* title = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));
        const char* filename = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 3));
        long long size = sqlite3_column_int64(stmt, 4);
        const char* content_type = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 5));
        const char* thumb = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 6));
        const char* created = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 7));

        char token[1024];
        mediatoken_sign(filename ? filename : "", get_media_secret().c_str(), token, sizeof(token));

        std::stringstream ss;
        ss << "{\"id\":" << vid
           << ",\"user_id\":" << uid
           << ",\"title\":\"" << (title ? title : "") << "\""
           << ",\"filename\":\"" << (filename ? filename : "") << "\""
           << ",\"size\":" << size
           << ",\"content_type\":\"" << (content_type ? content_type : "") << "\""
           << ",\"thumbnail_filename\":\"" << (thumb ? thumb : "") << "\""
           << ",\"url\":\"" << token << "\""
           << ",\"created_at\":\"" << (created ? created : "") << "\"}";

        std::string result = ss.str();
        sqlite3_finalize(stmt);
        if (result.size() + 1 > output_len) return nullptr;
        strcpy(output, result.c_str());
        return output;
    }

    sqlite3_finalize(stmt);
    return nullptr;
}

const char* videos_list(VideoHandle handle, const char* query, char* output, size_t output_len) {
    if (!output) return nullptr;

    std::string sql = "SELECT id, user_id, title, filename, size, content_type, thumbnail_filename, created_at FROM videos";
    if (query && strlen(query) > 0) {
        sql += " WHERE title LIKE '%' || ? || '%' ESCAPE '\\'";
    }
    sql += " ORDER BY created_at DESC, id DESC";

    sqlite3_stmt* stmt;
    if (sqlite3_prepare_v2(g_db, sql.c_str(), -1, &stmt, nullptr) != SQLITE_OK) return nullptr;

    if (query && strlen(query) > 0) {
        std::string escaped = query;
        size_t pos = 0;
        while ((pos = escaped.find("\\", pos)) != std::string::npos) { escaped.replace(pos, 1, "\\\\"); pos += 2; }
        pos = 0;
        while ((pos = escaped.find("%", pos)) != std::string::npos) { escaped.replace(pos, 1, "\\%"); pos += 2; }
        pos = 0;
        while ((pos = escaped.find("_", pos)) != std::string::npos) { escaped.replace(pos, 1, "\\_"); pos += 2; }
        sqlite3_bind_text(stmt, 1, escaped.c_str(), -1, SQLITE_TRANSIENT);
    }

    std::string result = "[";
    int first = 1;
    while (sqlite3_step(stmt) == SQLITE_ROW) {
        if (!first) result += ",";
        first = 0;

        int vid = sqlite3_column_int(stmt, 0);
        int uid = sqlite3_column_int(stmt, 1);
        const char* title = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));
        const char* filename = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 3));
        long long size = sqlite3_column_int64(stmt, 4);
        const char* content_type = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 5));
        const char* thumb = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 6));
        const char* created = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 7));

        char token[1024];
        mediatoken_sign(filename ? filename : "", get_media_secret().c_str(), token, sizeof(token));

        result += "{\"id\":" + std::to_string(vid) +
                  ",\"user_id\":" + std::to_string(uid) +
                  ",\"title\":\"" + (title ? title : "") + "\"" +
                  ",\"filename\":\"" + (filename ? filename : "") + "\"" +
                  ",\"size\":" + std::to_string(size) +
                  ",\"content_type\":\"" + (content_type ? content_type : "") + "\"" +
                  ",\"thumbnail_filename\":\"" + (thumb ? thumb : "") + "\"" +
                  ",\"url\":\"" + token + "\"" +
                  ",\"created_at\":\"" + (created ? created : "") + "\"}";
    }
    result += "]";

    sqlite3_finalize(stmt);
    if (result.size() + 1 > output_len) return nullptr;
    strcpy(output, result.c_str());
    return output;
}

int videos_delete(VideoHandle handle, int id, int user_id) {
    if (!g_db) return -1;

    sqlite3_stmt* stmt;
    const char* sql = "SELECT filename, thumbnail_filename FROM videos WHERE id = ? AND user_id = ?";
    if (sqlite3_prepare_v2(g_db, sql, -1, &stmt, nullptr) != SQLITE_OK) return -1;

    sqlite3_bind_int(stmt, 1, id);
    sqlite3_bind_int(stmt, 2, user_id);

    int rc = sqlite3_step(stmt);
    if (rc != SQLITE_ROW) {
        sqlite3_finalize(stmt);
        return -1;
    }

    const char* filename = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
    const char* thumb = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
    sqlite3_finalize(stmt);

    if (filename) {
        std::string fpath = g_upload_dir + "/" + filename;
        unlink(fpath.c_str());
    }
    if (thumb && strlen(thumb) > 0) {
        std::string tpath = g_upload_dir + "/" + thumb;
        unlink(tpath.c_str());
    }

    sqlite3_stmt* del_stmt;
    const char* del_sql = "DELETE FROM videos WHERE id = ?";
    if (sqlite3_prepare_v2(g_db, del_sql, -1, &del_stmt, nullptr) != SQLITE_OK) return -1;
    sqlite3_bind_int(del_stmt, 1, id);
    rc = sqlite3_step(del_stmt);
    sqlite3_finalize(del_stmt);

    return (rc == SQLITE_DONE) ? 0 : -1;
}

const char* videos_serve_media(VideoHandle handle, const char* filename, const char* range_header, long long* content_length, int* status, char* content_type_out, size_t content_type_len, char* output, size_t output_len) {
    if (!filename || !content_length || !status) return nullptr;

    std::string filepath = g_upload_dir + "/" + filename;
    struct stat st;
    if (stat(filepath.c_str(), &st) != 0) {
        *status = 404;
        return nullptr;
    }

    *content_length = st.st_size;
    *status = 200;

    const char* ct = "video/mp4";
    const char* ext = strrchr(filename, '.');
    if (ext) {
        if (strcmp(ext, ".webm") == 0) ct = "video/webm";
        else if (strcmp(ext, ".mkv") == 0) ct = "video/x-matroska";
        else if (strcmp(ext, ".avi") == 0) ct = "video/x-msvideo";
        else if (strcmp(ext, ".m3u8") == 0) ct = "application/vnd.apple.mpegurl";
        else if (strcmp(ext, ".mpd") == 0) ct = "application/dash+xml";
    }

    if (content_type_out && content_type_len > 0) {
        strncpy(content_type_out, ct, content_type_len - 1);
        content_type_out[content_type_len - 1] = '\0';
    }

    if (range_header && strlen(range_header) > 0) {
        *status = 206;
    }

    std::ifstream file(filepath, std::ios::binary);
    if (!file.is_open()) return nullptr;

    size_t to_read = output_len - 1;
    if (to_read > static_cast<size_t>(*content_length)) to_read = static_cast<size_t>(*content_length);

    file.read(output, to_read);
    size_t bytes_read = static_cast<size_t>(file.gcount());
    output[bytes_read] = '\0';
    file.close();

    return output;
}