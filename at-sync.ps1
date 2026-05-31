try {
    Set-Location $PSScriptRoot

    # ── Ctrl+C : empeche la fermeture, pose un flag ──────────────────────────
    $script:ctrlC = $false
    $script:ctrlCHandler = [ConsoleCancelEventHandler]{
        param($s, $e)
        $e.Cancel     = $true
        $script:ctrlC = $true
    }
    [Console]::add_CancelKeyPress($script:ctrlCHandler)

    # ── Fichiers auto-générés à ne jamais pousser ────────────────────────────
    $AUTO_FILES = @("revue_presse.json", "articles.json", "veille_data.json")

    function Set-SkipWorktree {
        param([switch]$Enable)
        $flag = if ($Enable) { "--skip-worktree" } else { "--no-skip-worktree" }
        foreach ($f in $AUTO_FILES) {
            if (Test-Path $f) {
                git update-index $flag $f 2>$null
            }
        }
    }

    function Reset-AutoFiles {
        # Remet les fichiers auto à leur version HEAD pour débloquer le rebase
        foreach ($f in $AUTO_FILES) {
            git checkout HEAD -- $f 2>$null
        }
    }

    function Show-Menu {
        Clear-Host
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host "   ALGERIA TECH - TABLEAU DE BORD SYNC    " -ForegroundColor White -BackgroundColor DarkGreen
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host "1. [SYNC]   Recuperer la revue du jour et les archives depuis GitHub"
        Write-Host "2. [DEPLOY] Pousser mes modifications vers GitHub + Cloudflare"
        Write-Host "3. [REPAIR] Nettoyer l'index Git (skip-worktree + fichiers parasites)"
        Write-Host "4. [START]  Lancer le serveur local (localhost:3000)"
        Write-Host "5. [STATUS] Verifier l'etat Git et les cles API"
        Write-Host "6. [BUILD]  Generer l'APK Android (Debug)"
        Write-Host "Q. Quitter"
        Write-Host "------------------------------------------"
        Write-Host "  [CTRL+C] depuis n'importe quelle option = retour ici" -ForegroundColor DarkGray
    }

    do {
        $script:ctrlC = $false
        Show-Menu
        Write-Host "Choisissez une option : " -NoNewline -ForegroundColor White

        # ReadKey = reponse instantanee, CancelKeyPress gere Ctrl+C
        try { $key = [Console]::ReadKey($true) } catch { $key = $null }

        if ($script:ctrlC -or ($null -eq $key)) {
            Write-Host "`n[CTRL+C] Retour au menu..." -ForegroundColor Yellow
            Start-Sleep -Milliseconds 300
            continue
        }
        $choice = $key.KeyChar.ToString().ToLower()
        Write-Host $choice

        switch ($choice) {

            # ── 1. SYNC ──────────────────────────────────────────────────────
            "1" {
                Write-Host "`n--- Recuperation depuis GitHub ---" -ForegroundColor Yellow
                git fetch origin main
                git checkout origin/main -- archives/ revue_presse.json articles.json veille_data.json 2>&1 | Out-Null
                # Reappliquer skip-worktree apres le checkout
                Set-SkipWorktree -Enable
                Write-Host "OK Localhost est a jour avec GitHub." -ForegroundColor Green
                Read-Host "`nAppuyez sur Entree pour continuer..."
            }

            # ── 2. DEPLOY ────────────────────────────────────────────────────
            "2" {
                Write-Host "`n--- Deploiement securise vers GitHub + Cloudflare ---" -ForegroundColor Yellow

                # Afficher ce qui va etre commite
                Write-Host "`nFichiers modifies (tracked) :" -ForegroundColor Cyan
                git status --short

                $msg = Read-Host "`nMessage du commit (ex: MAJ CSS logo)"
                if (-not $msg) { $msg = "Mise a jour" }

                # 1. Enlever skip-worktree pour voir l'etat reel
                Set-SkipWorktree -Enable:$false

                # 2. Remettre les fichiers auto a HEAD (evite conflits rebase)
                Reset-AutoFiles

                # 3. Stasher les changements non commites
                $stashCreated = $false
                $statusBefore = git status --porcelain
                if ($statusBefore) {
                    git stash push -m "deploy_temp" 2>&1 | Out-Null
                    $stashCreated = $true
                    Write-Host "Changements locaux mis en attente (stash)." -ForegroundColor Gray
                }

                # 4. Pull + rebase depuis GitHub (jamais de conflit desormais)
                Write-Host "Synchronisation avec GitHub..." -ForegroundColor Cyan
                $rebaseResult = git pull --rebase -X ours origin main 2>&1
                Write-Host $rebaseResult

                if ($LASTEXITCODE -ne 0) {
                    Write-Host "ERREUR lors du rebase. Annulation du rebase en cours..." -ForegroundColor Red
                    git rebase --abort 2>&1 | Out-Null
                    if ($stashCreated) { git stash pop 2>&1 | Out-Null }
                    Set-SkipWorktree -Enable
                    Read-Host "Appuyez sur Entree pour continuer..."
                    break
                }

                # 5. Restaurer les changements locaux
                if ($stashCreated) {
                    git stash pop 2>&1 | Out-Null
                    Write-Host "Changements locaux restaures." -ForegroundColor Gray
                }

                # 6. Remettre skip-worktree sur les fichiers auto
                Set-SkipWorktree -Enable

                # 7. Stager uniquement les fichiers TRACKED modifies (pas les auto-generes)
                git add -u
                # Exclure explicitement les fichiers auto du staging
                foreach ($f in $AUTO_FILES) {
                    git restore --staged $f 2>$null
                }

                # 8. Commiter
                $staged = git diff --cached --name-only
                if ($staged) {
                    git commit -m "DEPLOY $msg"
                    Write-Host "`nCommit cree." -ForegroundColor Green
                } else {
                    Write-Host "`nAucun fichier a commiter (deja a jour)." -ForegroundColor Yellow
                }

                # 9. Push
                Write-Host "Push vers GitHub..." -ForegroundColor Cyan
                $pushResult = git push origin main 2>&1
                Write-Host $pushResult

                if ($LASTEXITCODE -eq 0) {
                    Write-Host "`nOK Deploiement reussi sur GitHub et Cloudflare !" -ForegroundColor Green
                } else {
                    Write-Host "`nERREUR lors du push." -ForegroundColor Red
                }

                Read-Host "`nAppuyez sur Entree pour continuer..."
            }

            # ── 3. REPAIR ────────────────────────────────────────────────────
            "3" {
                Write-Host "`n--- Reparation de l'index Git ---" -ForegroundColor Yellow
                # Reappliquer skip-worktree (sans supprimer le tracking remote)
                Set-SkipWorktree -Enable
                Write-Host "OK skip-worktree applique sur : $($AUTO_FILES -join ', ')" -ForegroundColor Green
                # Nettoyer .idea et autres IDE
                git rm -r --cached mobile/.idea/ 2>$null
                git rm --cached .vscode/settings.json 2>$null
                Write-Host "OK Fichiers IDE retires de l'index." -ForegroundColor Green
                Read-Host "`nAppuyez sur Entree pour continuer..."
            }

            # ── 4. START ─────────────────────────────────────────────────────
            "4" {
                Write-Host "`n--- Lancement du serveur local (Ctrl+C = retour menu) ---" -ForegroundColor Cyan
                if (-not $env:MISTRAL_API_KEY -and (Test-Path ".env")) {
                    Get-Content ".env" | ForEach-Object {
                        if ($_ -match "^MISTRAL_API_KEY=(.+)$") {
                            $env:MISTRAL_API_KEY = $matches[1]
                            Write-Host "Cle Mistral chargee." -ForegroundColor Gray
                        }
                    }
                }
                $script:ctrlC = $false
                node server.js
                if ($script:ctrlC) {
                    Write-Host "`n[CTRL+C] Serveur arrete. Retour au menu..." -ForegroundColor Yellow
                    $script:ctrlC = $false
                    Start-Sleep -Milliseconds 300
                }
            }

            # ── 5. STATUS ────────────────────────────────────────────────────
            "5" {
                Write-Host "`n--- Etat du Projet ---" -ForegroundColor Yellow

                Write-Host "`nGit Status :" -ForegroundColor Cyan
                git status --short

                Write-Host "`nDerniers commits :" -ForegroundColor Cyan
                git log --oneline -5

                Write-Host "`nGitHub Auth (gh cli) :" -ForegroundColor Cyan
                gh auth status 2>&1

                $apiKey = $env:MISTRAL_API_KEY
                if (-not $apiKey -and (Test-Path ".env")) {
                    Get-Content ".env" | ForEach-Object {
                        if ($_ -match "^MISTRAL_API_KEY=(.+)$") { $apiKey = $matches[1] }
                    }
                }
                Write-Host "`nCle Mistral : " -NoNewline
                if ($apiKey) {
                    Write-Host "OK Detectee ($($apiKey.Substring(0,4))...)" -ForegroundColor Green
                } else {
                    Write-Host "MANQUANTE (generation auto revue desactivee)" -ForegroundColor Red
                }

                Read-Host "`nAppuyez sur Entree pour continuer..."
            }

            # ── 6. BUILD ─────────────────────────────────────────────────────
            "6" {
                Write-Host "`n--- Construction APK Android ---" -ForegroundColor Yellow
                if (Test-Path "mobile\gradlew.bat") {
                    Push-Location "mobile"
                    .\gradlew.bat assembleDebug
                    Pop-Location
                    Write-Host "`nOK Build termine !" -ForegroundColor Green
                    Write-Host "APK : mobile\app\build\outputs\apk\debug" -ForegroundColor Gray
                } else {
                    Write-Host "ERREUR : gradlew.bat introuvable dans le dossier mobile." -ForegroundColor Red
                }
                Read-Host "`nAppuyez sur Entree pour continuer..."
            }
        }

    } while ($choice -ne "q" -and $choice -ne "Q")

    [Console]::remove_CancelKeyPress($script:ctrlCHandler)

} catch {
    Write-Host "`nUNE ERREUR TECHNIQUE EST SURVENUE :" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor White
    Write-Host "Details : $($_.ScriptStackTrace)" -ForegroundColor Gray
    Read-Host "Appuyez sur Entree pour quitter."
}
