# ═══════════════════════════════════════════════════════════════
# Algeria Tech — Setup Windows Task Scheduler
# Lance fetch_social.py toutes les 2 heures automatiquement
# Usage : PowerShell → .\setup_scheduler.ps1
# ═══════════════════════════════════════════════════════════════

$TaskName    = "AlgeriaTech-SocialFeed"
$ScriptPath  = "E:\algeria-tech\fetch_social.py"
$PythonExe   = (Get-Command python -ErrorAction SilentlyContinue).Source
$WorkDir     = "E:\algeria-tech"
$LogFile     = "E:\algeria-tech\social_scheduler.log"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Algeria Tech — Configuration Task Scheduler Windows     ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# ── Vérification Python ─────────────────────────────────────────
if (-not $PythonExe) {
    Write-Host "[ERREUR] Python introuvable. Installez Python depuis python.org" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Python trouvé : $PythonExe" -ForegroundColor Cyan

# ── Vérification du script ───────────────────────────────────────
if (-not (Test-Path $ScriptPath)) {
    Write-Host "[ERREUR] Script introuvable : $ScriptPath" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Script trouvé : $ScriptPath" -ForegroundColor Cyan

# ── Supprimer l'ancienne tâche si elle existe ───────────────────
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "🔄 Ancienne tâche supprimée." -ForegroundColor Yellow
}

# ── Définir l'action ────────────────────────────────────────────
$action = New-ScheduledTaskAction `
    -Execute $PythonExe `
    -Argument "`"$ScriptPath`"" `
    -WorkingDirectory $WorkDir

# ── Définir le déclencheur : toutes les 2 heures ────────────────
$trigger = New-ScheduledTaskTrigger `
    -RepetitionInterval (New-TimeSpan -Hours 2) `
    -Once `
    -At (Get-Date).Date.AddHours(6)   # Commence à 6h00 du matin

# ── Lancer aussi au démarrage du PC ─────────────────────────────
$triggerBoot = New-ScheduledTaskTrigger -AtLogOn

# ── Paramètres : s'exécute même si pas connecté, en arrière-plan ─
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable

# ── Créer la tâche ──────────────────────────────────────────────
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger @($trigger, $triggerBoot) `
    -Settings $settings `
    -Description "Algeria Tech — Met à jour les actualités TIC toutes les 2h" `
    -RunLevel Highest `
    -Force | Out-Null

Write-Host ""
Write-Host "✅ Tâche planifiée créée : '$TaskName'" -ForegroundColor Green
Write-Host "   ⏱ Fréquence : toutes les 2 heures" -ForegroundColor White
Write-Host "   🚀 Démarre aussi au démarrage de Windows" -ForegroundColor White
Write-Host ""

# ── Premier lancement immédiat ──────────────────────────────────
Write-Host "▶ Premier lancement du script maintenant..." -ForegroundColor Cyan
$proc = Start-Process -FilePath $PythonExe `
    -ArgumentList "`"$ScriptPath`"" `
    -WorkingDirectory $WorkDir `
    -PassThru `
    -NoNewWindow

Write-Host "   PID: $($proc.Id) — Attendez la fin..." -ForegroundColor Gray
$proc.WaitForExit(120000)  # Timeout 2 minutes

if ($proc.ExitCode -eq 0) {
    Write-Host "✅ Script terminé avec succès !" -ForegroundColor Green
    $postCount = try { (Get-Content "E:\algeria-tech\tic_social.json" | ConvertFrom-Json).total } catch { 0 }
    Write-Host "   📊 Posts collectés : $postCount" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  Script terminé avec code $($proc.ExitCode). Vérifiez social_config.json" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host " Site disponible sur : http://localhost:3000/actualites-tic" -ForegroundColor White
Write-Host " Config sources     : E:\algeria-tech\social_config.json" -ForegroundColor White
Write-Host " Données            : E:\algeria-tech\tic_social.json" -ForegroundColor White
Write-Host " Gérer la tâche     : taskschd.msc → AlgeriaTech-SocialFeed" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
