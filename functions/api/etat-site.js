// ── Cloudflare Pages Function — /api/etat-site ─────────────────────────────────
// « Est-ce que tout tourne ? » pour l'Assistant Vocal (page privée, session admin exigée par _middleware.js).
// Vérifie la fraîcheur des données publiées (articles, revue, veille, Facebook, podcast, L'info en 30 s)
// et l'état des derniers passages de chaque workflow GitHub Actions (GITHUB_TOKEN côté serveur ; sans jeton, l'API publique).
import { OWNER, REPO } from '../_lib/admin.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });

async function asset(request, env, path) {
  try {
    const url = new URL(path, request.url);
    const r = env.ASSETS ? await env.ASSETS.fetch(url) : await fetch(url);
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

const H = 3600 * 1000;
// Âge en heures d'une date ; l'heure seule des articles est celle d'Alger (UTC+1).
const age = (d) => (Date.now() - new Date(d).getTime()) / H;
const plusRecent = (arr, f) => arr.map(f).filter(Boolean).map(d => new Date(d)).filter(d => !isNaN(d)).sort((a, b) => b - a)[0];

export async function onRequestGet({ request, env }) {
  const [arts, revue, veille, fb, podcast, express, flash] = await Promise.all([
    asset(request, env, '/articles-list.json'), asset(request, env, '/revue_presse.json'), asset(request, env, '/tic_social.json'),
    asset(request, env, '/data/fb-posts.json'), asset(request, env, '/podcast/latest.json'), asset(request, env, '/data/express-latest.json'),
    asset(request, env, '/data/flash-latest.json')
  ]);
  const items = [];
  const check = (nom, date, alerteH, panneH) => {
    if (!date) return items.push({ nom, etat: 'panne', detail: 'aucune donnée' });
    const h = age(date);
    items.push({ nom, etat: h > panneH ? 'panne' : h > alerteH ? 'alerte' : 'ok', heures: Math.round(h * 10) / 10 });
  };
  const listA = Array.isArray(arts) ? arts : (arts?.articles || []);
  check('Articles publiés', plusRecent(listA, a => a.date && `${a.date}T${a.heure || '12:00'}:00+01:00`), 24, 48);
  check('Revue de presse', revue?.lastUpdated || (revue?.edition && revue.edition + 'T06:00:00+01:00'), 26, 50);
  check('Veille institutions & médias', veille?.lastUpdated, 6, 24);
  check('Facebook des entreprises', plusRecent(Array.isArray(fb) ? fb : [], p => p.date), 24, 72);
  check('Podcast', podcast?.genere && podcast.genere + '+01:00', 14, 36);
  check('Flash Info (vidéo)', plusRecent(Array.isArray(flash) ? flash : [], f => f.publishedAt || (f.id && f.id.replace(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2}).*/, '$1-$2-$3T$4:$5:$6+01:00'))), 24, 72);
  check('L\'info en 30 s', plusRecent(Array.isArray(express) ? express : [], e => e.publishedAt || e.date || (e.id && e.id.replace(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2}).*/, '$1-$2-$3T$4:$5:$6Z'))), 24, 72);

  // Workflows GitHub : dernier passage terminé de chacun.
  let workflows = [];
  try {
    const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'AlgeriaTech-Assistant' };
    if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs?per_page=100&status=completed`, { headers });
    if (r.ok) {
      const j = await r.json();
      const vu = new Set();
      for (const run of j.workflow_runs || []) {
        if (vu.has(run.name) || run.event === 'dynamic') continue;   // « dynamic » = mises à jour Dependabot, pas nos robots
        vu.add(run.name);
        workflows.push({ nom: run.name, conclusion: run.conclusion, heures: Math.round(age(run.updated_at) * 10) / 10, url: run.html_url });
      }
    }
  } catch { /* état GitHub indisponible : on garde la fraîcheur des données */ }

  const echecs = workflows.filter(w => w.conclusion === 'failure');
  return json({ items, workflows, echecs, verifie: new Date().toISOString() });
}
