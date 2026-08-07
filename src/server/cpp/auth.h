#ifndef AUTH_H
#define AUTH_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

const char* auth_create_session(int user_id, const char* secret, char* output, size_t output_len);
int auth_validate_session(const char* token, const char* secret, int* user_id_out);
int auth_verify_password(const char* password, const char* hash);
const char* auth_hash_password(const char* password, char* output, size_t output_len);

#ifdef __cplusplus
}
#endif

#endif