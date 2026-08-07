#ifndef CP_PLATFORM_H
#define CP_PLATFORM_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stddef.h>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <io.h>
#include <direct.h>
#include <process.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <fcntl.h>

typedef intptr_t ssize_t;
typedef int socklen_t;

#define sock_close(fd) closesocket((SOCKET)(fd))
#define net_sleep(seconds) Sleep((DWORD)(seconds) * 1000)
#define net_mkdir(path, mode) _mkdir(path)
#define net_sigaction(sig, handler) signal((sig), (handler))
#define unlink _unlink
#define getpid _getpid

static inline int net_socket_init(void) {
    WSADATA wsa;
    return WSAStartup(MAKEWORD(2, 2), &wsa) == 0 ? 0 : -1;
}

#define strncasecmp _strnicmp
#define strcasecmp _stricmp

#else

#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <fcntl.h>
#include <dirent.h>
#include <signal.h>

#define sock_close(fd) close(fd)
#define net_sleep(seconds) sleep(seconds)
#define net_mkdir(path, mode) mkdir(path, mode)
#define net_sigaction(sig, handler) \
    do { \
        struct sigaction sa; \
        sa.sa_handler = (handler); \
        sigemptyset(&sa.sa_mask); \
        sa.sa_flags = 0; \
        sigaction((sig), &sa, NULL); \
    } while (0)

static inline int net_socket_init(void) { return 0; }

#endif

#endif
