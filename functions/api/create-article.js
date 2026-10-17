// POST /api/create-article — création / modification d'un article EN LIGNE.
// Même contrat que le Hub local (server.js) : Smart Ingest PRO n'a rien à changer.
// Session admin obligatoire ; le jeton GitHub reste côté serveur.
// Cloudflare reconstruit articles.json / articles-list.json (build.js) au déploiement.
import { json, requireAdmin, ghPut, ghText } from '../_lib/admin.js';

const clean = (v) => String(v == null ? '' : v);
const q = (v) => clean(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  try {
    const f = await request.formData();
    const g = (k) => clean(f.get(k));
    const id = /^[0-9]{6,20}$/.test(g('id')) ? g('id') : String(Date.now());
    const titre = g('titre'), categorie = g('categorie');
    if (!titre.trim() || !categorie.trim() || !g('contenu').trim()) return json({ message: 'Titre, catégorie et contenu sont requis.' }, 400);

    let imagePath = g('existingImage');
    const img = f.get('image');
    if (img && typeof img === 'object' && img.size > 0) {
      if (img.size > 12 * 1024 * 1024) return json({ message: 'Image trop lourde (12 Mo max).' }, 413);
      const ext = (img.name.match(/\.(jpe?g|png|gif|webp|avif)$/i) || ['', 'jpg'])[1].toLowerCase();
      imagePath = `images/${Date.now()}.${ext}`;
      await ghPut(env, imagePath, await img.arrayBuffer(), 'Admin : image ' + id);
    }
    let pdfPath = g('existingPdf');
    const pdf = f.get('pdf');
    if (pdf && typeof pdf === 'object' && pdf.size > 0) {
      if (pdf.size > 20 * 1024 * 1024) return json({ message: 'PDF trop lourd (20 Mo max).' }, 413);
      pdfPath = `documents/${Date.now()}.pdf`;
      await ghPut(env, pdfPath, await pdf.arrayBuffer(), 'Admin : document ' + id);
    }

    const position = g('position');
    const tags = g('tags').split(',').map(t => t.trim().replace(/"/g, '')).filter(Boolean).map(t => `"${t}"`).join(', ');
    const md = `---
titre: "${q(titre)}"
categorie: ${categorie.replace(/[\r\n]/g, ' ')}
date: ${g('date')}
heure: ${g('heure')}
image: "${q(imagePath)}"
pdf: "${q(pdfPath)}"
video: "${q(g('video'))}"
source: "${q(g('source'))}"
extrait: "${q(g('extrait'))}"
tags: [${tags}]
type: ${g('type').replace(/[\r\n]/g, ' ')}
position: ${position}
interactif: "${q(g('interactif'))}"
aretenir: "${q(g('aretenir'))}"
mediaPriority: ${g('mediaPriority') || 'video'}
---

${g('contenu')}
`;

    // Une seule Une par position : on libère l'ancien titulaire (via la liste publiée).
    if (position === '1' || position === '2') {
      try {
        const list = JSON.parse((await ghText(env, 'articles-list.json')) || '[]');
        for (const a of list.filter(a => String(a.position) === position && String(a.id) !== id).slice(0, 3)) {
          const old = await ghText(env, `articles/${a.id}.md`);
          if (old) await ghPut(env, `articles/${a.id}.md`, old.replace(new RegExp(`^position:\\s*${position}\\s*$`, 'm'), 'position: '), 'Admin : libère la position ' + position);
        }
      } catch (_) { /* non bloquant */ }
    }

    await ghPut(env, `articles/${id}.md`, md, 'Admin : ' + titre.slice(0, 80));
    return json({ success: true, id, message: 'Enregistré sur GitHub — en ligne dans ~1 min.' });
  } catch (e) {
    return json({ message: e.message || 'Erreur serveur' }, 500);
  }
}
