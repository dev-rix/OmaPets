import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const cli = resolve("bin/omapets.js")
const cliSource = readFileSync(cli, "utf8")

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

test("shows provider help before the interactive URL prompt", () => {
  assert.match(cliSource, /const interactiveHelp = `Install a pet[\s\S]*?Petdex:[\s\S]*?Codex Pets:[\s\S]*?OpenPets:/)
  assert.match(cliSource, /console\.log\(interactiveHelp\)[\s\S]*?prompt\.question\("Pet URL: "\)/)
})

test("prints the installed pet path", () => {
  assert.match(cliSource, /console\.log\(`Pet path: \$\{result\.destination\}`\)/)
})
