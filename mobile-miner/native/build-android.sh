#!/usr/bin/env bash
set -euo pipefail
: "${ANDROID_NDK_HOME:?Android NDK required}"
TASK_ROOT=$(cd "$(dirname "$0")" && pwd)
TASK_BUILD="$TASK_ROOT/build"
TASK_PREFIX="$TASK_BUILD/prefix"
TASK_TOOLCHAIN="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64"
export PATH="$TASK_TOOLCHAIN/bin:$PATH"
export ANDROID_NDK_ROOT="$ANDROID_NDK_HOME"
export CC=aarch64-linux-android29-clang CXX=aarch64-linux-android29-clang++
export AR=llvm-ar RANLIB=llvm-ranlib STRIP=llvm-strip
mkdir -p "$TASK_PREFIX" "$TASK_BUILD"
fetch_source() {
  local repo="$1" commit="$2" dest="$3"
  if [ ! -d "$dest/.git" ]; then
    git init "$dest"
    git -C "$dest" remote add origin "https://github.com/$repo.git"
    git -C "$dest" fetch --depth 1 origin "$commit"
  fi
  git -C "$dest" checkout --detach "$commit"
  test "$(git -C "$dest" rev-parse HEAD)" = "$commit"
}
fetch_source openssl/openssl 636dfadc70ce26f2473870570bfd9ec352806b1d "$TASK_BUILD/openssl"
fetch_source curl/curl 57495c64871d18905a0941db9196ef90bafe9a29 "$TASK_BUILD/curl"
fetch_source monkins1010/ccminer 1667394ad4120d64b0c57367e71cb832ad2e3645 "$TASK_BUILD/engine"
(
  cd "$TASK_BUILD/openssl"
  env -u CC -u CXX ./Configure android-arm64 -D__ANDROID_API__=29 no-shared no-tests --prefix="$TASK_PREFIX"
  make -j2
  make install_sw
)
(
  cd "$TASK_BUILD/curl"
  autoreconf -fi
  ./configure --host=aarch64-linux-android --prefix="$TASK_PREFIX" --disable-shared --enable-static \
    --without-ssl --without-zlib --without-brotli --without-zstd --without-libpsl \
    --without-libidn2 --without-librtmp --without-libssh2 --without-nghttp2 --without-nghttp3 \
    --disable-ldap --disable-ldaps --disable-manual --disable-docs
  make -j2
  make install
)
(
  cd "$TASK_BUILD/engine"
  chmod +x autogen.sh
  ACLOCAL_PATH="$TASK_PREFIX/share/aclocal" ./autogen.sh
  # Kill the native child if its Android parent dies, including process death without onDestroy.
  python3 - <<'PARENT_DEATH_PATCH'
from pathlib import Path
p = Path('ccminer.cpp')
s = p.read_text()
marker = '#include <signal.h>'
patch = '''
#ifdef __ANDROID__
#include <sys/prctl.h>
__attribute__((constructor)) static void marsx_parent_death_guard() {
    pid_t parent = getppid();
    if (parent == 1 || prctl(PR_SET_PDEATHSIG, SIGKILL) != 0 || getppid() != parent) _exit(125);
}
#endif
'''
if 'marsx_parent_death_guard' not in s:
    if s.count(marker) != 1: raise SystemExit('unexpected upstream include layout')
    p.write_text(s.replace(marker, marker + patch))
PARENT_DEATH_PATCH
  # Raw Stratum is permitted only on loopback behind the Android verified TLS relay.
  # OpenSSL is required for upstream hashing; remote TLS is handled by Android.
  CPPFLAGS="-I$TASK_PREFIX/include" LDFLAGS="-L$TASK_PREFIX/lib -L$TASK_PREFIX/lib64" \
    LIBS="-lcrypto -ldl -lm" CFLAGS="-O2 -fPIE" CXXFLAGS="-O2 -fPIE" CURL_CONFIG="$TASK_PREFIX/bin/curl-config" \
    ./configure --host=aarch64-linux-android --target=aarch64-linux-android \
      ac_cv_prog_c_openmp=unsupported ac_cv_prog_cxx_openmp=unsupported
  make -j2
  mkdir -p "$TASK_BUILD/artifact"
  cp ccminer "$TASK_BUILD/artifact/libmarsxminer.so"
  llvm-readelf -l ccminer | tee "$TASK_BUILD/artifact/elf-program-headers.txt"
  llvm-readelf -d ccminer | tee "$TASK_BUILD/artifact/elf-dependencies.txt"
  grep -q '/system/bin/linker64' "$TASK_BUILD/artifact/elf-program-headers.txt"
  if grep -Eq 'libc\.so\.6|libssl\.so|libcrypto\.so|libcurl\.so' "$TASK_BUILD/artifact/elf-dependencies.txt"; then
    echo 'Unexpected host/dynamic dependency'; exit 1
  fi
  if grep -q 'libc++_shared.so' "$TASK_BUILD/artifact/elf-dependencies.txt"; then
    cp "$TASK_TOOLCHAIN/sysroot/usr/lib/aarch64-linux-android/libc++_shared.so" "$TASK_BUILD/artifact/"
  fi
  cp LICENSE.txt "$TASK_BUILD/artifact/ENGINE-LICENSE.txt"
  sha256sum "$TASK_BUILD/artifact/"*.so > "$TASK_BUILD/artifact/SHA256SUMS"
  printf 'engine=1667394ad4120d64b0c57367e71cb832ad2e3645\nopenssl=636dfadc70ce26f2473870570bfd9ec352806b1d\ncurl=57495c64871d18905a0941db9196ef90bafe9a29\nndk=27.2.12479018\nabi=arm64-v8a\nparent_death=SIGKILL\napi=29\n' > "$TASK_BUILD/artifact/PROVENANCE.txt"
)
