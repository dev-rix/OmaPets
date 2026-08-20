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

test("extracts a slug from a Codex Pets hash URL", () => {
  assert.equal(petSlugFromUrl("https://codex-pets.net/#/pets/dario"), "dario")
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
    return response.clone()
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

test("normalizes the manifest ID for the installation directory", async () => {
  const petsDir = await mkdtemp(join(tmpdir(), "omarpets-test-"))
  const manifestUrl = "https://test.invalid/manifest"
  const fetchImpl = async url => {
    if (url === manifestUrl)
      return Response.json([{ slug: "kabi", petJsonUrl: "https://test.invalid/pet", spritesheetUrl: "https://test.invalid/sprite" }])
    if (url === "https://test.invalid/pet")
      return Response.json({ id: "Other Pet", spritesheetPath: "spritesheet.webp" })
    return new Response(new Uint8Array([1]))
  }

  const installed = await installPet("https://petdex.dev/pets/kabi", { petsDir, manifestUrl, fetchImpl })
  assert.equal(installed.slug, "other-pet")
  assert.equal(installed.sourceSlug, "kabi")
  assert.equal(installed.destination, join(petsDir, "other-pet"))
  assert.equal(JSON.parse(await readFile(join(petsDir, "other-pet", "pet.json"), "utf8")).id, "Other Pet")
})

test("normalizes a path-like manifest ID without escaping the pets directory", async () => {
  const petsDir = await mkdtemp(join(tmpdir(), "omarpets-test-"))
  const manifestUrl = "https://test.invalid/manifest"
  const fetchImpl = async url => {
    if (url === manifestUrl)
      return Response.json([{ slug: "kabi", petJsonUrl: "https://test.invalid/pet", spritesheetUrl: "https://test.invalid/sprite" }])
    if (url === "https://test.invalid/pet")
      return Response.json({ id: "../escape", spritesheetPath: "spritesheet.webp" })
    return new Response(new Uint8Array([1]))
  }

  const installed = await installPet("https://petdex.dev/pets/kabi", { petsDir, manifestUrl, fetchImpl })
  assert.equal(installed.destination, join(petsDir, "escape"))
})

test("downloads a pet from Codex Pets into the OmarPets layout", async () => {
  const petsDir = await mkdtemp(join(tmpdir(), "omarpets-test-"))
  const apiBase = "https://test.invalid/api/pets"
  const spritesheetUrl = "https://test.invalid/dario.webp"
  const pet = {
    id: "dario",
    displayName: "Dario",
    description: "A tiny frustrated pet.",
    spritesheetPath: "spritesheet.webp",
    spriteVersionNumber: 1,
    spritesheetUrl,
  }
  const fetchImpl = async url => {
    if (url === `${apiBase}/dario`) return Response.json({ pet })
    if (url === spritesheetUrl) return new Response(new Uint8Array([82, 73, 70, 70]))
    return new Response("missing", { status: 404 })
  }

  const installed = await installPet("https://codex-pets.net/#/pets/dario", {
    petsDir,
    codexPetsApiBase: apiBase,
    fetchImpl,
  })

  assert.equal(installed.destination, join(petsDir, "dario"))
  assert.equal(JSON.parse(await readFile(join(petsDir, "dario", "pet.json"), "utf8")).id, "dario")
  assert.deepEqual(await readFile(join(petsDir, "dario", "spritesheet.webp")), Buffer.from([82, 73, 70, 70]))
})
