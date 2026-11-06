/**
 * Runs a node bundle (bundle.mjs ... node ...) with Node's own WebAssembly on
 * a module file, refusing a file whose sha256 is not the one the glue was
 * vendored against, and prints the fixture's hash. When the bundle names an
 * expected hash (3D's, the browsers'), Node has to give it.
 *
 *     node Tests~/node-hash.mjs <bundle.js> <module.wasm>
 */
import { createHash } from "node:crypto"
import fs from "node:fs"
import vm from "node:vm"

const [bundle, wasm] = process.argv.slice(2)
const bytes = fs.readFileSync(wasm)
globalThis.__wasmBytes = bytes
vm.runInThisContext(fs.readFileSync(bundle, "utf8"), { filename: bundle })
const answer = JSON.parse(globalThis.__parity)
const sha = createHash("sha256").update(bytes).digest("hex")
if (sha !== answer.sha256) {
    console.error(`${wasm} has sha256 ${sha}; the glue was vendored against ${answer.sha256}`)
    process.exit(1)
}
// 3D's bundle carries the hash every browser gives: Node has to give it too,
// or this is not a reference worth holding a native module to.
if (answer.expected && answer.hash !== answer.expected) {
    console.error(`Node's WebAssembly gives ${answer.hash}, not the fixture's ${answer.expected}`)
    process.exit(1)
}
console.log(answer.hash)
