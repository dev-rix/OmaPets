import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const qml = readFileSync(new URL("../Main.qml", import.meta.url), "utf8")

assert.match(
  qml,
  /Item\s*\{\s*id:\s*frameViewport[\s\S]*?width:\s*frameWidth[\s\S]*?height:\s*frameHeight[\s\S]*?clip:\s*true/,
  "the spritesheet must be clipped to exactly one scaled frame",
)

assert.match(
  qml,
  /root\.atlasRows\s*=\s*Number\(pet\.spriteVersionNumber\s*\|\|\s*1\)\s*>=\s*2\s*\?\s*11\s*:\s*9[\s\S]*?height:\s*frameViewport\.frameHeight\s*\*\s*root\.atlasRows/,
  "v2 spritesheets must retain all eleven rows instead of being compressed to nine",
)

console.log("sprite crop viewport is exactly one frame")
