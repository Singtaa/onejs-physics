#!/usr/bin/env python3
"""
Runs a script in OneJS's engine with one native module registered, outside
Unity, and compares the answer it leaves in globalThis.__parity.

    python3 run-js.py <engine library> <module library> <name> <script.js>

Exits 0 when the hash is the expected one, 1 when it is not or the script
threw, 2 when a library will not load, and 3 when the script left no answer.
"""
import ctypes
import json
import sys


def main():
    if len(sys.argv) != 5:
        print(__doc__.strip())
        return 2
    engine_path, module_path, name, script_path = sys.argv[1:]
    try:
        engine = ctypes.CDLL(engine_path)
        module = ctypes.CDLL(module_path)
    except OSError as e:
        print(f"FAIL  cannot load: {e}")
        return 2
    table = getattr(module, f"onejs_wasm_{name}")
    table.restype = ctypes.c_void_p
    engine.qjs_register_wasm_module.argtypes = [ctypes.c_void_p]
    if engine.qjs_register_wasm_module(table()) != 0:
        print("FAIL  the engine refused the module")
        return 1
    engine.qjs_create.restype = ctypes.c_void_p
    engine.qjs_eval.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_int,
                                ctypes.c_char_p, ctypes.c_int]
    engine.qjs_destroy.argtypes = [ctypes.c_void_p]
    ctx = engine.qjs_create()
    buf = ctypes.create_string_buffer(64 * 1024)
    with open(script_path, "rb") as f:
        code = f.read()
    if engine.qjs_eval(ctx, code, script_path.encode(), 0, buf, len(buf)) != 0:
        print(f"FAIL  the script threw: {buf.value.decode('utf-8', 'replace')}")
        engine.qjs_destroy(ctx)
        return 1
    engine.qjs_eval(ctx, b"String(globalThis.__parity)", b"answer", 0, buf, len(buf))
    engine.qjs_destroy(ctx)
    text = buf.value.decode("utf-8", "replace")
    if text == "undefined":
        print("Nothing compared: the script left no answer.")
        return 3
    answer = json.loads(text)
    if answer["hash"] == answer["expected"]:
        print(f"ok    {answer['hash']}, the hash every browser gets")
        return 0
    print(f"FAIL  {answer['hash']}, expected {answer['expected']}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
