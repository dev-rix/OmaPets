# OmarPets

OmarPets is an Omarchy top-bar plugin that renders any Codex-compatible pet as a live coding-agent status indicator. It includes Ponyta and supports the standard v1 (`1536x1872`) and v2 (`1536x2288`) sprite layouts.

| Agent state | Pet animation row |
| --- | --- |
| Idle | Idle |
| Working | Running / active work |
| Waiting for input | Waiting |
| Finished | Review |
| Failed | Failed |

## Install

Install and enable OmarPets, then add its Codex lifecycle hooks:

```bash
omarchy plugin add https://github.com/yesmeck/omarpets.git --enable --yes && \
  ~/.config/omarchy/plugins/wei.omarpets/bin/install-codex-hooks
```

This places the widget in the middle section of the bar by default. Codex will
ask you to trust the installed commands the next time it starts; inspect and
approve them with `/hooks`.

For a local checkout:

```bash
omarchy plugin add "$(pwd)" --enable --yes && \
  ~/.config/omarchy/plugins/wei.omarpets/bin/install-codex-hooks
```

Automatic detection follows the agent selected by `omarchy-default-agent`. Explicit lifecycle events are the primary status source, recent session activity is the fallback, and process presence is used only when neither is available.

The installer adds commands alongside existing hooks without replacing them. Codex will ask you to trust the new commands when it next starts. The hooks report prompt submission, tool activity, permission requests, completion, and session boundaries through a small atomic state file.

For exact state reporting from any agent or hook, run the bundled controller:

```bash
~/.config/omarchy/plugins/wei.omarpets/bin/omarpetsctl working "Running tests"
~/.config/omarchy/plugins/wei.omarpets/bin/omarpetsctl waiting "Approve deployment"
~/.config/omarchy/plugins/wei.omarpets/bin/omarpetsctl success "Tests passed"
~/.config/omarchy/plugins/wei.omarpets/bin/omarpetsctl error "Build failed"
~/.config/omarchy/plugins/wei.omarpets/bin/omarpetsctl idle
```

Right-click the pet to list installed pets and switch between them. The choice
is saved in the bar configuration. Left-click previews working and middle-click
previews success. Hover for the current state and detail.

## Use another Codex pet

Install a pet into `~/.config/omarpets/pets/<pet-id>` and set the plugin's
`petPath` to its ID:

```bash
omarchy bar set wei.omarpets petPath my-pet
```

Alternatively, right-click the pet in the bar and choose it from the list.

You can also set `petPath` to an absolute path or a path beginning with `~/`.
The folder must contain `pet.json` and the PNG or WebP named by its
`spritesheetPath`. WebP sheets are converted into the OmarPets cache at runtime
for Qt builds without WebP support. The first nine rows must follow the Codex
pet state contract. ImageMagick's `magick` command must be installed for WebP
conversion.

Useful settings:

```bash
omarchy bar set wei.omarpets scale 1.5 --json
omarchy bar set wei.omarpets frameIntervalMs 120 --json
omarchy bar set wei.omarpets autoDetect false --json
```

## Ponyta artwork and license

The bundled Ponyta spritesheet comes from [Codex PokéPets](https://github.com/dnnyngyen/codex-pokepets), derived from Pokémon Black & White artwork. Pokémon imagery is © Nintendo / Game Freak / Creatures Inc. and is included only for personal, non-commercial fan use. It is not covered by this plugin's MIT code license. See [NOTICE.md](NOTICE.md).
