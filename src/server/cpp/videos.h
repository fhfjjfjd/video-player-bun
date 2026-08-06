#include <stddef.h>
#ifndef VIDEOS_H
#define VIDEOS_H

#ifdef __cplusplus
extern "C" {
#endif

typedef void* VideoHandle;

VideoHandle videos_init(const char* upload_dir);
void videos_close(VideoHandle handle);

const char* videos_upload(VideoHandle handle, const char* video_path, const char* thumbnail_path, const char* title, const char* content_type, int user_id, char* output, size_t output_len);
const char* videos_get(VideoHandle handle, int id, char* output, size_t output_len);
const char* videos_list(VideoHandle handle, const char* query, char* output, size_t output_len);
int videos_delete(VideoHandle handle, int id, int user_id);
const char* videos_generate_thumbnail(VideoHandle handle, const char* video_path, char* output, size_t output_len);
const char* videos_serve_media(VideoHandle handle, const char* filename, const char* range_header, long long* content_length, int* status, char* content_type_out, size_t content_type_len, char* output, size_t output_len);

#ifdef __cplusplus
}
#endif

#endif