import assert from "node:assert/strict"
import { readFileSync, statSync } from "node:fs"

const qml = readFileSync(new URL("../Main.qml", import.meta.url), "utf8")
const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"))

assert.equal(manifest.id, "omapets")
assert.match(qml, /moduleName:\s*"omapets"/)
assert.match(qml, /target:\s*"omapets"/)
assert.doesNotMatch(qml, /wei\.omarpets/)

for (const script of ["scan-pets", "detect-agent"]) {
  const scriptUrl = new URL(`../bin/${script}`, import.meta.url)
  assert.equal(readFileSync(scriptUrl, "utf8").startsWith("#!/usr/bin/env bash\n"), true)
  assert.notEqual(statSync(scriptUrl).mode & 0o111, 0, `${script} must be executable`)
  assert.match(qml, new RegExp(`Qt\\.resolvedUrl\\(\\"bin/${script}\\"\\)`))
}

const installerUrl = new URL("../bin/omapets", import.meta.url)
assert.equal(readFileSync(installerUrl, "utf8").startsWith("#!/usr/bin/env bash\n"), true)
assert.notEqual(statSync(installerUrl).mode & 0o111, 0, "the Bash pet installer must be executable")

assert.doesNotMatch(qml, /command:\s*\["sh",\s*"-c"/)

assert.doesNotMatch(
  qml,
  /statusTooltipText:\s*petName/,
  "the status tooltip must not include the selected pet name",
)

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
  /GridView\s*\{[\s\S]*?anchors\.top:\s*petPickerHeader\.bottom[\s\S]*?anchors\.bottom:\s*parent\.bottom[\s\S]*?ScrollBar\.vertical:\s*ScrollBar/,
  "the pet grid must fill a vertically scrollable viewport",
)

assert.match(
  qml,
  /contentHeight:\s*Style\.space\(320\)/,
  "the panel must use a fixed 320-pixel height",
)

assert.match(
  qml,
  /Button\s*\{\s*id:\s*installPetButton[\s\S]*?text:\s*"Install pet"[\s\S]*?onClicked:\s*root\.openPetInstaller\(\)/,
  "the pet panel must expose its installer even when pets are already available",
)

assert.match(
  qml,
  /Qt\.resolvedUrl\("bin\/omapets"\)[\s\S]*?xdg-terminal-exec[\s\S]*?--title=OmaPets/,
  "the installer button must run the bundled Bash installer in an OmaPets terminal",
)

assert.doesNotMatch(
  qml,
  /omarchy-launch-floating-terminal-with-presentation/,
  "the installer terminal must not render the Omarchy presentation banner",
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

assert.match(
  qml,
  /Text\s*\{[\s\S]*?text:\s*petTile\.modelData\.name[\s\S]*?textFormat:\s*Text\.PlainText/,
  "provider-controlled pet names must never be interpreted as rich text",
)

console.log("Tailscale-style pet panel animates every discovered pet and exposes its directory ID")
