import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const qml = readFileSync(new URL("../Main.qml", import.meta.url), "utf8")

assert.match(
  qml,
  /Item\s*\{\s*id:\s*frameViewport[\s\S]*?width:\s*frameWidth[\s\S]*?height:\s*frameHeight[\s\S]*?clip:\s*true/,
  "the spritesheet must be clipped to exactly one scaled frame",
)

console.log("sprite crop viewport is exactly one frame")
