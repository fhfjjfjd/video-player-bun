#ifndef SECURITY_H
#define SECURITY_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

const char* security_get_headers(char* output, size_t output_len);

#ifdef __cplusplus
}
#endif

#endif