import { getHealth } from "./handlers/health";
import { getHello, getHelloByName, putHello } from "./handlers/hello";
import { login, logout, me, register } from "./handlers/auth";
import { deleteVideo, getVideo, listVideos, serveMedia, uploadVideo } from "./handlers/videos";
import { createFeedbackHandler, listFeedbackHandler } from "./handlers/feedback";

/**
 * Router table for the API server (port 3001).
 *
 * This only declares backend endpoints. The frontend server (port 3000)
 * proxies every /api request here and serves the SPA shell.
 */
export function createApiRoutes() {
  return {
    "/api/health": getHealth,
    "/api/hello": {
      GET: getHello,
      PUT: putHello,
    },
    "/api/hello/:name": getHelloByName,
    "/api/register": {
      POST: register,
    },
    "/api/login": {
      POST: login,
    },
    "/api/logout": {
      POST: logout,
    },
    "/api/me": {
      GET: me,
    },
    "/api/videos": {
      GET: listVideos,
      POST: uploadVideo,
    },
    "/api/videos/:id": {
      GET: getVideo,
      DELETE: deleteVideo,
    },
    "/api/media": {
      GET: serveMedia,
    },
    "/api/feedback": {
      GET: listFeedbackHandler,
      POST: createFeedbackHandler,
    },
  };
}
