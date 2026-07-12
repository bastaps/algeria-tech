> ⚠️ **OBSOLÈTE (mis à jour 2026-07-12)** : le mot de passe admin a été **supprimé**.
> L'administration est désormais **disponible uniquement en localhost** (ton PC), sans mot de passe.
> Le site déployé (pages.dev / Render) est en **lecture seule** : toute écriture est bloquée
> côté serveur (403), y compris via F12 ou un appel direct à l'API. Les sections ci-dessous
> décrivant un mot de passe ne sont conservées qu'à titre historique.

Voici un **fichier de référence complet**, structuré pour être sauvegardé dans ton projet (ex: `REFERENCE_ADMIN.md`), suivi des **commandes PowerShell optimisées** et du **guide d'utilisation**.

---

# 📁 FICHIER DE RÉFÉRENCE : ALGERIA-TECH ADMIN CONTROL
> 📌 *Sauvegarde ce contenu dans un fichier `GESTION_ADMIN.md` à la racine de ton projet pour ne plus rien oublier.*

## 🔑 Configuration Actuelle
| Paramètre | Valeur |
|-----------|--------|
| **Mot de passe admin** | `admin-local-sans-mot-de-passe` |
| **Clé localStorage** | `AT_Admin_2026` |
| **Détection localhost** | `window.location.hostname === 'localhost' \|\| '127.0.0.1'` |
| **Raccourci déverrouiller** | `Ctrl + Shift + A` |
| **Raccourci verrouiller** | `Ctrl + Shift + L` |

## 🎨 CSS (`style.css`)
```css
/* === ADMIN CONTROLS - VISIBILITY === */
.admin-hidden {
    display: none !important;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
}
.admin-unlock-hint {
    position: fixed; bottom: 30px; right: 30px; width: 50px; height: 50px;
    background: rgba(0,98,51,0.15); border-radius: 50%; display: flex;
    align-items: center; justify-content: center; cursor: pointer;
    opacity: 0.3; transition: all 0.3s; z-index: 97; font-size: 1.2rem; color: var(--primary);
}
.admin-unlock-hint:hover { opacity: 0.8; transform: scale(1.1); }
.admin-unlock-hint.unlocked { background: rgba(210,16,52,0.2); color: var(--secondary); opacity: 0.6; }
```

## ⚡ JavaScript (`script.js`) - Logique Principale
```javascript
// 1. CONFIG & DÉTECTION
const ADMIN_CONFIG = {
    password: 'admin-local-sans-mot-de-passe',
    unlockKey: 'AT_Admin_2026',
    isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
};

// 2. ÉTAT & PERSISTANCE
function isAdminUnlocked() {
    if (ADMIN_CONFIG.isLocalhost) return true;
    return localStorage.getItem(ADMIN_CONFIG.unlockKey) === 'unlocked';
}

// 3. ACTIONS
function unlockAdmin() {
    if (ADMIN_CONFIG.isLocalhost) return true;
    const input = prompt('🔐 Accès Administration Algeria Tech\n\nEntrez le mot de passe:');
    if (input === ADMIN_CONFIG.password) {
        localStorage.setItem(ADMIN_CONFIG.unlockKey, 'unlocked');
        updateAdminVisibility();
        showToast('✅ Mode administrateur activé');
        return true;
    }
    return false;
}

function lockAdmin() {
    if (ADMIN_CONFIG.isLocalhost) return;
    localStorage.removeItem(ADMIN_CONFIG.unlockKey);
    updateAdminVisibility();
    showToast('🔒 Mode administrateur désactivé');
}

// 4. MISE À JOUR UI
function updateAdminVisibility() {
    const adminBtn = document.getElementById('adminBtn');
    const unlockHint = document.getElementById('adminUnlockHint');
    if (ADMIN_CONFIG.isLocalhost) {
        if (adminBtn) adminBtn.classList.remove('admin-hidden');
        if (unlockHint) unlockHint.classList.add('admin-hidden');
        return;
    }
    const unlocked = isAdminUnlocked();
    if (adminBtn) unlocked ? adminBtn.classList.remove('admin-hidden') : adminBtn.classList.add('admin-hidden');
    if (unlockHint) {
        unlocked ? unlockHint.classList.add('unlocked') : unlockHint.classList.remove('unlocked');
        unlockHint.innerHTML = unlocked ? '<i class="fas fa-lock-open"></i>' : '<i class="fas fa-lock"></i>';
        unlockHint.title = unlocked ? 'Cliquez pour verrouiller' : 'Cliquez pour déverrouiller l\'admin';
    }
}

// 5. INITIALISATION & RACCOURCIS
window.addEventListener('DOMContentLoaded', () => {
    if (!ADMIN_CONFIG.isLocalhost && !document.getElementById('adminUnlockHint')) {
        const btn = document.createElement('div');
        btn.id = 'adminUnlockHint'; btn.className = 'admin-unlock-hint';
        btn.innerHTML = '<i class="fas fa-lock"></i>'; btn.title = 'Cliquez pour déverrouiller l\'admin';
        btn.onclick = () => isAdminUnlocked() ? lockAdmin() : unlockAdmin();
        document.body.appendChild(btn);
    }
    setTimeout(updateAdminVisibility, 100);
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'A' && !isAdminUnlocked()) unlockAdmin();
        if (e.ctrlKey && e.shiftKey && e.key === 'L' && isAdminUnlocked()) lockAdmin();
    });
});
```

## 🛡️ Git & Fichiers Ignorés (`.gitignore`)
```text
revue_presse.json
veille_data.json
articles.json
node_modules/
.env
.env.local
*.log
.vscode/settings.json
```

---

# 🖥️ BLOC POWERSHELL : PUSH SANS ERREUR
> 📋 *Copie-colle ce bloc entier dans PowerShell. Il gère automatiquement les fichiers auto-générés et les conflits.*

```powershell
# 1. Nettoyer les fichiers auto-générés (évite les conflits de merge)
git restore revue_presse.json veille_data.json

# 2. Ajouter UNIQUEMENT les fichiers modifiés manuellement
git add style.css script.js .gitignore

# 3. Commit clair et structuré
git commit -m "feat: Admin visibility control + gitignore cleanup"

# 4. Récupérer les changements distants (rebase = historique propre)
git pull origin main --rebase

# 5. Pousser vers GitHub
git push origin main

Write-Host "✅ Déploiement lancé. Vérifie https://algeria-tech.pages.dev dans 2-3 min." -ForegroundColor Green
```

---

# 🔐 GUIDE D'UTILISATION : SITE EN LIGNE

### 🟢 Pour accéder au mode admin :
1. Clique sur le petit cadenas **🔒** (en bas à droite, opacité 30%)  
   **OU** fais `Ctrl + Shift + A`
2. Entre le mot de passe : **`admin-local-sans-mot-de-passe`**
3. ✅ Le bouton **"+"** rouge apparaît ✨
4. Le statut est sauvegardé dans ton navigateur (même après fermeture)

###  Pour quitter le mode admin :
1. Clique sur le cadenas **🔓** (devenu ouvert)  
   **OU** fais `Ctrl + Shift + L`
2. 🔒 Le bouton **"+"** disparaît immédiatement
3. L'interface redevient "visiteur uniquement"

### 🧹 Astuce de dépannage (si le bouton reste coincé) :
Ouvre la console du navigateur (`F12` → `Console`) et colle :
```javascript
localStorage.removeItem('AT_Admin_2026'); location.reload();
```

---

💡 **Conseil de maintenance** :  
- Ne modifie **jamais** `revue_presse.json` ou `veille_data.json` manuellement.  
- Si tu changes le mot de passe, mets à jour `ADMIN_CONFIG.password` dans `script.js` ET note-le dans ce fichier de référence.  
- Cloudflare Pages redéploie automatiquement à chaque `git push`. Vérifie l'onglet *Deployments* dans ton dashboard Cloudflare si le changement ne apparaît pas après 3 min.

Tu as tout sous la main. Dis-moi si tu veux que je te génère un fichier `.md` prêt à télécharger, ou si tu passes à une autre fonctionnalité ! 🚀