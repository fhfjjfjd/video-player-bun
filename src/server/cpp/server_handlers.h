#ifndef SERVER_HANDLERS_H
#define SERVER_HANDLERS_H

#include "server.h"

HttpResponse* handle_health(HttpRequest* req, RouteParam* rp);
HttpResponse* handle_hello(HttpRequest* req, RouteParam* rp);
HttpResponse* handle_hello_name(HttpRequest* req, RouteParam* rp);
HttpResponse* handle_register(HttpRequest* req, RouteParam* rp);
HttpResponse* handle_login(HttpRequest* req, RouteParam* rp);
HttpResponse* handle_logout(HttpRequest* req, RouteParam* rp);
HttpResponse* handle_me(HttpRequest* req, RouteParam* rp);
HttpResponse* handle_list_videos(HttpRequest* req, RouteParam* rp);
HttpResponse* handle_upload_video(HttpRequest* req, RouteParam* rp);
HttpResponse* handle_get_video(HttpRequest* req, RouteParam* rp);
HttpResponse* handle_delete_video(HttpRequest* req, RouteParam* rp);
HttpResponse* handle_serve_media(HttpRequest* req, RouteParam* rp);

void register_all_routes(void);

#endif