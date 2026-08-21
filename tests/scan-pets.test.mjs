import assert from "node:assert/strict"
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const scanner = resolve("bin/scan-pets")

test("keeps crafted markup inert and strips line-protocol control characters", async () => {
  const root = await mkdtemp(join(tmpdir(), "omarpets-scan-test-"))
  const petsDir = join(root, "pets")
  const petDir = join(petsDir, "crafted")
  const previewsDir = join(root, "previews")
  const fakeBin = join(root, "bin")
  await Promise.all([
    mkdir(petDir, { recursive: true }),
    mkdir(fakeBin, { recursive: true }),
  ])
  await writeFile(join(petDir, "pet.json"), JSON.stringify({
    id: "crafted",
    displayName: '<img src="https://attacker.invalid/pixel">\nTabbed\tName',
    spritesheetPath: "spritesheet.webp",
  }))
  await writeFile(join(petDir, "spritesheet.webp"), "RIFF")
  await writeFile(join(fakeBin, "magick"), "#!/usr/bin/env bash\ncp -- \"$1\" \"$2\"\n")
  await chmod(join(fakeBin, "magick"), 0o755)

  const result = spawnSync(scanner, [petsDir, previewsDir], {
    env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` },
    encoding: "utf8",
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(
    result.stdout,
    'crafted\t<img src="https://attacker.invalid/pixel"> Tabbed Name\tspritesheet.webp\n',
  )
})
