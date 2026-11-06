#!/bin/bash
# Each native module against WebAssembly: a determinism fixture (100 boxes,
# 300 steps, every body hashed as 64-bit floats) run through OneJS's engine
# with the module built here for this machine, which has to give the hash
# WebAssembly gives. Then the same fixture with one box fewer, which the check
# has to fail: one that passes it is measuring nothing.
#
#   rapier3d  oj's fixture (src/physics3d/parity.mjs), held to the hash Node,
#             Chrome and workerd give; Node is checked against it here too.
#   rapier2d  falling-boxes-2d.mjs, held to the hash Node's WebAssembly gives
#             with the same module, since no 2D hash has been agreed across
#             browsers yet.
#
#     ONEJS_DIR=<OneJS checkout> OJPLAY_DIR=<onejs-play checkout> Tests~/parity.sh [rapier3d rapier2d]
#
# Builds a module unless build/package/Plugins already has it for this host.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${ONEJS_DIR:?set ONEJS_DIR to a OneJS checkout}"
: "${OJPLAY_DIR:?set OJPLAY_DIR to a onejs-play checkout with 2D and 3D physics}"
MODULES=("$@")
[ ${#MODULES[@]} -gt 0 ] || MODULES=(rapier3d rapier2d)
case "$(uname -s)" in
    Darwin) PLATFORM=macos; ENGINE="$ONEJS_DIR/Plugins/macOS/libquickjs_unity.dylib"; LIBDIR="$HERE/build/package/Plugins/macOS"; EXT=dylib ;;
    Linux)  PLATFORM=linux; export ONEJS_IN_CONTAINER=1; ENGINE="$ONEJS_DIR/Plugins/Linux/x64/libquickjs_unity.so"; LIBDIR="$HERE/build/package/Plugins/Linux/x64"; EXT=so ;;
    *) echo "macOS or Linux only"; exit 2 ;;
esac
for name in "${MODULES[@]}"; do
    [ -f "$LIBDIR/libonejs_$name.$EXT" ] && [ -f "$HERE/build/npm/$name/$name.wasm" ] || { node "$HERE/Tools~/build.mjs" 0.0.0 "$PLATFORM"; break; }
done

OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
STATUS=0
for name in "${MODULES[@]}"; do
    dim="${name#rapier}"; dim="${dim%d}"
    LIB="$LIBDIR/libonejs_$name.$EXT"
    echo "=== $name: WebAssembly in Node ==="
    node "$HERE/Tests~/bundle.mjs" "$OJPLAY_DIR" "$dim" node "$OUT/$name-node.js"
    EXPECTED="$(node "$HERE/Tests~/node-hash.mjs" "$OUT/$name-node.js" "$HERE/build/npm/$name/$name.wasm")" || { echo "FAIL  Node could not give a reference hash"; STATUS=1; continue; }
    echo "      $EXPECTED"
    node "$HERE/Tests~/bundle.mjs" "$OJPLAY_DIR" "$dim" quickjs "$OUT/$name.js" 0 "$EXPECTED"
    node "$HERE/Tests~/bundle.mjs" "$OJPLAY_DIR" "$dim" quickjs "$OUT/$name-short.js" 1 "$EXPECTED"
    echo "=== $name: the native module in OneJS's engine ==="
    python3 "$HERE/Tests~/run-js.py" "$ENGINE" "$LIB" "$name" "$OUT/$name.js" || STATUS=1
    echo "=== $name: one box fewer, which must fail ==="
    set +e
    python3 "$HERE/Tests~/run-js.py" "$ENGINE" "$LIB" "$name" "$OUT/$name-short.js"
    SHORT=$?
    set -e
    if [ "$SHORT" -eq 1 ]; then echo "ok    the check failed the run with a box fewer"; else echo "FAIL  the check did not fail the run with a box fewer (exit $SHORT)"; STATUS=1; fi
done
[ "$STATUS" -eq 0 ] && echo PASS || echo FAIL
exit "$STATUS"
