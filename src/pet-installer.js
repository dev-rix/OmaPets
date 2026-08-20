import { homedir } from "node:os"
import { basename, join, resolve } from "node:path"
import { mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises"

const DEFAULT_MANIFEST_URL = "https://petdex.dev/api/manifest"
const DEFAULT_CODEX_PETS_API_BASE = "https://codex-pets.net/api/pets"
const DEFAULT_OPENPETS_SEARCH_INDEX_URL = "https://openpets.dev/pets/catalog.v3/search.json"
const PETDEX_HOSTS = new Set(["petdex.dev", "www.petdex.dev", "petdex.crafter.run"])
const CODEX_PETS_HOSTS = new Set(["codex-pets.net", "www.codex-pets.net"])
const OPENPETS_HOSTS = new Set(["openpets.dev", "www.openpets.dev"])
const MAX_FILE_BYTES = 50 * 1024 * 1024

function petSourceFromUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`Invalid pet URL: ${value}`)
  }

  const supportedHost = PETDEX_HOSTS.has(url.hostname)
    || CODEX_PETS_HOSTS.has(url.hostname)
    || OPENPETS_HOSTS.has(url.hostname)
  if (url.protocol !== "https:" || !supportedHost)
    throw new Error("Pet URL must use HTTPS on petdex.dev, codex-pets.net, or openpets.dev")

  const provider = CODEX_PETS_HOSTS.has(url.hostname)
    ? "codex-pets"
    : OPENPETS_HOSTS.has(url.hostname) ? "openpets" : "petdex"
  const route = provider === "codex-pets" && url.hash
    ? url.hash.replace(/^#\/?/, "/")
    : url.pathname
  const parts = route.split("/").filter(Boolean)
  const petsIndex = parts.indexOf("pets")
  const slug = petsIndex >= 0 ? parts[petsIndex + 1] : ""
  if (!slug || petsIndex + 2 !== parts.length || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Error(`Pet URL must look like ${provider === "codex-pets"
      ? "https://codex-pets.net/#/pets/<pet-id>"
      : provider === "openpets"
        ? "https://openpets.dev/pets/<pet-page-id>"
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

async function openPetsMetadata(sourceSlug, options, fetchImpl) {
  const slugMatch = sourceSlug.match(/^(.+)-[0-9a-f]{8}$/)
  if (!slugMatch) throw new Error("OpenPets URL must end with its eight-character page fingerprint")
  const petId = slugMatch[1]
  const searchIndexUrl = options.openPetsSearchIndexUrl || DEFAULT_OPENPETS_SEARCH_INDEX_URL
  const searchIndexResponse = await fetchResponse(searchIndexUrl, fetchImpl)
  const searchIndex = await searchIndexResponse.json()
  if (searchIndex?.version !== 3 || !Array.isArray(searchIndex.pages))
    throw new Error("OpenPets returned an invalid search index")

  let catalogPage
  for (const pageUrl of searchIndex.pages) {
    const resolvedPageUrl = new URL(String(pageUrl), searchIndexUrl)
    if (resolvedPageUrl.origin !== new URL(searchIndexUrl).origin)
      throw new Error("OpenPets search page uses an unexpected host")
    const response = await fetchResponse(resolvedPageUrl, fetchImpl)
    const page = await response.json()
    const match = Array.isArray(page?.pets)
      ? page.pets.find(candidate => candidate?.id === petId)
      : undefined
    if (match) {
      catalogPage = match.catalogPage
      break
    }
  }
  if (!Number.isInteger(catalogPage) || catalogPage < 0)
    throw new Error(`OpenPets pet not found: ${sourceSlug}`)

  const catalogPageUrl = options.openPetsCatalogPageUrl
    ? options.openPetsCatalogPageUrl(catalogPage)
    : `https://openpets.dev/pets/catalog.v3/page-${String(catalogPage).padStart(3, "0")}.json`
  const catalogResponse = await fetchResponse(catalogPageUrl, fetchImpl)
  const catalog = await catalogResponse.json()
  const pet = Array.isArray(catalog?.pets)
    ? catalog.pets.find(candidate => candidate?.id === petId)
    : undefined
  if (!pet || !pet.spritesheet) throw new Error(`OpenPets catalog entry is incomplete: ${petId}`)

  const spritesheetUrl = new URL(pet.spritesheet)
  if (spritesheetUrl.protocol !== "https:"
      || !OPENPETS_HOSTS.has(spritesheetUrl.hostname)
      || spritesheetUrl.pathname !== `/pets/${sourceSlug}/spritesheet.webp`
      || spritesheetUrl.search || spritesheetUrl.hash)
    throw new Error("OpenPets catalog returned an unexpected spritesheet URL")

  return {
    petJson: {
      id: petId,
      displayName: String(pet.displayName || petId),
      description: String(pet.description || ""),
      spritesheetPath: "spritesheet.webp",
    },
    spritesheetUrl: spritesheetUrl.toString(),
  }
}

export async function installPet(petUrl, options = {}) {
  const { provider, slug } = petSourceFromUrl(petUrl)
  const fetchImpl = options.fetchImpl || globalThis.fetch
  if (typeof fetchImpl !== "function") throw new Error("This command requires Node.js 20 or newer")

  const petsDir = resolve(options.petsDir || join(homedir(), ".config", "omarpets", "pets"))

  let petJsonUrl
  let spritesheetUrl
  let inlinePetJson

  if (provider === "openpets") {
    const metadata = await openPetsMetadata(slug, options, fetchImpl)
    inlinePetJson = Buffer.from(`${JSON.stringify(metadata.petJson, null, 2)}\n`)
    spritesheetUrl = metadata.spritesheetUrl
  } else if (provider === "codex-pets") {
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
