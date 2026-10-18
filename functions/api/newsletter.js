// POST /api/newsletter — inscription à la newsletter. L'adresse est transmise à un petit script Google (Apps Script)
// relié à la boîte algeriatech2026@gmail.com : il l'ajoute à une feuille « Abonnés » et envoie un e-mail de notification.
// Variable Cloudflare requise : NEWSLETTER_WEBHOOK (URL de l'application web Apps Script). Sans elle : 503 poli.
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  let d;
  try { d = await request.json(); } catch { return json({ message: 'Requête invalide.' }, 400); }
  if (d && d.website) return json({ success: true });            // piège anti-robots (champ caché rempli)
  const email = String((d && d.email) || '').trim().toLowerCase();
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ message: 'Adresse e-mail invalide.' }, 400);
  if (!env.NEWSLETTER_WEBHOOK) return json({ message: "L'inscription ouvre bientôt. Merci de repasser un peu plus tard." }, 503);
  try {
    const r = await fetch(env.NEWSLETTER_WEBHOOK, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ email, date: new Date().toISOString(), source: 'site' })
    });
    if (!r.ok) throw new Error('webhook ' + r.status);
    return json({ success: true });
  } catch (e) {
    return json({ message: "Inscription impossible pour le moment. Réessayez plus tard." }, 502);
  }
}
