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

# ── 2. Mémoriser le total de posts avant la mise à jour ──────
$totalBefore = 0
try {
    $json = Get-Content "$WorkDir\tic_social.json" -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json
    $totalBefore = $json.total
} catch {}

# ── 3. Lancer fetch_social.py ────────────────────────────────
$output = & $python "$WorkDir\fetch_social.py" 2>&1
$output | Out-String | Add-Content -Path $LogFile

# ── 4. Vérifier si de nouveaux posts ont été ajoutés ─────────
$totalAfter = 0
try {
    $json = Get-Content "$WorkDir\tic_social.json" -Raw | ConvertFrom-Json
    $totalAfter = $json.total
} catch {}

$added = $totalAfter - $totalBefore

# ── 5. Pull latest (GitHub Actions peut avoir poussé entre-temps) ────
Push-Location $WorkDir
try {
    # Synchroniser avec le dépôt distant avant de comparer/pousser
    $pullOut = git pull --rebase origin main 2>&1 | Out-String
    Add-Content -Path $LogFile -Value "git pull: $($pullOut.Trim())"

    # Recalculer le total APRÈS le pull (le remote peut avoir des posts plus récents)
    try {
        $jsonAfterPull = Get-Content "$WorkDir\tic_social.json" -Raw | ConvertFrom-Json
        $totalAfter = $jsonAfterPull.total
    } catch {}

    # git status --porcelain retourne non-vide si le fichier a été modifié localement
    $changed = git status --porcelain -- tic_social.json 2>$null
    if ($changed) {
        git add tic_social.json 2>$null | Out-Null
        $msg = "auto: social feed $ts ($totalAfter posts)"
        git commit -m $msg 2>&1 | Out-String | Add-Content -Path $LogFile
        $pushOut = git push origin main 2>&1 | Out-String
        Add-Content -Path $LogFile -Value $pushOut
        Add-Content -Path $LogFile -Value "✅ Cloudflare mis à jour — $totalAfter posts (+$added)"
    } else {
        Add-Content -Path $LogFile -Value "-- Pas de changement local dans tic_social.json, skip push"
    }
} catch {
    Add-Content -Path $LogFile -Value "ERREUR git : $_"
} finally {
    Pop-Location
}
