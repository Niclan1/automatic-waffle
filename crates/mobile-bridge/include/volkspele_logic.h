#ifndef VOLKSPELE_LOGIC_H
#define VOLKSPELE_LOGIC_H
char *rust_parse_catalog(const char *input);
char *rust_sha256_base64(const char *input);
char *rust_sha256_file(const char *input);
char *rust_fetch_catalog(const char *input);
char *rust_is_newer(const char *current, const char *latest);
void rust_free_string(char *output);
#endif
