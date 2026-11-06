/**
 * Bundles a determinism fixture with oj's Rapier glue into one script that
 * runs in global scope and leaves its answer in globalThis.__parity as JSON:
 * { hash, expected }.
 *
 *     node Tests~/bundle.mjs <onejs-play checkout> <2|3> <quickjs|node> <out.js> [boxes fewer] [expected]
 *
 * quickjs takes the module from __wasm as OneJS serves it. node instantiates
 * it with WebAssembly from globalThis.__wasmBytes, which node-hash.mjs sets.
 * 3D runs oj's own fixture (src/physics3d/parity.mjs), whose expected hash is
 * the one every browser gives; 2D runs falling-boxes-2d.mjs, whose expected
 * hash is the one given on the command line.
 *
 * boxes fewer drops that many boxes from the fixture, so the check has an
 * input it must fail. (A step fewer is no such input: by the last step the
 * boxes are at rest, and the hash does not move.)
 */
import { createRequire } from "node:module"
import fs from "node:fs"
import path from "node:path"

const [ojplay, dim, host, out, fewer = "0", given = ""] = process.argv.slice(2)
if (!["2", "3"].includes(dim) || !["quickjs", "node"].includes(host) || !out) {
    console.error("usage: node Tests~/bundle.mjs <onejs-play checkout> <2|3> <quickjs|node> <out.js> [boxes fewer] [expected]")
    process.exit(2)
}
const physics = path.join(ojplay, `src/physics${dim}d`)
for (const file of ["rapier.vendor.js", "rapier.version.ts", ...(dim === "3" ? ["parity.mjs"] : [])]) {
    if (!fs.existsSync(path.join(physics, file))) {
        console.error(`${physics}/${file} is missing: OJPLAY_DIR has to be a onejs-play with ${dim}D physics`)
        process.exit(2)
    }
}
const fixture = dim === "3"
    ? `import { fallingBoxesHash, PARITY } from "./parity.mjs"\nconst BOXES = PARITY.boxes, STEPS = PARITY.steps, EXPECTED = PARITY.hash`
    : `import { fallingBoxesHash, BOXES, STEPS } from ${JSON.stringify(path.join(import.meta.dirname, "falling-boxes-2d.mjs"))}\nconst EXPECTED = ${JSON.stringify(given)}`
const instantiate = host === "quickjs"
    ? `__wasm.instantiate("rapier${dim}d", RAPIER_WASM_SHA256, imports)`
    : "new WebAssembly.Instance(new WebAssembly.Module(globalThis.__wasmBytes), imports).exports"
// onejs-play's own esbuild, so this repository needs no node_modules.
const esbuild = createRequire(path.join(ojplay, "package.json"))("esbuild")
const entry = `
import * as R from "./rapier.vendor.js"
import { RAPIER_WASM_SHA256 } from "./rapier.version.ts"
${fixture}
// OneJS's bootstrap defines performance in Unity; this test runs without it.
globalThis.performance ??= { now: () => Date.now() }
const imports = { "./rapier_wasm${dim}d_bg.js": R.bg }
R.bg.__wbg_set_wasm(${instantiate})
globalThis.__parity = JSON.stringify({ hash: fallingBoxesHash(R, BOXES - ${Number(fewer)}, STEPS), expected: EXPECTED, sha256: RAPIER_WASM_SHA256 })
`
await esbuild.build({
    stdin: { contents: entry, resolveDir: physics, loader: "js" },
    bundle: true, format: "iife", target: "es2020", outfile: out, logLevel: "warning",
})
