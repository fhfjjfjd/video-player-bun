#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/src/server/cpp"
OUT="$ROOT/src/server/cpp/lib"
mkdir -p "$OUT"

CXX_BIN="${CXX:-g++}"
CC_BIN="${CC:-cc}"
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
  LIBS="-lm"
fi

SQLITE_FLAGS="-DSQLITE_THREADSAFE=1 -DSQLITE_OMIT_LOAD_EXTENSION"

echo "Building C++ server ($BIN_NAME) with $CXX_BIN + $CC_BIN ..."

echo "  [1/2] Compiling SQLite (C) ..."
"$CC_BIN" -O2 $EXTRA_CFLAGS $SQLITE_FLAGS \
    -c "$SRC/vendor/sqlite3.c" -o "$OUT/sqlite3.o"

echo "  [2/2] Compiling C++ sources and linking ..."
"$CXX_BIN" -std=c++17 -O2 -pthread $EXTRA_CFLAGS $SQLITE_FLAGS \
    -I"$SRC" -I"$SRC/vendor" \
    "$SRC/server.cpp" \
    "$SRC/server_handlers.cpp" \
    "$SRC/db.cpp" \
    "$SRC/auth.cpp" \
    "$SRC/mediatoken.cpp" \
    "$SRC/sha256.cpp" \
    "$OUT/sqlite3.o" \
    -o "$OUT/$BIN_NAME" $LIBS

echo "  [OK] $OUT/$BIN_NAME"
echo "C++ server built successfully."
