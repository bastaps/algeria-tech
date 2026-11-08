import { json, clearCookie } from '../../_lib/admin.js';

export async function onRequestPost({ request }) {
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin) return json({ error: 'Origine refusée.' }, 403);
  const res = json({ success: true });
  res.headers.append('Set-Cookie', clearCookie());
  res.headers.append('Set-Cookie', 'at_ui=; Secure; SameSite=Lax; Path=/; Max-Age=0');
  return res;
}
