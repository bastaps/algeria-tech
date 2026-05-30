try {
    # Définition du dossier de travail de manière robuste
    Set-Location $PSScriptRoot

    function Show-Menu {
        Clear-Host
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host "   ALGERIA TECH - TABLEAU DE BORD SYNC    " -ForegroundColor White -BackgroundColor DarkGreen
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host "1. [SYNC] Récupérer la revue du jour et les archives"
        Write-Host "2. [DEPLOY] Pousser mes nouvelles fonctionnalités"
        Write-Host "3. [REPAIR] Nettoyer les conflits (JSON & IDE)"
        Write-Host "4. [START] Lancer le serveur local (localhost:3000)"
        Write-Host "5. [STATUS] Vérifier l'état et les clés API"
        Write-Host "6. [BUILD] Générer l'APK Android (Debug)"
        Write-Host "Q. Quitter"
        Write-Host "------------------------------------------"
    }

    do {
        Show-Menu
        $choice = Read-Host "Choisissez une option"

        switch ($choice) {
            "1" {
                Write-Host "--- Récupération des données depuis GitHub ---" -ForegroundColor Yellow
                git fetch origin main
                git checkout origin/main -- archives/ revue_presse.json articles.json veille_data.json
                Write-Host "✅ Terminé. Localhost est à jour." -ForegroundColor Green
                Read-Host "Appuyez sur Entrée pour continuer..."
            }
            "2" {
                Write-Host "--- Déploiement sécurisé ---" -ForegroundColor Yellow
                $msg = Read-Host "Message du commit (ex: MAJ CSS)"
                git add .
                
                $hasChanges = (git status --porcelain)
                if ($hasChanges) {
                    git stash
                    Write-Host "📦 Changements locaux mis de côté (stash)." -ForegroundColor Gray
                }

                git pull origin main --rebase -X ours
                
                if ($hasChanges) {
                    git stash pop
                    Write-Host "📥 Changements locaux réappliqués." -ForegroundColor Gray
                }

                git add .
                git commit -m "🚀 $msg" --allow-empty
                git push origin main
                Write-Host "✅ Déploiement réussi sur GitHub et Cloudflare." -ForegroundColor Green
                Read-Host "Appuyez sur Entrée pour continuer..."
            }
            "3" {
                Write-Host "--- Nettoyage des fichiers suivis par erreur ---" -ForegroundColor Yellow
                git rm --cached articles.json revue_presse.json veille_data.json 2>$null
                git rm -r --cached mobile/.idea/ 2>$null
                git checkout -- veille_data.json 2>$null
                Write-Host "✅ Index Git nettoyé." -ForegroundColor Green
                Read-Host "Appuyez sur Entrée pour continuer..."
            }
            "4" {
                Write-Host "--- Lancement du serveur ---" -ForegroundColor Cyan
                node server.js
            }
            "5" {
                Write-Host "--- État du Projet ---" -ForegroundColor Yellow
                Write-Host "Git Status :"
                git status -short
                
                # Recherche de la clé dans l'environnement OU dans le fichier .env
                $apiKey = $env:MISTRAL_API_KEY
                if (-not $apiKey -and (Test-Path ".env")) {
                    $envFile = Get-Content ".env" | ConvertFrom-StringData
                    $apiKey = $envFile["MISTRAL_API_KEY"]
                }

                Write-Host "`nClé Mistral : " -NoNewline
                if ($apiKey) { 
                    Write-Host "✅ Détectée (" -NoNewline
                    Write-Host $apiKey.Substring(0,4) -NoNewline -ForegroundColor Gray
                    Write-Host "...)" -ForegroundColor Green 
                } else { 
                    Write-Host "❌ Introuvable (IA Smart-Generate désactivée)" -ForegroundColor Red 
                }
                Read-Host "Appuyez sur Entrée pour continuer..."
            }
            "6" {
                Write-Host "--- Construction de l'application Android ---" -ForegroundColor Yellow
                if (Test-Path "mobile\gradlew.bat") {
                    Push-Location "mobile"
                    .\gradlew.bat assembleDebug
                    Pop-Location
                    Write-Host "`n✅ Build terminé !" -ForegroundColor Green
                    Write-Host "📍 APK disponible dans : mobile\app\build\outputs\apk\debug" -ForegroundColor Gray
                } else {
                    Write-Host "❌ Erreur : gradlew.bat introuvable dans le dossier mobile." -ForegroundColor Red
                }
                Read-Host "Appuyez sur Entrée pour continuer..."
            }
        }
    } while ($choice -ne "q" -and $choice -ne "Q")
} catch {
    Write-Host ""
    Write-Host "❌ UNE ERREUR TECHNIQUE EST SURVENUE :" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor White
    Write-Host "Détails : $($_.ScriptStackTrace)" -ForegroundColor Gray
    Read-Host "Le script est interrompu. Appuyez sur Entree pour quitter."
}