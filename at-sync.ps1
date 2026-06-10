try {
    Set-Location $PSScriptRoot

    # ── Ctrl+C : intercepteur C# natif (garantit e.Cancel=true sur le bon thread) ─
    if (-not ([System.Management.Automation.PSTypeName]'CtrlCGuard').Type) {
        Add-Type @"
using System;
public static class CtrlCGuard {
    public static volatile bool Fired = false;
    private static ConsoleCancelEventHandler _h;
    public static void Register() {
        _h = new ConsoleCancelEventHandler(Handler);
        Console.CancelKeyPress += _h;
    }
    public static void Unregister() {
        if (_h != null) { Console.CancelKeyPress -= _h; _h = null; }
    }
    public static void Reset() { Fired = false; }
    private static void Handler(object s, ConsoleCancelEventArgs e) {
        e.Cancel = true;
        Fired = true;
    }
}
"@
    }
    [CtrlCGuard]::Register()

    # ── Fichiers auto-générés à ne jamais pousser ────────────────────────────
    # articles.json est EXCLU : il doit etre commite avec les articles de l'utilisateur
    # joradp_veille.json / arpce_veille.json : bases de données locales (changent en continu, jamais à pousser)
    $AUTO_FILES = @("revue_presse.json", "veille_data.json", "joradp_veille.json", "arpce_veille.json", "subscribers.json")

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
        # Retire skip-worktree ET remet à HEAD pour débloquer le merge
        # tic_social.json est EXCLU : il doit garder les données fraîches du Task Scheduler
        $allDataFiles = $AUTO_FILES + @("articles.json")
        foreach ($f in $allDataFiles) {
            git update-index --no-skip-worktree $f 2>$null
            if (Test-Path $f) { git checkout HEAD -- $f 2>$null }
        }
    }

    function Invoke-RegenerateArticles {
        Write-Host "Regeneration articles.json..." -ForegroundColor Gray
        $result = node regenerate-articles.js 2>&1
        Write-Host $result -ForegroundColor Gray
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
        Write-Host "7. [PUSH]   Pousser un contenu precis (article, image, revue, site...)"
        Write-Host "8. [RESOLVE] Resoudre les conflits de fusion (ouvre les fichiers en conflit)"
        Write-Host "------------------------------------------"
        Write-Host "9. [IDE]      Lancer Algeria Tech IDE (IA Chat + Terminal)" -ForegroundColor Cyan
        Write-Host "0. [ELECTRON] Lancer en mode bureau (fenetre desktop)" -ForegroundColor Cyan
        Write-Host "J. [JORADP]   Veille reglementaire (statut + backfill)" -ForegroundColor Yellow
        Write-Host "Q. Quitter"
        Write-Host "------------------------------------------"
        Write-Host "  [CTRL+C] depuis n'importe quelle option = retour ici" -ForegroundColor DarkGray
    }

    do {
        [CtrlCGuard]::Reset()
        Show-Menu
        Write-Host "Choisissez une option : " -NoNewline -ForegroundColor White

        # ReadKey = reponse instantanee sans Enter
        try { $key = [Console]::ReadKey($true) } catch { $key = $null }

        if ([CtrlCGuard]::Fired -or ($null -eq $key)) {
            Write-Host "`n[CTRL+C] Retour au menu..." -ForegroundColor Yellow
            [CtrlCGuard]::Reset()
            Start-Sleep -Milliseconds 300
            continue
        }
        $choice = $key.KeyChar.ToString().ToLower()
        Write-Host $choice

        switch ($choice) {

            # ── 1. SYNC ──────────────────────────────────────────────────────
            "1" {
                Write-Host "`n--- Synchronisation GitHub → Localhost ---" -ForegroundColor Yellow

                # Verifier s'il y a des modifications locales non committees
                $localChanges = git status --porcelain
                if ($localChanges) {
                    Write-Host "`nModifications locales detectees :" -ForegroundColor Cyan
                    git status --short
                    Write-Host ""
                    $choice = Read-Host "Mettre en attente (stash) pour continuer ? (O/n)"
                    if ($choice -eq "n" -or $choice -eq "N") {
                        Write-Host "Annule." -ForegroundColor Yellow
                        Read-Host "`nAppuyez sur Entree pour continuer..."
                        break
                    }
                    Reset-AutoFiles
                    git stash push -m "sync_temp" 2>&1 | Out-Null
                    Write-Host "Changements locaux mis en attente." -ForegroundColor Gray
                }

                # Pull complet depuis GitHub
                Write-Host "Recuperation depuis GitHub..." -ForegroundColor Cyan
                $pullResult = git pull --no-rebase origin main 2>&1
                Write-Host $pullResult

                if ($LASTEXITCODE -ne 0) {
                    Write-Host "ERREUR lors du pull." -ForegroundColor Red
                    git merge --abort 2>&1 | Out-Null
                    git stash pop 2>&1 | Out-Null
                    Read-Host "`nAppuyez sur Entree pour continuer..."
                    break
                }

                # Regenerer articles.json depuis tous les .md (y compris ceux crees sur Cloudflare)
                Invoke-RegenerateArticles

                # Reappliquer skip-worktree
                Set-SkipWorktree -Enable

                Write-Host "`nOK Localhost est a jour avec GitHub." -ForegroundColor Green
                Write-Host "(Articles crees sur Cloudflare cette semaine sont maintenant disponibles en local)" -ForegroundColor DarkGray
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

                # 4. Pull + merge depuis GitHub (-X ours = nos fichiers prioritaires en cas de conflit)
                Write-Host "Synchronisation avec GitHub..." -ForegroundColor Cyan
                $rebaseResult = git pull --no-rebase -X ours origin main 2>&1
                Write-Host $rebaseResult

                if ($LASTEXITCODE -ne 0) {
                    Write-Host "ERREUR lors du merge. Abandon..." -ForegroundColor Red
                    git merge --abort 2>&1 | Out-Null
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

                # 6. Regenerer articles.json depuis les .md (inclut les nouveaux articles GitHub Actions)
                Invoke-RegenerateArticles

                # 7. Remettre skip-worktree sur les fichiers auto
                Set-SkipWorktree -Enable

                # 8. Stager les fichiers modifies ET les nouveaux articles/images/documents
                git add -u                                    # fichiers tracked modifies
                git add articles/ 2>$null | Out-Null          # nouveaux .md (untracked)
                git add images/ 2>$null | Out-Null            # nouvelles images articles
                git add documents/ 2>$null | Out-Null         # nouveaux PDF
                git add tic_social.json 2>$null | Out-Null    # données fraîches réseaux sociaux
                git add joradp_static.json 2>$null | Out-Null # snapshot réglementaire JORADP
                git add arpce_static.json 2>$null | Out-Null  # snapshot réglementaire ARPCE
                # Exclure uniquement les fichiers vraiment auto-generes (revue + veille RSS)
                foreach ($f in $AUTO_FILES) {
                    git restore --staged $f 2>$null
                }

                # 9. Commiter
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
                [CtrlCGuard]::Reset()
                try { node server.js } catch { }
                Write-Host "`n[Serveur arrete] Retour au menu..." -ForegroundColor Yellow
                [CtrlCGuard]::Reset()
                Start-Sleep -Milliseconds 500
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

            # ── 7. PUSH INTELLIGENT ──────────────────────────────────────────
            "7" {
                Write-Host "`n--- PUSH INTELLIGENT : que voulez-vous pousser ? ---" -ForegroundColor Cyan
                Write-Host "  A. Article de presse  (articles/ + images/ + documents/)"
                Write-Host "  B. Revue de presse    (revue_presse.json uniquement)"
                Write-Host "  C. Modification site  (index.html / style.css / script.js)"
                Write-Host "  D. Infographie        (infographies/<dossier>/)"
                Write-Host "  E. Fichier(s) precis  (vous tapez le chemin)"
                Write-Host "  X. Annuler"
                Write-Host ""
                Write-Host "Votre choix : " -NoNewline -ForegroundColor White
                try { $pushKey = [Console]::ReadKey($true) } catch { $pushKey = $null }
                $pushChoice = $pushKey.KeyChar.ToString().ToLower()
                Write-Host $pushChoice

                $filesToStage = @()
                $commitPrefix = "PUSH"

                switch ($pushChoice) {

                    "a" {
                        Write-Host "`nArticles + images + documents detectes :" -ForegroundColor Cyan
                        git status --short | Where-Object { $_ -match "articles/|images/|documents/" }
                        $filesToStage = @("articles/", "images/", "documents/")
                        $commitPrefix = "DEPLOY Article"
                    }

                    "b" {
                        Write-Host "`nRevue de presse :" -ForegroundColor Cyan
                        git status --short | Where-Object { $_ -match "revue_presse|articles.json" }
                        $filesToStage = @("revue_presse.json", "articles.json")
                        $commitPrefix = "MAJ Revue de presse"
                    }

                    "c" {
                        Write-Host "`nFichiers site detectes :" -ForegroundColor Cyan
                        git status --short | Where-Object { $_ -match "\.html$|\.css$|\.js$|_headers|_redirects" }
                        $filesToStage = @("index.html", "style.css", "script.js", "_headers", "_redirects")
                        $commitPrefix = "MAJ Site"
                    }

                    "d" {
                        $dossier = Read-Host "`nNom du dossier infographie (ex: observatoire-mobile-2026)"
                        $dossier = $dossier.Trim()
                        if (-not $dossier) { Write-Host "Annule." -ForegroundColor Yellow; break }
                        $fullPath = "infographies/$dossier/"
                        if (-not (Test-Path $fullPath)) {
                            Write-Host "ERREUR : dossier '$fullPath' introuvable." -ForegroundColor Red
                            Read-Host "Appuyez sur Entree pour continuer..."
                            break
                        }
                        Write-Host "`nFichiers infographie :" -ForegroundColor Cyan
                        git status --short | Where-Object { $_ -match "infographies/$dossier" }
                        $filesToStage = @($fullPath)
                        $commitPrefix = "DEPLOY Infographie $dossier"
                    }

                    "e" {
                        $fichiers = Read-Host "`nChemin(s) a pousser (separes par des virgules)"
                        if (-not $fichiers) { Write-Host "Annule." -ForegroundColor Yellow; break }
                        $filesToStage = $fichiers -split "," | ForEach-Object { $_.Trim() }
                        Write-Host "`nFichiers selectionnes :" -ForegroundColor Cyan
                        $filesToStage | ForEach-Object { Write-Host "  - $_" }
                        $commitPrefix = "MAJ"
                    }

                    default {
                        Write-Host "Annule." -ForegroundColor Yellow
                        Read-Host "`nAppuyez sur Entree pour continuer..."
                        break
                    }
                }

                if ($filesToStage.Count -eq 0) { break }

                $msg = Read-Host "`nDescription du commit"
                if (-not $msg) { $msg = "mise a jour" }

                # Stage uniquement les fichiers selectionnes
                Set-SkipWorktree -Enable:$false
                Reset-AutoFiles

                foreach ($f in $filesToStage) {
                    git add $f 2>$null
                }
                # Toujours exclure les fichiers auto
                foreach ($f in $AUTO_FILES) { git restore --staged $f 2>$null }
                git restore --staged articles.json 2>$null

                $staged = git diff --cached --name-only
                if (-not $staged) {
                    Write-Host "`nAucun changement a pousser pour cette selection." -ForegroundColor Yellow
                    Set-SkipWorktree -Enable
                    Read-Host "`nAppuyez sur Entree pour continuer..."
                    break
                }

                Write-Host "`nFichiers qui seront commites :" -ForegroundColor Green
                $staged | ForEach-Object { Write-Host "  + $_" -ForegroundColor White }

                $confirm = Read-Host "`nConfirmer le push ? (O/n)"
                if ($confirm -eq "n" -or $confirm -eq "N") {
                    git restore --staged . 2>$null
                    Set-SkipWorktree -Enable
                    Write-Host "Annule." -ForegroundColor Yellow
                    Read-Host "`nAppuyez sur Entree pour continuer..."
                    break
                }

                git commit -m "$commitPrefix : $msg"

                Write-Host "Synchronisation avec GitHub..." -ForegroundColor Cyan
                $rebaseResult = git pull --no-rebase -X ours origin main 2>&1
                Write-Host $rebaseResult

                if ($LASTEXITCODE -ne 0) {
                    Write-Host "ERREUR merge. Abandon..." -ForegroundColor Red
                    git merge --abort 2>&1 | Out-Null
                    Set-SkipWorktree -Enable
                    Read-Host "Appuyez sur Entree pour continuer..."
                    break
                }

                # Regenerer articles.json apres le merge (inclut les nouveaux articles GitHub Actions)
                Invoke-RegenerateArticles
                git add articles.json articles/list.json 2>$null

                $pushResult = git push origin main 2>&1
                Write-Host $pushResult

                Set-SkipWorktree -Enable

                if ($LASTEXITCODE -eq 0) {
                    Write-Host "`nOK Push reussi sur GitHub et Cloudflare !" -ForegroundColor Green
                } else {
                    Write-Host "`nERREUR lors du push." -ForegroundColor Red
                }

                Read-Host "`nAppuyez sur Entree pour continuer..."
            }

            # ── 8. RESOLVE CONFLICTS ─────────────────────────────────────────
            "8" {
                Write-Host "`n--- Resolution des conflits de fusion ---" -ForegroundColor Yellow

                $conflictedFiles = git diff --name-only --diff-filter=U 2>&1
                if (-not $conflictedFiles) {
                    Write-Host "Aucun conflit detecte. Le depot est propre." -ForegroundColor Green
                    Read-Host "`nAppuyez sur Entree pour continuer..."
                    break
                }

                Write-Host "`nFichiers en conflit :" -ForegroundColor Red
                $conflictedFiles | ForEach-Object { Write-Host "  >> $_" -ForegroundColor White }

                # Choisir l'editeur disponible : VS Code > Notepad++ > Notepad
                $editor = $null
                if (Get-Command "code" -ErrorAction SilentlyContinue) {
                    $editor = "code"
                } elseif (Test-Path "C:\Program Files\Notepad++\notepad++.exe") {
                    $editor = "C:\Program Files\Notepad++\notepad++.exe"
                } elseif (Test-Path "C:\Program Files (x86)\Notepad++\notepad++.exe") {
                    $editor = "C:\Program Files (x86)\Notepad++\notepad++.exe"
                } else {
                    $editor = "notepad"
                }

                Write-Host "`nOuverture dans : $editor" -ForegroundColor Cyan
                $conflictedFiles | ForEach-Object {
                    if (Test-Path $_) {
                        Start-Process $editor $_
                    }
                }

                Write-Host "`nAprès avoir corrigé les conflits dans l'éditeur :" -ForegroundColor Yellow
                Write-Host "  1. Sauvegardez les fichiers"
                Write-Host "  2. Revenez ici et choisissez [2. DEPLOY] pour commiter et pousser"
                Write-Host ""
                Write-Host "  Commandes manuelles utiles :" -ForegroundColor DarkGray
                Write-Host "    git add <fichier>    # marquer comme resolu" -ForegroundColor DarkGray
                Write-Host "    git merge --continue # finaliser le merge" -ForegroundColor DarkGray
                Write-Host "    git merge --abort    # annuler le merge" -ForegroundColor DarkGray

                Read-Host "`nAppuyez sur Entree pour continuer..."
            }

            # ── 9. IDE ALGERIA TECH ──────────────────────────────────────────
            "9" {
                Write-Host "`n--- Lancement Algeria Tech IDE ---" -ForegroundColor Cyan
                $ideDir = "E:\gemini-cli\gemini-web-ui"
                if (-not (Test-Path $ideDir)) {
                    Write-Host "ERREUR : dossier IDE introuvable : $ideDir" -ForegroundColor Red
                    Read-Host "`nAppuyez sur Entree pour continuer..."
                    break
                }
                # Stopper les anciens processus node eventuels
                Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 600
                # Lancer serveur + Vite dans une nouvelle fenetre (non bloquant)
                Start-Process powershell -ArgumentList "-NoExit", "-Command",
                    "Set-Location '$ideDir'; Write-Host 'Algeria Tech IDE...' -ForegroundColor Cyan; npm run dev"
                # Attendre le demarrage puis ouvrir le navigateur
                Write-Host "Demarrage en cours" -NoNewline -ForegroundColor Gray
                for ($i = 0; $i -lt 6; $i++) { Start-Sleep -Seconds 1; Write-Host "." -NoNewline -ForegroundColor Gray }
                Write-Host ""
                Start-Process "http://localhost:5173"
                Write-Host "OK IDE lance !" -ForegroundColor Green
                Write-Host "   Navigateur : http://localhost:5173" -ForegroundColor DarkGray
                Write-Host "   Serveur    : http://localhost:3001" -ForegroundColor DarkGray
                Read-Host "`nAppuyez sur Entree pour continuer..."
            }

            # ── 0. ELECTRON DESKTOP ──────────────────────────────────────────
            "0" {
                Write-Host "`n--- Lancement Electron (mode bureau) ---" -ForegroundColor Cyan
                $ideDir = "E:\gemini-cli\gemini-web-ui"
                if (-not (Test-Path "$ideDir\node_modules\.bin\electron.cmd")) {
                    Write-Host "Electron non installe. Installation..." -ForegroundColor Yellow
                    Push-Location $ideDir
                    npm install electron --save-dev
                    Pop-Location
                }
                # Verifier si Vite tourne deja
                $viteOk = (Test-NetConnection -ComputerName localhost -Port 5173 -InformationLevel Quiet -WarningAction SilentlyContinue) -or
                          (Test-NetConnection -ComputerName localhost -Port 5174 -InformationLevel Quiet -WarningAction SilentlyContinue)
                if (-not $viteOk) {
                    Write-Host "Vite non detecte, lancement serveur + client..." -ForegroundColor Yellow
                    Start-Process powershell -ArgumentList "-NoExit", "-Command",
                        "Set-Location '$ideDir'; npm run dev"
                    Write-Host "Attente demarrage (6s)..." -ForegroundColor Gray
                    Start-Sleep -Seconds 6
                }
                # Lancer Electron
                Start-Process powershell -ArgumentList "-NoExit", "-Command",
                    "Set-Location '$ideDir'; npm run electron:dev"
                Write-Host "OK Electron en cours de demarrage..." -ForegroundColor Green
                Read-Host "`nAppuyez sur Entree pour continuer..."
            }

            # ── J. JORADP — Veille Reglementaire ────────────────────────────
            "j" {
                Write-Host "`n--- Veille Reglementaire JORADP ---" -ForegroundColor Yellow
                Write-Host "  Le serveur surveille automatiquement le JO chaque jour a 09h00." -ForegroundColor DarkGray
                Write-Host "  Cette option vous permet de consulter l'etat et de forcer des actions." -ForegroundColor DarkGray

                # Verifier si le serveur local tourne
                $serverOk = $false
                try {
                    $null = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 3 -ErrorAction Stop
                    $serverOk = $true
                } catch { }

                if (-not $serverOk) {
                    Write-Host "`nERREUR : Le serveur local n'est pas actif." -ForegroundColor Red
                    Write-Host "Lancez d'abord l'option 4 (START), puis revenez ici." -ForegroundColor Yellow
                    Read-Host "`nAppuyez sur Entree pour continuer..."
                    break
                }

                # Afficher le statut des deux sources
                $st = $null; $stA = $null
                try {
                    $st = Invoke-RestMethod -Uri "http://localhost:3000/api/joradp/status" -TimeoutSec 5
                } catch { }
                try {
                    $stA = Invoke-RestMethod -Uri "http://localhost:3000/api/arpce/status" -TimeoutSec 5
                } catch { }

                if (-not $st -and -not $stA) {
                    Write-Host "Impossible de lire les statuts (serveur actif ?)." -ForegroundColor Red
                    Read-Host "`nAppuyez sur Entree pour continuer..."
                    break
                }

                Write-Host "`nStatut actuel :" -ForegroundColor Green
                if ($st) {
                    Write-Host "  [JORADP] Textes TIC   : $($st.textes)  |  JO analyses : $($st.analyzed)  |  Derniere verif : $($st.lastChecked)"
                    if ($st.backfillRunning) { Write-Host "  [JORADP] Backfill EN COURS" -ForegroundColor Yellow }
                }
                if ($stA) {
                    Write-Host "  [ARPCE]  Publications : $($stA.total)  |  Derniere verif : $($stA.lastChecked)"
                    if ($stA.backfillRunning) { Write-Host "  [ARPCE]  Backfill EN COURS" -ForegroundColor Yellow }
                }

                if ($st.backfillRunning -or $stA.backfillRunning) {
                    Read-Host "`nBackfill en cours -- Appuyez sur Entree pour revenir au menu..."
                    break
                }

                Write-Host "`n  R. Verifier maintenant les nouveaux numeros du JO + ARPCE"
                Write-Host "  B. Backfill (analyser toutes les editions depuis une annee donnee)"
                Write-Host "  E. Exporter + Deployer vers Cloudflare Pages (joradp_static + arpce_static)" -ForegroundColor Yellow
                Write-Host "  X. Retour"
                Write-Host ""
                Write-Host "Votre choix : " -NoNewline -ForegroundColor White
                try { $jKey = [Console]::ReadKey($true) } catch { $jKey = $null }
                $jChoice = $jKey.KeyChar.ToString().ToLower()
                Write-Host $jChoice

                switch ($jChoice) {

                    "r" {
                        # Verifier JORADP + ARPCE
                        try {
                            $r = Invoke-RestMethod -Uri "http://localhost:3000/api/joradp/refresh" -Method POST -TimeoutSec 5
                            Write-Host "`nJORADP : $($r.message)" -ForegroundColor Green
                        } catch { Write-Host "JORADP ERREUR : $($_.Exception.Message)" -ForegroundColor Red }
                        try {
                            $r2 = Invoke-RestMethod -Uri "http://localhost:3000/api/arpce/refresh" -Method POST -TimeoutSec 5
                            Write-Host "ARPCE  : $($r2.message)" -ForegroundColor Green
                        } catch { Write-Host "ARPCE ERREUR : $($_.Exception.Message)" -ForegroundColor Red }
                        Write-Host "Les resultats apparaitront dans les logs de la fenetre serveur." -ForegroundColor DarkGray
                    }

                    "b" {
                        # Backfill JORADP — une ou plusieurs années
                        $startYearInput = Read-Host "Annee de depart JORADP (ex: 2025, Entree = $((Get-Date).Year))"
                        $startYear = if ($startYearInput -match "^\d{4}$") { [int]$startYearInput } else { (Get-Date).Year }
                        $endYear   = (Get-Date).Year
                        for ($y = $startYear; $y -le $endYear; $y++) {
                            Write-Host "`nLancement du backfill JORADP $y..." -ForegroundColor Cyan
                            try {
                                $body = "{`"year`":$y,`"delay_ms`":1000}"
                                $r = Invoke-RestMethod -Uri "http://localhost:3000/api/joradp/backfill" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 10
                                Write-Host "JORADP $y : $($r.message)" -ForegroundColor Green
                            } catch { Write-Host "JORADP $y ERREUR : $($_.Exception.Message)" -ForegroundColor Red }
                            if ($y -lt $endYear) {
                                Write-Host "Attente 30s avant l'annee suivante..." -ForegroundColor DarkGray
                                Start-Sleep -Seconds 30
                            }
                        }
                        # Backfill ARPCE (depuis 2025-01-01)
                        Write-Host "`nLancement du backfill ARPCE (12 pages, depuis 2025-01-01)..." -ForegroundColor Cyan
                        try {
                            $bodyA = '{"pages":12,"stop_date":"2025-01-01"}'
                            $r2 = Invoke-RestMethod -Uri "http://localhost:3000/api/arpce/backfill" -Method POST -ContentType "application/json" -Body $bodyA -TimeoutSec 10
                            Write-Host "ARPCE  : $($r2.message)" -ForegroundColor Green
                        } catch { Write-Host "ARPCE ERREUR : $($_.Exception.Message)" -ForegroundColor Red }
                        Write-Host "`nBackfill lance en arriere-plan. Suivez les logs serveur." -ForegroundColor DarkGray
                        Write-Host "Quand termine, tapez E pour exporter et deployer." -ForegroundColor Yellow
                    }

                    "e" {
                        # Export JSON statique + commit + push vers Cloudflare Pages
                        Write-Host "`n--- Export statique + Deploy Cloudflare Pages ---" -ForegroundColor Cyan
                        Write-Host "  1. Generation joradp_static.json et arpce_static.json..." -ForegroundColor DarkGray
                        try {
                            $exp = Invoke-RestMethod -Uri "http://localhost:3000/api/export-static" -Method POST -TimeoutSec 10
                            Write-Host "  OK : $($exp.joradp) textes JORADP, $($exp.arpce) publications ARPCE" -ForegroundColor Green
                        } catch {
                            Write-Host "  ERREUR export : $($_.Exception.Message)" -ForegroundColor Red
                            break
                        }

                        Write-Host "  2. Ajout dans git et commit..." -ForegroundColor DarkGray
                        git add joradp_static.json arpce_static.json 2>&1 | Out-Null
                        $staged = git diff --cached --name-only
                        if ($staged) {
                            $ts = Get-Date -Format "yyyy-MM-dd HH:mm"
                            git commit -m "REGLEMENTAIRE export statique $ts" 2>&1 | Write-Host
                            Write-Host "  Commit OK." -ForegroundColor Green
                        } else {
                            Write-Host "  Aucun changement dans les fichiers statiques." -ForegroundColor Yellow
                        }

                        Write-Host "  3. Push vers GitHub + Cloudflare Pages..." -ForegroundColor DarkGray
                        $pushR = git push origin main 2>&1
                        Write-Host $pushR
                        if ($LASTEXITCODE -eq 0) {
                            Write-Host "`n  OK Cloudflare Pages se met a jour automatiquement !" -ForegroundColor Green
                            Write-Host "  Verifiez dans 1-2 min : https://algeria-tech.pages.dev" -ForegroundColor Cyan
                        } else {
                            Write-Host "`n  ERREUR push." -ForegroundColor Red
                        }
                    }

                    default { Write-Host "Retour." -ForegroundColor DarkGray }
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

    [CtrlCGuard]::Unregister()

} catch [System.Management.Automation.PipelineStoppedException] {
    # Fermeture propre via Ctrl+C au niveau superieur
} catch {
    Write-Host "`nUNE ERREUR TECHNIQUE EST SURVENUE :" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor White
    Write-Host "Details : $($_.ScriptStackTrace)" -ForegroundColor Gray
    Read-Host "Appuyez sur Entree pour quitter."
}
