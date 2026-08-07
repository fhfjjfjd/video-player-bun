#include "sha256.h"

#include <stdio.h>
#include <string.h>

#ifdef _WIN32
#include <windows.h>
#include <wincrypt.h>
#endif

#define ROTR(x, n) (((x) >> (n)) | ((x) << (32 - (n))))

static const uint32_t K[64] = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
};

void sha256_init(sha256_ctx* ctx) {
    ctx->state[0] = 0x6a09e667;
    ctx->state[1] = 0xbb67ae85;
    ctx->state[2] = 0x3c6ef372;
    ctx->state[3] = 0xa54ff53a;
    ctx->state[4] = 0x510e527f;
    ctx->state[5] = 0x9b05688c;
    ctx->state[6] = 0x1f83d9ab;
    ctx->state[7] = 0x5be0cd19;
    ctx->bitlen = 0;
    ctx->buflen = 0;
}

static void sha256_compress(sha256_ctx* ctx, const uint8_t* block) {
    uint32_t w[64];
    uint32_t a, b, c, d, e, f, g, h, t1, t2;
    int i;

    for (i = 0; i < 16; i++) {
        w[i] = ((uint32_t)block[i * 4] << 24) |
               ((uint32_t)block[i * 4 + 1] << 16) |
               ((uint32_t)block[i * 4 + 2] << 8) |
               ((uint32_t)block[i * 4 + 3]);
    }
    for (i = 16; i < 64; i++) {
        uint32_t s0 = ROTR(w[i - 15], 7) ^ ROTR(w[i - 15], 18) ^ (w[i - 15] >> 3);
        uint32_t s1 = ROTR(w[i - 2], 17) ^ ROTR(w[i - 2], 19) ^ (w[i - 2] >> 10);
        w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }

    a = ctx->state[0];
    b = ctx->state[1];
    c = ctx->state[2];
    d = ctx->state[3];
    e = ctx->state[4];
    f = ctx->state[5];
    g = ctx->state[6];
    h = ctx->state[7];

    for (i = 0; i < 64; i++) {
        uint32_t S1 = ROTR(e, 6) ^ ROTR(e, 11) ^ ROTR(e, 25);
        uint32_t ch = (e & f) ^ (~e & g);
        t1 = h + S1 + ch + K[i] + w[i];
        uint32_t S0 = ROTR(a, 2) ^ ROTR(a, 13) ^ ROTR(a, 22);
        uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
        t2 = S0 + maj;
        h = g;
        g = f;
        f = e;
        e = d + t1;
        d = c;
        c = b;
        b = a;
        a = t1 + t2;
    }

    ctx->state[0] += a;
    ctx->state[1] += b;
    ctx->state[2] += c;
    ctx->state[3] += d;
    ctx->state[4] += e;
    ctx->state[5] += f;
    ctx->state[6] += g;
    ctx->state[7] += h;
}

void sha256_update(sha256_ctx* ctx, const void* data, size_t len) {
    const uint8_t* p = (const uint8_t*)data;
    ctx->bitlen += (uint64_t)len * 8;

    while (len > 0) {
        size_t take = 64 - ctx->buflen;
        if (take > len) take = len;
        memcpy(ctx->buffer + ctx->buflen, p, take);
        ctx->buflen += take;
        p += take;
        len -= take;
        if (ctx->buflen == 64) {
            sha256_compress(ctx, ctx->buffer);
            ctx->buflen = 0;
        }
    }
}

void sha256_final(sha256_ctx* ctx, uint8_t out[SHA256_DIGEST_SIZE]) {
    uint64_t bitlen = ctx->bitlen;
    uint8_t pad = 0x80;

    sha256_update(ctx, &pad, 1);

    uint8_t zero = 0;
    while (ctx->buflen != 56) {
        sha256_update(ctx, &zero, 1);
    }

    uint8_t len_bytes[8];
    for (int i = 0; i < 8; i++) {
        len_bytes[i] = (uint8_t)(bitlen >> (56 - i * 8));
    }
    sha256_update(ctx, len_bytes, 8);

    for (int i = 0; i < 8; i++) {
        out[i * 4] = (uint8_t)(ctx->state[i] >> 24);
        out[i * 4 + 1] = (uint8_t)(ctx->state[i] >> 16);
        out[i * 4 + 2] = (uint8_t)(ctx->state[i] >> 8);
        out[i * 4 + 3] = (uint8_t)(ctx->state[i]);
    }
}

void hmac_sha256(const uint8_t* key, size_t key_len,
                 const uint8_t* data, size_t data_len,
                 uint8_t out[SHA256_DIGEST_SIZE]) {
    uint8_t k_pad[64];
    uint8_t inner[SHA256_DIGEST_SIZE];
    sha256_ctx ctx;

    memset(k_pad, 0, sizeof(k_pad));
    if (key_len > sizeof(k_pad)) {
        sha256_init(&ctx);
        sha256_update(&ctx, key, key_len);
        sha256_final(&ctx, k_pad);
    } else {
        memcpy(k_pad, key, key_len);
    }

    uint8_t ipad[64], opad[64];
    for (int i = 0; i < 64; i++) {
        ipad[i] = k_pad[i] ^ 0x36;
        opad[i] = k_pad[i] ^ 0x5c;
    }

    sha256_init(&ctx);
    sha256_update(&ctx, ipad, 64);
    sha256_update(&ctx, data, data_len);
    sha256_final(&ctx, inner);

    sha256_init(&ctx);
    sha256_update(&ctx, opad, 64);
    sha256_update(&ctx, inner, SHA256_DIGEST_SIZE);
    sha256_final(&ctx, out);
}

static void pbkdf2_f(const uint8_t* pwd, size_t pwd_len,
                     const uint8_t* salt, size_t salt_len,
                     int iterations, uint32_t block_index,
                     uint8_t out[SHA256_DIGEST_SIZE]) {
    uint8_t u[SHA256_DIGEST_SIZE];
    uint8_t t[SHA256_DIGEST_SIZE];
    uint8_t mac_key[64];
    size_t mac_key_len = pwd_len;

    memset(mac_key, 0, sizeof(mac_key));
    if (pwd_len > sizeof(mac_key)) {
        sha256_ctx ctx;
        sha256_init(&ctx);
        sha256_update(&ctx, pwd, pwd_len);
        sha256_final(&ctx, mac_key);
        mac_key_len = SHA256_DIGEST_SIZE;
    } else {
        memcpy(mac_key, pwd, pwd_len);
    }

    uint8_t block[128];
    size_t bpos = 0;
    if (salt_len < sizeof(block) - 4) {
        memcpy(block, salt, salt_len);
        bpos = salt_len;
    } else {
        hmac_sha256(mac_key, mac_key_len, salt, salt_len, block);
        bpos = SHA256_DIGEST_SIZE;
    }
    block[bpos++] = (uint8_t)(block_index >> 24);
    block[bpos++] = (uint8_t)(block_index >> 16);
    block[bpos++] = (uint8_t)(block_index >> 8);
    block[bpos++] = (uint8_t)(block_index);

    hmac_sha256(mac_key, mac_key_len, block, bpos, u);
    memcpy(t, u, SHA256_DIGEST_SIZE);

    for (int i = 1; i < iterations; i++) {
        hmac_sha256(mac_key, mac_key_len, u, SHA256_DIGEST_SIZE, u);
        for (int j = 0; j < SHA256_DIGEST_SIZE; j++) {
            t[j] ^= u[j];
        }
    }

    memcpy(out, t, SHA256_DIGEST_SIZE);
}

int pbkdf2_hmac_sha256(const char* password, size_t pwd_len,
                       const uint8_t* salt, size_t salt_len,
                       int iterations, uint8_t* dk, size_t dk_len) {
    if (!password || !dk || iterations < 1 || dk_len == 0) return -1;
    if (dk_len > 64 * SHA256_DIGEST_SIZE) return -1;

    const uint8_t* pwd = (const uint8_t*)password;
    size_t blocks = (dk_len + SHA256_DIGEST_SIZE - 1) / SHA256_DIGEST_SIZE;

    for (uint32_t i = 1; i <= blocks; i++) {
        uint8_t t[SHA256_DIGEST_SIZE];
        pbkdf2_f(pwd, pwd_len, salt, salt_len, iterations, i, t);
        size_t off = (size_t)(i - 1) * SHA256_DIGEST_SIZE;
        size_t take = dk_len - off;
        if (take > SHA256_DIGEST_SIZE) take = SHA256_DIGEST_SIZE;
        memcpy(dk + off, t, take);
    }

    return 0;
}

int crypto_random_bytes(uint8_t* out, size_t len) {
    if (!out) return -1;
#ifdef _WIN32
    {
        HCRYPTPROV prov = 0;
        if (!CryptAcquireContextW(&prov, NULL, NULL, PROV_RSA_FULL, CRYPT_VERIFYCONTEXT | CRYPT_SILENT))
            return -1;
        BOOL ok = CryptGenRandom(prov, (DWORD)len, out);
        CryptReleaseContext(prov, 0);
        return ok ? 0 : -1;
    }
#else
    FILE* f = fopen("/dev/urandom", "rb");
    if (!f) return -1;
    size_t got = fread(out, 1, len, f);
    fclose(f);
    return got == len ? 0 : -1;
#endif
}

int crypto_const_compare(const uint8_t* a, const uint8_t* b, size_t len) {
    uint8_t diff = 0;
    for (size_t i = 0; i < len; i++) {
        diff |= (uint8_t)(a[i] ^ b[i]);
    }
    return diff == 0 ? 0 : -1;
}
