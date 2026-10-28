# Bakes every animation in carles.js into desktop/carles-frames.json for the desktop player.
# Runs tools/bake.html in headless Edge and saves what it writes into <pre id="out">.
#   powershell -ExecutionPolicy Bypass -File tools\bake.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$page = 'file:///' + ((Join-Path $root 'tools\bake.html') -replace '\\', '/')
$out = Join-Path $root 'desktop\carles-frames.json'

$dom = & $edge --headless=new --disable-gpu --allow-file-access-from-files --dump-dom $page | Out-String
$m = [regex]::Match($dom, '<pre id="out">(\{.*?)</pre>', 'Singleline')
if (-not $m.Success) {
  throw "The bake page didn't produce JSON. Open tools\bake.html in a browser to see the error."
}
$json = [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value)

New-Item -ItemType Directory -Force (Split-Path $out) | Out-Null
[System.IO.File]::WriteAllText($out, $json, (New-Object System.Text.UTF8Encoding $false))
$data = $json | ConvertFrom-Json
$frames = ($data.anims | ForEach-Object { $_.frames.Count } | Measure-Object -Sum).Sum
'{0} animations, {1} frames, {2:N0} KB -> {3}' -f $data.anims.Count, $frames, ((Get-Item $out).Length / 1KB), $out
