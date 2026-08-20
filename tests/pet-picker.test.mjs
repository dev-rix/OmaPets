import assert from "node:assert/strict"
import { readFileSync, statSync } from "node:fs"

const qml = readFileSync(new URL("../Main.qml", import.meta.url), "utf8")

for (const script of ["scan-pets", "detect-agent"]) {
  const scriptUrl = new URL(`../bin/${script}`, import.meta.url)
  assert.equal(readFileSync(scriptUrl, "utf8").startsWith("#!/usr/bin/env bash\n"), true)
  assert.notEqual(statSync(scriptUrl).mode & 0o111, 0, `${script} must be executable`)
  assert.match(qml, new RegExp(`Qt\\.resolvedUrl\\(\\"bin/${script}\\"\\)`))
}

assert.doesNotMatch(qml, /command:\s*\["sh",\s*"-c"/)

assert.doesNotMatch(
  qml,
  /assets\/ponyta|Ponyta \(bundled\)/,
  "the plugin must not depend on a bundled pet",
)

assert.match(
  qml,
  /KeyboardPanel\s*\{\s*id:\s*petPicker[\s\S]*?GridView\s*\{[\s\S]*?model:\s*root\.availablePets/,
  "the pet picker must use the same panel surface as Tailscale with a grid item for every discovered pet",
)

assert.match(
  qml,
  /source:\s*petTile\.modelData\.spritesheet/,
  "each pet tile must display its spritesheet",
)

assert.match(
  qml,
  /var\s+previewSheet\s*=\s*"file:\/\/"\s*\+\s*previewHome\s*\+\s*"\/"\s*\+\s*id\s*\+\s*"\.png"/,
  "downloaded pet previews must use Qt-compatible cached PNG atlases",
)

assert.match(
  qml,
  /GridView\s*\{[\s\S]*?anchors\.top:\s*petPickerTitle\.bottom[\s\S]*?anchors\.bottom:\s*parent\.bottom[\s\S]*?ScrollBar\.vertical:\s*ScrollBar/,
  "the pet grid must fill a vertically scrollable viewport",
)

assert.match(
  qml,
  /contentHeight:\s*Style\.space\(320\)/,
  "the panel must use a fixed 320-pixel height",
)

assert.match(
  qml,
  /No pets installed yet[\s\S]*?How to download pets/,
  "an empty pets directory must show download instructions",
)

assert.match(
  qml,
  /command:\s*\["xdg-open",\s*"https:\/\/github\.com\/yesmeck\/OmaPets#install-a-pet"\]/,
  "the download instructions must link to the README",
)

assert.match(
  qml,
  /x:\s*-\(root\.currentFrame\s*%\s*6\)\s*\*\s*petPreview\.width/,
  "pet previews must animate through their atlas frames",
)

assert.match(
  qml,
  /text:\s*petTile\.modelData\.name\s*\+[\s\S]*?petTile\.modelData\.id/,
  "pet labels must expose the directory ID as well as the display name",
)

console.log("Tailscale-style pet panel animates every discovered pet and exposes its directory ID")
