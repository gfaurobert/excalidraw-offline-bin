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
GLOBAL_TREE="$ARTIFACTS/trees/global-all.txt"
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

shot_zenity() {
  local name="$1"
  local out="$ARTIFACTS/screenshots/${name}.png"
  local z
  z=$(wait_zenity 5 || true)
  sleep 0.35
  if [[ -n "$z" ]]; then
    import -window "$z" "$out" 2>/dev/null || scrot "$out"
    echo "screenshot: $out"
  else
    scrot "$out" || true
    echo "screenshot (fallback): $out"
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

complete_confirm() {
  api_post "/api/e2e/complete-confirm" "{\"confirmed\":$1}" >/dev/null
}

run_global_all() {
  echo "--- Global + All targets ---"
  rm -rf "$E2E_HOME/.agents" "$E2E_HOME/.claude" "$E2E_HOME/.kiro" "$E2E_HOME/.cline"
  start_app

  api_post "/api/e2e/skill-install" "{}" &
  sleep 0.5
  wait_zenity 40 >/dev/null
  complete_pick "global"
  sleep 0.4
  wait_zenity 40 >/dev/null
  shot_zenity "01-checklist-global-all"
  complete_pick $'all'
  sleep 1.5
  stop_app

  find "$E2E_HOME" -path '*/excalidraw-sketching/*' -o -path '*/excalidraw-sketching' 2>/dev/null | sort >"$GLOBAL_TREE" || true
  find "$E2E_HOME/.agents" "$E2E_HOME/.claude" "$E2E_HOME/.kiro" "$E2E_HOME/.cline" 2>/dev/null | sort >>"$GLOBAL_TREE" || true
  echo "Global tree written to $GLOBAL_TREE"
  test -d "$E2E_HOME/.claude/skills/excalidraw-sketching"
  test -f "$E2E_HOME/.claude/skills/excalidraw-sketching/SKILL.md"
  ! test -d "$E2E_HOME/.claude/skills/excalidraw-sketching/evals"
}

run_project_agents_claude() {
  echo "--- Project + .agents + Claude Code ---"
  rm -rf "$PROJECT_ROOT/.agents" "$PROJECT_ROOT/.claude"
  start_app

  api_post "/api/e2e/skill-install" "{}" &
  sleep 0.5
  wait_zenity 40 >/dev/null
  complete_pick "project"
  sleep 0.4
  wait_zenity 40 >/dev/null
  complete_pick "$PROJECT_ROOT"
  sleep 0.4
  wait_zenity 40 >/dev/null
  shot_zenity "02-checklist-project"
  complete_pick $'agents\nclaude'
  sleep 1.5
  stop_app

  find "$PROJECT_ROOT" \( -path '*/.agents/skills/*' -o -path '*/.claude/skills/*' \) 2>/dev/null | sort >"$PROJECT_TREE"
  echo "Project tree written to $PROJECT_TREE"
  test -f "$PROJECT_ROOT/.agents/skills/excalidraw-sketching/SKILL.md"
  test -f "$PROJECT_ROOT/.claude/skills/excalidraw-sketching/SKILL.md"
}

show_success_dialog() {
  local listing="$1"
  local out="$ARTIFACTS/screenshots/03-install-success.png"
  zenity --info --title="Install skill" --text="Installed excalidraw-sketching to:\n${listing}" &
  local zp=$!
  sleep 0.6
  shot_zenity "03-install-success"
  kill "$zp" 2>/dev/null || true
  wait "$zp" 2>/dev/null || true
}

run_global_all
run_project_agents_claude

SUCCESS_PATHS=$(head -5 "$GLOBAL_TREE" | paste -sd '\n' -)
show_success_dialog "$SUCCESS_PATHS"

echo "E2E skill install complete"
