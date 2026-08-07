#ifndef CSHA256_H
#define CSHA256_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define SHA256_DIGEST_SIZE 32

typedef struct {
    uint32_t state[8];
    uint64_t bitlen;
    uint8_t buffer[64];
    size_t buflen;
} sha256_ctx;

void sha256_init(sha256_ctx* ctx);
void sha256_update(sha256_ctx* ctx, const void* data, size_t len);
void sha256_final(sha256_ctx* ctx, uint8_t out[SHA256_DIGEST_SIZE]);

void hmac_sha256(const uint8_t* key, size_t key_len,
                 const uint8_t* data, size_t data_len,
                 uint8_t out[SHA256_DIGEST_SIZE]);

/* PBKDF2-HMAC-SHA256 (RFC 2898). dk_len must be <= 64*32 bytes. */
int pbkdf2_hmac_sha256(const char* password, size_t pwd_len,
                       const uint8_t* salt, size_t salt_len,
                       int iterations, uint8_t* dk, size_t dk_len);

/* Cryptographically secure random bytes. Returns 0 on success, -1 on failure. */
int crypto_random_bytes(uint8_t* out, size_t len);

/* Constant-time comparison. Returns 0 if equal. */
int crypto_const_compare(const uint8_t* a, const uint8_t* b, size_t len);

#ifdef __cplusplus
}
#endif

#endif
