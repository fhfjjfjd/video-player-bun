#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/src/server/cpp"
OUT="$ROOT/src/server/cpp/lib"
mkdir -p "$OUT"

CXX_BIN="${CXX:-g++}"
TARGET="${TARGET_OS:-$(uname -s 2>/dev/null || echo unknown)}"

case "$TARGET" in
  MINGW*|MSYS*|CYGWIN*|Windows*|windows)
    BIN_NAME="video-server.exe"
    LIBS="-lws2_32 -lwinpthread"
    ;;
  *)
    BIN_NAME="video-server"
    LIBS="-lpthread -lm"
    ;;
esac

if [[ "$CXX" == *android* ]]; then
  LIBS="-lpthread -lm"
fi

echo "Building C++ server ($BIN_NAME) with $CXX_BIN ..."

"$CXX_BIN" -std=c++17 -O2 -pthread $EXTRA_CFLAGS \
    -DSQLITE_THREADSAFE=1 -DSQLITE_OMIT_LOAD_EXTENSION \
    -I"$SRC" -I"$SRC/vendor" \
    "$SRC/server.cpp" \
    "$SRC/server_handlers.cpp" \
    "$SRC/db.cpp" \
    "$SRC/auth.cpp" \
    "$SRC/mediatoken.cpp" \
    "$SRC/sha256.cpp" \
    "$SRC/vendor/sqlite3.c" \
    -o "$OUT/$BIN_NAME" $LIBS

echo "  [OK] $OUT/$BIN_NAME"
echo "C++ server built successfully."
