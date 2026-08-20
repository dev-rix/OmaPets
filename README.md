# OmarPets

OmarPets is an Omarchy top-bar plugin that renders any Codex-compatible pet as a live coding-agent status indicator. It supports the standard v1 (`1536x1872`) and v2 (`1536x2288`) sprite layouts. Pets are installed separately and no artwork is bundled with the plugin.

<video src="assets/omarpets.mp4" controls></video>

## Install the plugin

Install and enable OmarPets:

```bash
omarchy plugin add https://github.com/yesmeck/omarpets.git --enable --yes
```

Pets are installed separately. Until one is installed and selected, the bar
shows a placeholder. Right-click it to open the pet picker.

## Install a pet

The included Node.js package supports [Petdex](https://petdex.dev/),
[Codex Pets](https://codex-pets.net/), and [OpenPets](https://openpets.dev/)
URLs:

```bash
npx omarpets https://petdex.dev/pets/kabi
npx omarpets 'https://codex-pets.net/#/pets/dario'
npx omarpets https://openpets.dev/pets/player-05-b28eec8e
```

Quote Codex Pets URLs so the shell preserves the `#` route.

Pets are installed into `~/.config/omarpets/pets/<pet-id>` and appear in the
right-click picker. Existing pet folders are never overwritten. Use
`--dir <path>` to choose another destination.

## Agent status

Automatic detection follows the agent selected by `omarchy-default-agent`.
Recent session activity and process presence provide basic state detection.

For more accurate working, waiting, finished, and failed states, install the
optional lifecycle integrations:

```bash
~/.config/omarchy/plugins/wei.omarpets/bin/install-agent-hooks
```

With no arguments, the script installs integrations for every supported agent.
You can instead install one or more named agents:

```bash
~/.config/omarchy/plugins/wei.omarpets/bin/install-agent-hooks claude
~/.config/omarchy/plugins/wei.omarpets/bin/install-agent-hooks codex gemini
```

Supported names are `codex`, `claude`, `opencode`, `gemini`, `copilot`,
`crush`, `grok`, `pi`, and `omp`. The installer uses each agent's native hook,
plugin, or extension mechanism. Existing JSON and TOML settings are preserved,
changed files are backed up, and running it again does not add duplicate hooks.

Restart any open agent sessions after installation. OmarPets only uses hook data
from the agent currently selected by `omarchy-default-agent`; other installed
integrations can remain enabled for when you switch agents. Crush currently
exposes only a pre-tool hook, so its remaining states continue to use automatic
activity detection.

## Usage

Right-click the pet to list installed pets and switch between them. The choice
is saved in the bar configuration. Left-click previews working and middle-click
previews success. Hover for the current state and detail.

You can also select a pet through the CLI:

```bash
omarchy bar set wei.omarpets petPath my-pet
```

Useful settings:

```bash
omarchy bar set wei.omarpets scale 1.5 --json
omarchy bar set wei.omarpets frameIntervalMs 120 --json
omarchy bar set wei.omarpets autoDetect false --json
```
