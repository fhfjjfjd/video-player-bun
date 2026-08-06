#include <stddef.h>
#ifndef AUTH_H
#define AUTH_H

#ifdef __cplusplus
extern "C" {
#endif

const char* auth_create_session(int user_id, const char* secret, char* output, size_t output_len);
int auth_validate_session(const char* token, const char* secret, int* user_id_out);

#ifdef __cplusplus
}
#endif

#endif