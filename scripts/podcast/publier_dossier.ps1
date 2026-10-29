# Publie des fichiers precis vers GitHub (donc Cloudflare Pages) sans toucher au reste du depot local :
# worktree temporaire depuis origin/main -> copie -> commit -> push. ASCII only (powershell.exe = PS 5.1).
param([string]$Message, [string[]]$Chemins)
$ErrorActionPreference = 'Continue'
$PSNativeCommandUseErrorActionPreference = $false
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
git fetch -q origin main
$wt = Join-Path $env:TEMP ("at-pub-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
git worktree add -q --detach $wt origin/main
try {
    foreach ($c in $Chemins) {
        $src = Join-Path $root $c
        $dst = Join-Path $wt $c
        if (Test-Path $src -PathType Container) {
            if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
            New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
            Copy-Item $src $dst -Recurse -Force
        } elseif (Test-Path $src) {
            New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
            Copy-Item $src $dst -Force
        }
    }
    Set-Location $wt
    git add -A
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { Write-Output "Rien de nouveau a publier."; return }
    git -c user.name=bastaps -c user.email=bastaps@users.noreply.github.com commit -q -m $Message
    git push -q origin HEAD:main
    if ($LASTEXITCODE -ne 0) { git fetch -q origin main; git rebase origin/main; git push -q origin HEAD:main }
    Write-Output "Publie : $Message"
} finally {
    Set-Location $root
    git worktree remove --force $wt 2>$null
}
