#!/bin/bash
set -e

SRC_DIR="$(dirname "$0")/src/server/cpp"
OUT_DIR="$(dirname "$0")/src/server/cpp/lib"
mkdir -p "$OUT_DIR"

echo "Building C++ shared libraries..."

g++ -shared -fPIC -O2 -o "$OUT_DIR/libmediatoken.so" "$SRC_DIR/mediatoken.cpp" -I"$SRC_DIR" -lssl -lcrypto -lstdc++
echo "  [OK] libmediatoken.so"

g++ -shared -fPIC -O2 -o "$OUT_DIR/libsecurity.so" "$SRC_DIR/security.cpp" -I"$SRC_DIR" -lstdc++
echo "  [OK] libsecurity.so"

g++ -shared -fPIC -O2 -o "$OUT_DIR/libauth.so" "$SRC_DIR/auth.cpp" "$SRC_DIR/mediatoken.cpp" -I"$SRC_DIR" -lssl -lcrypto -lstdc++
echo "  [OK] libauth.so"

g++ -shared -fPIC -O2 -o "$OUT_DIR/libdb.so" "$SRC_DIR/db.cpp" -I"$SRC_DIR" -lsqlite3 -lstdc++
echo "  [OK] libdb.so"

g++ -shared -fPIC -O2 -o "$OUT_DIR/libvideos.so" "$SRC_DIR/videos.cpp" "$SRC_DIR/mediatoken.cpp" -I"$SRC_DIR" -lsqlite3 -lssl -lcrypto -lstdc++
echo "  [OK] libvideos.so"

echo "All C++ libraries built successfully in $OUT_DIR/"