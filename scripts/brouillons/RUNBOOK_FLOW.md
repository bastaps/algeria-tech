# Circuit « article vidéo » — procédure de la session planifiée

Objectif : 1 brouillon d'article par créneau (matin, midi, soir) avec **vidéo Google Flow** (si possible) + **version
interactive**. Le résultat est déposé sur GitHub ; le téléphone reçoit une notification ntfy à 3 boutons
(À la Une / 2e position / Brève). Le workflow GitHub « brouillons-publier » publie selon le choix, ou À LA UNE (position 1)
après 90 min sans choix. **Ne rien publier toi-même.** Dossier : `E:\algeria-tech`.

## Règles
- Compte Flow : **bastaps2024@gmail.com uniquement** (URL `https://flow.google.com/u/1/`). Jamais bastaps@gmail.com.
- Ne **jamais** saisir de mot de passe ni de code. Si Google demande une connexion : arrêt + alerte (voir « Échec »).
- Budget : 1 génération par créneau, **10 crédits maximum**. Si Flow annonce plus de 10 crédits : **refuser**.
- Accepter sans demander : dialogue « Droits d'utilisation de cette image » (J'accepte), « Approuver » (une fois, jamais
  « Toujours approuver »), téléchargement du clip. Rien d'autre (pas de paiement, pas de mise à niveau).
- Navigateur : extension **Claude in Chrome** (`mcp__claude-in-chrome__*`, charger via ToolSearch). Ouvrir un nouvel onglet, le fermer à la fin.
- Console : toujours `PYTHONUTF8=1 python ...`.

## Étapes
1. `PYTHONUTF8=1 python scripts/brouillons/circuit_flow.py choisir --slot <matin|midi|soir>`
   (matin = revue de presse ; midi/soir = flux RSS + réseaux sociaux)
   - code 3 = créneau déjà fait aujourd'hui → fin (aucune alerte) ; code 2 = rien de neuf → fin ;
   - code 0 → la dernière ligne JSON donne `ident` et `job`. Lire `job` (image_weserv, image_source, prompt_flow, dossier).
   - `choisir` prend D'ABORD les communiqués publiés par les entreprises / institutions (Djezzy, Algérie Télécom, ministères…), puis
     la presse ; il écarte tout fait déjà publié, en brouillon ou produit par l'autre circuit (anti-doublon). Rien à faire de plus.
   - **On n'anime JAMAIS une image qui montre des personnes réelles** (ministre, président, responsables : la photo EST l'information).
     Lire `job.video_mode` :
     - `aucune` ou `source` → **ne pas ouvrir Flow** : aller directement à l'étape 9 avec `none` (`source` : la vidéo YouTube du média
       qui accompagne l'article est reprise automatiquement ; `raison_video` explique le choix) ;
     - `image_texte` (image sans texte, sans personne) → vidéo « image + texte » : **importer l'image** (étapes 4-5) et taper `prompt_flow`
       TEL QUEL. C'est la recette de l'éditeur : « Génère une vidéo en 16/9 illustrant le texte suivant : « <titre> » ». Le prompt exige que le
       texte soit **affiché à l'écran ET lu à voix haute** par une voix off. Ne rien retirer ni raccourcir de ce prompt ;
     - `image_anime` (l'image contient déjà du texte) → **importer l'image** et taper `prompt_flow` TEL QUEL (animation seule, texte de l'image
       conservé, pas de voix off).
     Après génération, **vérifier avec ffprobe qu'il y a bien une piste audio** pour `image_texte` (la voix off) ; si la vidéo est muette ou
     sans le texte, relancer UNE fois (même prompt) si les crédits le permettent, sinon `none`. Jamais d'autre prompt avec des personnes.
2. Chrome : `tabs_context_mcp`, `tabs_create_mcp`, aller sur `https://flow.google.com/u/1/`. Ouvrir le menu du compte (avatar en haut à droite) :
   l'e-mail doit être bastaps2024@gmail.com ; **lire le solde** (« N crédits Google Flow »). Si l'e-mail est autre : « Changer de compte » →
   choisir bastaps2024 dans la liste (déjà connecté), sans mot de passe.
   **Si N < 10 : pas de vidéo** → passer directement à l'étape 9 avec `none` à la place du clip.
3. « Nouveau projet ». Les réglages de l'agent sont déjà : vidéo 16:9, ×1, Veo 3.1 Lite (à vérifier via l'icône réglages du panneau de droite).
4. Importer l'image (le sélecteur de fichiers natif est inaccessible) : dans l'onglet Flow, `javascript_tool` :
   `fetch(image_weserv)` → `blob` → `new File([blob],'image.jpg',{type:'image/jpeg'})` → `DataTransfer` → `dispatchEvent(new DragEvent('drop',{dataTransfer}))`
   sur l'élément au centre de la page (`dragenter`, `dragover`, `drop`). Si weserv échoue (403) : même chose avec `image_source`.
   Cliquer « J'accepte » dans le dialogue des droits.
5. Panneau droit : bouton « Ajouter des ingrédients au champ du prompt » → choisir l'image → « Ajouter au prompt ».
   Cliquer dans « Que voulez-vous créer ? », taper `prompt_flow` (texte entier, sans le modifier), envoyer. Flow demande « 1 vidéo, X crédits » :
   cliquer **Approuver** si X ≤ 10, sinon **Refuser** (→ étape 9 avec `none`).
6. Attendre la fin (pourcentage → tuile avec ▶), contrôle toutes les ~20 s, 12 min maximum (sinon → étape 9 avec `none`).
7. Ouvrir la vidéo (clic sur la tuile) → icône téléchargement (haut droite) → **720p** (le 1080p est payant : ne pas cliquer « Mettre à niveau »).
8. Le fichier arrive dans `E:\Mon_Profil\Telechargements` (gestionnaire de téléchargement : un `.tmp` est un mp4 valide).
   Prendre le plus récent (< 3 min, > 500 Ko), vérifier avec `ffprobe` (vidéo + audio, ~8 s), le copier vers `<dossier>\clip.mp4`.
9. `PYTHONUTF8=1 python scripts/brouillons/circuit_flow.py finaliser <ident> <dossier>\clip.mp4`
   (ou `... finaliser <ident> none` sans vidéo) : rédaction IA Smart Ingest PRO, carte interactive, dépôt GitHub du brouillon,
   notification ntfy avec boutons. Code 0 = terminé.
10. Fermer l'onglet ouvert. Fin. Résumer en une ligne (titre du brouillon, avec ou sans vidéo).

## Échec
À chaque blocage (connexion demandée, clip introuvable, script en erreur) :
`PYTHONUTF8=1 python scripts/brouillons/circuit_flow.py alerte "<explication courte>"` puis fermer l'onglet et s'arrêter.
Un problème de Flow seul (quota, refus, délai) n'est PAS un échec : on publie le brouillon sans vidéo (`none`).
Ne pas recommencer plus d'une fois.

## Consignes de l'utilisateur (2026-10-21, permanentes)
- Autorisation permanente d'utiliser Google Flow pour générer la vidéo quand elle est requise.
- Si l'image montre un haut responsable algérien (président, ministre, PDG) : garder l'image, PAS de vidéo (`none`), sauf si l'article/communiqué fournit déjà une vidéo.
- Plus de demande de validation par ntfy : l'article est publié automatiquement À LA UNE, position 1 (décision du 2026-10-28), délai 0. La notification ntfy sert seulement à informer ; l'utilisateur modifie/supprime après coup si besoin.

## Règles éditoriales ajoutées le 2026-10-28
- Format = Smart Ingest PRO « Générer avec IA » : le corps commence par « Alger, <date> (Algeria Tech) — <chapô> », puis le développement, « À retenir », « Sources ». Position 1.
- Sources : on cite d'abord la publication d'ORIGINE (site de l'entreprise / institution ou page Facebook officielle). Origine introuvable avec
  plusieurs sites qui publient → « Source : Admin ». Un seul site a publié et les autres le reprennent → on cite ce site.
- Fraîcheur : toute source dont les dates citées en tête sont de plus de 5 jours est écartée (communiqués anciens listés en tête d'un site).
- Ordre des sources : (1) scoops trouvés par l'IA sur sites/pages officiels (scoops.py), (2) communiqués officiels connus (officiels.py), (3) presse.
  Les publications Facebook illisibles sont signalées par ntfy comme « pistes » (elles ne sont jamais inventées).
- Les liens externes d'un article (Sources…) s'ouvrent dans un nouvel onglet.
