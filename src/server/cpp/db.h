#ifndef DB_H
#define DB_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef void* DBHandle;

DBHandle db_init(const char* db_path);
void db_close(DBHandle db);

int db_create_user(const char* username, const char* email, const char* password_hash, int* user_id_out);
int db_find_user_by_username(const char* username, char* email_out, size_t email_len, char* hash_out, size_t hash_len);
int db_find_user_by_email(const char* email, char* username_out, size_t username_len, char* hash_out, size_t hash_len);
int db_find_user_by_identifier(const char* identifier, char* username_out, size_t username_len, char* email_out, size_t email_len, char* hash_out, size_t hash_len);
int db_find_user_by_id(int user_id, char* output, size_t output_len);
int db_get_user_id_by_username(const char* username, int* user_id_out);

int db_create_session(int user_id, const char* token, const char* expires_at);
int db_find_user_by_session_token(const char* token, int* user_id_out);
int db_delete_session(const char* token);

int db_create_video(int user_id, const char* title, const char* filename, long long size, const char* content_type, const char* thumbnail_filename, int* video_id_out);
int db_list_all_videos(const char* query, char* output, size_t output_len);
int db_find_video_by_id(int id, char* output, size_t output_len);
int db_find_video_by_id_and_user(int id, int user_id, char* output, size_t output_len);
int db_find_video_by_filename(const char* filename, char* output, size_t output_len);
int db_delete_video(int id);

#ifdef __cplusplus
}
#endif

#endif