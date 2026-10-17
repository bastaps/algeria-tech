import { json, readSession } from '../../_lib/admin.js';

export async function onRequestGet({ request, env }) {
  return json({ admin: !!(await readSession(request, env)) });
}
