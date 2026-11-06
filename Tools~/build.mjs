#!/usr/bin/env node
/**
 * Builds a release of this package: every native library, Unity's import
 * settings for each, and the tarball a GitHub release carries.
 *
 *     ONEJS_DIR=<OneJS checkout> node Tools~/build.mjs <version> [platform...]
 *
 * platform: macos windows linux android ios (default all). Writes
 * build/package/ (the package as Unity sees it) and
 * build/com.singtaa.onejs-physics-<version>.tgz.
 *
 * Each module's .wasm is fetched from npm at the version modules.json names
 * and refused unless its sha256 is the one recorded there, which is the hash
 * oj's glue asks for. OneJS's wasm/build-module.sh turns it into a library per
 * platform. A library's .meta is OneJS's own engine library's at the same
 * path, so its platform settings are written once, in OneJS, with a guid of
 * its own derived from this package's name and the path, the same every build.
 */
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const HERE = path.resolve(import.meta.dirname, "..")
const BUILD = path.join(HERE, "build")
const PACKAGE = path.join(BUILD, "package")
const NAME = "com.singtaa.onejs-physics"
const ALL = ["macos", "windows", "linux", "android", "ios"]

const [version, ...asked] = process.argv.slice(2)
const platforms = asked.length > 0 ? asked : ALL
const fail = (message) => {
    console.error(message)
    process.exit(1)
}
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) fail("usage: ONEJS_DIR=<OneJS checkout> node Tools~/build.mjs <version> [macos windows linux android ios]")
for (const p of platforms) if (!ALL.includes(p)) fail(`unknown platform ${p}`)
const ONEJS = process.env.ONEJS_DIR
const builder = ONEJS && path.join(ONEJS, "Auxiliary~/quickjs-unity/wasm/build-module.sh")
if (!builder || !fs.existsSync(builder)) fail("set ONEJS_DIR to a OneJS checkout with Auxiliary~/quickjs-unity/wasm/build-module.sh")

const sha256 = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const guid = (rel) => createHash("md5").update(`${NAME}/${rel}`).digest("hex")
const run = (command, args, options = {}) => execFileSync(command, args, { stdio: "inherit", ...options })

fs.rmSync(BUILD, { recursive: true, force: true })
fs.mkdirSync(PACKAGE, { recursive: true })

// The package's own text, as git holds it.
for (const entry of ["package.json", "README.md", "LICENSE", "Third Party Notices.md", "modules.json", "Runtime", "Licenses~"]) {
    fs.cpSync(path.join(HERE, entry), path.join(PACKAGE, entry), { recursive: true })
    if (fs.existsSync(path.join(HERE, `${entry}.meta`))) fs.cpSync(path.join(HERE, `${entry}.meta`), path.join(PACKAGE, `${entry}.meta`))
}
const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE, "package.json"), "utf8"))
manifest.version = version
fs.writeFileSync(path.join(PACKAGE, "package.json"), JSON.stringify(manifest, null, 4) + "\n")

// Each module: the .wasm from npm, checked, then a library per platform.
const modules = JSON.parse(fs.readFileSync(path.join(HERE, "modules.json"), "utf8"))
const plugins = path.join(PACKAGE, "Plugins")
for (const [name, m] of Object.entries(modules)) {
    const dir = path.join(BUILD, "npm", name)
    fs.mkdirSync(dir, { recursive: true })
    const tgz = execFileSync("npm", ["pack", `${m.npm}@${m.version}`, "--silent"], { cwd: dir, encoding: "utf8" }).trim().split("\n").pop()
    run("tar", ["-xzf", tgz, `package/${m.file}`], { cwd: dir })
    const wasm = path.join(dir, `${name}.wasm`)
    fs.renameSync(path.join(dir, "package", m.file), wasm)
    const got = sha256(wasm)
    if (got !== m.sha256) fail(`${m.npm}@${m.version} ${m.file} has sha256 ${got}; modules.json records ${m.sha256}`)
    console.log(`${name}: ${m.npm}@${m.version}, sha256 ${got}`)
    run("bash", [builder, wasm, name, plugins, ...platforms])
}

// Import settings: OneJS's engine library's .meta beside the same path.
const ENGINE = { macos: "macOS/libquickjs_unity.dylib", windows: "Windows/x64/quickjs_unity.dll", linux: "Linux/x64/libquickjs_unity.so",
    ios: "iOS/libquickjs_unity.a" }
for (const abi of ["arm64-v8a", "armeabi-v7a", "x86_64"]) ENGINE[`android/${abi}`] = `Android/${abi}/libquickjs_unity.so`
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? [path.join(dir, e.name), ...walk(path.join(dir, e.name))] : [path.join(dir, e.name)])
for (const file of walk(plugins)) {
    const rel = path.relative(PACKAGE, file).split(path.sep).join("/")
    let meta
    if (fs.statSync(file).isDirectory()) {
        meta = `fileFormatVersion: 2\nguid: ${guid(rel)}\nfolderAsset: yes\nDefaultImporter:\n  externalObjects: {}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`
    } else {
        const inPlugins = rel.slice("Plugins/".length)
        const engine = Object.values(ENGINE).find((e) => path.dirname(e) === path.dirname(inPlugins) && path.extname(e) === path.extname(inPlugins))
        if (!engine) fail(`no OneJS engine library beside ${rel} to take import settings from`)
        const source = fs.readFileSync(path.join(ONEJS, "Plugins", `${engine}.meta`), "utf8")
        meta = source.replace(/^guid: [0-9a-f]{32}$/m, `guid: ${guid(rel)}`)
        if (meta === source) fail(`${engine}.meta has no guid line`)
    }
    fs.writeFileSync(`${file}.meta`, meta)
}
fs.writeFileSync(`${plugins}.meta`, `fileFormatVersion: 2\nguid: ${guid("Plugins")}\nfolderAsset: yes\nDefaultImporter:\n  externalObjects: {}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`)

const out = path.join(BUILD, `${NAME}-${version}.tgz`)
run("tar", ["-czf", out, "-C", BUILD, "package"])
console.log(`\n${path.relative(HERE, out)} (${(fs.statSync(out).size / 1048576).toFixed(1)} MB)`)
