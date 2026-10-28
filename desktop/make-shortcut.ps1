# Puts a "Carles" shortcut with his icon on your desktop. It starts him without a console window.
# Run it again after moving the carles-pet folder or reinstalling Python.
#   powershell -ExecutionPolicy Bypass -File desktop\make-shortcut.ps1
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$pyw = (Get-Command pythonw -ErrorAction SilentlyContinue).Source
if (-not $pyw) { throw 'pythonw.exe was not found. Install Python 3 from https://www.python.org/ (tick "Add python.exe to PATH").' }
$script = Join-Path $here 'carles_pet.py'
$icon = Join-Path $here 'carles.ico'

Start-Process -Wait -FilePath $pyw -ArgumentList '-I', "`"$script`"", '--save-icon', "`"$icon`""
if (-not (Test-Path $icon)) { throw "Couldn't write $icon." }

$lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Carles.lnk'
$s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
$s.TargetPath = $pyw
$s.Arguments = "-I `"$script`""
$s.WorkingDirectory = $here
$s.IconLocation = "$icon,0"
$s.Description = 'Carles, a pixel-art desktop pet'
$s.Save()
"Created $lnk"
