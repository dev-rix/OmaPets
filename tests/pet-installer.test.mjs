import assert from "node:assert/strict"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { installPet, petSlugFromUrl } from "../src/pet-installer.js"

test("extracts a slug from a Petdex URL", () => {
  assert.equal(petSlugFromUrl("https://petdex.dev/pets/kabi"), "kabi")
  assert.equal(petSlugFromUrl("https://petdex.dev/en/pets/kabi/"), "kabi")
})

test("rejects non-Petdex and malformed URLs", () => {
  assert.throws(() => petSlugFromUrl("https://example.com/pets/kabi"), /petdex\.dev/)
  assert.throws(() => petSlugFromUrl("https://petdex.dev/pets/kabi/extra"), /must look like/)
})

test("downloads a pet package into the OmarPets layout", async () => {
  const petsDir = await mkdtemp(join(tmpdir(), "omarpets-test-"))
  const manifestUrl = "https://test.invalid/manifest"
  const petJsonUrl = "https://test.invalid/pet.json"
  const spritesheetUrl = "https://test.invalid/sprite.webp"
  const petJson = {
    id: "kabi",
    displayName: "Kabi",
    spritesheetPath: "spritesheet.webp",
  }
  const responses = new Map([
    [manifestUrl, Response.json([{ slug: "kabi", petJsonUrl, spritesheetUrl }])],
    [petJsonUrl, Response.json(petJson)],
    [spritesheetUrl, new Response(new Uint8Array([82, 73, 70, 70]))],
  ])
  const fetchImpl = async url => {
    const response = responses.get(String(url))
    if (!response) return new Response("missing", { status: 404 })
    return response
  }

  const installed = await installPet("https://petdex.dev/pets/kabi", {
    petsDir,
    manifestUrl,
    fetchImpl,
  })

  assert.equal(installed.destination, join(petsDir, "kabi"))
  assert.deepEqual(JSON.parse(await readFile(join(petsDir, "kabi", "pet.json"), "utf8")), petJson)
  assert.deepEqual(await readFile(join(petsDir, "kabi", "spritesheet.webp")), Buffer.from([82, 73, 70, 70]))

  await assert.rejects(
    installPet("https://petdex.dev/pets/kabi", { petsDir, manifestUrl, fetchImpl }),
    /already installed/,
  )
})

test("rejects a manifest whose pet ID does not match the URL", async () => {
  const petsDir = await mkdtemp(join(tmpdir(), "omarpets-test-"))
  const manifestUrl = "https://test.invalid/manifest"
  const fetchImpl = async url => {
    if (url === manifestUrl)
      return Response.json([{ slug: "kabi", petJsonUrl: "https://test.invalid/pet", spritesheetUrl: "https://test.invalid/sprite" }])
    if (url === "https://test.invalid/pet")
      return Response.json({ id: "other", spritesheetPath: "spritesheet.webp" })
    return new Response(new Uint8Array([1]))
  }

  await assert.rejects(
    installPet("https://petdex.dev/pets/kabi", { petsDir, manifestUrl, fetchImpl }),
    /ID does not match/,
  )
})
