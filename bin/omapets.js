#!/usr/bin/env node

import process from "node:process"
import { createInterface } from "node:readline/promises"
import { installPet } from "../src/pet-installer.js"

const usage = `Usage:
  omapets
  omapets <pet-url> [--dir <pets-directory>]
  omapets install <pet-url> [--dir <pets-directory>]

Example:
  omapets https://petdex.dev/pets/kabi
  omapets https://codex-pets.net/#/pets/dario
  omapets https://openpets.dev/pets/player-05-b28eec8e`

function parseArgs(args) {
  const values = [...args]
  if (values[0] === "install") values.shift()
  if (values.includes("--help") || values.includes("-h")) return { help: true }

  const petUrl = values.shift()
  let petsDir

  while (values.length > 0) {
    const option = values.shift()
    if (option === "--dir") {
      petsDir = values.shift()
      if (!petsDir) throw new Error("--dir requires a directory")
    } else {
      throw new Error(`Unknown option: ${option}`)
    }
  }

  return { petUrl, petsDir }
}

async function promptForPetUrl() {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error("A Petdex, Codex Pets, or OpenPets URL is required")

  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const value = (await prompt.question("Pet URL: ")).trim()
    if (!value) throw new Error("A pet URL is required")
    return value
  } finally {
    prompt.close()
  }
}

try {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(usage)
    process.exit(0)
  }

  const petUrl = args.petUrl || await promptForPetUrl()
  const result = await installPet(petUrl, { petsDir: args.petsDir })
  console.log(`Installed ${result.displayName} to ${result.destination}`)
} catch (error) {
  console.error(`omapets: ${error.message}`)
  console.error(usage)
  process.exitCode = 1
}
