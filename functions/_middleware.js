// Passerelle : l'éditeur Smart Ingest PRO (page, script, styles) n'est servi
// QU'À une session admin valide. Sans connexion : redirection vers la page de
// connexion — le code de l'éditeur n'est même pas envoyé au navigateur.
// (_routes.json limite ce middleware à /smart-ingest-pro*, /admin-brouillons*, /brouillons/* et /api/*.)
// Les brouillons non publiés ne sont donc pas lisibles publiquement non plus.
import { readSession } from './_lib/admin.js';

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/smart-ingest-pro') || url.pathname.startsWith('/admin-brouillons') || url.pathname.startsWith('/brouillons/')) {
    const s = await readSession(request, env);
    if (!s) {
      return Response.redirect(`${url.origin}/admin-login.html?next=${encodeURIComponent(url.pathname + url.search)}`, 302);
    }
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'no-store');
    out.headers.set('X-Frame-Options', 'SAMEORIGIN');
    return out;
  }
  return next();
}
