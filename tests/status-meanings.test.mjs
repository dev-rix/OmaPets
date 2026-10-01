import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const qml = readFileSync(new URL("../Main.qml", import.meta.url), "utf8")

test("the widget knows all six status meanings", () => {
  for (const state of ["inactive", "working", "blocked", "attention", "finished", "error"]) {
    assert.match(qml, new RegExp(`stateRows:[\\s\\S]*?"${state}":\\s*\\d`), state)
    assert.match(qml, new RegExp(`stateLabels:[\\s\\S]*?"${state}":\\s*"`), state)
  }
})

test("earlier state names from saved hook files still display", () => {
  assert.match(qml, /legacyStates:\s*\(\{\s*"idle":\s*"inactive",\s*"waiting":\s*"blocked",\s*"success":\s*"finished"\s*\}\)/)
  assert.match(qml, /function\s+normalizedState\(value\)\s*\{[\s\S]*?legacyStates\[state\][\s\S]*?: "inactive"/)
})

test("blocked, may need attention and error magnify; finished only while the user is away", () => {
  assert.match(
    qml,
    /attentionOpen:\s*\(activityState === "blocked" \|\| activityState === "attention"\s*\|\| activityState === "error" \|\| finishedNoticePending\)\s*&& !attentionDismissed/,
  )
  assert.match(
    qml,
    /function\s+updateFinishedNotice\(\)\s*\{\s*if\s*\(activityState === "finished" && userIdle && !attentionDismissed\)\s*finishedNoticePending = true/,
  )
  assert.match(qml, /onUserIdleChanged:\s*\{\s*updateFinishedNotice\(\)/)
  assert.match(
    qml,
    /function\s+setActivity\([^)]*\)\s*\{[\s\S]*?finishedNoticePending = false[\s\S]*?updateFinishedNotice\(\)\s*\}/,
    "a new state must clear an earlier finished notice",
  )
})
