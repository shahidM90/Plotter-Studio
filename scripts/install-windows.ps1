$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ShortcutPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "Plotter Studio.lnk"
$StartScript = Join-Path $ProjectRoot "scripts\start-plotter-studio.cmd"

Write-Host "Installing Plotter Studio dependencies..."
Push-Location $ProjectRoot
npm.cmd install
npm.cmd run build
Pop-Location

Write-Host "Creating desktop shortcut..."
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $StartScript
$Shortcut.WorkingDirectory = $ProjectRoot
$Shortcut.WindowStyle = 1
$Shortcut.Description = "Start Plotter Studio"
$Shortcut.Save()

Write-Host ""
Write-Host "Plotter Studio is installed."
Write-Host "Use the desktop shortcut, or run:"
Write-Host "  npm.cmd start"
