# OneJS Physics

Native physics for [OneJS](https://github.com/Singtaa/OneJS) outside the
browser. A Play cart's physics (`useWorld`, bodies, characters, rays,
triggers) runs on a physics engine compiled to WebAssembly. In a browser that
module runs as WebAssembly. In Unity on desktop, Android and iOS, OneJS runs
JavaScript in QuickJS, which has no WebAssembly. This package carries the same
module compiled to native code for each of those platforms, so the same cart
gives the same results there, down to the bit.

**You normally never install this by hand.** `ojplay add` and eject put it in
your Unity project's manifest when a cart uses physics, at the version that
matches the cart's `ojplay`.

## What it is

- **No API of its own.** Carts use oj's physics API (`useWorld`, `shape`,
  `world.cast`, ...), documented on [play.onejs.com](https://play.onejs.com/docs).
  Nothing in user code names the engine inside, and nothing here is called
  from C#.
- **The same module, byte for byte.** Each native library is generated from
  the exact `.wasm` oj loads in the browser, identified by its sha256. oj asks
  OneJS for the module by name and hash, so glue from one release never runs
  against a library from another: a mismatch fails at load, by name.
- **3D now, 2D next.** `rapier3d` is in this package; `rapier2d` joins it.
  Navigation (Recast) is a separate package.
- **WebGL needs nothing from here.** The browser runs the module itself, and
  this package's code is excluded from WebGL builds.

## Install

`ojplay add` (or eject) does this for you. By hand:

1. Install a [OneJS](https://github.com/Singtaa/OneJS) that serves native
   WebAssembly modules to QuickJS (`QuickJSNative.RegisterWasmModule`). No
   release has it yet; it is on OneJS's `native-wasm` branch.
2. Download `com.singtaa.onejs-physics-<version>.tgz` from this repository's
   [releases](https://github.com/Singtaa/onejs-physics/releases).
3. Unity: **Window > Package Manager > + > Add package from tarball**, and pick
   the file. Or put it in `Packages/` and add to `Packages/manifest.json`:

   ```json
   "com.singtaa.onejs-physics": "file:com.singtaa.onejs-physics-<version>.tgz"
   ```

A git URL install gets this repository without its native libraries (see
below), so it registers nothing and says so in the Console.

## How it works

Each native library exports one function, `onejs_wasm_<name>()`, returning a
table that describes the module: its imports, its exports, its memory, and the
sha256 of the `.wasm` it came from. On load, `Runtime/PhysicsModules.cs` hands
each table to `QuickJSNative.RegisterWasmModule`, and every QuickJS context
then serves the module to JavaScript as `__wasm`, which oj uses in place of
`WebAssembly.instantiate`. The engine's half (the `__wasm` object, the
generator, the table's layout) is OneJS's, in
`Auxiliary~/quickjs-unity/wasm` and `src/quickjs_wasm.c`. This package holds
only modules.

The libraries are built with WABT's `wasm2c`, with memory bounds checked
rather than guarded by a signal handler (one would take Mono's and IL2CPP's
own faults for traps). That costs code size, about 10 MB per architecture for
the 3D engine, which is why it is a package of its own rather than part of
OneJS.

## Binaries live in releases, not in git

Git holds only text. A release builds every library from source and attaches
one tarball, the complete package, to its GitHub release. Committing the
libraries instead would add about 85 MB to this repository's history with
every engine update, carried by every clone from then on.

## Building a release

Needs a OneJS checkout (for the generator and the engine), Node, and the
toolchains OneJS's own `build-*.sh` use: Xcode, the Android NDK, MinGW, and
Docker for Linux.

```bash
ONEJS_DIR=<OneJS checkout> node Tools~/build.mjs <version> [macos windows linux android ios]
```

It fetches each module's `.wasm` from npm at the version in `modules.json`,
refuses one whose sha256 differs, builds every platform, writes Unity's import
settings for each library, and packs `build/com.singtaa.onejs-physics-<version>.tgz`.

## Testing

```bash
ONEJS_DIR=<OneJS checkout> OJPLAY_DIR=<onejs-play checkout> Tests~/parity.sh
```

Builds the 3D module for this machine, runs oj's determinism fixture (100
boxes, 300 steps, every body hashed) through OneJS's engine with the native
module, and requires the hash every browser gets. It then runs the fixture with
one box fewer and requires the check to fail on it.

## Licence

MIT, as OneJS. The engines inside are others' work under their own licences;
see [Third Party Notices.md](Third%20Party%20Notices.md).
