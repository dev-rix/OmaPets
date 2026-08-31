# OmaPets

OmaPets puts an animated coding companion in the Omarchy top bar. Your pet
reacts while your coding agent works, waits for input, finishes, or encounters
an error.

https://github.com/user-attachments/assets/be318ba0-94ea-4dd5-a315-9245acc02349

## Install the plugin

Install and enable OmaPets:

```bash
omarchy plugin add https://github.com/yesmeck/OmaPets.git --enable --yes
```

Click the pet in the bar to open the OmaPets panel.

## About this fork

This repository is a personal fork of the original [OmaPets project](https://github.com/yesmeck/OmaPets).
The upstream project is the recommended choice for most users and is the best
place to receive the author's normal updates:

```bash
omarchy plugin add https://github.com/yesmeck/OmaPets.git --enable --yes
```

This fork is maintained for my own vibe-coding setup. If you want the personal
customizations, install it instead with:

```bash
omarchy plugin add https://github.com/dev-rix/OmaPets.git --enable --yes
```

The fork currently adds:

- A magnified status window for waiting and error states, with yellow warning
  and red stop indicators in the top bar.
- Automatic dismissal of the magnified window after three seconds while the
  computer is active, while allowing it to remain visible during idle time.
- Discovery of pets installed through symlinks, including GNU Stow-managed
  dotfiles.
- Installation of pets from authenticated private GitHub repositories.
- Support for GitHub pet collections: a root `pet.json` is one pet; otherwise,
  immediate subfolders containing `pet.json` are installed as separate pets.

## Bundled pet

OmaPets includes [Glitchcat from Petdex](https://petdex.dev/pets/glitchcat)
as its default pet.

## Install a pet

Open the OmaPets panel and select **Install pet**. Paste a pet URL from
[Petdex](https://petdex.dev/), [Codex Pets](https://codex-pets.net/), or
[OpenPets](https://openpets.dev/). GitHub repositories are also supported when
they contain an OmaPets `pet.json` and spritesheet at their repository root.
For private GitHub repositories, authenticate the GitHub CLI first with
`gh auth login`, then paste a URL such as
`https://github.com/owner/private-pet`. A repository with a root `pet.json` is
installed as one pet. Otherwise, each immediate subfolder containing a
`pet.json` is installed as a pet; deeper folders are ignored. When installation
finishes, close the terminal and select your new pet from the panel.

## Agent status

OmaPets detects agent activity automatically. For more accurate status changes,
open the panel and select **Agent hooks**. Use Space to select your coding
agents, then press Enter. Restart any open agent sessions after installation.

## Usage

Left-click the pet to list installed pets and switch between them. The choice is
saved in the bar configuration. Select **Open folder** to browse the installed
pet files. Right-click cycles through pet statuses, and middle-click previews
success. Hover for the current state and detail.
