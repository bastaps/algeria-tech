# Podcast : genere le flash audio (matin|midi|soir) puis le publie. ASCII only.
param([string]$Creneau = '')
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
$py = 'C:\Users\Aps\AppData\Local\Python\bin\python.exe'
if ($Creneau -eq '') { $h = (Get-Date).Hour; $Creneau = if ($h -lt 11) { 'matin' } elseif ($h -lt 15) { 'midi' } else { 'soir' } }
$log = Join-Path $root 'scripts\podcast\podcast.log'
"$(Get-Date -Format s) debut $Creneau" | Add-Content $log
$env:PYTHONIOENCODING = 'utf-8'
& $py -u (Join-Path $root 'scripts\podcast\make_podcast.py') $Creneau 2>&1 | Add-Content $log
if ($LASTEXITCODE -eq 0) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'publier_dossier.ps1') -Message "Podcast $Creneau (auto)" -Chemins 'podcast/latest.json','podcast/fr','podcast/ar','podcast/en' 2>&1 | Add-Content $log
} else { "$(Get-Date -Format s) echec generation" | Add-Content $log }
