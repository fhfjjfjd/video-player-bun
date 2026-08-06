#include "security.h"
#include <cstring>

const char* security_get_headers(char* output, size_t output_len) {
    if (!output || output_len == 0) return nullptr;
    const char* headers =
        "Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self';\r\n"
        "X-Content-Type-Options: nosniff\r\n"
        "X-Frame-Options: DENY\r\n"
        "Referrer-Policy: strict-origin-when-cross-origin\r\n"
        "Permissions-Policy: camera=(), microphone=(), geolocation=()\r\n";
    size_t len = strlen(headers);
    if (len + 1 > output_len) return nullptr;
    memcpy(output, headers, len + 1);
    return output;
}