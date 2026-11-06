# Third Party Notices

This package is MIT licensed (LICENSE). The native libraries a release ships
are built from others' work, each under its own licence. The full text of the
Apache License 2.0 is in `Licenses~/Apache-2.0.txt`.

## Rapier

Every `onejs_rapier3d` library (and `onejs_rapier2d`, when it joins) is
generated from Rapier's WebAssembly build as published on npm
(`@dimforge/rapier3d-deterministic`, the version and sha256 in `modules.json`).

- Author: Sébastien Crozet (Dimforge), and Rapier's contributors
- Licence: Apache License 2.0
- Source: https://github.com/dimforge/rapier (its JavaScript build lives in `typescript/`)

The module is translated to C by `wasm2c` and compiled unchanged: no Rapier
source is modified.

## WABT (wasm2c and its runtime)

The C each library is compiled from is written by WABT's `wasm2c`, and each
library links WABT's wasm2c runtime (`wasm-rt-impl.c`, `wasm-rt-mem-impl.c`,
`wasm-rt-exceptions-impl.c` and their headers), release 1.0.42.

- Authors: the WABT contributors (WebAssembly Community Group)
- Licence: Apache License 2.0
- Source: https://github.com/WebAssembly/wabt
