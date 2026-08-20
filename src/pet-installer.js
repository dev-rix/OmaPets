import { homedir } from "node:os"
import { basename, join, resolve } from "node:path"
import { mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises"

const DEFAULT_MANIFEST_URL = "https://petdex.dev/api/manifest"
const DEFAULT_CODEX_PETS_API_BASE = "https://codex-pets.net/api/pets"
const PETDEX_HOSTS = new Set(["petdex.dev", "www.petdex.dev", "petdex.crafter.run"])
const CODEX_PETS_HOSTS = new Set(["codex-pets.net", "www.codex-pets.net"])
const MAX_FILE_BYTES = 50 * 1024 * 1024

function petSourceFromUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`Invalid pet URL: ${value}`)
  }

  if (url.protocol !== "https:" || (!PETDEX_HOSTS.has(url.hostname) && !CODEX_PETS_HOSTS.has(url.hostname)))
    throw new Error("Pet URL must use HTTPS on petdex.dev or codex-pets.net")

  const provider = CODEX_PETS_HOSTS.has(url.hostname) ? "codex-pets" : "petdex"
  const route = provider === "codex-pets" && url.hash
    ? url.hash.replace(/^#\/?/, "/")
    : url.pathname
  const parts = route.split("/").filter(Boolean)
  const petsIndex = parts.indexOf("pets")
  const slug = petsIndex >= 0 ? parts[petsIndex + 1] : ""
  if (!slug || petsIndex + 2 !== parts.length || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Error(`Pet URL must look like ${provider === "codex-pets"
      ? "https://codex-pets.net/#/pets/<pet-id>"
      : "https://petdex.dev/pets/<pet-id>"}`)

  return { provider, slug }
}

export function petSlugFromUrl(value) {
  return petSourceFromUrl(value).slug
}

function entriesFromManifest(manifest) {
  const entries = Array.isArray(manifest) ? manifest : manifest?.pets
  if (!Array.isArray(entries)) throw new Error("Petdex returned an invalid manifest")
  return entries
}

async function fetchResponse(url, fetchImpl) {
  const response = await fetchImpl(url, { redirect: "follow" })
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`)
  return response
}

async function download(url, fetchImpl) {
  const response = await fetchResponse(url, fetchImpl)
  const declaredSize = Number(response.headers.get("content-length") || 0)
  if (declaredSize > MAX_FILE_BYTES) throw new Error(`Download is larger than ${MAX_FILE_BYTES} bytes`)

  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length === 0) throw new Error(`Downloaded an empty file from ${url}`)
  if (bytes.length > MAX_FILE_BYTES) throw new Error(`Download is larger than ${MAX_FILE_BYTES} bytes`)
  return bytes
}

function validatePetJson(bytes) {
  let pet
  try {
    pet = JSON.parse(bytes.toString("utf8"))
  } catch {
    throw new Error("Pet provider returned an invalid pet.json")
  }

  const petId = String(pet.id || "")
  const spritesheetPath = String(pet.spritesheetPath || "")
  if (!petId.trim()) throw new Error("pet.json must include an ID")
  if (basename(spritesheetPath) !== spritesheetPath || !/^spritesheet\.(webp|png)$/i.test(spritesheetPath))
    throw new Error("pet.json must reference spritesheet.webp or spritesheet.png")

  return { pet, petId, spritesheetPath }
}

function directorySlug(petId, sourceSlug) {
  const normalized = String(petId)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return normalized || sourceSlug
}

export async function installPet(petUrl, options = {}) {
  const { provider, slug } = petSourceFromUrl(petUrl)
  const fetchImpl = options.fetchImpl || globalThis.fetch
  if (typeof fetchImpl !== "function") throw new Error("This command requires Node.js 20 or newer")

  const petsDir = resolve(options.petsDir || join(homedir(), ".config", "omarpets", "pets"))

  let petJsonUrl
  let spritesheetUrl
  let inlinePetJson

  if (provider === "codex-pets") {
    const apiBase = String(options.codexPetsApiBase || DEFAULT_CODEX_PETS_API_BASE).replace(/\/$/, "")
    const detailResponse = await fetchResponse(`${apiBase}/${encodeURIComponent(slug)}`, fetchImpl)
    const detail = await detailResponse.json()
    const pet = detail?.pet
    if (!pet || !pet.spritesheetUrl)
      throw new Error(`Codex Pets returned incomplete metadata: ${slug}`)
    inlinePetJson = Buffer.from(`${JSON.stringify(pet, null, 2)}\n`)
    spritesheetUrl = pet.spritesheetUrl
  } else {
    const manifestUrl = options.manifestUrl || DEFAULT_MANIFEST_URL
    const manifestResponse = await fetchResponse(manifestUrl, fetchImpl)
    const entries = entriesFromManifest(await manifestResponse.json())
    const entry = entries.find(candidate => candidate?.slug === slug)
    if (!entry) throw new Error(`Petdex pet not found: ${slug}`)
    if (!entry.petJsonUrl || !entry.spritesheetUrl)
      throw new Error(`Petdex manifest entry is incomplete: ${slug}`)
    petJsonUrl = entry.petJsonUrl
    spritesheetUrl = entry.spritesheetUrl
  }

  await mkdir(petsDir, { recursive: true })
  const stagingDir = await mkdtemp(join(petsDir, `.${slug}-`))
  let destination

  try {
    const [petJsonBytes, spritesheetBytes] = await Promise.all([
      inlinePetJson || download(petJsonUrl, fetchImpl),
      download(spritesheetUrl, fetchImpl),
    ])
    const { pet, petId, spritesheetPath } = validatePetJson(petJsonBytes)
    const installedSlug = directorySlug(petId, slug)
    destination = join(petsDir, installedSlug)

    try {
      await stat(destination)
      throw new Error(`Pet is already installed: ${destination}`)
    } catch (error) {
      if (error?.code !== "ENOENT") throw error
    }

    await Promise.all([
      writeFile(join(stagingDir, "pet.json"), petJsonBytes),
      writeFile(join(stagingDir, spritesheetPath), spritesheetBytes),
    ])
    await rename(stagingDir, destination)

    return {
      slug: installedSlug,
      sourceSlug: slug,
      displayName: String(pet.displayName || pet.id),
      destination,
    }
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true })
    if (destination && (error?.code === "EEXIST" || error?.code === "ENOTEMPTY"))
      throw new Error(`Pet is already installed: ${destination}`)
    throw error
  }
}
