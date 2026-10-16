# Verify portable zip and NSIS-installed Tauri builds serve the Excalidraw frontend.
$ErrorActionPreference = "Stop"

function Wait-For-AppUrl {
    param(
        [string]$LogPath,
        [int]$TimeoutSec = 120
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $chunks = @()
        if (Test-Path $LogPath) {
            $chunks += Get-Content -Raw -Path $LogPath -ErrorAction SilentlyContinue
        }
        $errPath = "$LogPath.err"
        if (Test-Path $errPath) {
            $chunks += Get-Content -Raw -Path $errPath -ErrorAction SilentlyContinue
        }
        $text = $chunks -join "`n"
        if ($text -match '(?:\[desktop\] app url|app url) http://127\.0\.0\.1:(\d+)/') {
            return [int]$Matches[1]
        }
        Start-Sleep -Milliseconds 500
    }
    throw "Timed out waiting for app url in log: $LogPath"
}

function Assert-Frontend {
    param(
        [int]$Port,
        [string]$Label
    )
    $uri = "http://127.0.0.1:$Port/"
    $resp = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 30
    if ($resp.StatusCode -ne 200) {
        throw "$Label`: expected HTTP 200, got $($resp.StatusCode)"
    }
    $html = $resp.Content
    if ($html -notmatch 'Excalidraw') {
        throw "$Label`: response missing Excalidraw HTML marker"
    }
    Write-Host "$Label`: GET / -> 200 (Excalidraw HTML ok)"
}

function Capture-Screenshot {
    param([string]$OutPath)
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
    $bounds = $screen.Bounds
    $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bmp.Dispose()
    Write-Host "Screenshot saved: $OutPath"
}

function Test-ExeLaunch {
    param(
        [string]$ExePath,
        [string]$Label,
        [string]$ScreenshotPath
    )
    if (-not (Test-Path $ExePath)) {
        throw "Missing exe: $ExePath"
    }
    $log = Join-Path $env:TEMP "excalidraw-offline-$Label.log"
    $errLog = "$log.err"
    foreach ($p in @($log, $errLog)) {
        if (Test-Path $p) { Remove-Item $p -Force }
    }
    $proc = Start-Process -FilePath $ExePath -PassThru -RedirectStandardOutput $log -RedirectStandardError $errLog
    try {
        $port = Wait-For-AppUrl -LogPath $log
        Assert-Frontend -Port $port -Label $Label
        Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/ready" -Method POST -UseBasicParsing -ContentType "application/json" -Body "{}" | Out-Null
        $logDir = Join-Path $env:LOCALAPPDATA "ExcalidrawOffline\logs"
        if (Test-Path $logDir) {
            Write-Host "$Label`: desktop log dir $logDir"
        }
        Start-Sleep -Seconds 2
        Capture-Screenshot -OutPath $ScreenshotPath
        Write-Host "$Label`: POST /api/quit"
        Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/quit" -Method POST -UseBasicParsing -ContentType "application/json" -Body "{}" -TimeoutSec 30 | Out-Null
        $deadline = (Get-Date).AddSeconds(12)
        while ((Get-Date) -lt $deadline -and -not $proc.HasExited) {
            Start-Sleep -Milliseconds 250
        }
        if (-not $proc.HasExited) {
            throw "$Label`: process did not exit after /api/quit"
        }
        Write-Host "$Label`: graceful exit ok"
    }
    finally {
        if (-not $proc.HasExited) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

$artifactRoot = Join-Path $PWD "dist/windows-verify"
New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null

$release = "src-tauri/target/x86_64-pc-windows-msvc/release"
$portableZip = "dist/excalidraw-offline-windows-x64-portable.zip"
if (-not (Test-Path $portableZip)) {
    throw "Portable zip not found: $portableZip"
}
$portableDir = Join-Path $artifactRoot "portable"
if (Test-Path $portableDir) { Remove-Item -Recurse -Force $portableDir }
Expand-Archive -Path $portableZip -DestinationPath $portableDir -Force
$portableExe = Join-Path $portableDir "Excalidraw-Offline.exe"
Test-ExeLaunch -ExePath $portableExe -Label "portable" -ScreenshotPath (Join-Path $artifactRoot "portable-window.png")

$installers = Get-ChildItem -Path "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis" -Filter "*setup*.exe" -ErrorAction SilentlyContinue
if (-not $installers) {
    throw "NSIS setup exe not found under bundle/nsis"
}
$setupExe = $installers[0].FullName
$installDir = Join-Path $artifactRoot "installed"
if (Test-Path $installDir) { Remove-Item -Recurse -Force $installDir }
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
# NSIS /D= sets install directory for silent install.
$installArgs = @("/S", "/D=$installDir")
Start-Process -FilePath $setupExe -ArgumentList $installArgs -Wait -NoNewWindow
$installedExe = Get-ChildItem -Path $installDir -Recurse -Filter "excalidraw-offline.exe" | Select-Object -First 1
if (-not $installedExe) {
    throw "Installed excalidraw-offline.exe not found under $installDir"
}
Test-ExeLaunch -ExePath $installedExe.FullName -Label "nsis" -ScreenshotPath (Join-Path $artifactRoot "nsis-window.png")

Write-Host "Windows verification passed (portable + NSIS)."
