#include "auth.h"
#include "mediatoken.h"
#include <cstring>
#include <sstream>
#include <ctime>

const char* auth_create_session(int user_id, const char* secret, char* output, size_t output_len) {
    if (!secret || !output) return nullptr;
    long long expiry = static_cast<long long>(time(nullptr)) + 30LL * 86400 * 1000;
    std::stringstream ss;
    ss << user_id << ":" << expiry;
    std::string payload = ss.str();

    char token[1024];
    if (!mediatoken_sign(payload.c_str(), secret, token, sizeof(token))) return nullptr;

    size_t tlen = strlen(token);
    if (tlen + 1 > output_len) return nullptr;
    strcpy(output, token);
    return output;
}

int auth_validate_session(const char* token, const char* secret, int* user_id_out) {
    if (!token || !secret || !user_id_out) return -1;

    char payload[512];
    if (mediatoken_verify(token, secret, payload, sizeof(payload)) != 0) return -1;

    char* colon = strchr(payload, ':');
    if (!colon) return -1;

    *colon = '\0';
    long long expiry = atoll(colon + 1);
    if (expiry < static_cast<long long>(time(nullptr) * 1000)) return -1;

    *user_id_out = atoi(payload);
    if (*user_id_out <= 0) return -1;

    return 0;
}