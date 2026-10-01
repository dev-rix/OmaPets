import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { chmod, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises"
import { readFileSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test from "node:test"

const qml = readFileSync(new URL("../Main.qml", import.meta.url), "utf8")
const converter = resolve("bin/convert-spritesheet")

// A PATH holding only bash, mkdir and cp, plus magick when a stub is requested.
async function sandbox({ magick } = {}) {
  const root = await mkdtemp(join(tmpdir(), "omapets-convert-test-"))
  const bin = join(root, "bin")
  await mkdir(bin)
  for (const tool of ["bash", "mkdir", "cp"]) {
    const path = execFileSync("bash", ["-c", `command -v ${tool}`], { encoding: "utf8" }).trim()
    await symlink(path, join(bin, tool))
  }
  if (magick) {
    await writeFile(join(bin, "magick"), `#!${join(bin, "bash")}\n${magick}\n`)
    await chmod(join(bin, "magick"), 0o755)
  }
  return { root, run: (args) => spawnSync(converter, args, { env: { PATH: bin }, encoding: "utf8" }) }
}

test("the bundled fallback atlas is a ready-made PNG that needs no conversion", () => {
  const png = readFileSync(new URL("../assets/pets/glitchcat/preview.png", import.meta.url))
  assert.equal(png.subarray(1, 4).toString(), "PNG")
  assert.equal(png.readUInt32BE(16), 8 * 192, "fallback atlas must have eight frame columns")
  assert.equal(png.readUInt32BE(20), 9 * 208, "fallback atlas must use the v1 nine-row layout")
  assert.match(
    qml,
    /fallbackSheetUrl:\s*Qt\.resolvedUrl\("assets\/pets\/glitchcat\/preview\.png"\)/,
  )
})

test("converter is an executable Bash helper used by the bar", () => {
  assert.equal(readFileSync(converter, "utf8").startsWith("#!/usr/bin/env bash\n"), true)
  assert.notEqual(statSync(converter).mode & 0o111, 0, "convert-spritesheet must be executable")
  assert.match(qml, /Qt\.resolvedUrl\("bin\/convert-spritesheet"\)/)
})

test("converter reports a missing ImageMagick as exit 127", async () => {
  const { root, run } = await sandbox()
  await writeFile(join(root, "sheet.webp"), "RIFF")
  const result = run([join(root, "sheet.webp"), join(root, "cache", "sheet.png")])
  assert.equal(result.status, 127)
  assert.match(result.stderr, /ImageMagick \(magick\) is required/)
})

test("converter reports a missing spritesheet as exit 66", async () => {
  const { root, run } = await sandbox({ magick: 'cp -- "$1" "$2"' })
  const result = run([join(root, "missing.webp"), join(root, "cache", "sheet.png")])
  assert.equal(result.status, 66)
  assert.match(result.stderr, /spritesheet not found/)
})

test("converter passes through ImageMagick failures", async () => {
  const { root, run } = await sandbox({ magick: "exit 1" })
  await writeFile(join(root, "sheet.webp"), "RIFF")
  const result = run([join(root, "sheet.webp"), join(root, "cache", "sheet.png")])
  assert.equal(result.status, 1)
})

test("converter creates the cache folder and writes the PNG", async () => {
  const { root, run } = await sandbox({ magick: 'cp -- "$1" "$2"' })
  await writeFile(join(root, "sheet.webp"), "RIFF")
  const result = run([join(root, "sheet.webp"), join(root, "cache", "omarpets", "sheet.png")])
  assert.equal(result.status, 0, result.stderr)
  assert.equal(await readFile(join(root, "cache", "omarpets", "sheet.png"), "utf8"), "RIFF")
})

test("every pet load failure falls back to Glitchcat", () => {
  assert.match(
    qml,
    /function\s+usePetFallback\(reason\)\s*\{[\s\S]*?petLoadError\s*=\s*configuredPetPath\s*===\s*""\s*\?\s*""\s*:\s*String\(reason\)[\s\S]*?atlasRows\s*=\s*9[\s\S]*?spritesheetUrl\s*=\s*fallbackSheetUrl[\s\S]*?petAvailable\s*=\s*true/,
    "the fallback must show Glitchcat's PNG atlas and keep the pet visible",
  )
  assert.match(qml, /onLoadFailed:\s*\{\s*root\.usePetFallback\(/, "a missing pet.json must fall back")
  assert.match(
    qml,
    /catch\s*\(error\)\s*\{[\s\S]*?root\.usePetFallback\("Its pet\.json is invalid/,
    "an invalid manifest must fall back",
  )
  assert.match(
    qml,
    /id:\s*sheetConverter[\s\S]*?else\s*\{[\s\S]*?root\.usePetFallback\(root\.conversionFailureReason\(exitCode\)\)/,
    "a failed WebP conversion must fall back",
  )
  assert.match(
    qml,
    /id:\s*atlas[\s\S]*?status\s*===\s*Image\.Error\s*&&\s*String\(source\)\s*!==\s*String\(root\.fallbackSheetUrl\)[\s\S]*?root\.usePetFallback\(/,
    "an unreadable spritesheet must fall back without looping on the fallback itself",
  )
  assert.doesNotMatch(
    qml,
    /root\.petAvailable\s*=\s*false/,
    "no load failure may leave the bar without a pet",
  )
  assert.match(
    qml,
    /root\.petLoadError\s*=\s*""[\s\S]*?root\.loadSpritesheet\(/,
    "a successful manifest load must clear the previous failure",
  )
})

test("a missing ImageMagick is explained to the user", () => {
  assert.match(
    qml,
    /exitCode\s*===\s*127\)\s*return\s*"ImageMagick \(magick\) is not installed/,
  )
})

test("a selection change during conversion converts the newer pet", () => {
  assert.match(
    qml,
    /onExited:\s*function\(exitCode\)\s*\{\s*\/\/[^\n]*\n\s*if\s*\(root\.pendingSheetUrl\s*!==\s*root\.convertingSheetUrl\)\s*\{\s*root\.loadSpritesheet\(root\.pendingSheetUrl\)\s*return/,
  )
})

test("the pet panel identifies the unavailable selection", () => {
  assert.match(
    qml,
    /Text\s*\{\s*id:\s*petLoadErrorBanner[\s\S]*?visible:\s*root\.petFallbackActive[\s\S]*?root\.configuredPetPath[\s\S]*?root\.petLoadError[\s\S]*?textFormat:\s*Text\.PlainText/,
    "the panel must name the failed selection and why, as plain text",
  )
  assert.match(qml, /GridView\s*\{\s*id:\s*petGrid[\s\S]*?anchors\.top:\s*petLoadErrorBanner\.bottom/)
  assert.match(
    qml,
    /unavailable:\s*root\.petFallbackActive[\s\S]*?selected:\s*String\(root\.configuredPetPath\)\s*===\s*String\(petTile\.modelData\.petPath\)\s*&&\s*!petTile\.unavailable/,
    "the failed pet must not be shown as the working selection",
  )
  assert.match(qml, /petTile\.unavailable\s*\?\s*" · unavailable"/)
  assert.match(qml, /petFallbackActive\s*\?\s*"\\nSelected pet unavailable; showing Glitchcat"/)
})
