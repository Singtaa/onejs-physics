#!/bin/bash
# The native 3D module against the browser: oj's determinism fixture (100
# boxes, 300 steps, every body hashed as 64-bit floats) run through OneJS's
# engine with the module built here for this machine, which has to give the
# hash Node, Chrome and workerd give. Then the same fixture with one box fewer,
# which the check has to fail: one that passes it is measuring nothing.
#
#     ONEJS_DIR=<OneJS checkout> OJPLAY_DIR=<onejs-play checkout> Tests~/parity.sh
#
# Builds the module unless build/package/Plugins already has it for this host.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${ONEJS_DIR:?set ONEJS_DIR to a OneJS checkout}"
: "${OJPLAY_DIR:?set OJPLAY_DIR to a onejs-play checkout with 3D physics}"
case "$(uname -s)" in
    Darwin) PLATFORM=macos; ENGINE="$ONEJS_DIR/Plugins/macOS/libquickjs_unity.dylib"; LIB="$HERE/build/package/Plugins/macOS/libonejs_rapier3d.dylib" ;;
    Linux)  PLATFORM=linux; export ONEJS_IN_CONTAINER=1; ENGINE="$ONEJS_DIR/Plugins/Linux/x64/libquickjs_unity.so"; LIB="$HERE/build/package/Plugins/Linux/x64/libonejs_rapier3d.so" ;;
    *) echo "macOS or Linux only"; exit 2 ;;
esac
[ -f "$LIB" ] || node "$HERE/Tools~/build.mjs" 0.0.0 "$PLATFORM"

OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
node "$HERE/Tests~/bundle.mjs" "$OJPLAY_DIR" "$OUT/parity.js"
node "$HERE/Tests~/bundle.mjs" "$OJPLAY_DIR" "$OUT/short.js" 1

STATUS=0
echo "=== the fixture ==="
python3 "$HERE/Tests~/run-js.py" "$ENGINE" "$LIB" rapier3d "$OUT/parity.js" || STATUS=1
echo "=== one box fewer, which must fail ==="
set +e
python3 "$HERE/Tests~/run-js.py" "$ENGINE" "$LIB" rapier3d "$OUT/short.js"
SHORT=$?
set -e
if [ "$SHORT" -eq 1 ]; then echo "ok    the check failed the run with a box fewer"; else echo "FAIL  the check did not fail the run with a box fewer (exit $SHORT)"; STATUS=1; fi
[ "$STATUS" -eq 0 ] && echo PASS || echo FAIL
exit "$STATUS"
