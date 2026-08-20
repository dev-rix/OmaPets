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
  property double overrideUntil: 0
  property int currentFrame: 0
  property int imageRevision: 0

  readonly property real petScale: Number(setting("scale", 0.9))
  readonly property int frameInterval: Math.max(60, Number(setting("frameIntervalMs", 140)))
  readonly property bool autoDetect: setting("autoDetect", true) !== false
  readonly property int activeWindowSec: Math.max(2, Number(setting("activeWindowSec", 8)))
  readonly property string home: Quickshell.env("HOME") || ""
  readonly property string cacheHome: Quickshell.env("XDG_CACHE_HOME") || home + "/.cache"
  readonly property string convertedSheetPath: cacheHome + "/omarpets/spritesheet.png"
  readonly property string configuredPetPath: String(setting("petPath", ""))
  readonly property url petManifestUrl: configuredPetPath === ""
    ? Qt.resolvedUrl("assets/ponyta/pet.json")
    : "file://" + expandHome(configuredPetPath).replace(/\/$/, "") + "/pet.json"
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
      + "recent=0; "
      + "for dir in \"${CODEX_HOME:-$home/.codex}/sessions\" \"${CLAUDE_CONFIG_DIR:-$home/.claude}/projects\"; do "
      + "[ -d \"$dir\" ] && find \"$dir\" -type f -newermt \"$window seconds ago\" -print -quit 2>/dev/null | grep -q . && recent=1; "
      + "done; "
      + "if [ $recent -eq 1 ]; then printf working; "
      + "elif pgrep -f '(^|/)(codex|claude)( |$)' >/dev/null 2>&1; then printf waiting; "
      + "else printf idle; fi",
      "omarpets-detect", String(root.activeWindowSec), root.home]

    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applyDetectedState(text.trim())
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
    anchors.fill: parent
    clip: true

    Image {
      id: atlas
      readonly property real frameHeight: parent.height * root.petScale
      readonly property real frameWidth: frameHeight * 192 / 208
      width: frameWidth * 8
      height: frameHeight * 9
      x: (parent.width - frameWidth) / 2 - root.currentFrame * frameWidth
      y: (parent.height - frameHeight) / 2 - root.stateRows[root.activityState] * frameHeight
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
        if (mouse.button === Qt.RightButton) root.setActivity("error", "Test error animation", 2500)
        else if (mouse.button === Qt.MiddleButton) root.setActivity("success", "Test success animation", 2500)
        else root.setActivity("working", "Test working animation", 1800)
      }
    }
  }

  ToolTip.visible: hover.hovered
  ToolTip.text: petName + " · " + (stateLabels[activityState] || activityState)
    + (activityDetail === "" ? "" : "\n" + activityDetail)

  HoverHandler { id: hover }
}
