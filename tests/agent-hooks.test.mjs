import assert from "node:assert/strict"
import { access, chmod, lstat, mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const installer = resolve("bin/install-agent-hooks")
const hook = resolve("bin/omapets-hook")
const detector = resolve("bin/detect-agent")

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

test("uses the OmaPets state directory consistently", async () => {
  const [hookSource, detectorSource] = await Promise.all([
    readFile(hook, "utf8"),
    readFile(detector, "utf8"),
  ])

  assert.match(hookSource, /omarchy\/omapets\/status\.json|state_dir="\$state_home\/omarchy\/omapets"/)
  assert.match(detectorSource, /omarchy\/omapets\/status\.json/)
  assert.doesNotMatch(`${hookSource}\n${detectorSource}`, /omarchy\/omarpets/)
})

test("installs and uninstalls every managed agent integration", async () => {
  const root = await mkdtemp(join(tmpdir(), "omarpets-hooks-test-"))
  const paths = {
    codex: join(root, "codex"),
    claude: join(root, "claude"),
    gemini: join(root, "gemini"),
    copilot: join(root, "copilot"),
    grok: join(root, "grok"),
    crush: join(root, "crush"),
    config: join(root, "config"),
    pi: join(root, "pi"),
    omp: join(root, "omp"),
  }
  const env = {
    ...process.env,
    HOME: root,
    CODEX_HOME: paths.codex,
    CLAUDE_CONFIG_DIR: paths.claude,
    GEMINI_CONFIG_DIR: paths.gemini,
    COPILOT_HOME: paths.copilot,
    GROK_HOME: paths.grok,
    CRUSH_CONFIG_DIR: paths.crush,
    XDG_CONFIG_HOME: paths.config,
    PI_CODING_AGENT_DIR: paths.pi,
    OMP_AGENT_DIR: paths.omp,
  }

  await Promise.all([
    mkdir(paths.codex, { recursive: true }),
    mkdir(paths.claude, { recursive: true }),
    mkdir(paths.crush, { recursive: true }),
  ])
  await Promise.all([
    writeFile(join(paths.codex, "config.toml"), 'model = "gpt-test"\n'),
    writeFile(join(paths.claude, "settings.json"), `${JSON.stringify({
      theme: "dark",
      hooks: { PreToolUse: [{ hooks: [{ type: "command", command: "keep-me" }] }] },
    })}\n`),
    writeFile(join(paths.crush, "crush.json"), `${JSON.stringify({
      theme: "dark",
      hooks: { PreToolUse: [{ name: "other", command: "keep-me" }] },
    })}\n`),
  ])

  const installed = spawnSync(installer, ["all"], { env, encoding: "utf8" })
  assert.equal(installed.status, 0, installed.stderr)
  assert.match(await readFile(join(paths.codex, "config.toml"), "utf8"), /BEGIN OMAPETS MANAGED HOOKS/)
  const codexConfig = await readFile(join(paths.codex, "config.toml"), "utf8")
  assert.match(codexConfig, /\[\[hooks\.PreToolUse\]\]/)
  assert.doesNotMatch(codexConfig, /\[\[hooks\.PostToolUse\]\]/)
  assert.equal(await exists(join(paths.config, "opencode/plugins/omapets.js")), true)
  assert.equal(await exists(join(paths.pi, "extensions/omapets.ts")), true)

  const uninstalled = spawnSync(installer, ["--uninstall", "all"], { env, encoding: "utf8" })
  assert.equal(uninstalled.status, 0, uninstalled.stderr)

  assert.equal(await readFile(join(paths.codex, "config.toml"), "utf8"), 'model = "gpt-test"\n')
  const claude = JSON.parse(await readFile(join(paths.claude, "settings.json"), "utf8"))
  assert.equal(claude.theme, "dark")
  assert.equal(claude.hooks.PreToolUse[0].hooks[0].command, "keep-me")
  const crush = JSON.parse(await readFile(join(paths.crush, "crush.json"), "utf8"))
  assert.equal(crush.theme, "dark")
  assert.equal(crush.hooks.PreToolUse[0].command, "keep-me")
  assert.equal(await exists(join(paths.copilot, "hooks/omapets.json")), false)
  assert.equal(await exists(join(paths.grok, "hooks/omapets.json")), false)
  assert.equal(await exists(join(paths.config, "opencode/plugins/omapets.js")), false)
  assert.equal(await exists(join(paths.pi, "extensions/omapets.ts")), false)
  assert.equal(await exists(join(paths.omp, "extensions/omapets.ts")), false)
})

test("writes activity state with owner-only permissions", async () => {
  const root = await mkdtemp(join(tmpdir(), "omarpets-hooks-test-"))
  const stateHome = join(root, "state")
  const result = spawnSync(hook, ["working", "codex"], {
    env: { ...process.env, HOME: root, XDG_STATE_HOME: stateHome },
    input: "{}\n",
    encoding: "utf8",
  })

  assert.equal(result.status, 0, result.stderr)
  const state = join(stateHome, "omarchy/omapets/status.json")
  assert.equal((await lstat(state)).mode & 0o777, 0o600)
})

test("refuses to remove a generated integration without an ownership signature", async () => {
  const root = await mkdtemp(join(tmpdir(), "omarpets-hooks-test-"))
  const plugin = join(root, "opencode/plugins/omapets.js")
  await mkdir(join(root, "opencode/plugins"), { recursive: true })
  await writeFile(plugin, "// user-owned file\n")

  const result = spawnSync(installer, ["--uninstall", "opencode"], {
    env: { ...process.env, HOME: root, XDG_CONFIG_HOME: root },
    encoding: "utf8",
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Refusing to remove modified integration/)
  assert.equal(await readFile(plugin, "utf8"), "// user-owned file\n")
})

test("uninstalls legacy unmarked Codex hook blocks", async () => {
  const root = await mkdtemp(join(tmpdir(), "omarpets-hooks-test-"))
  const codexHome = join(root, "codex")
  const config = join(codexHome, "config.toml")
  const hook = resolve("bin/omapets-hook")
  await mkdir(codexHome, { recursive: true })
  await writeFile(config, `model = "gpt-test"

[[hooks.SessionStart]]
[[hooks.SessionStart.hooks]]
type = "command"
command = "${hook} session-start codex"
`)

  const result = spawnSync(installer, ["--uninstall", "codex"], {
    env: { ...process.env, HOME: root, CODEX_HOME: codexHome },
    encoding: "utf8",
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(await readFile(config, "utf8"), 'model = "gpt-test"\n')
})

test("rejects symlinked install and uninstall targets", async () => {
  const root = await mkdtemp(join(tmpdir(), "omarpets-hooks-test-"))
  const codexHome = join(root, "codex")
  const claudeHome = join(root, "claude")
  const victim = join(root, "victim")
  const codexConfig = join(codexHome, "config.toml")
  const claudeConfig = join(claudeHome, "settings.json")
  await Promise.all([
    mkdir(codexHome, { recursive: true }),
    mkdir(claudeHome, { recursive: true }),
  ])
  await writeFile(victim, "do not modify\n")
  await Promise.all([
    symlink(victim, codexConfig),
    symlink(victim, claudeConfig),
  ])
  const env = {
    ...process.env,
    HOME: root,
    CODEX_HOME: codexHome,
    CLAUDE_CONFIG_DIR: claudeHome,
  }

  for (const args of [["codex"], ["claude"], ["--uninstall", "codex"], ["--uninstall", "claude"]]) {
    const result = spawnSync(installer, args, { env, encoding: "utf8" })
    assert.notEqual(result.status, 0, args.join(" "))
    assert.match(result.stderr, /Refusing symlink target/)
    assert.equal(await readFile(victim, "utf8"), "do not modify\n")
  }
})

test("uses unpredictable exclusive backups without following legacy backup symlinks", async () => {
  const root = await mkdtemp(join(tmpdir(), "omarpets-hooks-test-"))
  const codexHome = join(root, "codex")
  const config = join(codexHome, "config.toml")
  const victim = join(root, "victim")
  await mkdir(codexHome, { recursive: true })
  await writeFile(config, 'model = "gpt-test"\n')
  await writeFile(victim, "do not modify\n")
  const timestamp = spawnSync("date", ["+%Y%m%d%H%M%S"], { encoding: "utf8" }).stdout.trim()
  const legacyBackup = `${config}.bak.${timestamp}`
  await symlink(victim, legacyBackup)

  const result = spawnSync(installer, ["codex"], {
    env: { ...process.env, HOME: root, CODEX_HOME: codexHome },
    encoding: "utf8",
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(await readFile(victim, "utf8"), "do not modify\n")
  assert.equal((await lstat(legacyBackup)).isSymbolicLink(), true)
  const backups = (await readdir(codexHome)).filter(name => /^\.config\.toml\.backup\.[0-9a-f]{32}$/.test(name))
  assert.equal(backups.length, 1)
  assert.equal(await readFile(join(codexHome, backups[0]), "utf8"), 'model = "gpt-test"\n')
})

test("interactive installer applies the agents selected in the floating terminal", async () => {
  const root = await mkdtemp(join(tmpdir(), "omarpets-hooks-test-"))
  const fakeBin = join(root, "bin")
  const codexHome = join(root, "codex")
  const claudeHome = join(root, "claude")
  await mkdir(fakeBin, { recursive: true })
  await writeFile(join(fakeBin, "gum"), "#!/usr/bin/env bash\nprintf 'codex\\nclaude\\n'\n")
  await chmod(join(fakeBin, "gum"), 0o755)

  const result = spawnSync(installer, ["--interactive"], {
    env: {
      ...process.env,
      HOME: root,
      CODEX_HOME: codexHome,
      CLAUDE_CONFIG_DIR: claudeHome,
      PATH: `${fakeBin}:${process.env.PATH}`,
    },
    encoding: "utf8",
    input: "\n",
    timeout: 5_000,
  })

  assert.equal(result.error, undefined, result.error?.message)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Install agent hooks/)
  assert.match(result.stdout, /Agent hooks installed/)
  assert.match(result.stdout, /Press any key to close…/)
  assert.match(await readFile(join(codexHome, "config.toml"), "utf8"), /BEGIN OMAPETS MANAGED HOOKS/)
  assert.equal(JSON.parse(await readFile(join(claudeHome, "settings.json"), "utf8")).hooks !== undefined, true)
})
