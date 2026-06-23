# ═══════════════════════════════════════════════════════════════
# Algeria Tech — Auto Social Feed + Deploy
# Lance fetch_social.py puis pousse tic_social.json vers Cloudflare
# si de nouveaux posts ont été ajoutés.
# Exécuté automatiquement par Windows Task Scheduler toutes les 2h.
# ═══════════════════════════════════════════════════════════════

$WorkDir = "E:\algeria-tech"
$LogFile = "$WorkDir\social_scheduler.log"
$MaxLogSize = 500KB

# Rotation du log si > 500 KB
if ((Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt $MaxLogSize) {
    if (Test-Path "$WorkDir\social_scheduler.old.log") { Remove-Item "$WorkDir\social_scheduler.old.log" -Force }
    Rename-Item $LogFile "$WorkDir\social_scheduler.old.log"
}

$ts = Get-Date -Format "yyyy-MM-dd HH:mm"
Add-Content -Path $LogFile -Value "`n=== $ts ==="

# ── 1. Récupérer Python ──────────────────────────────────────
$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) {
    Add-Content -Path $LogFile -Value "ERREUR : Python introuvable"
    exit 1
}

# ── 2. Pull AVANT de generer (evite conflits de rebase) ──────
Push-Location $WorkDir
try {
    $pullOut = git pull --rebase origin main 2>&1 | Out-String
    Add-Content -Path $LogFile -Value "git pull: $($pullOut.Trim())"
} catch {
    Add-Content -Path $LogFile -Value "git pull warning: $_"
}
Pop-Location

# ── 3. Memoriser le total avant mise a jour ───────────────────
$totalBefore = 0
try {
    $json = Get-Content "$WorkDir\tic_social.json" -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json
    $totalBefore = $json.total
} catch {}

# ── 4. Lancer fetch_social.py ────────────────────────────────
$output = & $python "$WorkDir\fetch_social.py" --no-translate 2>&1
$output | Out-String | Add-Content -Path $LogFile

# ── 5. Verifier si le fichier a change ───────────────────────
$totalAfter = 0
try {
    $json = Get-Content "$WorkDir\tic_social.json" -Raw | ConvertFrom-Json
    $totalAfter = $json.total
} catch {}

$added = $totalAfter - $totalBefore

# ── 6. Commit + push si tic_social.json modifie ──────────────
Push-Location $WorkDir
try {

    $changed = git status --porcelain -- tic_social.json 2>$null
    if ($changed) {
        git add tic_social.json 2>$null | Out-Null
        $msg = "auto: social feed $ts ($totalAfter posts)"
        git commit -m $msg 2>&1 | Out-String | Add-Content -Path $LogFile
        $pushOut = git push origin main 2>&1 | Out-String
        Add-Content -Path $LogFile -Value $pushOut
        Add-Content -Path $LogFile -Value "✅ Cloudflare mis à jour — $totalAfter posts (+$added)"
    } else {
        Add-Content -Path $LogFile -Value "-- Aucun changement dans tic_social.json, skip push"
    }
} catch {
    Add-Content -Path $LogFile -Value "ERREUR git : $_"
} finally {
    Pop-Location
}

