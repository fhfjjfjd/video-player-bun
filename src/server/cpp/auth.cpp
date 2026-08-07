#include "auth.h"
#include "mediatoken.h"
#include "sha256.h"
#include <cstdlib>
#include <cstring>
#include <sstream>
#include <ctime>

static void to_hex(const unsigned char* data, size_t len, char* out) {
    static const char* hex = "0123456789abcdef";
    for (size_t i = 0; i < len; i++) {
        out[i * 2] = hex[(data[i] >> 4) & 0xF];
        out[i * 2 + 1] = hex[data[i] & 0xF];
    }
    out[len * 2] = '\0';
}

static int from_hex(const char* in, unsigned char* out, size_t out_len) {
    size_t in_len = strlen(in);
    if (in_len % 2 != 0 || in_len / 2 > out_len) return -1;
    for (size_t i = 0; i < in_len; i += 2) {
        char hi = in[i], lo = in[i + 1];
        auto hex_val = [](char c) -> int {
            if (c >= '0' && c <= '9') return c - '0';
            if (c >= 'a' && c <= 'f') return c - 'a' + 10;
            if (c >= 'A' && c <= 'F') return c - 'A' + 10;
            return -1;
        };
        int h = hex_val(hi), l = hex_val(lo);
        if (h < 0 || l < 0) return -1;
        out[i / 2] = static_cast<unsigned char>((h << 4) | l);
    }
    return 0;
}

const char* auth_hash_password(const char* password, char* output, size_t output_len) {
    if (!password || !output) return nullptr;

    unsigned char salt[16];
    unsigned char key[32];
    if (crypto_random_bytes(salt, sizeof(salt)) != 0) return nullptr;

    if (pbkdf2_hmac_sha256(password, strlen(password),
                           salt, sizeof(salt), 100000,
                           key, sizeof(key)) != 0) return nullptr;

    std::stringstream ss;
    ss << "pbkdf2$100000$";
    char hex_buf[64];
    to_hex(salt, sizeof(salt), hex_buf);
    ss << hex_buf << "$";
    to_hex(key, sizeof(key), hex_buf);
    ss << hex_buf;

    std::string result = ss.str();
    if (result.size() + 1 > output_len) return nullptr;
    strcpy(output, result.c_str());
    return output;
}

int auth_verify_password(const char* password, const char* hash) {
    if (!password || !hash) return -1;

    if (strncmp(hash, "pbkdf2$", 7) != 0) return -1;

    std::string h(hash);
    std::stringstream ss(h);
    std::string scheme, iter_str, salt_hex, key_hex;
    if (!std::getline(ss, scheme, '$')) return -1;
    if (!std::getline(ss, iter_str, '$')) return -1;
    if (!std::getline(ss, salt_hex, '$')) return -1;
    if (!std::getline(ss, key_hex, '$')) return -1;

    int iterations = atoi(iter_str.c_str());
    if (iterations <= 0) return -1;

    unsigned char salt[16];
    unsigned char expected[32];
    if (salt_hex.size() != 32) return -1;
    if (key_hex.size() != 64) return -1;
    if (from_hex(salt_hex.c_str(), salt, sizeof(salt)) != 0) return -1;
    if (from_hex(key_hex.c_str(), expected, sizeof(expected)) != 0) return -1;

    unsigned char key[32];
    if (pbkdf2_hmac_sha256(password, strlen(password),
                           salt, sizeof(salt), iterations,
                           key, sizeof(key)) != 0) return -1;

    return crypto_const_compare(key, expected, sizeof(key)) == 0 ? 0 : -1;
}

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