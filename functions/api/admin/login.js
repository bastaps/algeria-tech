import { json, makeSessionCookie, verifyPassword, timingSafeText, failures, addFailure, clearFailures, notifier } from '../../_lib/admin.js';

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.ADMIN_USER || !env.ADMIN_PASSWORD_HASH || !env.SESSION_SECRET) return json({ error: 'Administration non configurée.' }, 503);
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin) return json({ error: 'Origine refusée.' }, 403);
  const ip = request.headers.get('CF-Connecting-IP') || 'inconnu';
  if ((await failures(env, ip)) >= 5) {
    notifier(env, waitUntil, 'Admin : verrouillage', 'Trop de tentatives de connexion (' + ((request.cf && request.cf.country) || '?') + ').', 'warning');
    return json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' }, 429);
  }

  let body = {};
  try { body = await request.json(); } catch (_) {}
  const user = String(body.user || '').slice(0, 100), password = String(body.password || '').slice(0, 200);
  // Les deux vérifications sont toujours exécutées (pas de fuite par le temps de réponse).
  const okUser = await timingSafeText(user, env.ADMIN_USER);
  const okPass = await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
  if (!(okUser && okPass)) {
    await addFailure(env, ip);
    await new Promise(r => setTimeout(r, 700));
    return json({ error: 'Identifiant ou mot de passe incorrect.' }, 401);
  }
  await clearFailures(env, ip);
  notifier(env, waitUntil, 'Admin : connexion', 'Connexion réussie (' + ((request.cf && request.cf.country) || '?') + ').', 'key');
  return json({ success: true }, 200, { 'Set-Cookie': await makeSessionCookie(env, env.ADMIN_USER) });
}
