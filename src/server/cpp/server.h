#ifndef SERVER_H
#define SERVER_H

#include <stddef.h>

#define SERVER_PORT 3000
#define SERVER_HOSTNAME "127.0.0.1"
#define DIST_DIR "dist"
#define UPLOAD_DIR "uploads"
#define MAX_REQUEST_SIZE (64 * 1024 * 1024)
#define MAX_HEADER_SIZE (8192)
#define MAX_PATH 4096
#define MAX_HEADERS 64
#define MAX_ROUTES 256

typedef struct {
    char method[16];
    char path[MAX_PATH];
    char query[MAX_PATH];
    char headers[MAX_HEADERS][256];
    int header_count;
    char* body;
    size_t body_len;
    size_t body_capacity;
    char remote_addr[64];
    int remote_port;
} HttpRequest;

typedef struct {
    int status_code;
    char headers[32][512];
    int header_count;
    char* body;
    size_t body_len;
    char file_path[MAX_PATH];
    long long file_start;
    long long file_end;
} HttpResponse;

typedef struct {
    char path[MAX_PATH];
    char method[16];
    int client_fd;
    void* user_data;
} RouteParam;

typedef HttpResponse* (*HandlerFn)(HttpRequest*, RouteParam*);

typedef struct {
    char path[MAX_PATH];
    char method[16];
    HandlerFn handler;
    int param_index;
} Route;

int server_start(int port, const char* hostname);
void server_stop(void);
void route_register(const char* path, const char* method, HandlerFn handler);
void route_register_param(const char* path, const char* method, HandlerFn handler, int param_index);
HttpResponse* route_dispatch(HttpRequest* req, int client_fd);

const char* mime_type(const char* path);
void response_init(HttpResponse* res);
void response_set_header(HttpResponse* res, const char* key, const char* value);
void response_send(HttpResponse* res, int client_fd);
void response_free(HttpResponse* res);

int parse_request(int client_fd, HttpRequest* req);
void apply_security_headers(HttpResponse* res);
void serve_file_response(HttpResponse* res, int client_fd);
const char* get_dist_dir(void);
const char* get_upload_dir(void);
char* find_header(HttpRequest* req, const char* key);

#endif