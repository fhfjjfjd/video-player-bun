#include "server.h"
#include "db.h"
#include "server_handlers.h"
#include "platform.h"
#include <pthread.h>
#include <signal.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <time.h>
#include <ctype.h>

static volatile int g_running = 0;
static int g_server_fd = -1;
static Route g_routes[MAX_ROUTES];
static int g_route_count = 0;
static pthread_mutex_t g_route_mutex = PTHREAD_MUTEX_INITIALIZER;

static char g_dist_dir[512] = "dist";
static char g_upload_dir[512] = "uploads";

const char* get_dist_dir(void) { return g_dist_dir; }
const char* get_upload_dir(void) { return g_upload_dir; }

static const char* get_mime_type(const char* ext) {
    if (!ext) return "application/octet-stream";
    if (strcmp(ext, ".html") == 0) return "text/html";
    if (strcmp(ext, ".css") == 0) return "text/css";
    if (strcmp(ext, ".js") == 0) return "application/javascript";
    if (strcmp(ext, ".json") == 0) return "application/json";
    if (strcmp(ext, ".png") == 0) return "image/png";
    if (strcmp(ext, ".jpg") == 0 || strcmp(ext, ".jpeg") == 0) return "image/jpeg";
    if (strcmp(ext, ".gif") == 0) return "image/gif";
    if (strcmp(ext, ".svg") == 0) return "image/svg+xml";
    if (strcmp(ext, ".ico") == 0) return "image/x-icon";
    if (strcmp(ext, ".woff") == 0) return "font/woff";
    if (strcmp(ext, ".woff2") == 0) return "font/woff2";
    if (strcmp(ext, ".ttf") == 0) return "font/ttf";
    if (strcmp(ext, ".mp4") == 0) return "video/mp4";
    if (strcmp(ext, ".webm") == 0) return "video/webm";
    if (strcmp(ext, ".mkv") == 0) return "video/x-matroska";
    if (strcmp(ext, ".avi") == 0) return "video/x-msvideo";
    if (strcmp(ext, ".m3u8") == 0) return "application/vnd.apple.mpegurl";
    if (strcmp(ext, ".mpd") == 0) return "application/dash+xml";
    if (strcmp(ext, ".mp3") == 0) return "audio/mpeg";
    if (strcmp(ext, ".wav") == 0) return "audio/wav";
    if (strcmp(ext, ".ogg") == 0) return "audio/ogg";
    if (strcmp(ext, ".pdf") == 0) return "application/pdf";
    if (strcmp(ext, ".zip") == 0) return "application/zip";
    if (strcmp(ext, ".gz") == 0) return "application/gzip";
    if (strcmp(ext, ".map") == 0) return "application/json";
    if (strcmp(ext, ".wasm") == 0) return "application/wasm";
    if (strcmp(ext, ".txt") == 0) return "text/plain";
    if (strcmp(ext, ".xml") == 0) return "application/xml";
    return "application/octet-stream";
}

const char* mime_type(const char* path) {
    if (!path) return "application/octet-stream";
    const char* dot = strrchr(path, '.');
    if (!dot) return "application/octet-stream";
    return get_mime_type(dot);
}

void response_init(HttpResponse* res) {
    memset(res, 0, sizeof(HttpResponse));
    res->status_code = 200;
    res->file_start = 0;
    res->file_end = -1;
}

void response_set_header(HttpResponse* res, const char* key, const char* value) {
    if (res->header_count >= 32) return;
    snprintf(res->headers[res->header_count], 512, "%s: %s", key, value);
    res->header_count++;
}

void response_free(HttpResponse* res) {
    if (res->body) {
        free(res->body);
        res->body = NULL;
    }
}

void apply_security_headers(HttpResponse* res) {
    response_set_header(res, "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    response_set_header(res, "X-Content-Type-Options", "nosniff");
    response_set_header(res, "X-Frame-Options", "DENY");
    response_set_header(res, "Referrer-Policy", "no-referrer");
    response_set_header(res, "Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

static void url_decode(char* dst, const char* src, size_t dst_len) {
    size_t j = 0;
    for (size_t i = 0; src[i] && j < dst_len - 1; i++) {
        if (src[i] == '%' && src[i + 1] && src[i + 2]) {
            char hex[3] = {src[i + 1], src[i + 2], 0};
            dst[j++] = (char)strtol(hex, NULL, 16);
            i += 2;
        } else if (src[i] == '+') {
            dst[j++] = ' ';
        } else {
            dst[j++] = src[i];
        }
    }
    dst[j] = '\0';
}

char* find_header(HttpRequest* req, const char* key) {
    for (int i = 0; i < req->header_count; i++) {
        size_t klen = strlen(key);
        if (strncasecmp(req->headers[i], key, klen) == 0 && req->headers[i][klen] == ':') {
            char* val = req->headers[i] + klen + 1;
            while (*val == ' ') val++;
            return val;
        }
    }
    return NULL;
}

int parse_request(int client_fd, HttpRequest* req) {
    char buf[MAX_HEADER_SIZE];
    size_t total = 0;
    int n;

    memset(req, 0, sizeof(HttpRequest));
    req->body = (char*)malloc(MAX_REQUEST_SIZE);
    if (!req->body) return -1;
    req->body_capacity = MAX_REQUEST_SIZE;

    while (1) {
        n = recv(client_fd, buf + total, sizeof(buf) - total - 1, 0);
        if (n <= 0) return -1;
        total += n;
        buf[total] = '\0';
        if (strstr(buf, "\r\n\r\n") || strstr(buf, "\n\n")) break;
        if (total >= MAX_HEADER_SIZE - 1) return -1;
    }

    char* line = buf;
    int line_num = 0;

    while (line && *line && line_num < MAX_HEADERS) {
        char* next = strstr(line, "\r\n");
        if (!next) next = strchr(line, '\n');
        if (next) *next = '\0';

        if (line_num == 0) {
            sscanf(line, "%15s %4095s %*s", req->method, req->path);
            char* q = strchr(req->path, '?');
            if (q) {
                strncpy(req->query, q + 1, MAX_PATH - 1);
                req->query[MAX_PATH - 1] = '\0';
                *q = '\0';
            }
            url_decode(req->path, req->path, MAX_PATH);
        } else {
            strncpy(req->headers[req->header_count], line, 255);
            req->headers[req->header_count][255] = '\0';
            req->header_count++;
        }

        line_num++;
        if (!next) break;
        line = next + (next[1] == '\n' ? 2 : 1);
        if (*line == '\0') break;
    }

    char* body_start = strstr(buf, "\r\n\r\n");
    if (!body_start) body_start = strstr(buf, "\n\n");
    size_t body_len = 0;
    if (body_start) {
        body_start += (strstr(buf, "\r\n\r\n") ? 4 : 2);
        size_t header_len = body_start - buf;
        body_len = total - header_len;
        if (body_len > 0 && body_len < MAX_REQUEST_SIZE) {
            memcpy(req->body, body_start, body_len);
            req->body_len = body_len;
        }
    }

    const char* cl = find_header(req, "Content-Length");
    if (cl) {
        long long cl_val = atoll(cl);
        if (cl_val > 0 && (size_t)cl_val <= MAX_REQUEST_SIZE) {
            size_t have = req->body_len;
            if (have < (size_t)cl_val) {
                size_t to_read = (size_t)cl_val - have;
                size_t offset = have;
                while (to_read > 0 && offset < req->body_capacity) {
                    n = recv(client_fd, req->body + offset, to_read, 0);
                    if (n <= 0) break;
                    offset += n;
                    to_read -= n;
                }
                req->body_len = offset;
            }
        }
    }

    return 0;
}

static void send_all(int fd, const char* data, size_t len) {
    size_t sent = 0;
    while (sent < len) {
        ssize_t n = send(fd, data + sent, len - sent, 0);
        if (n <= 0) break;
        sent += n;
    }
}

void serve_file_response(HttpResponse* res, int client_fd) {
    if (strlen(res->file_path) == 0) return;

    struct stat st;
    if (stat(res->file_path, &st) != 0 || S_ISDIR(st.st_mode)) {
        const char* msg = "HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\nConnection: close\r\n\r\nNot Found";
        send_all(client_fd, msg, strlen(msg));
        return;
    }

    long long file_size = st.st_size;
    long long start = res->file_start;
    long long end = res->file_end >= 0 ? res->file_end : file_size - 1;

    const char* ct = mime_type(res->file_path);

    if (res->file_start > 0 || res->file_end >= 0) {
        if (start >= file_size) {
            char hdr[512];
            int hlen = snprintf(hdr, sizeof(hdr),
                "HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */%lld\r\nConnection: close\r\n\r\n", file_size);
            send_all(client_fd, hdr, hlen);
            return;
        }
        if (end >= file_size) end = file_size - 1;

        char hdr[8192];
        int hlen = 0;
        hlen += snprintf(hdr + hlen, sizeof(hdr) - hlen, "HTTP/1.1 206 Partial Content\r\n");
        hlen += snprintf(hdr + hlen, sizeof(hdr) - hlen, "Content-Type: %s\r\n", ct);
        hlen += snprintf(hdr + hlen, sizeof(hdr) - hlen, "Content-Range: bytes %lld-%lld/%lld\r\n", start, end, file_size);
        hlen += snprintf(hdr + hlen, sizeof(hdr) - hlen, "Content-Length: %lld\r\n", end - start + 1);
        hlen += snprintf(hdr + hlen, sizeof(hdr) - hlen, "Accept-Ranges: bytes\r\n");
        hlen += snprintf(hdr + hlen, sizeof(hdr) - hlen, "Connection: close\r\n");
        for (int i = 0; i < res->header_count; i++) {
            hlen += snprintf(hdr + hlen, sizeof(hdr) - hlen, "%s\r\n", res->headers[i]);
        }
        hlen += snprintf(hdr + hlen, sizeof(hdr) - hlen, "\r\n");
        send_all(client_fd, hdr, hlen);

        int fd_file = open(res->file_path, O_RDONLY);
        if (fd_file < 0) return;
        lseek(fd_file, start, SEEK_SET);
        long long remaining = end - start + 1;
        char chunk[8192];
        while (remaining > 0) {
            size_t to_read = remaining > (long long)sizeof(chunk) ? sizeof(chunk) : (size_t)remaining;
            ssize_t n = read(fd_file, chunk, to_read);
            if (n <= 0) break;
            send_all(client_fd, chunk, n);
            remaining -= n;
        }
        close(fd_file);
    } else {
        char hdr[8192];
        int hlen = 0;
        hlen += snprintf(hdr + hlen, sizeof(hdr) - hlen, "HTTP/1.1 200 OK\r\n");
        hlen += snprintf(hdr + hlen, sizeof(hdr) - hlen, "Content-Type: %s\r\n", ct);
        hlen += snprintf(hdr + hlen, sizeof(hdr) - hlen, "Content-Length: %lld\r\n", file_size);
        hlen += snprintf(hdr + hlen, sizeof(hdr) - hlen, "Accept-Ranges: bytes\r\n");
        hlen += snprintf(hdr + hlen, sizeof(hdr) - hlen, "Connection: close\r\n");
        for (int i = 0; i < res->header_count; i++) {
            hlen += snprintf(hdr + hlen, sizeof(hdr) - hlen, "%s\r\n", res->headers[i]);
        }
        hlen += snprintf(hdr + hlen, sizeof(hdr) - hlen, "\r\n");
        send_all(client_fd, hdr, hlen);

        int fd_file = open(res->file_path, O_RDONLY);
        if (fd_file < 0) return;
        char chunk[8192];
        ssize_t n;
        while ((n = read(fd_file, chunk, sizeof(chunk))) > 0) {
            send_all(client_fd, chunk, n);
        }
        close(fd_file);
    }
}

void response_send(HttpResponse* res, int client_fd) {
    if (strlen(res->file_path) > 0) {
        serve_file_response(res, client_fd);
        return;
    }

    char status_line[64];
    const char* status_text = "OK";
    switch (res->status_code) {
        case 200: status_text = "OK"; break;
        case 201: status_text = "Created"; break;
        case 206: status_text = "Partial Content"; break;
        case 302: status_text = "Found"; break;
        case 400: status_text = "Bad Request"; break;
        case 401: status_text = "Unauthorized"; break;
        case 403: status_text = "Forbidden"; break;
        case 404: status_text = "Not Found"; break;
        case 405: status_text = "Method Not Allowed"; break;
        case 413: status_text = "Payload Too Large"; break;
        case 416: status_text = "Range Not Satisfiable"; break;
        case 500: status_text = "Internal Server Error"; break;
        default: status_text = "OK"; break;
    }

    snprintf(status_line, sizeof(status_line), "HTTP/1.1 %d %s\r\n", res->status_code, status_text);
    send_all(client_fd, status_line, strlen(status_line));

    char header_buf[512];
    for (int i = 0; i < res->header_count; i++) {
        snprintf(header_buf, sizeof(header_buf), "%s\r\n", res->headers[i]);
        send_all(client_fd, header_buf, strlen(header_buf));
    }

    if (res->body && res->body_len > 0) {
        snprintf(header_buf, sizeof(header_buf), "Content-Length: %zu\r\n", res->body_len);
        send_all(client_fd, header_buf, strlen(header_buf));
    }

    send_all(client_fd, "\r\n", 2);

    if (res->body && res->body_len > 0) {
        send_all(client_fd, res->body, res->body_len);
    }
}

void* handle_client(void* arg) {
    int client_fd = *(int*)arg;
    free(arg);

    HttpRequest req;
    if (parse_request(client_fd, &req) != 0) {
        free(req.body);
        sock_close(client_fd);
        return NULL;
    }

    HttpResponse* res = route_dispatch(&req, client_fd);
    if (!res) {
        const char* path = req.path;
        if (strncmp(path, "/api/", 5) == 0) {
            const char* json = "{\"error\":\"Not Found\"}";
            char header[512];
            int hlen = 0;
            hlen += snprintf(header + hlen, sizeof(header) - hlen, "HTTP/1.1 404 Not Found\r\n");
            hlen += snprintf(header + hlen, sizeof(header) - hlen, "Content-Type: application/json\r\n");
            hlen += snprintf(header + hlen, sizeof(header) - hlen, "Content-Length: %zu\r\n", strlen(json));
            hlen += snprintf(header + hlen, sizeof(header) - hlen, "Connection: close\r\n");
            hlen += snprintf(header + hlen, sizeof(header) - hlen, "\r\n");
            send_all(client_fd, header, hlen);
            send_all(client_fd, json, strlen(json));
        } else {
            char filepath[4096];
            struct stat st;
            if (strstr(path, "..") != NULL) {
                const char* json = "{\"error\":\"Forbidden\"}";
                char header[512];
                int hlen = 0;
                hlen += snprintf(header + hlen, sizeof(header) - hlen, "HTTP/1.1 403 Forbidden\r\n");
                hlen += snprintf(header + hlen, sizeof(header) - hlen, "Content-Type: application/json\r\n");
                hlen += snprintf(header + hlen, sizeof(header) - hlen, "Content-Length: %zu\r\n", strlen(json));
                hlen += snprintf(header + hlen, sizeof(header) - hlen, "Connection: close\r\n");
                hlen += snprintf(header + hlen, sizeof(header) - hlen, "\r\n");
                send_all(client_fd, header, hlen);
                send_all(client_fd, json, strlen(json));
            } else {
                const char* rel = (strcmp(path, "/") == 0) ? "/index.html" : path;
                snprintf(filepath, sizeof(filepath), "%s%s", get_dist_dir(), rel);
                if (stat(filepath, &st) != 0 || S_ISDIR(st.st_mode)) {
                    snprintf(filepath, sizeof(filepath), "%s/index.html", get_dist_dir());
                }
                HttpResponse dummy;
                response_init(&dummy);
                strncpy(dummy.file_path, filepath, MAX_PATH - 1);
                apply_security_headers(&dummy);
                serve_file_response(&dummy, client_fd);
            }
        }
        free(req.body);
        sock_close(client_fd);
        return NULL;
    }

    apply_security_headers(res);
    response_send(res, client_fd);
    response_free(res);
    free(res);
    free(req.body);
    sock_close(client_fd);
    return NULL;
}

static void* accept_loop(void* arg) {
    (void)arg;
    while (g_running) {
        struct sockaddr_in client_addr;
        socklen_t addr_len = sizeof(client_addr);
        int client_fd = (int)accept(g_server_fd, (struct sockaddr*)&client_addr, &addr_len);
        if (client_fd < 0) continue;

        char* fd_ptr = (char*)malloc(sizeof(int));
        *fd_ptr = client_fd;

        pthread_t tid;
        pthread_create(&tid, NULL, handle_client, fd_ptr);
        pthread_detach(tid);
    }
    return NULL;
}

int server_start(int port, const char* hostname) {
    if (net_socket_init() != 0) {
        perror("winsock init");
        return -1;
    }

    g_server_fd = (int)socket(AF_INET, SOCK_STREAM, 0);
    if (g_server_fd < 0) {
        perror("socket");
        return -1;
    }

    int opt = 1;
    setsockopt(g_server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port = htons(port);
    inet_pton(AF_INET, hostname, &addr.sin_addr);

    if (bind(g_server_fd, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        perror("bind");
        sock_close(g_server_fd);
        return -1;
    }

    if (listen(g_server_fd, 128) < 0) {
        perror("listen");
        sock_close(g_server_fd);
        return -1;
    }

    g_running = 1;

    pthread_t accept_thread;
    pthread_create(&accept_thread, NULL, accept_loop, NULL);
    pthread_detach(accept_thread);

    return 0;
}

void server_stop(void) {
    g_running = 0;
    if (g_server_fd >= 0) {
        sock_close(g_server_fd);
        g_server_fd = -1;
    }
}

void route_register(const char* path, const char* method, HandlerFn handler) {
    pthread_mutex_lock(&g_route_mutex);
    if (g_route_count < MAX_ROUTES) {
        strncpy(g_routes[g_route_count].path, path, MAX_PATH - 1);
        strncpy(g_routes[g_route_count].method, method, 15);
        g_routes[g_route_count].handler = handler;
        g_routes[g_route_count].param_index = -1;
        g_route_count++;
    }
    pthread_mutex_unlock(&g_route_mutex);
}

void route_register_param(const char* path, const char* method, HandlerFn handler, int param_index) {
    pthread_mutex_lock(&g_route_mutex);
    if (g_route_count < MAX_ROUTES) {
        strncpy(g_routes[g_route_count].path, path, MAX_PATH - 1);
        strncpy(g_routes[g_route_count].method, method, 15);
        g_routes[g_route_count].handler = handler;
        g_routes[g_route_count].param_index = param_index;
        g_route_count++;
    }
    pthread_mutex_unlock(&g_route_mutex);
}

HttpResponse* route_dispatch(HttpRequest* req, int client_fd) {
    (void)client_fd;

    HandlerFn handler = NULL;
    char param_val[MAX_PATH];
    int has_param = 0;

    pthread_mutex_lock(&g_route_mutex);

    for (int i = 0; i < g_route_count; i++) {
        Route* r = &g_routes[i];

        if (strcmp(r->method, req->method) != 0) continue;

        if (strcmp(r->path, req->path) == 0) {
            handler = r->handler;
            has_param = 0;
            break;
        }

        if (r->param_index >= 0) {
            char prefix[MAX_PATH];
            snprintf(prefix, sizeof(prefix), "%.*s", r->param_index, r->path);
            size_t plen = strlen(prefix);
            if (plen > 0 && strncmp(req->path, prefix, plen) == 0 && req->path[plen] == '/') {
                const char* rest = req->path + plen + 1;
                const char* slash = strchr(rest, '/');
                if (slash) {
                    size_t plen2 = slash - rest;
                    if (plen2 >= MAX_PATH) {
                        pthread_mutex_unlock(&g_route_mutex);
                        return NULL;
                    }
                    memcpy(param_val, rest, plen2);
                    param_val[plen2] = '\0';
                } else {
                    strncpy(param_val, rest, MAX_PATH - 1);
                    param_val[MAX_PATH - 1] = '\0';
                }
                handler = r->handler;
                has_param = 1;
                break;
            }
        }
    }

    pthread_mutex_unlock(&g_route_mutex);

    if (!handler) return NULL;

    RouteParam rp;
    strncpy(rp.path, req->path, MAX_PATH - 1);
    strncpy(rp.method, req->method, 15);
    rp.client_fd = client_fd;
    rp.user_data = has_param ? param_val : NULL;
    return handler(req, &rp);
}

static void on_signal(int sig) {
    (void)sig;
    server_stop();
}

int main(int argc, char* argv[]) {
    int port = SERVER_PORT;
    const char* hostname = SERVER_HOSTNAME;

    if (argc >= 2) port = atoi(argv[1]);
    if (argc >= 3) hostname = argv[2];

    const char* d = getenv("DIST_DIR");
    if (d) strncpy(g_dist_dir, d, sizeof(g_dist_dir) - 1);
    const char* u = getenv("UPLOAD_DIR");
    if (u) strncpy(g_upload_dir, u, sizeof(g_upload_dir) - 1);

    net_mkdir(g_upload_dir, 0755);

    const char* db_path = getenv("DATABASE_PATH");
    if (!db_path) db_path = "data.db";
    DBHandle db = db_init(db_path);
    if (!db) {
        fprintf(stderr, "[server] Failed to open database: %s\n", db_path);
        return 1;
    }

    register_all_routes();

    printf("[server] Starting C++ server on %s:%d\n", hostname, port);
    printf("[server] Serving static files from %s\n", g_dist_dir);
    printf("[server] Upload directory: %s\n", g_upload_dir);

    if (server_start(port, hostname) != 0) {
        fprintf(stderr, "[server] Failed to start\n");
        return 1;
    }

    printf("[server] Server running at http://%s:%d/\n", hostname, port);

    net_sigaction(SIGINT, on_signal);
    net_sigaction(SIGTERM, on_signal);

    while (g_running) {
        net_sleep(1);
    }

    db_close(db);
    printf("[server] Shutting down...\n");
    return 0;
}