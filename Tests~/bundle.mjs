/**
 * Bundles oj's determinism fixture with oj's Rapier glue into one script that
 * QuickJS runs in global scope, taking the module from __wasm as OneJS serves
 * it. The script leaves its answer in globalThis.__parity as JSON:
 * { hash, expected }.
 *
 *     node Tests~/bundle.mjs <onejs-play checkout> <out.js> [boxes fewer]
 *
 * boxes fewer drops that many boxes from the fixture, so the check has an
 * input it must fail. (A step fewer is no such input: by step 299 the boxes
 * are at rest, and the hash does not move.)
 */
import { createRequire } from "node:module"
import fs from "node:fs"
import path from "node:path"

const [ojplay, out, fewer = "0"] = process.argv.slice(2)
const physics = path.join(ojplay, "src/physics3d")
for (const file of ["rapier.vendor.js", "parity.mjs", "rapier.version.ts"]) {
    if (!fs.existsSync(path.join(physics, file))) {
        console.error(`${physics}/${file} is missing: OJPLAY_DIR has to be a onejs-play with 3D physics`)
        process.exit(2)
    }
}
// onejs-play's own esbuild, so this repository needs no node_modules.
const esbuild = createRequire(path.join(ojplay, "package.json"))("esbuild")
const entry = `
import * as R from "./rapier.vendor.js"
import { fallingBoxesHash, PARITY } from "./parity.mjs"
import { RAPIER_WASM_SHA256 } from "./rapier.version.ts"
// OneJS's bootstrap defines performance in Unity; this test runs without it.
globalThis.performance ??= { now: () => Date.now() }
const exports = __wasm.instantiate("rapier3d", RAPIER_WASM_SHA256, { "./rapier_wasm3d_bg.js": R.bg })
R.bg.__wbg_set_wasm(exports)
globalThis.__parity = JSON.stringify({ hash: fallingBoxesHash(R, PARITY.boxes - ${Number(fewer)}, PARITY.steps), expected: PARITY.hash })
`
await esbuild.build({
    stdin: { contents: entry, resolveDir: physics, loader: "js" },
    bundle: true, format: "iife", target: "es2020", outfile: out, logLevel: "warning",
})
