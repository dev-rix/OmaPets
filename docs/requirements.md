# OmaPets Requirements

## Document purpose

This document describes what OmaPets currently does, the user outcome it is
intended to provide, and the known direction for future work. Current behavior
and future goals are deliberately separated so that planned functionality is
not mistaken for functionality available today.

This is a living product document. It should be updated whenever observable
behavior, supported workflows, business rules, or priorities change.

## Product context

OmaPets is an Omarchy top-bar companion that represents coding-agent activity
through an animated pet. It is a personal fork of the original OmaPets project.

The owner of this fork is its primary user and decision-maker. The product
should prioritize that user's workflow and preferences. Other Omarchy users
may use the fork, and its behavior should remain understandable and usable for
them where doing so does not compromise the primary user's goals.

## Desired outcome

The primary outcome is a fast, glanceable understanding of a coding agent's
status without requiring the user to switch to the agent's window.

Waiting and error conditions require additional visual prominence because they
may require the user to act. The enlarged pet view serves as an attention
signal rather than a decorative effect.

## Users and stakeholders

### Primary user and product owner

The repository owner uses OmaPets during coding sessions, defines the desired
experience, and decides which inherited or new behaviors should remain.

The owner's currently important coding agents are:

- Codex
- Claude Code
- Agy, whose precise integration requirements are not yet defined

Local-model agents and other coding agents may become important later.

### Other users

Other Omarchy users may install and use the fork voluntarily. They are
secondary users: general usability and safe behavior are desirable, but broad
market adoption is not a primary success measure.

## Current scope

### Top-bar status companion

OmaPets shall display one animated pet in the Omarchy top bar.

The pet shall represent one of these activity states:

| State | Meaning currently presented to the user | Visual treatment |
| --- | --- | --- |
| Idle | The selected agent is not currently detected as working or waiting | Idle animation |
| Working | The selected agent is actively working | A randomly selected running, left-moving, or right-moving animation |
| Waiting | The selected agent needs input, or fallback detection sees an open agent without recent activity | Waiting animation and attention treatment |
| Success | The selected agent reported normal completion or stopped without reporting an error | Success animation without magnification |
| Error | The selected agent has encountered a failure | Error animation and attention treatment |

The user shall be able to hover over the pet to see the detected agent, when
one is known, and the current state. A detail may also be shown when the state
was supplied through a path that includes one, but consistent reason-level
detail is not part of the dependable current experience.

### Attention behavior

Waiting and error states shall trigger the attention treatment. While this
treatment is active:

- The normal top-bar pet shall be replaced by a yellow warning indicator for
  waiting or a red stop indicator for error.
- A magnified view of the pet shall be presented.
- Clicking the magnified view shall dismiss it immediately.
- If the computer is not idle, the magnified view shall dismiss automatically
  after three seconds.
- If Omarchy idle status is available and the computer is idle, automatic
  dismissal shall pause so the attention state remains noticeable when the
  user returns.
- When Omarchy reports that the computer has become active again, the
  three-second dismissal period shall begin again.
- If idle status is unavailable or unusable, OmaPets shall assume the user is
  active and use the three-second dismissal behavior.

Dismissal of the magnified view shall not change the underlying agent state.
Success shall not trigger the magnified attention view.

### Agent status reporting

OmaPets currently supports two levels of status reporting:

1. Automatic detection, enabled by default, checks saved hook status and
   provides a fallback based on the current Omarchy agent, recent activity,
   and whether its process is running.
2. Optional agent hooks provide lifecycle-based status updates where an agent
   supports them.

Automatic detection shall periodically reassess the current/default Omarchy
agent. In the current product, one pet represents only that agent; activity
from multiple agents is not displayed simultaneously.

The current `autoDetect` setting controls the entire recurring status check.
Disabling it therefore stops both heuristic inference and the widget's reading
of saved hook updates. This coupling is a known limitation and is scheduled to
change in the implementation backlog.

If no current/default agent is available, the pet shall report idle. For Codex
and Claude Code, recent agent-session activity shall be treated as working. If
the selected agent is running without recent detectable activity, fallback
detection shall treat it as waiting. This last behavior is a known semantic
limitation because it does not prove that user input is required.

A recent hook state shall take precedence over fallback inference when it
belongs to the current/default agent. Successful completion is intentionally
short-lived; other hook states may persist until replaced, expired, or ended
by another lifecycle event.

The interactive hook setup currently offers these agent identifiers:

- `codex` (Codex)
- `claude` (Claude Code)
- `opencode` (OpenCode)
- `gemini` (Gemini)
- `copilot` (GitHub Copilot)
- `crush` (Crush)
- `grok` (Grok)
- `pi` (Pi)
- `omp` (Oh My Pi)

The user shall be able to select one or more agents during interactive hook
setup. The user shall be told to restart open agent sessions after setup so the
new reporting behavior can take effect.

Hook removal shall remove only OmaPets-managed behavior and preserve unrelated
agent configuration. If ownership of a generated integration cannot be
established, removal shall be refused rather than deleting a possibly
user-owned file.

OmaPets also accepts external status commands for idle, working, waiting,
success, and error, along with commands to refresh the selected pet or the pet
list. This is a supported integration option for custom agents and scripts.
Unknown hook lifecycle events shall make no state change and shall return
without disrupting the coding agent.

### Pet animation

OmaPets shall support the established version 1 and version 2 Codex-compatible
sprite layouts. A pet may provide a PNG or WebP spritesheet.

The displayed sprite shall be cropped to one animation frame. Version 2 pets
shall retain their additional sprite rows rather than being compressed into a
version 1 layout.

While the pet is working, OmaPets shall vary the working animation between the
available running and directional loops. A new working loop may be selected
after the prior loop completes.

The user may configure the pet scale and animation speed within the limits
exposed by the plugin settings.

### Bundled and installed pets

Glitchcat shall be the bundled default pet. If the user has not selected a
different pet, Glitchcat shall appear without requiring a separate install.

The user shall be able to left-click the top-bar pet to open the pet panel. The
panel shall:

- Show the OmaPets identity.
- Show the bundled pet first.
- Discover valid installed pets from the user's OmaPets pets folder.
- Include pets made available through symbolic links, including pets managed
  through a linked dotfiles setup.
- Show an animated preview, display name, and directory identifier for each
  discovered pet.
- Allow the user to select a pet and have that choice persist in the Omarchy
  bar configuration.
- Allow the user to return to the bundled default.
- Provide actions to install a pet, open the pets folder, and configure agent
  hooks.

Pet discovery shall honor the user's configured base configuration directory
and use the standard user configuration directory when none is configured.
Opening the pets folder shall create it first if it does not exist.

The current `petPath` setting accepts either a pet identifier in the OmaPets
pets directory or an arbitrary folder path. Restricting selectable pets to the
pets directory, while continuing to permit entries that are symbolic links, is
an implementation task below.

A discovered pet shall be eligible for display only when its folder contains a
readable `pet.json` and the spritesheet named by that manifest. Invalid or
incomplete pets shall not be presented as available selections. The current
picker reserves the `glitchcat` identifier for the bundled pet and silently
omits an installed pet with that directory identifier.

Pet-provided names shall be rendered as plain text. Control characters that
could corrupt the pet-discovery protocol shall be made inert.

### Pet installation

The user shall be able to start pet installation from the pet panel or invoke
the installer directly. Interactive installation shall explain which URL
formats are accepted, show where the pet will be installed, report progress,
and keep the result visible until the user closes the installer.

The current accepted sources are:

- Petdex pet-page URLs
- Codex Pets pet-page URLs
- OpenPets pet-page URLs
- GitHub repository URLs

Private GitHub repositories shall be supported when the user has authenticated
their GitHub access before installation.

For GitHub repositories:

- A root-level `pet.json` defines one pet package.
- If no root-level `pet.json` exists, each immediate child folder containing a
  `pet.json` defines a separate pet package.
- Folders deeper than one level shall not be searched for packages.
- Each installed package must include the spritesheet named by its manifest.

An installable pet must have a non-empty identifier and must name either
`spritesheet.png` or `spritesheet.webp`. Installed directory identifiers shall
be normalized into safe, consistent names.

The installer currently does not overwrite an existing pet with the same
installed identifier. It reports the conflict and leaves the existing pet in
place. The planned collision behavior is defined in the implementation backlog.
After a successful interactive installation, the panel's available-pet list
shall be refreshed.

### Dependencies and capability constraints

OmaPets relies on capabilities provided by its Omarchy environment and helper
programs. The current dependencies are:

- ImageMagick for WebP conversion and installed-pet previews.
- `curl` and `jq` for pet installation and package validation.
- `gum` for interactive agent selection during hook setup.
- GitHub CLI access for GitHub-hosted pets, with prior authentication required
  for private repositories.
- Omarchy shell, terminal, file-opening, and idle-status capabilities for the
  corresponding panel and attention workflows.

A missing conditional dependency shall be explained to the user when they try
to use the affected capability. It shall not cause an unexplained blank or be
represented as a successful result.

### Diagnostic interactions

The following inherited interactions remain available as testing conveniences
rather than core product workflows:

- Right-clicking the pet cycles through idle, working, waiting, success, and
  error and requests a five-second override.
- Middle-clicking the pet requests a two-and-a-half-second success override.

These controls allow visual states to be checked without requiring a real
agent lifecycle event. Currently, expiration only allows automatic detection
to replace the preview; it does not itself restore a state. A preview can
therefore remain indefinitely when automatic detection is disabled.

## Business rules and safety constraints

The following safeguards are part of expected product behavior:

- User-supplied provider URLs must use an approved secure service.
- Direct catalog-provider downloads must validate every redirect before it is
  followed, limit redirect chains, and fail safely on redirect loops.
- GitHub retrieval currently uses GitHub CLI access and receives package
  validation after retrieval, but not every file receives the same explicit
  pre-installation size controls as direct catalog-provider downloads.
- Empty downloads and protected files larger than the accepted maximum must be
  rejected. Consistent GitHub file protection is an implementation task.
- A pet spritesheet reference must remain within its pet folder.
- Provider-controlled display names must never be interpreted as executable or
  rich-text content.
- Agent configuration changes must preserve unrelated user settings.
- Existing configuration must be backed up before managed changes replace it.
- Hook setup and removal must reject unsafe symbolic-link or non-regular-file
  targets rather than following them.
- Generated integrations must not be deleted when OmaPets cannot establish
  that it owns them.
- Agent activity-state data shall be readable and writable only by its owner
  because it may contain recent agent metadata.
- Failed installation shall be reported without representing the affected pet
  as successfully installed. WebP conversion failures currently receive only
  a console warning and can leave no visible pet; the required fallback is an
  implementation task.

## Current user journeys and acceptance criteria

### Glance at agent status

Given OmaPets is enabled in the top bar, when the current agent's state changes,
then the pet shall use the animation associated with the detected state.

Given the state is waiting or error, when the state is received, then OmaPets
shall show its attention treatment in addition to representing the state.

Given the attention treatment is visible while the computer is idle, when no
user activity occurs and Omarchy idle status is available, then the magnified
pet shall remain visible.

Given the attention treatment is visible and the computer is active, when
three seconds pass or the user clicks the magnified pet, then the magnified
view shall close without changing the underlying state.

### Choose a pet

Given the user opens the pet panel, when installed pets are successfully
discovered, then the current panel shall show bundled Glitchcat and every valid
discovered pet except an installed pet that conflicts with the reserved
`glitchcat` identifier.

Given the user chooses a pet, when the selection is saved, then the top-bar pet
shall update to that selection and the choice shall persist.

Given the user chooses Glitchcat, when the selection is saved, then OmaPets
shall restore the bundled-default selection rather than requiring a copied
Glitchcat install.

### Install a pet

Given the user provides a supported pet URL, when the package is valid and no
pet with the same normalized identifier exists, then the pet manifest and its
spritesheet shall be installed together and the user shall be told where the
pet was installed.

Given a direct catalog provider redirects a download, when any destination is
not an approved secure source or the redirect limit is exceeded, then
installation shall stop with an explanation.

Given the destination pet already exists, when installation is attempted, then
the existing pet shall remain unchanged and the user shall be told that the pet
is already installed.

### Configure agent hooks

Given the user opens agent-hook setup, when one or more supported agents are
selected, then OmaPets shall add its reporting behavior for those agents while
preserving unrelated configuration.

Given a user removes OmaPets hooks, when the integration is recognized as
OmaPets-managed, then only the managed integration shall be removed and other
agent settings shall remain.

Given a generated integration is not recognizably owned by OmaPets, when
removal is attempted, then OmaPets shall refuse to delete it and report why.

## Known current limitations

- The product displays one persistent pet and follows only the current/default
  Omarchy agent. It does not display simultaneous agents independently.
- All agent hooks currently write to one shared latest-status record. An event
  from one agent can replace the saved event from another agent before the
  current/default-agent filter is applied.
- Disabling automatic detection also prevents saved hook updates from reaching
  the widget.
- Waiting has two possible meanings under current behavior: a confirmed
  interaction request or an open agent with no recent detected activity.
- An inactive open agent, a completed agent, and an agent blocked on the user
  are not yet reliably distinguishable in every reporting path.
- Reason-level status detail is not consistently carried from agent hooks to
  the visible tooltip.
- Diagnostic previews do not restore themselves when automatic detection is
  disabled.
- An invalid selected pet or a failed WebP conversion can leave the bar without
  a visible pet instead of falling back to Glitchcat.
- Pet discovery does not yet apply the same spritesheet containment rule as
  installation and final pet loading.
- Hook installation can replace an unrecognized same-name integration after
  backing it up; ownership is checked more strictly during removal.
- The current pet setting permits arbitrary folder paths outside the pets
  directory.
- Identifier collisions are rejected during installation, while an installed
  pet using the bundled `glitchcat` identifier is silently hidden by the picker.
- Agy and local-model agents do not yet have defined supported integrations.
- The automated hook-permissions test uses the unsupported input `working`
  instead of a lifecycle event. A valid `tool-start` event has been verified to
  create a working-state file with owner-only `0600` permissions.
- The interactive hook-installer test is prevented from spawning its test
  process in the reviewed workspace environment with `EPERM`. This is an
  environment/test-harness investigation, not a confirmed product defect.
- Accessibility expectations beyond hover text and differentiated animation,
  shape, and color have not yet been defined.

## Current implementation backlog

The items in this section are agreed requirements but are not current
functionality. They must not be described as shipped until their acceptance
criteria have been verified.

### Align pet discovery containment

- Manually installed and symbolically linked pets shall receive the same
  spritesheet containment protection as downloaded pets.
- Discovery and final selection shall use the same eligibility rule.
- A pet whose spritesheet escapes its pet folder, including through a symbolic
  link, shall not appear selectable.
- Rejection shall not read, convert, or cache the outside file.

### Align GitHub package safeguards

- GitHub content shall correspond to the repository selected by the user.
- Empty or oversized GitHub manifests and spritesheets shall be rejected under
  explicit package limits consistent with other providers.
- An incomplete GitHub retrieval shall not create an installed pet.
- Documentation shall describe equivalent safety outcomes without requiring
  every provider to use identical redirect handling.

### Fall back when a selected pet cannot load

- If the selected pet is invalid, missing, or cannot be converted, OmaPets
  shall display bundled Glitchcat so agent status remains visible.
- The failed pet shall not be represented as usable.
- The pet panel shall identify the unavailable selection clearly enough for the
  user to correct or change it.
- If a missing helper capability caused the failure, the user shall receive a
  clear explanation of what capability is unavailable.

### Make diagnostic previews reliably temporary

- A right-click state preview shall last five seconds.
- A middle-click success preview shall last two-and-a-half seconds.
- When a preview ends, OmaPets shall restore the current detected state.
- If automatic detection is disabled, OmaPets shall restore the state shown
  before the preview.
- Real agent events received during a preview shall be eligible for display
  when the preview ends.

### Resolve installed-pet identifier collisions

- Installation shall never overwrite an existing pet.
- When a normalized identifier is already used, the new installation shall
  receive the next available numeric suffix, such as `glitchcat-2` and
  `glitchcat-3`.
- The pet's declared display name shall remain unchanged.
- The picker shall show the resulting unique directory identifier.
- Installation shall report the final identifier and location to the user.
- This rule shall apply to every collision, including collision with the
  bundled Glitchcat identifier.

### Protect existing agent integrations during setup

- An existing integration recognized as OmaPets-managed may be updated after a
  backup is created.
- An unrecognized file at an OmaPets integration path shall not be replaced.
- Setup shall report the conflict and identify the affected path.
- Shared agent configuration shall preserve all unrelated entries.
- Removal shall retain the same ownership safeguards.

### Use recognizable agent names during hook setup

- The interactive selector shall show human-readable agent names.
- Short identifiers may also be shown where they help recognition, such as
  “Oh My Pi (omp).”
- The selected name shall unambiguously identify the integration that will be
  configured.

### Maintain the agent-hook tests

- The permissions test shall send a supported lifecycle event and verify both
  its normalized state and owner-only file permissions.
- The interactive hook-installer scenario shall be verified in the normal
  project test environment.
- A workspace-specific process restriction shall not be treated as a product
  defect without reproduction in a supported environment.

### Separate hook reporting from automatic inference

- Disabling automatic detection shall stop heuristic status guesses.
- Installed hook updates shall continue reaching the widget while automatic
  detection is disabled.
- The configurable recent-activity window shall apply only to heuristic
  inference.
- A recent explicit hook event shall take precedence over an inferred state.

### Restrict selectable pet locations

- User-selected pets shall be entries in the OmaPets pets directory.
- An entry in that directory may be a symbolic link to a pet managed elsewhere,
  provided the pet otherwise passes validation.
- Arbitrary folder paths outside the pets directory shall not be accepted as
  selections.
- Bundled Glitchcat shall remain the built-in exception.

### Retain independent agent status

- One agent's event shall not erase another agent's latest status.
- While the product displays one pet, it shall continue to show only the
  current/default agent's retained status.
- The retained statuses shall provide the behavioral foundation for later
  per-agent pet display.

### Preserve safe unknown-event behavior

- A supported lifecycle event shall be translated into its corresponding
  display state and saved with owner-only permissions.
- An unsupported hook event shall make no state change and return without
  disrupting the coding agent.

## Future state

### Next goal: per-agent pets

The next product goal, after the current repository and its documentation meet
the owner's standards, is to represent agents independently.

The intended outcomes are:

- The user can assign a different pet to each coding agent.
- An assigned pet appears only while its agent is running.
- Multiple pets can appear when multiple assigned agents are running.
- Each visible pet independently represents the state of its assigned agent.
- Codex, Claude Code, and Agy receive priority based on the owner's use.
- The model permits later inclusion of local-model agents and other coding
  agents without treating unspecified integrations as currently supported.

The future status model shall distinguish at least:

- An agent that is running but inactive.
- An agent that has completed its work.
- An agent that is blocked pending user interaction.
- An agent that has failed.

Only a state that genuinely requires user interaction shall trigger the
waiting-related magnified attention view. Error shall remain attention-worthy,
while successful completion shall remain non-magnified.

Detailed interaction design and acceptance criteria for this goal remain open
until the questions below are resolved.

### Later goal: attention reason

A later goal is to let the user inspect why an agent requires attention, such
as the relevant permission request. This information must be associated with
the correct agent and must not expose unsafe provider-controlled formatting.

## Success measures

For the current product:

- During ordinary use, the primary user can identify the current agent's state
  with a quick glance at the top bar.
- Waiting and error conditions attract attention after the user has been away
  without remaining needlessly magnified during active use.
- Pet selection, installation, and hook setup can be completed through the pet
  panel without requiring the user to discover undocumented commands.
- Existing user pets and unrelated agent configuration are not overwritten or
  removed without clear ownership and intent.
- Product documentation accurately distinguishes current functionality from
  known limitations and future goals.

Quantitative targets, such as maximum recognition time or acceptable missed
status events, have not yet been established.

## Assumptions

- Existing upstream behavior is documented when it remains in the current
  product, but it is not automatically considered permanent.
- The primary user's experience takes precedence if generalized behavior would
  add unwanted complexity.
- The current provider list and supported-agent list describe compatibility,
  not a commitment to optimize equally for every provider or agent.
- Future goals express product direction and shall not be presented as shipped
  functionality.

## Open questions

The following questions do not block documenting or maintaining the current
product. They must be answered before the related future behavior is considered
implementation-ready:

- What product or agent does “Agy” refer to, and what user-observable states
  can it report?
- What does it mean for each supported agent to be “running” or “on”?
- How does the user assign, review, change, or remove an agent's pet?
- In what order should multiple agent pets appear?
- What should happen when several agents require attention simultaneously?
- Should agents without an explicit pet assignment use a default pet, remain
  hidden, or prompt the user to choose?
- How long should completed, inactive, and failed agents remain visible?
- Which reason details are useful when an agent needs attention, and which
  information must be withheld for privacy?
- What non-animation and non-color cues are required for accessible status and
  attention reporting?
- Why is the interactive hook-installer test unable to spawn its test process
  in the reviewed workspace, and does the same restriction occur in the normal
  project test environment?
