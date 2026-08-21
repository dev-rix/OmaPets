import assert from "node:assert/strict"
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const installer = resolve("bin/omapets")

async function harness(fixtures) {
  const root = await mkdtemp(join(tmpdir(), "omarpets-installer-test-"))
  const fakeBin = join(root, "bin")
  const fixtureFile = join(root, "fixtures.json")
  const curlLog = join(root, "curl.log")
  await mkdir(fakeBin)
  await writeFile(fixtureFile, JSON.stringify(fixtures))
  await writeFile(join(fakeBin, "curl"), `#!/usr/bin/env bash
set -euo pipefail
headers=
output=
url=\${!#}
while (( $# > 0 )); do
  case "$1" in
    --dump-header) headers=$2; shift 2 ;;
    --output) output=$2; shift 2 ;;
    --write-out) shift 2 ;;
    *) shift ;;
  esac
done
printf '%s\\n' "$url" >>"$FAKE_CURL_LOG"
entry=$(jq -cer --arg url "$url" '.[$url]' "$FAKE_CURL_FIXTURES")
status=$(jq -r '.status // 200' <<<"$entry")
location=$(jq -r '.location // empty' <<<"$entry")
body=$(jq -r '.body // empty' <<<"$entry")
printf 'HTTP/1.1 %s Test\\r\\n' "$status" >"$headers"
[[ -z $location ]] || printf 'Location: %s\\r\\n' "$location" >>"$headers"
printf '\\r\\n' >>"$headers"
printf '%s' "$body" >"$output"
printf '%s' "$status"
`)
  await chmod(join(fakeBin, "curl"), 0o755)
  return {
    root,
    petsDir: join(root, "pets"),
    curlLog,
    env: {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH}`,
      FAKE_CURL_FIXTURES: fixtureFile,
      FAKE_CURL_LOG: curlLog,
    },
  }
}

function petdexFixtures(manifestUrl = "https://petdex.dev/api/manifest") {
  return {
    [manifestUrl]: {
      body: JSON.stringify([{ slug: "kabi", petJsonUrl: "https://assets.petdex.dev/kabi/pet.json", spritesheetUrl: "https://assets.petdex.dev/kabi/spritesheet.webp" }]),
    },
    "https://assets.petdex.dev/kabi/pet.json": {
      body: JSON.stringify({ id: "Kabi Pet", displayName: "Kabi", spritesheetPath: "spritesheet.webp" }),
    },
    "https://assets.petdex.dev/kabi/spritesheet.webp": { body: "RIFF" },
  }
}

test("installs a Petdex pet with Bash and preserves the destination", async () => {
  const setup = await harness(petdexFixtures())
  const result = spawnSync(installer, ["https://petdex.dev/pets/kabi", "--dir", setup.petsDir], {
    env: setup.env,
    encoding: "utf8",
  })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /\[omapets\] Installing petdex pet kabi/)
  assert.match(result.stdout, /\[omapets\] Fetching https:\/\/petdex\.dev\/api\/manifest/)
  assert.match(result.stdout, /\[omapets\] Validating downloaded pet package/)
  assert.match(result.stdout, new RegExp(`Installed Kabi to ${setup.petsDir}/kabi-pet`))
  assert.equal(JSON.parse(await readFile(join(setup.petsDir, "kabi-pet/pet.json"), "utf8")).id, "Kabi Pet")
  assert.equal(await readFile(join(setup.petsDir, "kabi-pet/spritesheet.webp"), "utf8"), "RIFF")

  const duplicate = spawnSync(installer, ["https://petdex.dev/pets/kabi", "--dir", setup.petsDir], {
    env: setup.env,
    encoding: "utf8",
  })
  assert.notEqual(duplicate.status, 0)
  assert.match(duplicate.stderr, /already installed/)
})

test("validates every redirect before following it", async () => {
  const safeManifest = "https://assets.petdex.dev/manifest.json"
  const fixtures = petdexFixtures(safeManifest)
  fixtures["https://petdex.dev/api/manifest"] = { status: 307, location: safeManifest }
  const setup = await harness(fixtures)
  const result = spawnSync(installer, ["https://petdex.dev/pets/kabi", "--dir", setup.petsDir], {
    env: setup.env,
    encoding: "utf8",
  })
  assert.equal(result.status, 0, result.stderr)

  for (const location of ["http://assets.petdex.dev/manifest", "https://127.0.0.1/manifest", "https://attacker.invalid/manifest"]) {
    const rejected = await harness({
      "https://petdex.dev/api/manifest": { status: 302, location },
    })
    const attempt = spawnSync(installer, ["https://petdex.dev/pets/kabi", "--dir", rejected.petsDir], {
      env: rejected.env,
      encoding: "utf8",
    })
    assert.notEqual(attempt.status, 0, location)
    assert.match(attempt.stderr, /HTTPS|unapproved host/, location)
    assert.equal((await readFile(rejected.curlLog, "utf8")).trim(), "https://petdex.dev/api/manifest")
  }
})

test("rejects redirect loops after five hops", async () => {
  const manifestUrl = "https://petdex.dev/api/manifest"
  const setup = await harness({ [manifestUrl]: { status: 302, location: manifestUrl } })
  const result = spawnSync(installer, ["https://petdex.dev/pets/kabi", "--dir", setup.petsDir], {
    env: setup.env,
    encoding: "utf8",
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /exceeded 5 redirects/)
  assert.equal((await readFile(setup.curlLog, "utf8")).trim().split("\n").length, 6)
})

test("installs Codex Pets metadata", async () => {
  const setup = await harness({
    "https://codex-pets.net/api/pets/dario": {
      body: JSON.stringify({ pet: { id: "dario", displayName: "Dario", spritesheetPath: "spritesheet.webp", spritesheetUrl: "https://codex-pets.net/assets/dario.webp" } }),
    },
    "https://codex-pets.net/assets/dario.webp": { body: "RIFF" },
  })
  const result = spawnSync(installer, ["https://codex-pets.net/#/pets/dario", "--dir", setup.petsDir], {
    env: setup.env,
    encoding: "utf8",
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(await readFile(join(setup.petsDir, "dario/pet.json"), "utf8")).id, "dario")
})

test("installs OpenPets catalog metadata", async () => {
  const slug = "player-05-b28eec8e"
  const setup = await harness({
    "https://openpets.dev/pets/catalog.v3/search.json": {
      body: JSON.stringify({ version: 3, pages: ["search-page-000.json"] }),
    },
    "https://openpets.dev/pets/catalog.v3/search-page-000.json": {
      body: JSON.stringify({ pets: [{ id: "player-05", catalogPage: 2 }] }),
    },
    "https://openpets.dev/pets/catalog.v3/page-002.json": {
      body: JSON.stringify({ pets: [{ id: "player-05", displayName: "Player", description: "A pet", spritesheet: `https://openpets.dev/pets/${slug}/spritesheet.webp` }] }),
    },
    [`https://openpets.dev/pets/${slug}/spritesheet.webp`]: { body: "RIFF" },
  })
  const result = spawnSync(installer, [`https://openpets.dev/pets/${slug}`, "--dir", setup.petsDir], {
    env: setup.env,
    encoding: "utf8",
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(await readFile(join(setup.petsDir, "player-05/pet.json"), "utf8")).displayName, "Player")
})

test("has interactive help without requiring Node or npm", async () => {
  const source = await readFile(installer, "utf8")
  const help = spawnSync(installer, ["--help"], { encoding: "utf8" })

  assert.equal(help.status, 0, help.stderr)
  assert.match(help.stdout, /^Usage:\n  omapets$/m)
  assert.match(help.stdout, /XDG_CONFIG_HOME\/omapets\/pets/)
  assert.match(help.stdout, /falling back to ~\/\.config\/omapets\/pets/)
  assert.match(source, /interactive_help[\s\S]*Petdex:[\s\S]*Codex Pets:[\s\S]*OpenPets:/)
  assert.match(source, /interactive_help "\$pets_dir"/)
  assert.match(source, /Installed %s to %s/)
  assert.match(source, /Press any key to close…/)
  assert.doesNotMatch(source, /node|npm|omapets\.js/)
})
