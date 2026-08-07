#include "mediatoken.h"
#include "sha256.h"
#include <cstring>
#include <cstdlib>
#include <sstream>
#include <iomanip>
#include <fstream>
#include <random>
#include <sys/stat.h>

#ifdef _WIN32
#include <io.h>
#define chmod _chmod
#endif

static std::string load_secret_from_file(const char* path) {
    std::ifstream f(path);
    if (!f.is_open()) return "";
    std::stringstream ss;
    ss << f.rdbuf();
    std::string secret = ss.str();
    while (!secret.empty() && (secret.back() == '\n' || secret.back() == '\r')) {
        secret.pop_back();
    }
    return secret;
}

static std::string load_secret() {
    const char* from_env = std::getenv("MEDIA_URL_SECRET");
    if (from_env && strlen(from_env) > 0) return from_env;

    const char* from_file_env = std::getenv("MEDIA_SECRET_FILE");
    std::string file_path = from_file_env ? from_file_env : ".media-secret";
    std::string from_file = load_secret_from_file(file_path.c_str());
    if (!from_file.empty()) return from_file;

    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(0, 255);
    std::stringstream ss;
    for (int i = 0; i < 32; i++) {
        ss << std::hex << std::setw(2) << std::setfill('0') << dis(gen);
    }
    std::string generated = ss.str();
    std::ofstream out(file_path, std::ios::binary);
    if (out.is_open()) {
        out << generated;
        out.close();
        chmod(file_path.c_str(), 0600);
    }
    return generated;
}

static std::string base64url_encode(const unsigned char* data, size_t len) {
    static const char* alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    std::string result;
    result.reserve(((len + 2) / 3) * 4);
    for (size_t i = 0; i < len; i += 3) {
        uint32_t triple = (static_cast<uint32_t>(data[i]) << 16);
        if (i + 1 < len) triple |= (static_cast<uint32_t>(data[i + 1]) << 8);
        if (i + 2 < len) triple |= static_cast<uint32_t>(data[i + 2]);
        result += alphabet[(triple >> 18) & 0x3F];
        result += alphabet[(triple >> 12) & 0x3F];
        result += (i + 1 < len) ? alphabet[(triple >> 6) & 0x3F] : '=';
        result += (i + 2 < len) ? alphabet[triple & 0x3F] : '=';
    }
    while (!result.empty() && result.back() == '=') result.pop_back();
    return result;
}

static std::string base64url_decode(const char* input) {
    std::string s = input;
    while (s.size() % 4) s += '=';
    std::string result;
    result.reserve(s.size() * 3 / 4);
    for (size_t i = 0; i < s.size(); i += 4) {
        uint32_t val = 0;
        for (int j = 0; j < 4; j++) {
            char c = s[i + j];
            val <<= 6;
            if (c >= 'A' && c <= 'Z') val += c - 'A';
            else if (c >= 'a' && c <= 'z') val += c - 'a' + 26;
            else if (c >= '0' && c <= '9') val += c - '0' + 52;
            else if (c == '-') val += 62;
            else if (c == '_') val += 63;
        }
        for (int j = 0; j < 3 && i + j + 1 < s.size(); j++) {
            result += static_cast<char>((val >> (16 - 8 * j)) & 0xFF);
        }
    }
    return result;
}

const char* mediatoken_sign(const char* filename, const char* secret, char* output, size_t output_len) {
    if (!filename || !secret || !output) return nullptr;
    std::string fname(filename);
    long long expiry = static_cast<long long>(time(nullptr)) + 86400000;
    std::stringstream payload_ss;
    payload_ss << "{\"f\":\"" << fname << "\",\"e\":" << expiry << "}";
    std::string payload = payload_ss.str();

    std::string b64_payload = base64url_encode(reinterpret_cast<const unsigned char*>(payload.c_str()), payload.size());

    unsigned char hash[SHA256_DIGEST_SIZE];
    hmac_sha256(reinterpret_cast<const uint8_t*>(secret), strlen(secret),
                reinterpret_cast<const uint8_t*>(b64_payload.c_str()), b64_payload.size(),
                hash);

    std::string b64_sig = base64url_encode(hash, SHA256_DIGEST_SIZE);

    std::string token = b64_payload + "." + b64_sig;
    if (token.size() + 1 > output_len) return nullptr;
    strcpy(output, token.c_str());
    return output;
}

int mediatoken_verify(const char* token, const char* secret, char* output, size_t output_len) {
    if (!token || !secret || !output) return -1;
    std::string t(token);
    size_t dot_pos = t.rfind('.');
    if (dot_pos == std::string::npos || dot_pos == 0 || dot_pos == t.size() - 1) return -1;

    std::string payload_b64 = t.substr(0, dot_pos);
    std::string sig_b64 = t.substr(dot_pos + 1);

    if (sig_b64.size() != 43 && sig_b64.size() != 44) return -1;

    std::string payload_json = base64url_decode(payload_b64.c_str());

    unsigned char hash[SHA256_DIGEST_SIZE];
    hmac_sha256(reinterpret_cast<const uint8_t*>(secret), strlen(secret),
                reinterpret_cast<const uint8_t*>(payload_b64.c_str()), payload_b64.size(),
                hash);

    std::string expected_sig = base64url_encode(hash, SHA256_DIGEST_SIZE);
    if (sig_b64 != expected_sig) return -1;

    size_t e_pos = payload_json.find("\"e\":");
    if (e_pos == std::string::npos) return -1;
    long long expiry = atoll(payload_json.c_str() + e_pos + 4);
    if (expiry < static_cast<long long>(time(nullptr) * 1000)) return -1;

    size_t f_pos = payload_json.find("\"f\":\"");
    if (f_pos == std::string::npos) return -1;
    size_t f_start = f_pos + 5;
    size_t f_end = payload_json.find('"', f_start);
    if (f_end == std::string::npos) return -1;
    std::string filename = payload_json.substr(f_start, f_end - f_start);

    if (filename.find('/') != std::string::npos || filename.find('\\') != std::string::npos || filename.find("..") != std::string::npos) {
        return -1;
    }

    if (filename.size() + 1 > output_len) return -1;
    strcpy(output, filename.c_str());
    return 0;
}