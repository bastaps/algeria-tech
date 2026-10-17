import { json, clearCookie } from '../../_lib/admin.js';

export async function onRequestPost({ request }) {
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin) return json({ error: 'Origine refusée.' }, 403);
  return json({ success: true }, 200, { 'Set-Cookie': clearCookie() });
}
