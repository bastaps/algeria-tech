> ⚠️ **OBSOLÈTE (mis à jour 2026-07-12)** : le mot de passe admin a été **supprimé**.
> Administration = **localhost uniquement** (sans mot de passe). Le site déployé est en
> **lecture seule** (écritures bloquées côté serveur, 403, même via F12). Les mentions de
> mot de passe ci-dessous sont conservées à titre historique.

Voici un fichier **GESTION_GLOBAL.md** complet et structuré, prêt à être sauvegardé dans ton projet :

```markdown
# 📚 ALGERIA TECH - DOCUMENTATION DE RÉFÉRENCE
> **Version:** 2026 | **Projet:** Algeria Tech by Basta  
> **Déploiement:** Cloudflare Pages | **Repo:** github.com/bastaps/algeria-tech

---

## 🔐 SYSTÈME ADMIN - CONTRÔLE D'ACCÈS

### Configuration Actuelle
| Paramètre | Valeur |
|-----------|--------|
| **Mot de passe admin** | `admin-local-sans-mot-de-passe` |
| **Clé localStorage** | `AT_Admin_2026` |
| **Détection localhost** | `window.location.hostname === 'localhost' \|\| '127.0.0.1'` |
| **Raccourci déverrouiller** | `Ctrl + Shift + A` |
| **Raccourci verrouiller** | `Ctrl + Shift + L` |

###  Guide d'Utilisation - Site en Ligne

#### 🟢 Pour accéder au mode admin :
1. Clique sur le petit cadenas **🔒** (en bas à droite, opacité 30%)  
   **OU** fais `Ctrl + Shift + A`
2. Entre le mot de passe : **`admin-local-sans-mot-de-passe`**
3. ✅ Le bouton **"+"** rouge apparaît ✨
4. Le statut est sauvegardé dans ton navigateur (même après fermeture)

#### 🔒 Pour quitter le mode admin :
1. Clique sur le cadenas **🔓** (devenu ouvert)  
   **OU** fais `Ctrl + Shift + L`
2. 🔒 Le bouton **"+"** disparaît immédiatement
3. L'interface redevient "visiteur uniquement"

### 🎨 CSS - Classes Admin (style.css)
```css
/* === ADMIN CONTROLS - VISIBILITY === */
.admin-hidden {
    display: none !important;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
}

.admin-unlock-hint {
    position: fixed; bottom: 30px; right: 30px; 
    width: 50px; height: 50px;
    background: rgba(0,98,51,0.15); 
    border-radius: 50%; 
    display: flex; align-items: center; 
    justify-content: center; 
    cursor: pointer;
    opacity: 0.3; 
    transition: all 0.3s; 
    z-index: 97; 
    font-size: 1.2rem; 
    color: var(--primary);
}

.admin-unlock-hint:hover { 
    opacity: 0.8; 
    transform: scale(1.1); 
}

.admin-unlock-hint.unlocked { 
    background: rgba(210,16,52,0.2); 
    color: var(--secondary); 
    opacity: 0.6; 
}
```

### ⚡ JavaScript - Logique Admin (script.js)
```javascript
// === ADMIN VISIBILITY CONTROL ===
const ADMIN_CONFIG = {
    password: 'admin-local-sans-mot-de-passe',
    unlockKey: 'AT_Admin_2026',
    isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
};

function isAdminUnlocked() {
    if (ADMIN_CONFIG.isLocalhost) return true;
    return localStorage.getItem(ADMIN_CONFIG.unlockKey) === 'unlocked';
}

function unlockAdmin() {
    if (ADMIN_CONFIG.isLocalhost) return true;
    const input = prompt('🔐 Accès Administration Algeria Tech\n\nEntrez le mot de passe:');
    if (input === ADMIN_CONFIG.password) {
        localStorage.setItem(ADMIN_CONFIG.unlockKey, 'unlocked');
        updateAdminVisibility();
        showToast('✅ Mode administrateur activé');
        return true;
    } else if (input !== null) {
        showToast('❌ Mot de passe incorrect');
        return false;
    }
    return false;
}

function lockAdmin() {
    if (ADMIN_CONFIG.isLocalhost) return;
    localStorage.removeItem(ADMIN_CONFIG.unlockKey);
    updateAdminVisibility();
    showToast('🔒 Mode administrateur désactivé');
}

function updateAdminVisibility() {
    const adminBtn = document.getElementById('adminBtn');
    const unlockHint = document.getElementById('adminUnlockHint');
    
    if (ADMIN_CONFIG.isLocalhost) {
        if (adminBtn) adminBtn.classList.remove('admin-hidden');
        if (unlockHint) unlockHint.classList.add('admin-hidden');
        return;
    }
    
    const unlocked = isAdminUnlocked();
    
    if (adminBtn) {
        unlocked ? adminBtn.classList.remove('admin-hidden') : adminBtn.classList.add('admin-hidden');
    }
    
    if (unlockHint) {
        unlocked ? unlockHint.classList.add('unlocked') : unlockHint.classList.remove('unlocked');
        unlockHint.innerHTML = unlocked ? '<i class="fas fa-lock-open"></i>' : '<i class="fas fa-lock"></i>';
        unlockHint.title = unlocked ? 'Cliquez pour verrouiller' : 'Cliquez pour déverrouiller l\'admin';
    }
}

// Initialisation
window.addEventListener('DOMContentLoaded', () => {
    if (!ADMIN_CONFIG.isLocalhost && !document.getElementById('adminUnlockHint')) {
        const btn = document.createElement('div');
        btn.id = 'adminUnlockHint'; 
        btn.className = 'admin-unlock-hint';
        btn.innerHTML = '<i class="fas fa-lock"></i>'; 
        btn.title = 'Cliquez pour déverrouiller l\'admin';
        btn.onclick = () => isAdminUnlocked() ? lockAdmin() : unlockAdmin();
        document.body.appendChild(btn);
    }
    setTimeout(updateAdminVisibility, 100);
    
    // Raccourcis clavier
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'A' && !isAdminUnlocked()) unlockAdmin();
        if (e.ctrlKey && e.shiftKey && e.key === 'L' && isAdminUnlocked()) lockAdmin();
    });
});
```

### 🧹 Astuce de dépannage
Si le bouton reste coincé, ouvre la console du navigateur (F12) et colle :
```javascript
localStorage.removeItem('AT_Admin_2026'); 
location.reload();
```

---

## 🖥️ COMMANDES POWERSHELL - PUSH GITHUB

### 📋 Procédure Complète (Sans Erreur)

```powershell
# ============================================
# ALGERIA TECH - PUSH VERS GITHUB
# ============================================

# 1. Nettoyer les fichiers auto-générés (évite les conflits)
git restore revue_presse.json veille_data.json

# 2. Ajouter UNIQUEMENT les fichiers modifiés manuellement
git add style.css script.js .gitignore

# 3. Commit clair et structuré
git commit -m "feat: Admin visibility control + gitignore cleanup"

# 4. Récupérer les changements distants (rebase = historique propre)
git pull origin main --rebase

# 5. Pousser vers GitHub
git push origin main

# Message de confirmation
Write-Host "✅ Déploiement lancé. Vérifie https://algeria-tech.pages.dev dans 2-3 min." -ForegroundColor Green
```

### 🔧 Commandes Utiles Quotidiennes

```powershell
# Vérifier l'état Git
git status

# Voir les modifications
git diff

# Annuler des modifications locales
git restore <nom_fichier>

# Voir l'historique des commits
git log --oneline -5

# Vérifier la branche actuelle
git branch

# Mettre à jour la branche locale
git pull origin main
```

### ⚠️ Gestion des Erreurs Courantes

#### Erreur: "Updates were rejected because the remote contains work..."
```powershell
# Solution:
git pull origin main --rebase
git push origin main
```

#### Erreur: "Your local changes would be overwritten..."
```powershell
# Solution:
git restore revue_presse.json veille_data.json
git pull origin main
git push origin main
```

---

## 📁 STRUCTURE DU PROJET

### Fichiers Principaux
```
algeria-tech/
├── index.html              # Page principale
├── style.css               # Styles CSS complets
├── script.js               # JavaScript principal
├── server.js               # Backend Node.js (Express)
├── .gitignore              # Fichiers ignorés par Git
├── articles.json           # Liste des articles (auto-généré)
├── revue_presse.json       # Revue de presse (auto-généré)
├── veille_data.json        # Veille techno (auto-généré)
├── articles/               # Articles Markdown
├── images/                 # Images uploadées
├── documents/              # PDF et documents
└── infographies/           # Infographies générées
```

### Fichiers Auto-Générés (À IGNORER dans Git)
```json
{
  "ignore": [
    "revue_presse.json",
    "veille_data.json", 
    "articles.json",
    "infographies/media-list.json",
    "infographies/interactifs-list.json"
  ]
}
```

---

## 🎯 FONCTIONNALITÉS PRINCIPALES

### 1. Gestion des Articles
- **Création:** Via le bouton "+" (admin uniquement)
- **Modification:** Clique sur un article → bouton crayon
- **Suppression:** Dans le modal admin → bouton "Supprimer"
- **Stockage:** Fichiers Markdown dans `/articles/`
- **Métadonnées:** Front Matter YAML (titre, date, catégorie, tags, image, video)

### 2. Veille Technologique
- **Sources RSS:** TSA, Les Enjeux Eco, Algérie360, APS, ITMag, Silicon.fr, ZDNet, TechCrunch, Le Monde, Wired
- **Actualisation:** Toutes les 4 heures automatique
- **Ajout manuel:** Via le bouton "Ajouter un article" dans la section Veille
- **Filtrage:** Par tags et par date

### 3. Revue de Presse IA
- **Génération:** Quotidienne à 06h00
- **Sources:** 20+ sources algériennes et internationales
- **Catégories:** IA, Télécoms, Startups, Innovation, Numérique, Cybersécurité, Réseaux
- **Synthèse IA:** Mistral AI
- **Archives:** Consultables par date

### 4. Lecteur Audio TTS
- **Technologie:** Web Speech API (gratuit)
- **Voix:** Français (Microsoft, Google, Neural)
- **Fonctionnalités:** 
  - Lecture d'article complet
  - Synchronisation visuelle (highlighting)
  - Sélecteur de voix dans la sidebar
  - Raccourci: Bouton "Écouter" dans l'article

### 5. Mode Sombre/Clair
- **Basculement:** Bouton lune/soleil dans le header
- **Persistance:** localStorage
- **Styles:** Variables CSS avec thème complet

### 6. Infographies Automatiques
- **Générateur:** Via API `/api/generate`
- **Formats supportés:** PDF, DOCX, PPTX, TXT
- **Extraction:** Texte + statistiques + graphiques
- **Output:** Dossier multi-fichiers HTML/CSS premium

---

##  DÉPLOIEMENT

### Cloudflare Pages
1. **Lien GitHub:** Connecté automatiquement
2. **Déclencheur:** À chaque `git push` sur `main`
3. **Build:** Automatique (pas de commande nécessaire)
4. **URL:** https://algeria-tech.pages.dev
5. **Délai:** 2-3 minutes après push

### Local (Développement)
```powershell
# Installer les dépendances
npm install

# Démarrer le serveur
npm start
# OU
node server.js

# Accéder à: http://localhost:3000
```

---

## 📊 API ENDPOINTS

### Articles
```
GET    /api/articles                    # Liste des fichiers
GET    /api/article-content/:file       # Contenu d'un article
POST   /api/create-article              # Créer/mettre à jour
DELETE /api/delete-article/:id          # Supprimer
```

### Veille
```
GET    /api/veille                      # Récupérer tous les articles
POST   /api/veille                      # Ajouter manuellement
PUT    /api/veille/:id                  # Modifier
DELETE /api/veille/:id                  # Supprimer
```

### Revue de Presse
```
GET    /api/revue                       # Génération automatique
GET    /archives/:date.json             # Édition archivée
```

### Infographies
```
GET    /api/infographies/media          # Liste des médias
GET    /api/infographies/interactifs    # Présentations interactives
POST   /api/generate                    # Générer infographie
POST   /api/smart-generate              # Rédaction IA
POST   /api/transcribe-pdf              # Extraction PDF
```

### Utilitaires
```
GET    /health                          # Status serveur
GET    /api/generate-static-files       # Générer JSON statiques
```

---

## ️ VARIABLES D'ENVIRONNEMENT

### Fichier `.env` (à créer)
```env
# Serveur
PORT=3000

# GitHub (pour déploiement cloud)
GITHUB_TOKEN=your_github_token_here

# API Mistral AI (pour génération IA)
MISTRAL_API_KEY=your_mistral_api_key_here

# YouTube API (pour vidéos)
YOUTUBE_API_KEY=your_youtube_api_key_here
```

### Clés API Utilisées
| Service | Clé | Usage |
|---------|-----|-------|
| **Mistral AI** | `MISTRAL_API_KEY` | Rédaction auto, synthèse revue de presse |
| **YouTube Data API** | `YOUTUBE_API_KEY` | Récupération vidéos chaîne |
| **Open-Meteo** | (gratuit, sans clé) | Météo Alger |
| **RSS2JSON** | (gratuit, sans clé) | Conversion flux RSS |

---

## 🔒 SÉCURITÉ

### Bonnes Pratiques
1. **Ne jamais commiter** `.env` (déjà dans `.gitignore`)
2. **Changer le mot de passe admin** régulièrement
3. **Utiliser HTTPS** en production (Cloudflare gère)
4. **Limiter l'accès admin** aux IPs de confiance (optionnel)

### Protection des Données
- `veille_data.json` et `revue_presse.json` ignorés (contenu dynamique)
- Images et PDF uploadés sur GitHub (via API)
- Articles stockés en Markdown (versionnés)

---

## 📝 CHECKLIST AVANT PUSH

```markdown
## Checklist Pré-Push
- [ ] Tester en local (localhost:3000)
- [ ] Vérifier que le bouton admin fonctionne
- [ ] Tester la lecture d'un article
- [ ] Vérifier la veille et revue de presse
- [ ] Git add uniquement style.css et script.js
- [ ] Git commit avec message descriptif
- [ ] Git pull --rebase (récupérer changements distants)
- [ ] Git push origin main
- [ ] Attendre 2-3 min pour déploiement Cloudflare
- [ ] Tester sur algeria-tech.pages.dev
```

---

## 🐛 DEBUG & LOGS

### Console Navigateur
```javascript
// Vérifier le statut admin
console.log('Admin Unlocked:', isAdminUnlocked());
console.log('Is Localhost:', window.location.hostname);

// Vider le cache articles
localStorage.removeItem('at_articles_cache');

// Forcer rechargement articles
loadArticles();
```

### Logs Serveur (PowerShell)
```powershell
# Voir les logs en temps réel
npm start

# Les logs apparaissent dans la console:
# [VEILLE] Flux actualisés. Nouveautés: X
# ✅ media-list.json généré avec X fichiers
# 🚀 Algeria Tech · Port 3000 · Générateur activé
```

---

## 📞 SUPPORT & MAINTENANCE

### Fichiers de Log
- `LogFile.txt` - Logs du générateur
- `at-sync.ps1` - Script de synchronisation
- `generate_revue_presse.ps1` - Génération revue

### Ressources Utiles
- **Repo GitHub:** https://github.com/bastaps/algeria-tech
- **Cloudflare Dashboard:** https://dash.cloudflare.com
- **Mistral AI Docs:** https://docs.mistral.ai
- **Cloudflare Pages:** https://pages.cloudflare.com/docs

---

##  LICENSE
© 2026 Algeria Tech by Basta - Tous droits réservés

---

**Dernière mise à jour:** Janvier 2026  
**Maintenu par:** Basta  
**Version du document:** 1.0
```

---

## 📥 Comment utiliser ce fichier :

1. **Copie** tout le contenu ci-dessus
2. **Ouvre** ton éditeur de code (VS Code)
3. **Crée** un nouveau fichier : `GESTION_GLOBAL.md`
4. **Colle** le contenu
5. **Enregistre** dans la racine de ton projet `E:\algeria-tech\`
6. **Commit** si tu veux le versionner :
   ```powershell
   git add REFERENCE_PROJET.md
   git commit -m "docs: Ajout documentation de référence complète"
   git push origin main
   ```

Ce fichier contient **tout** : commandes Git, système admin, architecture, API, et procédures de déploiement. Tu pourras t'y référer à tout moment ! 🚀