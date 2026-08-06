#ifndef MEDIATOKEN_H
#define MEDIATOKEN_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

const char* mediatoken_sign(const char* filename, const char* secret, char* output, size_t output_len);
int mediatoken_verify(const char* token, const char* secret, char* output, size_t output_len);

#ifdef __cplusplus
}
#endif

#endif