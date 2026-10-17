// ── Administration en ligne — briques de sécurité (Cloudflare Pages Functions) ──
// Rien de secret n'est dans le dépôt. Variables d'environnement à définir dans
// Cloudflare Pages → Settings → Variables and Secrets (type « Secret ») :
//   ADMIN_USER            identifiant
//   ADMIN_PASSWORD_HASH   produit par `node tools/make-admin-hash.js` (pbkdf2$…)
//   SESSION_SECRET        longue chaîne aléatoire (≥ 32 caractères)
//   GITHUB_TOKEN          jeton fine-grained, dépôt algeria-tech, « Contents : Read and write »
// Optionnel : un KV nommé ADMIN_KV pour le verrouillage anti force brute.
// La sécurité repose UNIQUEMENT sur ces contrôles serveur : le code de la page,
// lisible en F12, ne contient aucun secret et ne donne aucun accès.

const enc = new TextEncoder();
export const OWNER = 'bastaps';
export const REPO = 'algeria-tech';
export const COOKIE = 'at_admin';
const SESSION_TTL = 8 * 3600; // secondes

export const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }
  });

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const fromB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function hmacKey(secret, usage) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usage);
}

export async function makeSessionCookie(env, user) {
  const payload = b64u(enc.encode(JSON.stringify({ u: user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL })));
  const sig = b64u(await crypto.subtle.sign('HMAC', await hmacKey(env.SESSION_SECRET, ['sign']), enc.encode(payload)));
  return `${COOKIE}=${payload}.${sig}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL}`;
}

export const clearCookie = () => `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;

export async function readSession(request, env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return null;
  const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  if (!m) return null;
  const [payload, sig] = m[1].split('.');
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(env.SESSION_SECRET, ['verify']), fromB64u(sig), enc.encode(payload));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64u(payload)));
    if (!data.exp || data.exp < Date.now() / 1000) return null;
    return data;
  } catch (_) { return null; }
}

// Exige une session valide ; pour toute écriture, exige aussi une requête de même origine (anti-CSRF).
export async function requireAdmin(request, env) {
  const s = await readSession(request, env);
  if (!s) return { error: json({ error: 'Non autorisé.' }, 401) };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('Origin');
    if (!origin || origin !== new URL(request.url).origin) return { error: json({ error: 'Origine refusée.' }, 403) };
  }
  if (!env.GITHUB_TOKEN) return { error: json({ error: 'GITHUB_TOKEN non configuré côté serveur.' }, 500) };
  return { session: s };
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

// Format : pbkdf2$<itérations>$<sel base64>$<hash base64>
export async function verifyPassword(password, stored) {
  const [alg, iter, salt, hash] = (stored || '').split('$');
  if (alg !== 'pbkdf2' || !iter || !salt || !hash) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(salt), iterations: parseInt(iter, 10) }, key, 256);
  return safeEqual(new Uint8Array(bits), fromB64(hash));
}

export async function timingSafeText(a, b) {
  const ha = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(a)));
  const hb = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(b)));
  return safeEqual(ha, hb);
}

// ── Anti force brute : 5 échecs / 15 min / IP (KV si disponible, sinon mémoire de l'isolat) ──
const mem = new Map();
export async function failures(env, ip) {
  if (env.ADMIN_KV) return parseInt(await env.ADMIN_KV.get('rl:' + ip) || '0', 10);
  const e = mem.get(ip); return e && e.exp > Date.now() ? e.n : 0;
}
export async function addFailure(env, ip) {
  const n = (await failures(env, ip)) + 1;
  if (env.ADMIN_KV) await env.ADMIN_KV.put('rl:' + ip, String(n), { expirationTtl: 900 });
  else mem.set(ip, { n, exp: Date.now() + 900000 });
}
export async function clearFailures(env, ip) {
  if (env.ADMIN_KV) await env.ADMIN_KV.delete('rl:' + ip); else mem.delete(ip);
}

// ── GitHub (jeton uniquement côté serveur) ──
const gh = (env, path, init = {}) =>
  fetch(`https://api.github.com/repos/${OWNER}/${REPO}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
      'User-Agent': 'algeria-tech-admin', 'Content-Type': 'application/json', ...(init.headers || {})
    }
  });

export async function ghGet(env, filePath) {
  const r = await gh(env, `contents/${encodeURI(filePath)}?ref=main`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('GitHub lecture ' + r.status);
  return r.json();
}

export function toBase64(bytes) {
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
}

export async function ghPut(env, filePath, content, message) {
  const bytes = typeof content === 'string' ? enc.encode(content) : new Uint8Array(content);
  const existing = await ghGet(env, filePath);
  const r = await gh(env, `contents/${encodeURI(filePath)}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: toBase64(bytes), branch: 'main', ...(existing ? { sha: existing.sha } : {}) })
  });
  if (!r.ok) throw new Error('GitHub écriture ' + r.status + ' : ' + (await r.text()).slice(0, 200));
  return true;
}

export async function ghDelete(env, filePath, message) {
  const existing = await ghGet(env, filePath);
  if (!existing) return false;
  const r = await gh(env, `contents/${encodeURI(filePath)}`, {
    method: 'DELETE', body: JSON.stringify({ message, sha: existing.sha, branch: 'main' })
  });
  if (!r.ok) throw new Error('GitHub suppression ' + r.status);
  return true;
}

export const ghText = async (env, filePath) => {
  const f = await ghGet(env, filePath);
  return f && f.content ? new TextDecoder().decode(fromB64(f.content.replace(/\n/g, ''))) : null;
};

// ── Alerte téléphone (ntfy) : secret NTFY_TOPIC, jamais de donnée sensible dans le message ──
export function notifier(env, waitUntil, titre, message, tags = 'lock') {
  if (!env.NTFY_TOPIC) return;
  const p = fetch('https://ntfy.sh/' + encodeURIComponent(env.NTFY_TOPIC), {
    method: 'POST', body: message, headers: { Title: titre, Tags: tags }
  }).catch(() => {});
  if (waitUntil) waitUntil(p);
}
