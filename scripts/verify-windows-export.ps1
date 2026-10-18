# Exercise the export CLI of the portable Windows build; outputs land in dist/windows-export.
param([string]$Exe = "dist/tauri-windows-portable/Excalidraw-Offline.exe")
$ErrorActionPreference = "Stop"
$Exe = (Resolve-Path $Exe).Path
$out = New-Item -ItemType Directory -Force -Path "dist/windows-export"
$work = Join-Path $env:RUNNER_TEMP "exoff-export"
Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "$work/with-assets", "$work/no-assets" | Out-Null
Copy-Item test-fixtures/e2e-export/matrix-demo.excalidraw "$work/with-assets/demo.excalidraw"
Copy-Item -Recurse test-fixtures/e2e-export/assets "$work/with-assets/assets"
Copy-Item test-fixtures/e2e-export/matrix-demo.excalidraw "$work/no-assets/demo.excalidraw"
$results = @()
$failed = $false

function Run-Export([string]$Name, [string[]]$ExportArgs, [int]$Expect) {
    $so = Join-Path $work "$Name.out"; $se = Join-Path $work "$Name.err"
    $p = Start-Process -FilePath $Exe -ArgumentList $ExportArgs -Wait -PassThru -NoNewWindow `
        -RedirectStandardOutput $so -RedirectStandardError $se
    $stdout = (Get-Content -Raw $so -ErrorAction SilentlyContinue) + ""
    $stderr = (Get-Content -Raw $se -ErrorAction SilentlyContinue) + ""
    $ok = ($p.ExitCode -eq $Expect)
    Write-Host "[$Name] exit=$($p.ExitCode) expect=$Expect"
    Write-Host "  stdout: $($stdout.Trim())"
    Write-Host "  stderr: $(($stderr.Trim() -split "`n" | Select-Object -Last 2) -join ' | ')"
    return [pscustomobject]@{ name = $Name; exit = $p.ExitCode; expect = $Expect; ok = $ok; stdout = $stdout.Trim(); stderr = $stderr.Trim() }
}

function Assert-Png([string]$Path) {
    if (-not (Test-Path $Path)) { throw "missing output $Path" }
    $b = [System.IO.File]::ReadAllBytes($Path)
    if ($b.Length -lt 100 -or $b[0] -ne 0x89 -or $b[1] -ne 0x50) { throw "not a PNG: $Path" }
    Add-Type -AssemblyName System.Drawing
    $img = [System.Drawing.Image]::FromFile($Path); $dim = "$($img.Width)x$($img.Height)"; $img.Dispose()
    Write-Host "  png ok: $Path ($($b.Length) bytes, $dim)"
    return $dim
}

$wa = "$work/with-assets/demo.excalidraw"
$r = Run-Export "whole-assets" @("export", "`"$wa`"", "--out", "`"$work/whole.png`"") 0
if ($r.ok) { $r | Add-Member dim (Assert-Png "$work/whole.png") }; $results += $r

$r = Run-Export "all-frames-json" @("export", "`"$wa`"", "--all-frames", "--json", "-d", "`"$work/frames`"") 0
if ($r.ok) {
    $paths = ($r.stdout | ConvertFrom-Json).paths
    if ($paths.Count -ne 2) { throw "expected 2 frame paths, got $($paths.Count)" }
    $r | Add-Member dim (($paths | ForEach-Object { Assert-Png $_ }) -join ",")
}
$results += $r

$r = Run-Export "bbox-scale1" @("export", "`"$wa`"", "--bbox", "0,0,400,300", "--scale", "1", "--out", "`"$work/bbox.png`"") 0
if ($r.ok) { $r | Add-Member dim (Assert-Png "$work/bbox.png") }; $results += $r

$r = Run-Export "default-location" @("export", "`"$wa`"") 0
if ($r.ok) { $r | Add-Member dim (Assert-Png $r.stdout) }; $results += $r

$r = Run-Export "missing-asset" @("export", "`"$work/no-assets/demo.excalidraw`"", "--out", "`"$work/no-assets.png`"") 0
if ($r.ok) { $r | Add-Member dim (Assert-Png "$work/no-assets.png") }; $results += $r

$results += Run-Export "unknown-frame" @("export", "`"$wa`"", "--frame", "nope", "-d", "`"$work`"") 1
$results += Run-Export "missing-file" @("export", "`"$work/nope.excalidraw`"") 1

# Interactive-style invocation (no redirection): output must reach the console.
$help = & cmd /c "`"$Exe`" export --help" | Out-String
$helpOk = $help -match "excalidraw-offline export"
Write-Host "[help-console] captured=$helpOk"
$results += [pscustomobject]@{ name = "help-console"; exit = 0; expect = 0; ok = $helpOk; stdout = ($help.Trim() -split "`n")[0] }

Get-ChildItem $work -Recurse -Include *.png | ForEach-Object { Copy-Item $_.FullName (Join-Path $out ("exp-" + ($_.Name -replace '[^A-Za-z0-9._-]', '_'))) }
$results | ConvertTo-Json -Depth 3 | Set-Content (Join-Path $out "results.json")
$results | Format-Table name, exit, expect, ok, dim -AutoSize | Out-String | Write-Host
if ($results | Where-Object { -not $_.ok }) { throw "export verification failed" }
Write-Host "Windows export verification passed."
