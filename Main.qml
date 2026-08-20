import QtQuick
import QtQuick.Controls
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui

BarWidget {
  id: root
  moduleName: "wei.omarpets"

  // Codex atlas rows: idle, right, left, wave, jump, failed, waiting,
  // running/active, review. V2 adds two rows but keeps these first nine.
  readonly property var stateRows: ({
    "idle": 0,
    "working": 7,
    "waiting": 6,
    "success": 8,
    "error": 5
  })
  readonly property var stateLabels: ({
    "idle": "Agent idle",
    "working": "Agent working",
    "waiting": "Agent needs input",
    "success": "Agent finished",
    "error": "Agent failed"
  })
  // Codex pet packages do not declare per-row frame counts. Ponyta uses six
  // frames for its normal loops and all eight for failure.
  readonly property var stateFrames: ({
    "idle": 6,
    "working": 6,
    "waiting": 6,
    "success": 6,
    "error": 8
  })

  property string activityState: "idle"
  property string activityDetail: ""
  property string detectedState: "idle"
  property string detectedAgent: ""
  property double overrideUntil: 0
  property int currentFrame: 0
  property int imageRevision: 0
  property bool petPickerOpen: false
  property var availablePets: []

  readonly property real petScale: Number(setting("scale", 0.8))
  readonly property int frameInterval: Math.max(60, Number(setting("frameIntervalMs", 140)))
  readonly property bool autoDetect: setting("autoDetect", true) !== false
  readonly property int activeWindowSec: Math.max(2, Number(setting("activeWindowSec", 8)))
  readonly property string home: Quickshell.env("HOME") || ""
  readonly property string cacheHome: Quickshell.env("XDG_CACHE_HOME") || home + "/.cache"
  readonly property string convertedSheetPath: cacheHome + "/omarpets/spritesheet.png"
  readonly property string configuredPetPath: String(setting("petPath", ""))
  readonly property string petsHome: home + "/.config/omarpets/pets"
  readonly property string resolvedPetPath: resolvePetPath(configuredPetPath)
  readonly property url petManifestUrl: configuredPetPath === ""
    ? Qt.resolvedUrl("assets/ponyta/pet.json")
    : "file://" + resolvedPetPath.replace(/\/$/, "") + "/pet.json"
  property string petName: "Ponyta"
  property url spritesheetUrl: ""
  property string pendingSheetUrl: ""

  function setting(key, fallback) {
    return settings && settings[key] !== undefined ? settings[key] : fallback
  }

  function expandHome(path) {
    var value = String(path || "")
    if (value === "~") return home
    if (value.indexOf("~/") === 0) return home + value.slice(1)
    return value
  }

  function resolvePetPath(path) {
    var value = expandHome(path)
    if (value !== "" && value.indexOf("/") < 0)
      return petsHome + "/" + value
    return value
  }

  function refreshAvailablePets() {
    if (!petScanner.running) petScanner.running = true
  }

  function close() { petPickerOpen = false }

  function parseAvailablePets(output) {
    var pets = [{ id: "", name: "Ponyta (bundled)" }]
    var lines = String(output || "").trim().split("\n")
    for (var index = 0; index < lines.length; index++) {
      if (lines[index] === "") continue
      var fields = lines[index].split("\t")
      var id = String(fields.shift() || "").trim()
      if (id === "") continue
      pets.push({ id: id, name: String(fields.join(" ") || id).trim() })
    }
    availablePets = pets
  }

  function selectPet(id) {
    var selectedId = String(id || "")
    var entry = { id: root.moduleName }
    for (var key in root.settings)
      if (key !== "id") entry[key] = root.settings[key]
    entry.petPath = selectedId

    root.settings = entry
    if (root.bar && root.bar.shell
        && typeof root.bar.shell.updateEntryInline === "function")
      root.bar.shell.updateEntryInline(root.moduleName, entry)
    petPickerOpen = false
  }

  function filePath(url) {
    var value = String(url || "")
    return decodeURIComponent(value.replace(/^file:\/\//, ""))
  }

  function loadSpritesheet(url) {
    var value = String(url || "")
    if (/\.webp$/i.test(value)) {
      pendingSheetUrl = value
      if (!sheetConverter.running) {
        sheetConverter.command = ["sh", "-c",
          "mkdir -p \"$1\" && magick \"$2\" \"$3\"",
          "omarpets-convert", root.cacheHome + "/omarpets", filePath(value), root.convertedSheetPath]
        sheetConverter.running = true
      }
    } else {
      spritesheetUrl = value
    }
  }

  function normalizedState(value) {
    var state = String(value || "").toLowerCase()
    return stateRows[state] !== undefined ? state : "idle"
  }

  function setActivity(state, detail, holdMs) {
    activityState = normalizedState(state)
    activityDetail = String(detail || "")
    overrideUntil = holdMs > 0 ? Date.now() + holdMs : 0
    currentFrame = 0
  }

  function applyDetectedState(state) {
    detectedState = normalizedState(state)
    if (overrideUntil > Date.now()) return
    if (overrideUntil !== 0) overrideUntil = 0
    if (activityState !== detectedState) setActivity(detectedState, "", 0)
  }

  function applyDetectorOutput(output) {
    var parts = String(output || "").trim().split(":")
    detectedAgent = parts.length > 1 ? parts[0] : ""
    applyDetectedState(parts.length > 1 ? parts[1] : parts[0])
  }

  function agentLabel(agent) {
    var labels = {
      "codex": "Codex",
      "claude": "Claude Code",
      "opencode": "OpenCode",
      "gemini": "Gemini",
      "copilot": "GitHub Copilot",
      "crush": "Crush",
      "grok": "Grok",
      "omp": "Oh My Pi",
      "pi": "Pi"
    }
    return labels[agent] || agent
  }

  function reloadPet() { petManifest.reload() }
  onPetManifestUrlChanged: reloadPet()

  FileView {
    id: petManifest
    path: root.petManifestUrl
    watchChanges: true
    printErrors: true
    onFileChanged: reload()
    onLoaded: {
      try {
        var pet = JSON.parse(String(text() || "{}"))
        var sheet = String(pet.spritesheetPath || "spritesheet.webp")
        if (sheet.indexOf("..") >= 0 || sheet.indexOf("/") === 0)
          throw new Error("spritesheetPath must stay inside the pet folder")
        root.petName = String(pet.displayName || pet.id || "Pet")
        var manifestUrl = String(root.petManifestUrl)
        var slash = manifestUrl.lastIndexOf("/")
        root.loadSpritesheet(manifestUrl.slice(0, slash + 1) + sheet)
        root.imageRevision++
      } catch (error) {
        console.warn("omarpets: invalid pet manifest", error)
      }
    }
  }


  Process {
    id: sheetConverter
    running: false
    onExited: function(exitCode) {
      if (exitCode === 0) {
        root.spritesheetUrl = ""
        Qt.callLater(function() {
          root.spritesheetUrl = "file://" + root.convertedSheetPath
          root.imageRevision++
        })
      } else {
        console.warn("omarpets: could not convert WebP spritesheet", root.pendingSheetUrl)
      }
    }
  }

  Process {
    id: petScanner
    running: false
    command: ["sh", "-c",
      "pets=$1; [ -d \"$pets\" ] || exit 0; "
      + "find \"$pets\" -mindepth 2 -maxdepth 2 -type f -name pet.json -printf '%h\\n' 2>/dev/null "
      + "| sort | while IFS= read -r dir; do "
      + "id=${dir##*/}; sheet=$(jq -r '.spritesheetPath // empty' \"$dir/pet.json\" 2>/dev/null); "
      + "[ -n \"$sheet\" ] && [ -f \"$dir/$sheet\" ] || continue; "
      + "name=$(jq -r '.displayName // .id // empty' \"$dir/pet.json\" 2>/dev/null | tr '\\t\\r\\n' '   '); "
      + "[ -n \"$name\" ] || name=$id; printf '%s\\t%s\\n' \"$id\" \"$name\"; done",
      "omarpets-scan", root.petsHome]

    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.parseAvailablePets(text)
    }
  }

  IpcHandler {
    target: "wei.omarpets"

    function idle(detail: string): void { root.setActivity("idle", detail, 0) }
    function working(detail: string): void { root.setActivity("working", detail, 0) }
    function waiting(detail: string): void { root.setActivity("waiting", detail, 0) }
    function success(detail: string): void { root.setActivity("success", detail, 5000) }
    function error(detail: string): void { root.setActivity("error", detail, 8000) }
    function refresh(): void { root.reloadPet() }
  }

  Process {
    id: detector
    running: false
    command: ["sh", "-c",
      "window=$1; home=$2; "
      + "agent=$(omarchy-default-agent 2>/dev/null); "
      + "[ -n \"$agent\" ] || { printf ':idle'; exit; }; "
      + "state_home=${XDG_STATE_HOME:-$home/.local/state}; "
      + "status_file=\"$state_home/omarchy/omarpets/status.json\"; "
      + "if [ -f \"$status_file\" ]; then "
      + "hook_agent=$(jq -r '.agent // empty' \"$status_file\" 2>/dev/null); "
      + "hook_state=$(jq -r '.state // empty' \"$status_file\" 2>/dev/null); "
      + "hook_time=$(jq -r '(.updatedAtEpoch | tonumber?) // 0' \"$status_file\" 2>/dev/null); "
      + "age=$(($(date +%s) - hook_time)); "
      + "max_age=14400; [ \"$hook_state\" = success ] && max_age=8; "
      + "if [ \"$hook_agent\" = \"$agent\" ] && [ $age -ge 0 ] && [ $age -le $max_age ]; then "
      + "printf '%s:%s' \"$agent\" \"$hook_state\"; exit; fi; fi; "
      + "recent=0; "
      + "case \"$agent\" in "
      + "codex) activity_dir=\"${CODEX_HOME:-$home/.codex}/sessions\" ;; "
      + "claude) activity_dir=\"${CLAUDE_CONFIG_DIR:-$home/.claude}/projects\" ;; "
      + "*) activity_dir= ;; esac; "
      + "[ -n \"$activity_dir\" ] && [ -d \"$activity_dir\" ] "
      + "&& find \"$activity_dir\" -type f -newermt \"$window seconds ago\" -print -quit 2>/dev/null | grep -q . && recent=1; "
      + "printf '%s:' \"$agent\"; "
      + "if [ $recent -eq 1 ]; then printf working; "
      + "elif pgrep -f \"(^|/)$agent( |$)\" >/dev/null 2>&1; then printf waiting; "
      + "else printf idle; fi",
      "omarpets-detect", String(root.activeWindowSec), root.home]

    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applyDetectorOutput(text)
    }
  }

  Timer {
    interval: 2000
    running: root.autoDetect
    repeat: true
    triggeredOnStart: true
    onTriggered: if (!detector.running) detector.running = true
  }

  Timer {
    interval: root.frameInterval
    running: true
    repeat: true
    onTriggered: root.currentFrame = (root.currentFrame + 1) % root.stateFrames[root.activityState]
  }

  implicitWidth: Math.round(38 * petScale)
  implicitHeight: barSize

  Item {
    id: frameViewport
    readonly property real frameHeight: root.height * root.petScale
    readonly property real frameWidth: frameHeight * 192 / 208
    width: frameWidth
    height: frameHeight
    anchors.centerIn: parent
    clip: true

    Image {
      id: atlas
      width: frameViewport.frameWidth * 8
      height: frameViewport.frameHeight * 9
      x: -root.currentFrame * frameViewport.frameWidth
      y: -root.stateRows[root.activityState] * frameViewport.frameHeight
      source: root.spritesheetUrl
      cache: false
      smooth: false
      mipmap: false
      asynchronous: true
    }

    MouseArea {
      anchors.fill: parent
      acceptedButtons: Qt.LeftButton | Qt.MiddleButton | Qt.RightButton
      hoverEnabled: true
      onClicked: function(mouse) {
        if (mouse.button === Qt.RightButton) {
          root.refreshAvailablePets()
          root.petPickerOpen = !root.petPickerOpen
        }
        else if (mouse.button === Qt.MiddleButton) root.setActivity("success", "Test success animation", 2500)
        else root.setActivity("working", "Test working animation", 1800)
      }
    }
  }

  PopupCard {
    id: petPicker
    anchorItem: root
    owner: root
    bar: root.bar
    open: root.petPickerOpen
    contentWidth: petPicker.fittedContentWidth(Style.space(240))
    contentHeight: petPicker.fittedContentHeight(petList.implicitHeight)

    Column {
      id: petList
      anchors.fill: parent
      spacing: Style.space(4)

      Text {
        text: "Choose pet"
        color: root.bar.foreground
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.body
        font.bold: true
        bottomPadding: Style.space(4)
      }

      Text {
        visible: petScanner.running
        text: "Looking for pets…"
        color: Qt.darker(root.bar.foreground, 1.4)
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.bodySmall
      }

      Repeater {
        model: root.availablePets

        delegate: Rectangle {
          id: petRow
          required property var modelData
          width: petList.width
          height: Style.space(32)
          radius: Style.spacing.labelGap
          color: petMouse.containsMouse
            ? Style.normalFillFor(root.bar.foreground, Color.accent)
            : "transparent"

          readonly property bool selected: String(root.configuredPetPath) === String(modelData.id)

          Text {
            anchors.left: parent.left
            anchors.right: checkmark.left
            anchors.leftMargin: Style.space(8)
            anchors.verticalCenter: parent.verticalCenter
            text: petRow.modelData.name
            color: root.bar.foreground
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body
            elide: Text.ElideRight
          }

          Text {
            id: checkmark
            anchors.right: parent.right
            anchors.rightMargin: Style.space(8)
            anchors.verticalCenter: parent.verticalCenter
            text: petRow.selected ? "✓" : ""
            color: root.bar.foreground
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body
          }

          MouseArea {
            id: petMouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.selectPet(petRow.modelData.id)
          }
        }
      }
    }
  }

  ToolTip.visible: hover.hovered
  ToolTip.text: petName
    + (detectedAgent === "" ? "" : " · " + agentLabel(detectedAgent))
    + " · " + (stateLabels[activityState] || activityState)
    + (activityDetail === "" ? "" : "\n" + activityDetail)

  HoverHandler { id: hover }
}
