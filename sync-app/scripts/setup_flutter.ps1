param(
  [string]$FlutterVersion = "3.24.0"
)

Write-Host "Setting up Flutter SDK v$FlutterVersion..."

$ErrorActionPreference = "Stop"

$zipUrl = "https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_$FlutterVersion-stable.zip"
$destDir = "$env:USERPROFILE\flutter"
$zipPath = "$env:TEMP\flutter_sdk.zip"

if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir | Out-Null }

Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath

Expand-Archive -Path $zipPath -DestinationPath $destDir -Force
Remove-Item $zipPath -Force

$flutterBin = Join-Path $destDir "flutter\bin"

# Add to PATH for current session
$env:Path = "$flutterBin;" + $env:Path

# Optionally persist PATH for user
$persist = Read-Host "Persist Flutter bin to PATH? (y/N)"
if ($persist -match '^[yY]') {
  $current = [Environment]::GetEnvironmentVariable("Path", "User")
  if ($current -notlike "*$flutterBin*") {
    [Environment]::SetEnvironmentVariable("Path", "$flutterBin;$current", "User")
    Write-Host "Added $flutterBin to User PATH. Restart terminals to take effect."
  }
}

flutter --version
flutter doctor
