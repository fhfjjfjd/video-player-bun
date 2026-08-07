#include "server_handlers.h"
#include "server.h"
#include "db.h"
#include "auth.h"
#include "mediatoken.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "platform.h"
#include <sys/stat.h>
#include <fcntl.h>

#define SESSION_COOKIE "session"
#define SESSION_TTL_SEC 2592000
#define MEDIA_SECRET_FILE ".media-secret"
#define MAX_UPLOAD_SIZE (1024LL * 1024 * 1024)

static char g_media_secret[128] = "";

static void load_media_secret(void) {
    const char* env = getenv("MEDIA_URL_SECRET");
    if (env && strlen(env) > 0) {
        strncpy(g_media_secret, env, sizeof(g_media_secret) - 1);
        return;
    }
    const char* file_env = getenv("MEDIA_SECRET_FILE");
    const char* file = file_env ? file_env : MEDIA_SECRET_FILE;
    FILE* f = fopen(file, "r");
    if (f) {
        if (fgets(g_media_secret, sizeof(g_media_secret), f)) {
            size_t len = strlen(g_media_secret);
            while (len > 0 && (g_media_secret[len - 1] == '\n' || g_media_secret[len - 1] == '\r')) {
                g_media_secret[--len] = '\0';
            }
        }
        fclose(f);
        if (strlen(g_media_secret) > 0) return;
    }
    strcpy(g_media_secret, "media_secret_fallback");
}

static const char* get_secret(void) {
    return g_media_secret;
}

static char* get_cookie_value(HttpRequest* req, const char* name) {
    char* cookie = find_header(req, "Cookie");
    if (!cookie) return NULL;
    size_t name_len = strlen(name);

    char* p = cookie;
    while (*p) {
        while (*p == ' ' || *p == ';') p++;
        if (strncasecmp(p, name, name_len) == 0 && (p[name_len] == '=' || p[name_len] == '\0' || p[name_len] == ';')) {
            p += name_len;
            if (*p == '=') p++;
            char* start = p;
            char* end = start;
            while (*end && *end != ';') end++;
            size_t len = end - start;
            static char value[2048];
            if (len >= sizeof(value)) len = sizeof(value) - 1;
            memcpy(value, start, len);
            value[len] = '\0';
            return value;
        }
        while (*p && *p != ';') p++;
    }
    return NULL;
}

static char* get_query_param(const char* query, const char* name) {
    if (!query) return NULL;
    static char value[1024];
    size_t name_len = strlen(name);
    const char* p = query;
    while (*p) {
        const char* amp = strchr(p, '&');
        size_t seg_len = amp ? (size_t)(amp - p) : strlen(p);
        if (seg_len > name_len && strncmp(p, name, name_len) == 0 && p[name_len] == '=') {
            const char* val_start = p + name_len + 1;
            size_t val_len = seg_len - name_len - 1;
            if (val_len >= sizeof(value)) val_len = sizeof(value) - 1;
            memcpy(value, val_start, val_len);
            value[val_len] = '\0';

            char* out = value;
            const char* in = value;
            size_t j = 0;
            for (size_t i = 0; in[i] && j < sizeof(value) - 1; i++) {
                if (in[i] == '%' && in[i + 1] && in[i + 2]) {
                    char hex[3] = {in[i + 1], in[i + 2], 0};
                    out[j++] = (char)strtol(hex, NULL, 16);
                    i += 2;
                } else if (in[i] == '+') {
                    out[j++] = ' ';
                } else {
                    out[j++] = in[i];
                }
            }
            out[j] = '\0';
            return value;
        }
        if (!amp) break;
        p = amp + 1;
    }
    return NULL;
}

static void set_cookie_header(HttpResponse* res, const char* token) {
    char cookie[1024];
    snprintf(cookie, sizeof(cookie),
        "%s=%s; Path=/; HttpOnly; SameSite=Lax; Max-Age=%d",
        SESSION_COOKIE, token, SESSION_TTL_SEC);
    response_set_header(res, "Set-Cookie", cookie);
}

static void clear_cookie_header(HttpResponse* res) {
    char cookie[256];
    snprintf(cookie, sizeof(cookie), "%s=; Path=/; Max-Age=0", SESSION_COOKIE);
    response_set_header(res, "Set-Cookie", cookie);
}

static int extract_user_id(HttpRequest* req) {
    char* token = get_cookie_value(req, SESSION_COOKIE);
    if (!token) return -1;
    int user_id = -1;
    if (auth_validate_session(token, get_secret(), &user_id) != 0) return -1;
    return user_id;
}

static char* read_body(HttpRequest* req) {
    if (req->body_len == 0) return NULL;
    char* copy = (char*)malloc(req->body_len + 1);
    if (!copy) return NULL;
    memcpy(copy, req->body, req->body_len);
    copy[req->body_len] = '\0';
    return copy;
}

static const char* get_json_field(const char* json, const char* key) {
    static char value[1024];
    if (!json) return NULL;
    char search[256];
    snprintf(search, sizeof(search), "\"%s\"", key);
    const char* p = strstr(json, search);
    if (!p) return NULL;
    p += strlen(search);
    while (*p && (*p == ' ' || *p == ':' || *p == '"')) p++;
    if (*p != '"') return NULL;
    p++;
    size_t i = 0;
    while (*p && *p != '"' && i < sizeof(value) - 1) {
        if (*p == '\\' && *(p + 1)) {
            p++;
            switch (*p) {
                case 'n': value[i++] = '\n'; break;
                case 't': value[i++] = '\t'; break;
                case 'r': value[i++] = '\r'; break;
                case '"': value[i++] = '"'; break;
                case '\\': value[i++] = '\\'; break;
                case '/': value[i++] = '/'; break;
                default: value[i++] = *p; break;
            }
        } else {
            value[i++] = *p;
        }
        p++;
    }
    value[i] = '\0';
    return value;
}

static HttpResponse* make_json(int status, const char* body) {
    HttpResponse* res = (HttpResponse*)malloc(sizeof(HttpResponse));
    response_init(res);
    res->status_code = status;
    res->body = strdup(body);
    res->body_len = strlen(res->body);
    return res;
}

HttpResponse* handle_health(HttpRequest* req, RouteParam* rp) {
    (void)req;
    (void)rp;
    char body[128];
    snprintf(body, sizeof(body), "{\"status\":\"ok\",\"uptime\":%.0f}", (double)time(NULL));
    return make_json(200, body);
}

HttpResponse* handle_hello(HttpRequest* req, RouteParam* rp) {
    (void)rp;
    char body[256];
    snprintf(body, sizeof(body), "{\"message\":\"Hello, world!\",\"method\":\"%s\"}", req->method);
    return make_json(200, body);
}

HttpResponse* handle_hello_name(HttpRequest* req, RouteParam* rp) {
    (void)req;
    const char* name = (const char*)rp->user_data;
    char body[1024];
    snprintf(body, sizeof(body), "{\"message\":\"Hello, %s!\"}", name ? name : "");
    return make_json(200, body);
}

HttpResponse* handle_register(HttpRequest* req, RouteParam* rp) {
    (void)rp;
    char* body = read_body(req);
    if (!body) return make_json(400, "{\"error\":\"Body JSON kh\\u00f4ng h\\u1ee3p l\\u1ec7.\"}");

    const char* username = get_json_field(body, "username");
    const char* email = get_json_field(body, "email");
    const char* password = get_json_field(body, "password");

    if (!username || !password) {
        free(body);
        return make_json(400, "{\"error\":\"Thi\\u1ebfu username ho\\u1eb7c password.\"}");
    }

    size_t uname_len = strlen(username);
    int valid = 1;
    for (size_t i = 0; i < uname_len; i++) {
        char c = username[i];
        if (!((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_')) {
            valid = 0;
            break;
        }
    }
    if (!valid || uname_len < 3 || uname_len > 32) {
        free(body);
        return make_json(400, "{\"error\":\"Username ph\\u1ea3i g\\u1ed3m 3\\u201332 k\\u00fd t\\u1ef1 ch\\u1eef, s\\u1ed1 ho\\u1eb7c g\\u1ea1ch d\\u01b0\\u1edbi.\"}");
    }

    if (strlen(password) < 6) {
        free(body);
        return make_json(400, "{\"error\":\"Password ph\\u1ea3i c\\u00f3 \\u00edt nh\\u1ea5t 6 k\\u00fd t\\u1ef1.\"}");
    }

    if (!email || strlen(email) < 1 || strstr(email, "@gmail.com") == NULL) {
        free(body);
        return make_json(400, "{\"error\":\"Email ph\\u1ea3i l\\u00e0 t\\u00e0i kho\\u1ea3n Gmail h\\u1ee3p l\\u1ec7 (\\u2026@gmail.com).\"}");
    }

    char username_out[256] = {0};
    char hash_out[256] = {0};
    if (db_find_user_by_username(username, username_out, sizeof(username_out), hash_out, sizeof(hash_out)) == 0) {
        free(body);
        return make_json(409, "{\"error\":\"Username \\u0111\\u00e3 t\\u1ed3n t\\u1ea1i.\"}");
    }
    if (db_find_user_by_email(email, username_out, sizeof(username_out), hash_out, sizeof(hash_out)) == 0) {
        free(body);
        return make_json(409, "{\"error\":\"Email Gmail n\\u00e0y \\u0111\\u00e3 \\u0111\\u01b0\\u1ee3c d\\u00f9ng \\u0111\\u1ec3 \\u0111\\u0103ng k\\u00fd.\"}");
    }

    char hash[256];
    if (!auth_hash_password(password, hash, sizeof(hash))) {
        free(body);
        return make_json(500, "{\"error\":\"Failed to hash password\"}");
    }

    int user_id = 0;
    int result = db_create_user(username, email, hash, &user_id);
    free(body);

    if (result != 0) {
        return make_json(500, "{\"error\":\"Failed to create user\"}");
    }

    return make_json(201, "{\"ok\":true}");
}

HttpResponse* handle_login(HttpRequest* req, RouteParam* rp) {
    (void)rp;
    char* body = read_body(req);
    if (!body) return make_json(400, "{\"error\":\"Body JSON kh\\u00f4ng h\\u1ee3p l\\u1ec7.\"}");

    const char* identifier = get_json_field(body, "username");
    const char* password = get_json_field(body, "password");

    if (!identifier || !password) {
        free(body);
        return make_json(400, "{\"error\":\"Thi\\u1ebfu Gmail/username ho\\u1eb7c password.\"}");
    }

    if (strlen(password) < 6) {
        free(body);
        return make_json(400, "{\"error\":\"Password ph\\u1ea3i c\\u00f3 \\u00edt nh\\u1ea5t 6 k\\u00fd t\\u1ef1.\"}");
    }

    char username_out[256] = {0};
    char email_out[256] = {0};
    char hash_out[256] = {0};
    int found = db_find_user_by_identifier(identifier, username_out, sizeof(username_out),
                                            email_out, sizeof(email_out), hash_out, sizeof(hash_out));
    free(body);

    if (found != 0 || strlen(hash_out) == 0) {
        return make_json(401, "{\"error\":\"Sai Gmail/username ho\\u1eb7c password.\"}");
    }

    if (auth_verify_password(password, hash_out) != 0) {
        return make_json(401, "{\"error\":\"Sai Gmail/username ho\\u1eb7c password.\"}");
    }

    int user_id = 0;
    if (db_get_user_id_by_username(username_out, &user_id) != 0) {
        return make_json(500, "{\"error\":\"Failed to look up user\"}");
    }

    char session_token[1024];
    if (!auth_create_session(user_id, get_secret(), session_token, sizeof(session_token))) {
        return make_json(500, "{\"error\":\"Failed to create session\"}");
    }

    long long now = (long long)time(NULL);
    char expires_at[64];
    snprintf(expires_at, sizeof(expires_at), "%lld", now + SESSION_TTL_SEC);
    db_create_session(user_id, session_token, expires_at);

    char json[1024];
    snprintf(json, sizeof(json),
        "{\"user\":{\"id\":%d,\"username\":\"%s\"}}",
        user_id, username_out);
    HttpResponse* res = make_json(200, json);
    set_cookie_header(res, session_token);
    return res;
}

HttpResponse* handle_logout(HttpRequest* req, RouteParam* rp) {
    (void)rp;
    char* token = get_cookie_value(req, SESSION_COOKIE);
    if (token) {
        db_delete_session(token);
    }
    HttpResponse* res = make_json(200, "{\"ok\":true}");
    clear_cookie_header(res);
    return res;
}

HttpResponse* handle_me(HttpRequest* req, RouteParam* rp) {
    (void)rp;
    int user_id = extract_user_id(req);
    if (user_id <= 0) {
        return make_json(401, "{\"error\":\"Ch\\u01b0a \\u0111\\u0103ng nh\\u1eadp.\"}");
    }

    char output[4096];
    if (db_find_user_by_id(user_id, output, sizeof(output)) != 0) {
        return make_json(404, "{\"error\":\"User not found\"}");
    }

    char json[8192];
    snprintf(json, sizeof(json), "{\"user\":%s}", output);
    return make_json(200, json);
}

HttpResponse* handle_list_videos(HttpRequest* req, RouteParam* rp) {
    (void)rp;
    (void)req;
    char* q = get_query_param(req->query, "q");

    char output[65536];
    if (db_list_all_videos(q ? q : "", output, sizeof(output)) != 0) {
        return make_json(200, "{\"videos\":[]}");
    }

    size_t json_len = strlen(output) + 16;
    char* json = (char*)malloc(json_len);
    snprintf(json, json_len, "{\"videos\":%s}", output);
    HttpResponse* res = make_json(200, json);
    free(json);
    return res;
}

static void generate_uuid(char* out, size_t out_len) {
    if (out_len < 37) return;
    const char* chars = "0123456789abcdef";
    unsigned int seed = (unsigned int)time(NULL) ^ (unsigned int)getpid();
    for (int i = 0; i < 36; i++) {
        if (i == 8 || i == 13 || i == 18 || i == 23) {
            out[i] = '-';
        } else if (i == 14) {
            out[i] = '4';
        } else if (i == 19) {
            out[i] = chars[8 + (seed % 4)];
            seed = seed * 1103515245 + 12345;
        } else {
            out[i] = chars[seed % 16];
            seed = seed * 1103515245 + 12345;
        }
    }
    out[36] = '\0';
}

static const char* get_file_ext(const char* filename) {
    const char* dot = strrchr(filename, '.');
    if (!dot || strchr(dot, '/')) return "";
    return dot;
}

HttpResponse* handle_upload_video(HttpRequest* req, RouteParam* rp) {
    (void)rp;
    int user_id = extract_user_id(req);
    if (user_id <= 0) {
        return make_json(401, "{\"error\":\"Ch\\u01b0a \\u0111\\u0103ng nh\\u1eadp.\"}");
    }

    const char* content_type = find_header(req, "Content-Type");
    if (!content_type || strstr(content_type, "multipart/form-data") == NULL) {
        return make_json(400, "{\"error\":\"Expected multipart/form-data\"}");
    }

    char boundary[256] = {0};
    const char* bc = strstr(content_type, "boundary=");
    if (bc) {
        bc += 9;
        if (*bc == '"') bc++;
        size_t i = 0;
        while (*bc && *bc != ';' && *bc != '"' && i < sizeof(boundary) - 1) {
            boundary[i++] = *bc++;
        }
        boundary[i] = '\0';
    }

    if (strlen(boundary) == 0) {
        return make_json(400, "{\"error\":\"Missing boundary\"}");
    }

    char title[512] = {0};
    char video_filename[512] = {0};
    char video_content_type[128] = "video/mp4";
    char video_tmp[4096] = {0};
    long long video_size = 0;
    char thumb_tmp[4096] = {0};
    int found_video = 0;

    char* body = req->body;
    size_t body_len = req->body_len;
    char* p = body;
    char* end = body + body_len;

    while (p < end) {
        char* bp = strstr(p, boundary);
        if (!bp) break;
        p = bp + strlen(boundary);
        if (p + 1 < end && p[0] == '-' && p[1] == '-') break;
        if (p < end && (*p == '\r' || *p == '\n')) p++;
        if (p < end && *p == '\r') p++;
        if (p < end && *p == '\n') p++;

        char* header_end = strstr(p, "\r\n\r\n");
        if (!header_end) break;

        char* name_start = strstr(p, "name=\"");
        char* field_name = NULL;
        char field_buf[256];
        if (name_start && (size_t)(name_start - p) < 4096) {
            name_start += 6;
            char* name_end = strchr(name_start, '"');
            if (name_end) {
                size_t nl = name_end - name_start;
                if (nl < sizeof(field_buf)) {
                    memcpy(field_buf, name_start, nl);
                    field_buf[nl] = '\0';
                    field_name = field_buf;
                }
            }
        }

        char* fn_start = strstr(p, "filename=\"");
        if (fn_start) {
            fn_start += 10;
            char* fn_end = strchr(fn_start, '"');
            if (fn_end) {
                size_t fl = fn_end - fn_start;
                if (fl < sizeof(video_filename)) {
                    memcpy(video_filename, fn_start, fl);
                    video_filename[fl] = '\0';
                }
            }
        }

        char* ct_line = strstr(p, "Content-Type:");
        if (ct_line) {
            ct_line += 13;
            while (*ct_line == ' ' || *ct_line == '\t') ct_line++;
            char* ct_end = strchr(ct_line, '\r');
            if (!ct_end) ct_end = strchr(ct_line, '\n');
            if (ct_end) {
                size_t cl = ct_end - ct_line;
                if (cl < sizeof(video_content_type)) {
                    memcpy(video_content_type, ct_line, cl);
                    video_content_type[cl] = '\0';
                }
            }
        }

        p = header_end + 4;
        if (p >= end) break;

        char* next_bp = strstr(p, boundary);
        if (!next_bp) break;
        size_t part_len = (size_t)(next_bp - p);
        while (part_len > 0 && (p[part_len - 1] == '\r' || p[part_len - 1] == '\n')) part_len--;

        if (field_name && strcmp(field_name, "title") == 0) {
            size_t cl = part_len < sizeof(title) - 1 ? part_len : sizeof(title) - 1;
            memcpy(title, p, cl);
            title[cl] = '\0';
        } else if (field_name && (strcmp(field_name, "video") == 0 || strcmp(field_name, "file") == 0)) {
            const char* upload = get_upload_dir();
            char tmp[4096];
            snprintf(tmp, sizeof(tmp), "%s/.tmp_upload_%d_%ld", upload, user_id, (long)time(NULL));
            FILE* f = fopen(tmp, "wb");
            if (f) {
                fwrite(p, 1, part_len, f);
                fclose(f);
                strncpy(video_tmp, tmp, sizeof(video_tmp) - 1);
                video_size = part_len;
                found_video = 1;
            }
        } else if (field_name && strcmp(field_name, "thumbnail") == 0 && part_len > 0) {
            const char* upload = get_upload_dir();
            char tmp[4096];
            snprintf(tmp, sizeof(tmp), "%s/.tmp_thumb_%d_%ld", upload, user_id, (long)time(NULL));
            FILE* f = fopen(tmp, "wb");
            if (f) {
                fwrite(p, 1, part_len, f);
                fclose(f);
                strncpy(thumb_tmp, tmp, sizeof(thumb_tmp) - 1);
            }
        }

        p = next_bp;
        while (p < end && (*p == '\r' || *p == '\n' || *p == '-')) p++;
    }

    if (!found_video || video_size == 0) {
        if (strlen(video_tmp) > 0) unlink(video_tmp);
        if (strlen(thumb_tmp) > 0) unlink(thumb_tmp);
        return make_json(400, "{\"error\":\"Thi\\u1ebfu file video trong request.\"}");
    }

    if (video_size > MAX_UPLOAD_SIZE) {
        unlink(video_tmp);
        if (strlen(thumb_tmp) > 0) unlink(thumb_tmp);
        return make_json(400, "{\"error\":\"File v\\u01b0\\u1ee3t qu\\u00e1 gi\\u1edbi h\\u1ea1n 1GB.\"}");
    }

    if (strncmp(video_content_type, "video/", 6) != 0) {
        unlink(video_tmp);
        if (strlen(thumb_tmp) > 0) unlink(thumb_tmp);
        return make_json(400, "{\"error\":\"File kh\\u00f4ng ph\\u1ea3i l\\u00e0 video.\"}");
    }

    if (strlen(title) == 0) {
        if (strlen(video_filename) > 0) {
            strncpy(title, video_filename, sizeof(title) - 1);
        } else {
            strcpy(title, "Video");
        }
    }

    const char* ext = get_file_ext(video_filename);
    if (strlen(ext) == 0 || strlen(ext) > 12) ext = ".mp4";

    char stored_name[256];
    char uuid[37];
    generate_uuid(uuid, sizeof(uuid));
    snprintf(stored_name, sizeof(stored_name), "%s%s", uuid, ext);

    const char* upload = get_upload_dir();
    char final_path[4096];
    snprintf(final_path, sizeof(final_path), "%s/%s", upload, stored_name);
    rename(video_tmp, final_path);

    char thumb_stored[256] = {0};
    if (strlen(thumb_tmp) > 0) {
        const char* text = get_file_ext(thumb_tmp);
        if (strlen(text) == 0) text = ".jpg";
        char uuid2[37];
        generate_uuid(uuid2, sizeof(uuid2));
        snprintf(thumb_stored, sizeof(thumb_stored), "%s%s", uuid2, text);
        char final_thumb[4096];
        snprintf(final_thumb, sizeof(final_thumb), "%s/%s", upload, thumb_stored);
        rename(thumb_tmp, final_thumb);
    } else {
        char cmd[8192];
        char thumb_name[256];
        char uuid3[37];
        generate_uuid(uuid3, sizeof(uuid3));
        snprintf(thumb_name, sizeof(thumb_name), "%s.jpg", uuid3);
        char thumb_path[4096];
        snprintf(thumb_path, sizeof(thumb_path), "%s/%s", upload, thumb_name);
        snprintf(cmd, sizeof(cmd), "ffmpeg -y -ss 00:00:01 -i \"%s\" -vframes 1 -q:v 2 \"%s\" 2>/dev/null", final_path, thumb_path);
        int ret = system(cmd);
        if (ret != 0) {
            snprintf(cmd, sizeof(cmd), "ffmpeg -y -i \"%s\" -vframes 1 -q:v 2 \"%s\" 2>/dev/null", final_path, thumb_path);
            ret = system(cmd);
        }
        struct stat st;
        if (stat(thumb_path, &st) == 0 && st.st_size > 0) {
            strncpy(thumb_stored, thumb_name, sizeof(thumb_stored) - 1);
        } else {
            unlink(thumb_path);
        }
    }

    int video_id = 0;
    int rc = db_create_video(user_id, title, stored_name, video_size, video_content_type,
                             strlen(thumb_stored) > 0 ? thumb_stored : NULL, &video_id);
    if (rc != 0) {
        unlink(final_path);
        if (strlen(thumb_stored) > 0) {
            char tp[4096];
            snprintf(tp, sizeof(tp), "%s/%s", upload, thumb_stored);
            unlink(tp);
        }
        return make_json(500, "{\"error\":\"Failed to create video\"}");
    }

    char token[1024];
    if (!mediatoken_sign(stored_name, get_secret(), token, sizeof(token))) {
        strcpy(token, "");
    }

    char thumb_token[1024] = "";
    if (strlen(thumb_stored) > 0) {
        mediatoken_sign(thumb_stored, get_secret(), thumb_token, sizeof(thumb_token));
    }

    char json[4096];
    snprintf(json, sizeof(json),
        "{\"video\":{\"id\":%d,\"title\":\"%s\",\"url\":\"%s\","
        "\"thumbnail_url\":\"%s\",\"size\":%lld,\"content_type\":\"%s\","
        "\"created_at\":\"now\",\"owner_id\":%d,\"is_mine\":true}}",
        video_id, title, token, thumb_token, video_size, video_content_type, user_id);
    return make_json(201, json);
}

HttpResponse* handle_get_video(HttpRequest* req, RouteParam* rp) {
    (void)req;
    const char* id_str = (const char*)rp->user_data;
    int id = id_str ? atoi(id_str) : 0;
    if (id <= 0) {
        return make_json(400, "{\"error\":\"ID video kh\\u00f4ng h\\u1ee3p l\\u1ec7.\"}");
    }

    char output[4096];
    if (db_find_video_by_id(id, output, sizeof(output)) != 0) {
        return make_json(404, "{\"error\":\"Video kh\\u00f4ng t\\u1ed3n t\\u1ea1i.\"}");
    }

    size_t json_len = strlen(output) + 16;
    char* json = (char*)malloc(json_len);
    snprintf(json, json_len, "{\"video\":%s}", output);
    HttpResponse* res = make_json(200, json);
    free(json);
    return res;
}

HttpResponse* handle_delete_video(HttpRequest* req, RouteParam* rp) {
    (void)req;
    int user_id = extract_user_id(req);
    if (user_id <= 0) {
        return make_json(401, "{\"error\":\"Ch\\u01b0a \\u0111\\u0103ng nh\\u1eadp.\"}");
    }

    const char* id_str = (const char*)rp->user_data;
    int id = id_str ? atoi(id_str) : 0;
    if (id <= 0) {
        return make_json(400, "{\"error\":\"ID video kh\\u00f4ng h\\u1ee3p l\\u1ec7.\"}");
    }

    char output[4096];
    if (db_find_video_by_id_and_user(id, user_id, output, sizeof(output)) != 0) {
        return make_json(404, "{\"error\":\"Video kh\\u00f4ng t\\u1ed3n t\\u1ea1i.\"}");
    }

    db_delete_video(id);
    return make_json(200, "{\"ok\":true}");
}

HttpResponse* handle_serve_media(HttpRequest* req, RouteParam* rp) {
    (void)rp;
    char* token = get_query_param(req->query, "t");
    if (!token) {
        return make_json(400, "{\"error\":\"Missing token\"}");
    }

    char filename[512];
    if (mediatoken_verify(token, get_secret(), filename, sizeof(filename)) != 0) {
        return make_json(403, "{\"error\":\"Forbidden\"}");
    }

    const char* upload = get_upload_dir();
    char filepath[4096];
    snprintf(filepath, sizeof(filepath), "%s/%s", upload, filename);

    struct stat st;
    if (stat(filepath, &st) != 0) {
        return make_json(404, "{\"error\":\"Not Found\"}");
    }

    char* range = find_header(req, "Range");
    long long start = 0;
    long long end = -1;
    int has_range = 0;

    if (range && strncmp(range, "bytes=", 6) == 0) {
        has_range = 1;
        char* dash = strchr(range + 6, '-');
        if (dash) {
            *dash = '\0';
            start = atoll(range + 6);
            const char* end_str = dash + 1;
            if (strlen(end_str) > 0) {
                end = atoll(end_str);
            } else {
                end = st.st_size - 1;
            }
            *dash = '-';
        }
        if (end < 0 || end >= st.st_size) end = st.st_size - 1;
    }

    HttpResponse* res = (HttpResponse*)malloc(sizeof(HttpResponse));
    response_init(res);
    res->status_code = has_range ? 206 : 200;
    strncpy(res->file_path, filepath, MAX_PATH - 1);
    res->file_start = start;
    res->file_end = end;
    return res;
}

void register_all_routes(void) {
    load_media_secret();

    route_register("/api/health", "GET", handle_health);
    route_register("/api/hello", "GET", handle_hello);
    route_register("/api/hello", "PUT", handle_hello);
    route_register("/api/hello/:name", "GET", handle_hello_name);
    route_register("/api/register", "POST", handle_register);
    route_register("/api/login", "POST", handle_login);
    route_register("/api/logout", "POST", handle_logout);
    route_register("/api/me", "GET", handle_me);
    route_register("/api/videos", "GET", handle_list_videos);
    route_register("/api/videos", "POST", handle_upload_video);
    route_register("/api/videos/:id", "GET", handle_get_video);
    route_register("/api/videos/:id", "DELETE", handle_delete_video);
    route_register("/api/media", "GET", handle_serve_media);
}