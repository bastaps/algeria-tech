# ═══════════════════════════════════════════════════════════════════
# Algeria Tech — Assistant configuration RSS.app
# Lance le navigateur avec toutes les pages Facebook à configurer
# Répartition sur 3 comptes gratuits (5 feeds chacun = 15 total)
# Usage : .\setup_rssapp.ps1
# ═══════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Algeria Tech — Configuration RSS.app (3 comptes)       ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "PRINCIPE : RSS.app gratuit = 5 feeds par compte." -ForegroundColor Yellow
Write-Host "           3 comptes × 5 = 15 pages Facebook couvertes." -ForegroundColor Yellow
Write-Host ""
Write-Host "ETAPES pour chaque page :" -ForegroundColor Cyan
Write-Host "  1. Allez sur rss.app → Create RSS Feed" -ForegroundColor White
Write-Host "  2. Collez l'URL Facebook de la page" -ForegroundColor White
Write-Host "  3. Copiez l'URL RSS générée (ex: https://rss.app/feeds/XXXXX.xml)" -ForegroundColor White
Write-Host "  4. Collez-la dans social_config.json → champ 'rss_url'" -ForegroundColor White
Write-Host ""

# ── Répartition des 14 pages sur 3 comptes ──────────────────────────────────
$compte1 = @(
    @{ name="Ooredoo Algérie";        url="https://www.facebook.com/OoredooDZ" },
    @{ name="Djezzy";                  url="https://www.facebook.com/djezzy" },
    @{ name="Mobilis";                 url="https://www.facebook.com/MobilisOfficielle" },
    @{ name="MPT (Ministère TIC)";     url="https://www.facebook.com/mpt.gov.dz" },
    @{ name="Algérie Télécom";         url="https://www.facebook.com/AlgerieTelecom" }
)

$compte2 = @(
    @{ name="Algérie Poste";           url="https://www.facebook.com/algerieposteofficiel" },
    @{ name="ATS Satellite";           url="https://www.facebook.com/atsofficiel" },
    @{ name="MKESME (Startups)";       url="https://www.facebook.com/mkesme.dz" },
    @{ name="MESRS";                   url="https://www.facebook.com/mesrs.dz" },
    @{ name="Huawei Mobile DZ";        url="https://www.facebook.com/HuaweimobileDZ" }
)

$compte3 = @(
    @{ name="Huawei Global";           url="https://www.facebook.com/huawei" },
    @{ name="Condor Electronics";      url="https://www.facebook.com/Condor.Electromenager" },
    @{ name="Stream System";           url="https://www.facebook.com/streamsystem" },
    @{ name="ARPCE";                   url="https://www.facebook.com/ARPCE.DZ" }
)

# ── Afficher la répartition ──────────────────────────────────────────────────
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  COMPTE 1 — email: email1@exemple.com  (5 feeds prioritaires)" -ForegroundColor Magenta
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor DarkGray
foreach ($p in $compte1) { Write-Host "  • $($p.name)" -ForegroundColor White }

Write-Host ""
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  COMPTE 2 — email: email2@exemple.com  (5 feeds gouvernement)" -ForegroundColor Magenta
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor DarkGray
foreach ($p in $compte2) { Write-Host "  • $($p.name)" -ForegroundColor White }

Write-Host ""
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  COMPTE 3 — email: email3@exemple.com  (5 feeds équipementiers)" -ForegroundColor Magenta
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor DarkGray
foreach ($p in $compte3) { Write-Host "  • $($p.name)" -ForegroundColor White }

Write-Host ""

# ── Ouvrir les onglets ───────────────────────────────────────────────────────
$open = Read-Host "Ouvrir rss.app + les 14 pages Facebook dans le navigateur ? (O/N)"

if ($open -eq "O" -or $open -eq "o" -or $open -eq "oui") {

    Write-Host ""
    Write-Host "Ouverture de rss.app..." -ForegroundColor Cyan
    Start-Process "https://rss.app/account/register"
    Start-Sleep -Seconds 2

    Write-Host "Ouverture des pages Facebook (Compte 1)..." -ForegroundColor Yellow
    foreach ($p in $compte1) {
        Start-Process $p.url
        Start-Sleep -Milliseconds 500
    }

    Start-Sleep -Seconds 3
    Write-Host "Ouverture des pages Facebook (Compte 2)..." -ForegroundColor Yellow
    foreach ($p in $compte2) {
        Start-Process $p.url
        Start-Sleep -Milliseconds 500
    }

    Start-Sleep -Seconds 3
    Write-Host "Ouverture des pages Facebook (Compte 3)..." -ForegroundColor Yellow
    foreach ($p in $compte3) {
        Start-Process $p.url
        Start-Sleep -Milliseconds 500
    }

    Write-Host ""
    Write-Host "✅ Onglets ouverts ! Suivez les étapes pour chaque page." -ForegroundColor Green
}

# ── Aide: config sociale ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "──────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "APRES la config, relancez la mise à jour :" -ForegroundColor Cyan
Write-Host "  python fetch_social.py --no-translate" -ForegroundColor White
Write-Host "  → Ou automatiquement : .\setup_scheduler.ps1" -ForegroundColor White
Write-Host ""
Write-Host "Config : E:\algeria-tech\social_config.json" -ForegroundColor Gray
Write-Host "──────────────────────────────────────────────────────────" -ForegroundColor DarkGray
