# Pages Facebook (Apify) : collecte + publication via le Hub local, puis deploiement. ASCII only.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
$py = 'C:\Users\Aps\AppData\Local\Python\bin\python.exe'
$log = Join-Path $root 'scripts\apify\apify.log'
$hubOk = $false
try { $hubOk = (Invoke-WebRequest -Uri 'http://localhost:3000/entreprises' -UseBasicParsing -TimeoutSec 8).StatusCode -eq 200 } catch {}
if (-not $hubOk) { "$(Get-Date -Format s) Hub :3000 arrete - collecte annulee" | Add-Content $log; exit 0 }
$env:PYTHONIOENCODING = 'utf-8'
$out = & $py -u (Join-Path $root 'scripts\apify\fb_pages.py') --publier 2>&1
$out | Add-Content $log
if (($out | Select-String 'publi.* \(').Count -gt 0) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'mail-watcher\auto-deploy.ps1') -CommitMessage 'Articles Facebook officiels (auto)' 2>&1 | Add-Content $log
}
