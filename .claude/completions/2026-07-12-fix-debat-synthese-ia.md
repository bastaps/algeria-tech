# Fix — « Débattre avec l'IA » + « Synthèse IA » injoignables

**Date** : 2026-07-12

## Symptômes
- Sur `localhost:3000` : `Réseau : getaddrinfo ENOTFOUND api.mistral.ai`.
- Sur `algeria-tech.pages.dev` / mobile : « Impossible de joindre le serveur. Vérifiez votre connexion. »

## Causes
1. **localhost** : `/api/debat` et `/api/synthese` appelaient Mistral **sans timeout ni retry** → un échec DNS transitoire du host cassait toute la requête.
2. **pages.dev** : hébergement **statique** Cloudflare Pages, **aucun backend** pour `/api/*` (`_redirects` n'a aucune règle `/api`). Le `fetch('/api/debat')` du client tombait sur du non-JSON → `.catch()`.

## Correctifs
1. `server.js` : helper `callMistral()` (timeout 25 s + retry sur ENOTFOUND/EAI_AGAIN/ECONNRESET/ETIMEDOUT/ECONNREFUSED/EPIPE). `/api/debat` et `/api/synthese` refactorés pour l'utiliser + message d'erreur 503 clair sur panne réseau.
2. Cloudflare Pages Functions créées — backend « edge » déployé auto avec le site :
   - `functions/api/debat.js`
   - `functions/api/synthese.js`
   - Clé : `env.MISTRAL_API_KEY` (dashboard CF) avec repli sur la clé du dépôt.

## Vérifié
- `node --check` OK sur les 3 fichiers.
- Serveur relancé sur port 3999 : `/api/debat` → 200 `{reponse}`, `/api/synthese` → 200 `{points[]}`.

## Sécurité — clés API (2026-07-12)
- Clé Mistral **rotée** : nouvelle clé placée dans `.env` (gitignoré) uniquement.
- Clés en dur **retirées** de `server.js` et des 2 Functions → lecture via env uniquement.
- `clé-api.txt` (contenait clé Mistral + 2 clés Google/Gemini `AIzaSy…`) **retiré du suivi git**
  (`git rm --cached`, gardé sur disque) + ajouté au `.gitignore`.
- ⚠️ Clés encore présentes dans l'**historique git** : révoquer côté fournisseur :
  - Mistral : `5AJz…` (ancienne, en dur) + `zLvm…` (ancienne .env)
  - Google/Gemini : les 2 clés `AIzaSy…` de `clé-api.txt`
  - YouTube : `AIzaSyDw_grxm…` en dur dans `script.js` + `dist/script.js` (client-side)

## À faire par l'utilisateur
- **Localhost** : redémarrer le serveur Node (PID 5824) pour charger le fix + la nouvelle clé.
- **pages.dev** : définir `MISTRAL_API_KEY` (nouvelle clé) dans le dashboard CF Pages
  (Settings → Environment variables) — **obligatoire**, plus de fallback en dur — puis `git push`.
- **Révoquer** les anciennes clés listées ci-dessus (elles restent dans l'historique git).
