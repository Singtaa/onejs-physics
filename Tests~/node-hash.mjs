/**
 * Runs a node bundle (bundle.mjs ... node ...) with Node's own WebAssembly on
 * a module file, refusing a file whose sha256 is not the one the glue was
 * vendored against, and prints the fixture's hash, which has to be the one
 * the browsers agree on.
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
// The bundle carries the hash every browser gives: Node has to give it too,
// or the fixture and the module do not belong together.
if (answer.hash !== answer.expected) {
    console.error(`Node's WebAssembly gives ${answer.hash}, not the fixture's ${answer.expected}`)
    process.exit(1)
}
console.log(answer.hash)
