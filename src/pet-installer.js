import { homedir } from "node:os"
import { basename, join, resolve } from "node:path"
import { mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises"

const DEFAULT_MANIFEST_URL = "https://petdex.dev/api/manifest"
const PETDEX_HOSTS = new Set(["petdex.dev", "www.petdex.dev", "petdex.crafter.run"])
const MAX_FILE_BYTES = 50 * 1024 * 1024

export function petSlugFromUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`Invalid Petdex URL: ${value}`)
  }

  if (url.protocol !== "https:" || !PETDEX_HOSTS.has(url.hostname))
    throw new Error("Pet URL must use HTTPS on petdex.dev")

  const parts = url.pathname.split("/").filter(Boolean)
  const petsIndex = parts.indexOf("pets")
  const slug = petsIndex >= 0 ? parts[petsIndex + 1] : ""
  if (!slug || petsIndex + 2 !== parts.length || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Error("Pet URL must look like https://petdex.dev/pets/<pet-id>")

  return slug
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

function validatePetJson(bytes, slug) {
  let pet
  try {
    pet = JSON.parse(bytes.toString("utf8"))
  } catch {
    throw new Error("Petdex returned an invalid pet.json")
  }

  const spritesheetPath = String(pet.spritesheetPath || "")
  if (pet.id !== slug) throw new Error(`pet.json ID does not match URL slug ${slug}`)
  if (basename(spritesheetPath) !== spritesheetPath || !/^spritesheet\.(webp|png)$/i.test(spritesheetPath))
    throw new Error("pet.json must reference spritesheet.webp or spritesheet.png")

  return { pet, spritesheetPath }
}

export async function installPet(petUrl, options = {}) {
  const slug = petSlugFromUrl(petUrl)
  const fetchImpl = options.fetchImpl || globalThis.fetch
  if (typeof fetchImpl !== "function") throw new Error("This command requires Node.js 20 or newer")

  const petsDir = resolve(options.petsDir || join(homedir(), ".config", "omarpets", "pets"))
  const destination = join(petsDir, slug)

  try {
    await stat(destination)
    throw new Error(`Pet is already installed: ${destination}`)
  } catch (error) {
    if (error?.code !== "ENOENT") throw error
  }

  const manifestUrl = options.manifestUrl || DEFAULT_MANIFEST_URL
  const manifestResponse = await fetchResponse(manifestUrl, fetchImpl)
  const entries = entriesFromManifest(await manifestResponse.json())
  const entry = entries.find(candidate => candidate?.slug === slug)
  if (!entry) throw new Error(`Petdex pet not found: ${slug}`)
  if (!entry.petJsonUrl || !entry.spritesheetUrl)
    throw new Error(`Petdex manifest entry is incomplete: ${slug}`)

  await mkdir(petsDir, { recursive: true })
  const stagingDir = await mkdtemp(join(petsDir, `.${slug}-`))

  try {
    const [petJsonBytes, spritesheetBytes] = await Promise.all([
      download(entry.petJsonUrl, fetchImpl),
      download(entry.spritesheetUrl, fetchImpl),
    ])
    const { pet, spritesheetPath } = validatePetJson(petJsonBytes, slug)

    await Promise.all([
      writeFile(join(stagingDir, "pet.json"), petJsonBytes),
      writeFile(join(stagingDir, spritesheetPath), spritesheetBytes),
    ])
    await rename(stagingDir, destination)

    return {
      slug,
      displayName: String(pet.displayName || pet.id),
      destination,
    }
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true })
    if (error?.code === "EEXIST" || error?.code === "ENOTEMPTY")
      throw new Error(`Pet is already installed: ${destination}`)
    throw error
  }
}
