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

```bash
omarchy plugin add https://github.com/YOUR-USER/omarpets --enable
```

For a local checkout:

```bash
omarchy plugin add "$(pwd)" --enable
```

Automatic detection watches recent Codex and Claude session writes. It distinguishes active work, an open agent waiting for input, and no running agent.

For exact state reporting from any agent or hook, run the bundled controller:

```bash
~/.config/omarchy/plugins/wei.omarpets/bin/omarpetsctl working "Running tests"
~/.config/omarchy/plugins/wei.omarpets/bin/omarpetsctl waiting "Approve deployment"
~/.config/omarchy/plugins/wei.omarpets/bin/omarpetsctl success "Tests passed"
~/.config/omarchy/plugins/wei.omarpets/bin/omarpetsctl error "Build failed"
~/.config/omarchy/plugins/wei.omarpets/bin/omarpetsctl idle
```

Left-, middle-, and right-click the pet to preview working, success, and error animations. Hover for the current state and detail.

## Use another Codex pet

Install a pet into `~/.codex/pets/<pet-id>` and set the plugin's `petPath`:

```bash
omarchy bar set wei.omarpets petPath '~/.codex/pets/my-pet'
```

The folder must contain `pet.json` and the PNG or WebP named by its `spritesheetPath`. WebP sheets are converted into the OmarPets cache at runtime for Qt builds without WebP support. The first nine rows must follow the Codex pet state contract. ImageMagick's `magick` command must be installed for WebP conversion.

Useful settings:

```bash
omarchy bar set wei.omarpets scale 1.5 --json
omarchy bar set wei.omarpets frameIntervalMs 120 --json
omarchy bar set wei.omarpets autoDetect false --json
```

## Ponyta artwork and license

The bundled Ponyta spritesheet comes from [Codex PokéPets](https://github.com/dnnyngyen/codex-pokepets), derived from Pokémon Black & White artwork. Pokémon imagery is © Nintendo / Game Freak / Creatures Inc. and is included only for personal, non-commercial fan use. It is not covered by this plugin's MIT code license. See [NOTICE.md](NOTICE.md).
