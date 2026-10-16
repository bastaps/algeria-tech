# Circuit « article vidéo » — procédure de la session planifiée

Objectif : 1 brouillon d'article par jour avec **vidéo Google Flow** + **version interactive**, à valider dans
`/admin-brouillons.html` (notification ntfy). **Ne rien publier.** Dossier : `E:\algeria-tech`.

## Règles
- Compte Flow : **bastaps2024@gmail.com uniquement** (URL `https://flow.google.com/u/1/`). Jamais bastaps@gmail.com.
- Ne **jamais** saisir de mot de passe ni de code. Si Google demande une connexion : arrêt + alerte (voir « Échec »).
- Budget : 1 génération (≤ 10 crédits). Si Flow annonce plus de 10 crédits, ou un quota épuisé : **refuser**, arrêt + alerte.
- Accepter sans demander : dialogue « Droits d'utilisation de cette image » (J'accepte), « Approuver » (une fois, jamais
  « Toujours approuver »), téléchargement du clip. Rien d'autre (pas de paiement, pas de mise à niveau).
- Navigateur : extension **Claude in Chrome** (`mcp__claude-in-chrome__*`, charger via ToolSearch). Ouvrir un nouvel onglet, le fermer à la fin.
- Console : toujours `PYTHONUTF8=1 python ...`.

## Étapes
1. `PYTHONUTF8=1 python scripts/brouillons/circuit_flow.py choisir`
   - code 3 = quota du jour déjà utilisé → fin (aucune alerte) ; code 2 = rien de neuf → fin ;
   - code 0 → la dernière ligne JSON donne `ident` et `job`. Lire `job` (image_weserv, image_source, prompt_flow, dossier).
2. Chrome : `tabs_context_mcp`, `tabs_create_mcp`, aller sur `https://flow.google.com/u/1/`. Vérifier le compte (avatar en haut à droite :
   « A », pas de badge PRO ; en cas de doute cliquer l'avatar et lire l'e-mail : doit être bastaps2024@gmail.com).
   Sinon « Changer de compte » → choisir bastaps2024 dans la liste (déjà connecté). Pas de mot de passe.
3. « Nouveau projet ». Les réglages de l'agent sont déjà : vidéo 16:9, ×1, Veo 3.1 Lite (à vérifier via l'icône réglages du panneau de droite).
4. Importer l'image (le sélecteur de fichiers natif est inaccessible) : dans l'onglet Flow, `javascript_tool` :
   `fetch(image_weserv)` → `blob` → `new File([blob],'image.jpg',{type:'image/jpeg'})` → `DataTransfer` → `dispatchEvent(new DragEvent('drop',{dataTransfer}))`
   sur l'élément au centre de la page (`dragenter`, `dragover`, `drop`). Si weserv échoue (403) : même chose avec `image_source`.
   Cliquer « J'accepte » dans le dialogue des droits.
5. Panneau droit : bouton « Ajouter des ingrédients au champ du prompt » → choisir l'image → « Ajouter au prompt ».
   Cliquer dans « Que voulez-vous créer ? », taper `prompt_flow`, envoyer. Flow demande « 1 vidéo, X crédits » :
   cliquer **Approuver** si X ≤ 10, sinon **Refuser**.
6. Attendre la fin (pourcentage → tuile avec ▶), contrôle toutes les ~20 s, 12 min maximum.
7. Ouvrir la vidéo (clic sur la tuile) → icône téléchargement (haut droite) → **720p** (le 1080p est payant : ne pas cliquer « Mettre à niveau »).
8. Le fichier arrive dans `E:\Mon_Profil\Telechargements` (gestionnaire de téléchargement : un `.tmp` est un mp4 valide).
   Prendre le plus récent (< 3 min, > 500 Ko), vérifier avec `ffprobe` (vidéo + audio, ~8 s), le copier vers `<dossier>\clip.mp4`.
9. `PYTHONUTF8=1 python scripts/brouillons/circuit_flow.py finaliser <ident> <dossier>\clip.mp4`
   (rédaction IA Smart Ingest PRO, carte interactive, dépôt GitHub du brouillon, notification ntfy). Code 0 = terminé.
10. Fermer l'onglet ouvert. Fin. Résumer en une ligne (titre du brouillon).

## Échec
À chaque blocage (connexion demandée, quota Flow épuisé, génération refusée ou > 12 min, clip introuvable, script en erreur) :
`PYTHONUTF8=1 python scripts/brouillons/circuit_flow.py alerte "<explication courte>"` puis fermer l'onglet et s'arrêter.
Ne pas recommencer plus d'une fois.
