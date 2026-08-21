# OmaPets

OmaPets is an Omarchy top-bar plugin that renders any Codex-compatible pet as a live coding-agent status indicator. It supports the standard v1 (`1536x1872`) and v2 (`1536x2288`) sprite layouts. Pets are installed separately and no artwork is bundled with the plugin.

https://github.com/user-attachments/assets/be318ba0-94ea-4dd5-a315-9245acc02349

## Install the plugin

Install and enable OmaPets:

```bash
omarchy plugin add https://github.com/yesmeck/OmaPets.git --enable --yes
```

Pets are installed separately. Until one is installed and selected, the bar
shows a placeholder. Right-click it to open the pet picker.

## Install a pet

Open the OmaPets panel and select **Install pet**. A floating terminal shows
the supported URL formats, prompts for a pet page URL, installs the pet, and
displays its local path. Press any key when finished to close the terminal;
the pet picker refreshes automatically.

The bundled Bash installer supports [Petdex](https://petdex.dev/),
[Codex Pets](https://codex-pets.net/), and [OpenPets](https://openpets.dev/).
It uses the standard Omarchy tools `bash`, `curl`, and `jq`.

The installer is versioned with the plugin, validates provider hosts and HTTPS
redirects, and never overwrites an existing pet directory.

Pets are installed into `~/.config/omapets/pets/<pet-id>` and appear in the
right-click picker. Existing pet folders are never overwritten. Use
`--dir <path>` to choose another destination.

## Agent status

Automatic detection follows the agent selected by `omarchy-default-agent`.
Recent session activity and process presence provide basic state detection.

For more accurate working, waiting, finished, and failed states, install the
optional lifecycle integrations. Open the OmaPets panel, select **Install
hooks**, choose one or more coding agents, and press Enter. The floating
terminal reports changed files and backups, then waits for a keypress before
closing.

Supported names are `codex`, `claude`, `opencode`, `gemini`, `copilot`,
`crush`, `grok`, `pi`, and `omp`. The installer uses each agent's native hook,
plugin, or extension mechanism. Existing JSON and TOML settings are preserved,
changed files are backed up, and running it again does not add duplicate hooks.

Remove one or more integrations without disturbing other agent settings:

```bash
~/.config/omarchy/plugins/omapets/bin/install-agent-hooks --uninstall codex claude
~/.config/omarchy/plugins/omapets/bin/install-agent-hooks --uninstall all
```

Uninstall also creates backups. Generated integration files are removed only
when they contain an OmaPets ownership marker or match the legacy generated
format; files without either signature are left in place for manual review.

Restart any open agent sessions after installation. OmaPets only uses hook data
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
omarchy bar set omapets petPath my-pet
```

Useful settings:

```bash
omarchy bar set omapets scale 1.5 --json
omarchy bar set omapets frameIntervalMs 120 --json
omarchy bar set omapets autoDetect false --json
```
