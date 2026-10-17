# Administration en ligne (algeria-tech.pages.dev)

## Ce qui existe
- `/admin-login.html` : connexion (identifiant + mot de passe).
- `/smart-ingest-pro.html` : éditeur, **servi uniquement avec une session valide** (sinon redirection vers la connexion).
- `/admin-brouillons.html` : brouillons préparés par l'IA (relire / modifier / publier / rejeter).
- `functions/api/admin/*`, `create-article`, `interactif`, `upload-inline-image`, `delete-article/[id]` : écritures protégées.
- `.github/workflows/brouillons.yml` : 3 passages par jour (7 h, 12 h, 17 h Alger) + notification ntfy.

## Sécurité (ce qui protège réellement)
- Mot de passe stocké **haché** (PBKDF2-SHA256, 100 000 itérations), jamais en clair.
- Session = cookie signé HMAC, `HttpOnly` (illisible par le JavaScript, donc invisible en F12/console), `Secure`, `SameSite=Strict`, 8 h.
- Toute écriture exige la session **et** une requête de même origine (anti-CSRF).
- 5 échecs / 15 min / IP → blocage (+ alerte ntfy). Délai artificiel sur chaque échec.
- Le jeton GitHub n'existe que côté serveur Cloudflare.
- F12 montre le code de la page : il ne contient aucun secret et ne donne aucun accès ; les API répondent 401 sans session.

## Mise en route (à faire une seule fois)
1. En local : `node tools/make-admin-hash.js` → saisir le mot de passe (masqué). Notez `ADMIN_PASSWORD_HASH` et `SESSION_SECRET`.
2. GitHub → Settings → Developer settings → Fine-grained token : dépôt `algeria-tech` uniquement, permission **Contents : Read and write**. C'est `GITHUB_TOKEN`.
3. Cloudflare → Pages → algeria-tech → Settings → Variables and Secrets (type **Secret**, environnement Production) :
   `ADMIN_USER`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `GITHUB_TOKEN`, et `NTFY_TOPIC` (alertes de connexion).
4. Recommandé : Workers & Pages → KV → créer `admin-kv`, le lier au projet sous le nom `ADMIN_KV` (verrouillage anti force brute fiable).
5. Recommandé : Cloudflare → Security → WAF → Rate limiting : 10 requêtes / minute sur `/api/admin/login`.
6. Redéployer le projet Pages (nouveau push ou « Retry deployment »).

Tant que les secrets ne sont pas posés, `/api/admin/login` répond « Administration non configurée » : rien n'est accessible.

## Limites actuelles de l'édition en ligne
Création, modification, suppression, images, cartes interactives et brouillons fonctionnent en ligne.
Les moteurs locaux de Smart Ingest PRO (import d'URL, génération IA via le Hub, régénération du site) ne sont disponibles qu'en localhost.
