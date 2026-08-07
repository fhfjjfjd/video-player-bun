#include "db.h"
#include <sqlite3.h>
#include <cctype>
#include <cstring>
#include <sstream>
#include <string>

static std::string escape_sqlite(const char* input) {
    std::string s = input;
    size_t pos = 0;
    while ((pos = s.find("'", pos)) != std::string::npos) {
        s.replace(pos, 1, "''");
        pos += 2;
    }
    return s;
}

extern "C" {

DBHandle g_db = nullptr;

DBHandle db_init(const char* db_path) {
    sqlite3* db = nullptr;
    int rc = sqlite3_open(db_path, &db);
    if (rc != SQLITE_OK || !db) return nullptr;
    g_db = db;

    sqlite3_exec(db, "PRAGMA journal_mode = WAL;", nullptr, nullptr, nullptr);

    sqlite3_exec(db,
        "CREATE TABLE IF NOT EXISTS users ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "username TEXT NOT NULL UNIQUE,"
        "password_hash TEXT NOT NULL,"
        "email TEXT,"
        "created_at TEXT NOT NULL DEFAULT (datetime('now')));",
        nullptr, nullptr, nullptr);

    sqlite3_exec(db,
        "CREATE TABLE IF NOT EXISTS sessions ("
        "token TEXT PRIMARY KEY,"
        "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,"
        "created_at TEXT NOT NULL DEFAULT (datetime('now')),"
        "expires_at TEXT NOT NULL);",
        nullptr, nullptr, nullptr);

    sqlite3_exec(db,
        "CREATE TABLE IF NOT EXISTS videos ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,"
        "title TEXT NOT NULL,"
        "filename TEXT NOT NULL UNIQUE,"
        "size INTEGER NOT NULL,"
        "content_type TEXT NOT NULL,"
        "thumbnail_filename TEXT,"
        "created_at TEXT NOT NULL DEFAULT (datetime('now')));",
        nullptr, nullptr, nullptr);

    sqlite3_exec(db,
        "CREATE TABLE IF NOT EXISTS feedback ("
        "id TEXT PRIMARY KEY,"
        "type TEXT NOT NULL,"
        "title TEXT NOT NULL,"
        "body TEXT NOT NULL,"
        "status TEXT NOT NULL DEFAULT 'open',"
        "created_at TEXT NOT NULL DEFAULT (datetime('now')),"
        "author TEXT);",
        nullptr, nullptr, nullptr);

    int userCols = 0;
    sqlite3_stmt* stmt;
    if (sqlite3_prepare_v2(db, "PRAGMA table_info(users)", -1, &stmt, nullptr) == SQLITE_OK) {
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            userCols++;
        }
        sqlite3_finalize(stmt);
    }

    return db;
}

void db_close(DBHandle db) {
    if (db) sqlite3_close(static_cast<sqlite3*>(db));
}

int db_create_user(const char* username, const char* email, const char* password_hash, int* user_id_out) {
    if (!g_db || !username || !password_hash || !user_id_out) return -1;
    sqlite3* db = static_cast<sqlite3*>(g_db);

    sqlite3_stmt* stmt;
    const char* sql = "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) return -1;

    sqlite3_bind_text(stmt, 1, username, -1, SQLITE_TRANSIENT);
    if (email && strlen(email) > 0) {
        sqlite3_bind_text(stmt, 2, email, -1, SQLITE_TRANSIENT);
    } else {
        sqlite3_bind_null(stmt, 2);
    }
    sqlite3_bind_text(stmt, 3, password_hash, -1, SQLITE_TRANSIENT);

    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE) return -1;
    *user_id_out = static_cast<int>(sqlite3_last_insert_rowid(db));
    return 0;
}

int db_find_user_by_username(const char* username, char* email_out, size_t email_len, char* hash_out, size_t hash_len) {
    if (!g_db || !username) return -1;
    sqlite3* db = static_cast<sqlite3*>(g_db);

    sqlite3_stmt* stmt;
    const char* sql = "SELECT email, password_hash FROM users WHERE username = ?";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) return -1;

    sqlite3_bind_text(stmt, 1, username, -1, SQLITE_TRANSIENT);

    int rc = sqlite3_step(stmt);
    if (rc == SQLITE_ROW) {
        const char* email = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
        const char* hash = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
        if (email && email_out && email_len > 0) {
            strncpy(email_out, email, email_len - 1);
            email_out[email_len - 1] = '\0';
        }
        if (hash && hash_out && hash_len > 0) {
            strncpy(hash_out, hash, hash_len - 1);
            hash_out[hash_len - 1] = '\0';
        }
        sqlite3_finalize(stmt);
        return 0;
    }

    sqlite3_finalize(stmt);
    return -1;
}

int db_find_user_by_email(const char* email, char* username_out, size_t username_len, char* hash_out, size_t hash_len) {
    if (!g_db || !email) return -1;
    sqlite3* db = static_cast<sqlite3*>(g_db);

    sqlite3_stmt* stmt;
    const char* sql = "SELECT username, password_hash FROM users WHERE email = ?";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) return -1;

    std::string lower_email = email;
    for (auto& c : lower_email) c = tolower(c);
    sqlite3_bind_text(stmt, 1, lower_email.c_str(), -1, SQLITE_TRANSIENT);

    int rc = sqlite3_step(stmt);
    if (rc == SQLITE_ROW) {
        const char* uname = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
        const char* hash = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
        if (uname && username_out && username_len > 0) {
            strncpy(username_out, uname, username_len - 1);
            username_out[username_len - 1] = '\0';
        }
        if (hash && hash_out && hash_len > 0) {
            strncpy(hash_out, hash, hash_len - 1);
            hash_out[hash_len - 1] = '\0';
        }
        sqlite3_finalize(stmt);
        return 0;
    }

    sqlite3_finalize(stmt);
    return -1;
}

int db_find_user_by_identifier(const char* identifier, char* username_out, size_t username_len, char* email_out, size_t email_len, char* hash_out, size_t hash_len) {
    if (!g_db || !identifier) return -1;
    sqlite3* db = static_cast<sqlite3*>(g_db);

    int has_at = (strchr(identifier, '@') != nullptr);
    sqlite3_stmt* stmt;
    const char* sql;

    if (has_at) {
        sql = "SELECT username, email, password_hash FROM users WHERE email = ?";
    } else {
        sql = "SELECT username, email, password_hash FROM users WHERE username = ?";
    }

    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) return -1;

    std::string search = identifier;
    if (has_at) {
        for (auto& c : search) c = tolower(c);
    }
    sqlite3_bind_text(stmt, 1, search.c_str(), -1, SQLITE_TRANSIENT);

    int rc = sqlite3_step(stmt);
    if (rc == SQLITE_ROW) {
        const char* uname = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
        const char* email = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
        const char* hash = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));

        if (uname && username_out && username_len > 0) {
            strncpy(username_out, uname, username_len - 1);
            username_out[username_len - 1] = '\0';
        }
        if (email && email_out && email_len > 0) {
            strncpy(email_out, email ? email : "", email_len - 1);
            email_out[email_len - 1] = '\0';
        }
        if (hash && hash_out && hash_len > 0) {
            strncpy(hash_out, hash, hash_len - 1);
            hash_out[hash_len - 1] = '\0';
        }
        sqlite3_finalize(stmt);
        return 0;
    }

    sqlite3_finalize(stmt);
    return -1;
}

int db_find_user_by_id(int user_id, char* output, size_t output_len) {
    if (!g_db || user_id <= 0 || !output) return -1;
    sqlite3* db = static_cast<sqlite3*>(g_db);

    sqlite3_stmt* stmt;
    const char* sql = "SELECT id, username, email FROM users WHERE id = ?";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) return -1;

    sqlite3_bind_int(stmt, 1, user_id);

    int rc = sqlite3_step(stmt);
    if (rc == SQLITE_ROW) {
        int uid = sqlite3_column_int(stmt, 0);
        const char* uname = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
        const char* email = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));

        std::string result = "{\"id\":" + std::to_string(uid) +
                             ",\"username\":\"" + (uname ? uname : "") + "\"" +
                             ",\"email\":\"" + (email ? email : "") + "\"}";

        if (result.size() + 1 > output_len) {
            sqlite3_finalize(stmt);
            return -1;
        }
        strcpy(output, result.c_str());
        sqlite3_finalize(stmt);
        return 0;
    }

    sqlite3_finalize(stmt);
    return -1;
}

int db_get_user_id_by_username(const char* username, int* user_id_out) {
    if (!g_db || !username || !user_id_out) return -1;
    sqlite3* db = static_cast<sqlite3*>(g_db);

    sqlite3_stmt* stmt;
    const char* sql = "SELECT id FROM users WHERE username = ?";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) return -1;

    sqlite3_bind_text(stmt, 1, username, -1, SQLITE_TRANSIENT);

    int rc = sqlite3_step(stmt);
    if (rc == SQLITE_ROW) {
        *user_id_out = sqlite3_column_int(stmt, 0);
        sqlite3_finalize(stmt);
        return 0;
    }

    sqlite3_finalize(stmt);
    return -1;
}

int db_create_session(int user_id, const char* token, const char* expires_at) {
    if (!g_db || !token || !expires_at) return -1;
    sqlite3* db = static_cast<sqlite3*>(g_db);

    sqlite3_stmt* stmt;
    const char* sql = "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) return -1;

    sqlite3_bind_text(stmt, 1, token, -1, SQLITE_TRANSIENT);
    sqlite3_bind_int(stmt, 2, user_id);
    sqlite3_bind_text(stmt, 3, expires_at, -1, SQLITE_TRANSIENT);

    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);
    return (rc == SQLITE_DONE) ? 0 : -1;
}

int db_find_user_by_session_token(const char* token, int* user_id_out) {
    if (!g_db || !token || !user_id_out) return -1;
    sqlite3* db = static_cast<sqlite3*>(g_db);

    sqlite3_stmt* stmt;
    const char* sql = "SELECT u.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > datetime('now')";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) return -1;

    sqlite3_bind_text(stmt, 1, token, -1, SQLITE_TRANSIENT);

    int rc = sqlite3_step(stmt);
    if (rc == SQLITE_ROW) {
        *user_id_out = sqlite3_column_int(stmt, 0);
        sqlite3_finalize(stmt);
        return 0;
    }

    sqlite3_finalize(stmt);
    return -1;
}

int db_delete_session(const char* token) {
    if (!g_db || !token) return -1;
    sqlite3* db = static_cast<sqlite3*>(g_db);

    sqlite3_stmt* stmt;
    const char* sql = "DELETE FROM sessions WHERE token = ?";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) return -1;

    sqlite3_bind_text(stmt, 1, token, -1, SQLITE_TRANSIENT);

    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);
    return (rc == SQLITE_DONE) ? 0 : -1;
}

int db_create_video(int user_id, const char* title, const char* filename, long long size, const char* content_type, const char* thumbnail_filename, int* video_id_out) {
    if (!g_db || !title || !filename || !content_type || !video_id_out) return -1;
    sqlite3* db = static_cast<sqlite3*>(g_db);

    sqlite3_stmt* stmt;
    const char* sql = "INSERT INTO videos (user_id, title, filename, size, content_type, thumbnail_filename) VALUES (?, ?, ?, ?, ?, ?)";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) return -1;

    sqlite3_bind_int(stmt, 1, user_id);
    sqlite3_bind_text(stmt, 2, title, -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 3, filename, -1, SQLITE_TRANSIENT);
    sqlite3_bind_int64(stmt, 4, size);
    sqlite3_bind_text(stmt, 5, content_type, -1, SQLITE_TRANSIENT);
    if (thumbnail_filename && strlen(thumbnail_filename) > 0) {
        sqlite3_bind_text(stmt, 6, thumbnail_filename, -1, SQLITE_TRANSIENT);
    } else {
        sqlite3_bind_null(stmt, 6);
    }

    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE) return -1;
    *video_id_out = static_cast<int>(sqlite3_last_insert_rowid(db));
    return 0;
}

int db_list_all_videos(const char* query, char* output, size_t output_len) {
    if (!g_db || !output) return -1;
    sqlite3* db = static_cast<sqlite3*>(g_db);

    std::string sql = "SELECT id, user_id, title, filename, size, content_type, thumbnail_filename, created_at FROM videos";
    if (query && strlen(query) > 0) {
        sql += " WHERE title LIKE '%' || ? || '%' ESCAPE '\\'";
    }
    sql += " ORDER BY created_at DESC, id DESC";

    sqlite3_stmt* stmt;
    if (sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr) != SQLITE_OK) return -1;

    if (query && strlen(query) > 0) {
        std::string escaped = query;
        size_t pos = 0;
        while ((pos = escaped.find("\\", pos)) != std::string::npos) {
            escaped.replace(pos, 1, "\\\\");
            pos += 2;
        }
        pos = 0;
        while ((pos = escaped.find("%", pos)) != std::string::npos) {
            escaped.replace(pos, 1, "\\%");
            pos += 2;
        }
        pos = 0;
        while ((pos = escaped.find("_", pos)) != std::string::npos) {
            escaped.replace(pos, 1, "\\_");
            pos += 2;
        }
        sqlite3_bind_text(stmt, 1, escaped.c_str(), -1, SQLITE_TRANSIENT);
    }

    std::string result = "[";
    int first = 1;
    while (sqlite3_step(stmt) == SQLITE_ROW) {
        if (!first) result += ",";
        first = 0;

        int id = sqlite3_column_int(stmt, 0);
        int uid = sqlite3_column_int(stmt, 1);
        const char* title = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));
        const char* filename = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 3));
        long long size = sqlite3_column_int64(stmt, 4);
        const char* content_type = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 5));
        const char* thumb = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 6));
        const char* created = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 7));

        result += "{\"id\":" + std::to_string(id) +
                  ",\"user_id\":" + std::to_string(uid) +
                  ",\"title\":\"" + (title ? title : "") + "\"" +
                  ",\"filename\":\"" + (filename ? filename : "") + "\"" +
                  ",\"size\":" + std::to_string(size) +
                  ",\"content_type\":\"" + (content_type ? content_type : "") + "\"" +
                  ",\"thumbnail_filename\":\"" + (thumb ? thumb : "") + "\"" +
                  ",\"created_at\":\"" + (created ? created : "") + "\"}";
    }
    result += "]";

    sqlite3_finalize(stmt);

    if (result.size() + 1 > output_len) return -1;
    strcpy(output, result.c_str());
    return 0;
}

int db_find_video_by_id(int id, char* output, size_t output_len) {
    if (!g_db || !output) return -1;
    sqlite3* db = static_cast<sqlite3*>(g_db);

    sqlite3_stmt* stmt;
    const char* sql = "SELECT id, user_id, title, filename, size, content_type, thumbnail_filename, created_at FROM videos WHERE id = ?";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) return -1;

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

        std::string result = "{\"id\":" + std::to_string(vid) +
                             ",\"user_id\":" + std::to_string(uid) +
                             ",\"title\":\"" + (title ? title : "") + "\"" +
                             ",\"filename\":\"" + (filename ? filename : "") + "\"" +
                             ",\"size\":" + std::to_string(size) +
                             ",\"content_type\":\"" + (content_type ? content_type : "") + "\"" +
                             ",\"thumbnail_filename\":\"" + (thumb ? thumb : "") + "\"" +
                             ",\"created_at\":\"" + (created ? created : "") + "\"}";

        if (result.size() + 1 > output_len) {
            sqlite3_finalize(stmt);
            return -1;
        }
        strcpy(output, result.c_str());
        sqlite3_finalize(stmt);
        return 0;
    }

    sqlite3_finalize(stmt);
    return -1;
}

int db_find_video_by_id_and_user(int id, int user_id, char* output, size_t output_len) {
    if (!g_db) return -1;
    sqlite3* db = static_cast<sqlite3*>(g_db);

    sqlite3_stmt* stmt;
    const char* sql = "SELECT id, user_id, title, filename, size, content_type, thumbnail_filename, created_at FROM videos WHERE id = ? AND user_id = ?";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) return -1;

    sqlite3_bind_int(stmt, 1, id);
    sqlite3_bind_int(stmt, 2, user_id);

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

        std::string result = "{\"id\":" + std::to_string(vid) +
                             ",\"user_id\":" + std::to_string(uid) +
                             ",\"title\":\"" + (title ? title : "") + "\"" +
                             ",\"filename\":\"" + (filename ? filename : "") + "\"" +
                             ",\"size\":" + std::to_string(size) +
                             ",\"content_type\":\"" + (content_type ? content_type : "") + "\"" +
                             ",\"thumbnail_filename\":\"" + (thumb ? thumb : "") + "\"" +
                             ",\"created_at\":\"" + (created ? created : "") + "\"}";

        if (result.size() + 1 > output_len) {
            sqlite3_finalize(stmt);
            return -1;
        }
        strcpy(output, result.c_str());
        sqlite3_finalize(stmt);
        return 0;
    }

    sqlite3_finalize(stmt);
    return -1;
}

int db_find_video_by_filename(const char* filename, char* output, size_t output_len) {
    if (!g_db || !filename || !output) return -1;
    sqlite3* db = static_cast<sqlite3*>(g_db);

    sqlite3_stmt* stmt;
    const char* sql = "SELECT id, user_id, title, filename, size, content_type, thumbnail_filename, created_at FROM videos WHERE filename = ?";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) return -1;

    sqlite3_bind_text(stmt, 1, filename, -1, SQLITE_TRANSIENT);

    int rc = sqlite3_step(stmt);
    if (rc == SQLITE_ROW) {
        int vid = sqlite3_column_int(stmt, 0);
        int uid = sqlite3_column_int(stmt, 1);
        const char* title = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));
        const char* fname = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 3));
        long long size = sqlite3_column_int64(stmt, 4);
        const char* content_type = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 5));
        const char* thumb = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 6));
        const char* created = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 7));

        std::string result = "{\"id\":" + std::to_string(vid) +
                             ",\"user_id\":" + std::to_string(uid) +
                             ",\"title\":\"" + (title ? title : "") + "\"" +
                             ",\"filename\":\"" + (fname ? fname : "") + "\"" +
                             ",\"size\":" + std::to_string(size) +
                             ",\"content_type\":\"" + (content_type ? content_type : "") + "\"" +
                             ",\"thumbnail_filename\":\"" + (thumb ? thumb : "") + "\"" +
                             ",\"created_at\":\"" + (created ? created : "") + "\"}";

        if (result.size() + 1 > output_len) {
            sqlite3_finalize(stmt);
            return -1;
        }
        strcpy(output, result.c_str());
        sqlite3_finalize(stmt);
        return 0;
    }

    sqlite3_finalize(stmt);
    return -1;
}

int db_delete_video(int id) {
    if (!g_db) return -1;
    sqlite3* db = static_cast<sqlite3*>(g_db);

    sqlite3_stmt* stmt;
    const char* sql = "DELETE FROM videos WHERE id = ?";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) return -1;

    sqlite3_bind_int(stmt, 1, id);

    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);
    return (rc == SQLITE_DONE) ? 0 : -1;
}

}