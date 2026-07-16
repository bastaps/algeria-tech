# Version A — la version du site

C'est **la version officielle**, liée au site à la place de « CV Tech ».

## Comment Kateb fonctionne ici
- **En local** (double-clic sur `index.html`) : Kateb rédige avec son **générateur intégré** (à partir de votre métier, vos mots-clés, vos compétences). Fonctionne immédiatement, sans clé ni serveur.
- **En ligne** (déployé sur le site) : Kateb appelle automatiquement `/api/kateb` → **vraie IA Mistral**. La clé reste **cachée côté serveur** (`/functions/api/kateb.js` à la racine du dépôt).

Aucune manipulation à faire : le fichier détecte tout seul s'il peut joindre l'IA, sinon il bascule sur le générateur local. **Jamais bloqué.**

## Déploiement
- Ce fichier est servi à l'URL `/cv-massar/A-en-ligne/` du site.
- Il faut que la variable **`MISTRAL_API_KEY`** soit définie dans le dashboard Cloudflare Pages (Settings → Environment variables) pour activer la vraie IA. Sinon, le générateur local prend le relais.
