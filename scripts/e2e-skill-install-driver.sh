#!/usr/bin/env bash
# Skill install E2E — packaged app + zenity checklist (EXCALIDRAW_E2E=1).
set -euo pipefail

ROOT="${ROOT:?}"
LAUNCHER="${LAUNCHER:?}"
ARTIFACTS="${ARTIFACTS:?}"
E2E_HOME="${E2E_HOME:?}"
PROJECT_ROOT="${PROJECT_ROOT:?}"

mkdir -p "$ARTIFACTS/screenshots" "$ARTIFACTS/logs" "$ARTIFACTS/trees"
LOG="$ARTIFACTS/run.log"
exec > >(tee -a "$LOG") 2>&1

echo "=== skill install E2E $(date -Iseconds) ==="
echo "HOME=$E2E_HOME PROJECT=$PROJECT_ROOT"

if command -v openbox >/dev/null 2>&1; then
  openbox >/dev/null 2>&1 &
  sleep 0.4
fi

export EXCALIDRAW_E2E=1
export HOME="$E2E_HOME"
export LIBGL_ALWAYS_SOFTWARE=1
export MESA_GL_VERSION_OVERRIDE=3.3

APP_LOG="$ARTIFACTS/logs/app.stdout"
GLOBAL_BEFORE="$ARTIFACTS/trees/global-before.txt"
GLOBAL_AFTER="$ARTIFACTS/trees/global-after.txt"
PROJECT_TREE="$ARTIFACTS/trees/project-agents-claude.txt"

wait_zenity() {
  local tries="${1:-60}"
  for _ in $(seq 1 "$tries"); do
    local z
    z=$(xdotool search --class "Zenity" 2>/dev/null | head -1 || true)
    if [[ -n "$z" ]]; then
      echo "$z"
      return 0
    fi
    sleep 0.15
  done
  return 1
}

wait_zenity_title() {
  local title_sub="$1"
  local tries="${2:-80}"
  for _ in $(seq 1 "$tries"); do
    local z
    z=$(xdotool search --name "$title_sub" 2>/dev/null | head -1 || true)
    if [[ -n "$z" ]]; then
      echo "$z"
      return 0
    fi
    sleep 0.15
  done
  return 1
}

shot_zenity_window() {
  local name="$1"
  local title_sub="${2:-}"
  local out="$ARTIFACTS/screenshots/${name}.png"
  local z=""
  if [[ -n "$title_sub" ]]; then
    z=$(wait_zenity_title "$title_sub" 80 || true)
  fi
  if [[ -z "$z" ]]; then
    z=$(wait_zenity 10 || true)
  fi
  sleep 0.5
  if [[ -n "$z" ]]; then
    import -window "$z" "$out" 2>/dev/null || scrot "$out"
    echo "screenshot: $out (zenity wid=$z title=${title_sub:-any})"
  else
    echo "FATAL: no zenity window for $name (title=${title_sub:-any})" >&2
    exit 1
  fi
}

start_app() {
  rm -f "$APP_LOG"
  bash "$LAUNCHER" >"$APP_LOG" 2>&1 &
  APP_PID=$!
  PORT=""
  for _ in $(seq 1 120); do
    PORT=$(grep -oE 'Listening on http://127.0.0.1:[0-9]+' "$APP_LOG" 2>/dev/null | head -1 | grep -oE '[0-9]+$' || true)
    [[ -n "$PORT" ]] && break
    sleep 0.25
  done
  [[ -n "$PORT" ]] || { echo "FATAL: no listen port"; exit 1; }
  BASE="http://127.0.0.1:$PORT"
  echo "app listening $BASE pid=$APP_PID"
}

stop_app() {
  curl -sf -X POST "$BASE/api/quit" >/dev/null 2>&1 || true
  sleep 0.8
  kill "$APP_PID" 2>/dev/null || true
  wait "$APP_PID" 2>/dev/null || true
  pkill -f 'zenity --' 2>/dev/null || true
  sleep 0.3
}

api_post() {
  curl -sf -X POST "$BASE$1" -H 'content-type: application/json' -d "$2"
}

complete_pick() {
  local path="$1"
  local body
  body=$(deno eval 'console.log(JSON.stringify({ path: Deno.args[0] }))' "$path")
  api_post "/api/e2e/complete-pick" "$body" >/dev/null
}

complete_pick_cancelled() {
  api_post "/api/e2e/complete-pick" '{"cancelled":true}' >/dev/null
}

write_global_before() {
  {
    echo "=== before install ($(date -Iseconds)) ==="
    for d in .agents .claude .kiro .cline; do
      if [[ -e "$E2E_HOME/$d" ]]; then
        echo "EXISTS: $E2E_HOME/$d"
        find "$E2E_HOME/$d" 2>/dev/null | sort
      else
        echo "MISSING: $E2E_HOME/$d"
      fi
    done
  } >"$GLOBAL_BEFORE"
}

write_global_after() {
  {
    echo "=== after install (skill folders only) ==="
    for d in .agents .claude .kiro .cline; do
      echo "$E2E_HOME/$d/skills/excalidraw-sketching"
    done
  } >"$GLOBAL_AFTER"
}

run_global_all() {
  echo "--- Global + All targets ---"
  rm -rf "$E2E_HOME/.agents" "$E2E_HOME/.claude" "$E2E_HOME/.kiro" "$E2E_HOME/.cline"
  write_global_before

  export EXCALIDRAW_E2E_CHECKLIST_PRESET=all
  export EXCALIDRAW_E2E_CAPTURE_INFO=1

  start_app

  api_post "/api/e2e/skill-install" "{}" &
  sleep 0.6
  wait_zenity_title "Install skill" 80 >/dev/null
  complete_pick "global"
  sleep 0.5
  wait_zenity_title "targets" 80 >/dev/null
  shot_zenity_window "01-checklist-global-all" "targets"
  complete_pick "all"
  sleep 0.8
  wait_zenity_title "Install skill" 80 >/dev/null
  shot_zenity_window "03-install-success" "Install skill"
  xdotool key Return 2>/dev/null || true
  sleep 0.5
  stop_app

  unset EXCALIDRAW_E2E_CHECKLIST_PRESET
  unset EXCALIDRAW_E2E_CAPTURE_INFO

  write_global_after
  while read -r line; do
    [[ "$line" == ===* ]] && continue
    [[ -z "$line" ]] && continue
    test -d "$line"
    test -f "$line/SKILL.md"
    ! test -d "$line/evals"
  done <"$GLOBAL_AFTER"
  grep -q "MISSING: $E2E_HOME/.claude" "$GLOBAL_BEFORE"
  echo "Global before: $GLOBAL_BEFORE"
  echo "Global after: $GLOBAL_AFTER"
}

run_project_agents_claude() {
  echo "--- Project + .agents + Claude Code ---"
  rm -rf "$PROJECT_ROOT/.agents" "$PROJECT_ROOT/.claude"
  unset EXCALIDRAW_E2E_CHECKLIST_PRESET
  unset EXCALIDRAW_E2E_CAPTURE_INFO

  start_app

  api_post "/api/e2e/skill-install" "{}" &
  sleep 0.6
  wait_zenity_title "Install skill" 80 >/dev/null
  complete_pick "project"
  sleep 0.4
  wait_zenity_title "Select project" 80 >/dev/null
  complete_pick "$PROJECT_ROOT"
  sleep 0.5
  wait_zenity_title "targets" 80 >/dev/null
  shot_zenity_window "02-checklist-project" "targets"
  complete_pick $'agents\nclaude'
  sleep 1.2
  stop_app

  {
    echo "=== project install (skill folders only) ==="
    echo "$PROJECT_ROOT/.agents/skills/excalidraw-sketching"
    echo "$PROJECT_ROOT/.claude/skills/excalidraw-sketching"
  } >"$PROJECT_TREE"
  test -f "$PROJECT_ROOT/.agents/skills/excalidraw-sketching/SKILL.md"
  test -f "$PROJECT_ROOT/.claude/skills/excalidraw-sketching/SKILL.md"
  echo "Project tree: $PROJECT_TREE"
}

run_global_checklist_cancel() {
  echo "--- Global checklist cancel (no install) ---"
  rm -rf "$E2E_HOME/.agents" "$E2E_HOME/.claude" "$E2E_HOME/.kiro" "$E2E_HOME/.cline"
  unset EXCALIDRAW_E2E_CHECKLIST_PRESET
  unset EXCALIDRAW_E2E_CAPTURE_INFO

  start_app
  api_post "/api/e2e/skill-install" "{}" &
  sleep 0.6
  wait_zenity_title "Install skill" 80 >/dev/null
  complete_pick "global"
  sleep 0.5
  wait_zenity_title "targets" 80 >/dev/null
  complete_pick_cancelled
  sleep 1
  stop_app

  test ! -e "$E2E_HOME/.agents/skills/excalidraw-sketching"
  test ! -e "$E2E_HOME/.claude/skills/excalidraw-sketching"
  echo "Cancel left home without skill installs"
}

run_global_checklist_cancel
run_global_all
run_project_agents_claude

echo "E2E skill install complete"
