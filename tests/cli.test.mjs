import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import test from "node:test"

const cli = resolve("bin/omapets.js")

test("documents interactive no-argument installation", () => {
  const result = spawnSync(cli, ["--help"], { encoding: "utf8" })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /^Usage:\n  omapets$/m)
})

test("does not wait for a prompt without an interactive terminal", () => {
  const result = spawnSync(cli, [], { encoding: "utf8" })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /A Petdex, Codex Pets, or OpenPets URL is required/)
})
