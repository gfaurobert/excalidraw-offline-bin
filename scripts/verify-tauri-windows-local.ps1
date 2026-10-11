# Gregor local Windows VM validation: HTTP, desktop log, graceful quit (not Task Manager).
param(
    [string]$ExePath = "",
    [string]$ReportPath = "dist\windows-local-verify.log"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path (Split-Path $ReportPath -Parent) | Out-Null
$report = New-Object System.Collections.Generic.List[string]
function Log([string]$Line) {
    $ts = Get-Date -Format "o"
    $msg = "$ts $Line"
    Write-Host $msg
    $report.Add($msg)
}

if (-not $ExePath) {
    $candidates = @(
        "dist\tauri-windows-portable\Excalidraw-Offline.exe",
        "src-tauri\target\x86_64-pc-windows-msvc\release\excalidraw-offline.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $ExePath = $c; break }
    }
}
if (-not (Test-Path $ExePath)) {
    throw "Set -ExePath to excalidraw-offline.exe (not found automatically)"
}

Log "EXE=$ExePath"
$stdout = Join-Path $env:TEMP "excal-local-out.log"
$stderr = Join-Path $env:TEMP "excal-local-err.log"
Remove-Item $stdout, $stderr -ErrorAction SilentlyContinue

$proc = Start-Process -FilePath $ExePath -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
Log "PID=$($proc.Id)"

$port = $null
$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
    $text = @(
        (Get-Content -Raw $stdout -ErrorAction SilentlyContinue),
        (Get-Content -Raw $stderr -ErrorAction SilentlyContinue)
    ) -join "`n"
    if ($text -match '127\.0\.0\.1:(\d+)') {
        $port = [int]$Matches[1]
        break
    }
    Start-Sleep -Milliseconds 400
}
if (-not $port) { throw "Could not discover HTTP port from process output" }
Log "PORT=$port"

$root = Invoke-WebRequest -Uri "http://127.0.0.1:$port/" -UseBasicParsing -TimeoutSec 30
if ($root.StatusCode -ne 200) { throw "GET / returned $($root.StatusCode)" }
if ($root.Content -notmatch 'Excalidraw') { throw "GET / missing Excalidraw HTML" }
Log "GET / -> 200 (Excalidraw HTML)"

$ready = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/ready" -Method POST -UseBasicParsing -ContentType "application/json" -Body "{}" -TimeoutSec 15
Log "POST /api/ready -> $($ready.StatusCode)"

Start-Sleep -Seconds 2
$logDir = Join-Path $env:LOCALAPPDATA "ExcalidrawOffline\logs"
if (Test-Path $logDir) {
    $latest = Get-ChildItem $logDir -Filter "*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latest) {
        Log "DESKTOP_LOG=$($latest.FullName)"
        Get-Content $latest.FullName -Tail 40 | ForEach-Object { Log "  $_" }
    }
} else {
    Log "WARN: no log dir at $logDir yet"
}

Log "POST /api/quit (graceful shutdown)"
Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/quit" -Method POST -UseBasicParsing -ContentType "application/json" -Body "{}" -TimeoutSec 30 | Out-Null

$quitDeadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $quitDeadline) {
    if ($proc.HasExited) { break }
    Start-Sleep -Milliseconds 300
}
if (-not $proc.HasExited) {
    Log "WARN: process still running after /api/quit; sending CloseMainWindow"
    $proc.CloseMainWindow() | Out-Null
    Start-Sleep -Seconds 2
}
if (-not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
    throw "Process did not exit gracefully"
}
Log "PASS: graceful quit"
$report | Set-Content -Path $ReportPath -Encoding UTF8
Log "Report written to $ReportPath"
