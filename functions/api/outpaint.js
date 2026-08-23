// ── Cloudflare Pages Function — /api/outpaint ─────────────────────────────────
// Outpainting (extension générative du décor) pour la Station d'Image.
// Le client envoie une image déjà mise au format cible par le moteur local
// (image d'origine intacte au centre + décor prolongé sur les côtés) et un
// masque blanc sur les zones à réinventer. Le modèle ne repeint QUE le masque.
//
// Deux fournisseurs, dans cet ordre :
//   1. Workers AI  — binding `AI` (Pages → Settings → Functions → AI bindings)
//   2. Stability   — variable d'environnement `STABILITY_API_KEY`
// Aucune clé en dur : ce dépôt est public.
//
// Réponse : { image: "data:image/png;base64,…", moteur: "workers-ai" | "stability" }
// En cas d'indisponibilité, le client garde silencieusement son rendu local.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });

const MODELE_WAI = '@cf/runwayml/stable-diffusion-v1-5-inpainting';
// Mode créatif : SDXL accepte aussi un masque et compose des scènes bien plus riches.
const MODELE_CREATIF = '@cf/stabilityai/stable-diffusion-xl-base-1.0';
// Description de l'image, pour construire un prompt qui parle vraiment du visuel.
const MODELE_VISION = '@cf/llava-hf/llava-1.5-7b-hf';

// Le mode créatif a le droit d'inventer des objets : on ne lui interdit que ce qui
// abîmerait la marque (texte, logos) ou trahirait la génération (visages ratés).
const NEGATIF_CREATIF =
  'text, letters, words, arabic script, typography, logo, watermark, signature, ' +
  'deformed faces, extra limbs, distorted hands, low quality, blurry, jpeg artifacts';
const STYLE_CREATIF =
  'high quality advertising photography, coherent scene, consistent lighting and ' +
  'perspective with the original, professional composition';

const PROMPT_DEFAUT =
  'seamless background extension, same style, same colors, same lighting, ' +
  'clean uncluttered continuation of the existing background, no text, no letters, ' +
  'no logo, no watermark, no people, no new objects';
const NEGATIF_DEFAUT =
  'text, letters, words, typography, logo, watermark, signature, faces, people, ' +
  'duplicated objects, seam, border, frame, blurry artifacts, distorted';

/* base64 (avec ou sans préfixe data:) → Uint8Array */
function versOctets(b64) {
  const brut = String(b64 || '').replace(/^data:[^,]+,/, '');
  const bin = atob(brut);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function versBase64(octets) {
  let s = '';
  const u = new Uint8Array(octets);
  const pas = 0x8000;
  for (let i = 0; i < u.length; i += pas) s += String.fromCharCode.apply(null, u.subarray(i, i + pas));
  return btoa(s);
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Requête invalide.' }, 400); }

  const { image, mask, prompt, width, height, mode, seed, action } = body || {};

  // ── Action « décrire » : LLaVA raconte l'image, le client s'en sert de prompt ──
  if (action === 'decrire') {
    if (!image) return json({ error: 'image requise.' }, 400);
    if (!env.AI) return json({ error: 'Description non configurée (binding AI absent).' }, 503);
    try {
      const r = await env.AI.run(MODELE_VISION, {
        image: [...versOctets(image)],
        prompt: "Describe this advertising visual in one short English sentence: the setting, " +
                "the main subject, the colors and the mood. Do not mention any text or logo.",
        max_tokens: 96
      });
      const texte = String((r && (r.description || r.response)) || '').trim().replace(/\s+/g, ' ');
      if (!texte) return json({ error: 'Description vide.' }, 502);
      return json({ description: texte.slice(0, 300), moteur: 'llava' });
    } catch (e) {
      return json({ error: 'Description indisponible.' }, 502);
    }
  }

  if (!image || !mask) return json({ error: 'image et mask requis.' }, 400);

  const w = Math.round(Number(width) || 0), h = Math.round(Number(height) || 0);
  if (!w || !h || w % 8 || h % 8) return json({ error: 'width/height doivent être des multiples de 8.' }, 400);
  if (w * h > 1600 * 1600) return json({ error: 'Image trop grande (max ~2,5 Mpx).' }, 413);

  let octetsImage, octetsMasque;
  try { octetsImage = versOctets(image); octetsMasque = versOctets(mask); }
  catch { return json({ error: 'Encodage base64 invalide.' }, 400); }

  const creatif = mode === 'creatif';
  const consigne = String(prompt || '').slice(0, 400) ||
                   (creatif ? STYLE_CREATIF : PROMPT_DEFAUT);

  // ── 0. Mode créatif : SDXL, autorisé à inventer la scène ────────────────────
  if (creatif && env.AI) {
    try {
      const r = await env.AI.run(MODELE_CREATIF, {
        prompt: consigne + ', ' + STYLE_CREATIF,
        negative_prompt: NEGATIF_CREATIF,
        image_b64: String(image).replace(/^data:[^,]+,/, ''),
        mask: [...octetsMasque],
        width: w,
        height: h,
        strength: 1,
        guidance: 6.5,
        num_steps: 20,
        seed: Number.isFinite(Number(seed)) ? Number(seed) : Math.floor(Math.random() * 1e9)
      });
      const buf = r instanceof ReadableStream ? await new Response(r).arrayBuffer()
                : r instanceof ArrayBuffer ? r
                : r && r.image ? versOctets(r.image).buffer
                : null;
      if (buf) return json({
        image: 'data:image/png;base64,' + versBase64(buf),
        moteur: 'sdxl-creatif',
        prompt: consigne
      });
      return json({ error: 'Le modèle créatif n\'a rien renvoyé.' }, 502);
    } catch (e) {
      return json({ error: 'Mode créatif indisponible : ' + String(e.message || e).slice(0, 160) }, 502);
    }
  }

  // ── 1. Workers AI ───────────────────────────────────────────────────────────
  if (env.AI) {
    try {
      const r = await env.AI.run(MODELE_WAI, {
        prompt: consigne,
        negative_prompt: NEGATIF_DEFAUT,
        image: [...octetsImage],
        mask: [...octetsMasque],
        width: w,
        height: h,
        strength: 0.92,
        guidance: 7.5,
        num_steps: 20
      });
      const buf = r instanceof ReadableStream ? await new Response(r).arrayBuffer()
                : r instanceof ArrayBuffer ? r
                : r && r.image ? versOctets(r.image).buffer
                : null;
      if (buf) return json({ image: 'data:image/png;base64,' + versBase64(buf), moteur: 'workers-ai' });
    } catch (e) {
      // on tente le fournisseur suivant
    }
  }

  // ── 2. Stability (inpainting v2beta) ────────────────────────────────────────
  if (env.STABILITY_API_KEY) {
    try {
      const fd = new FormData();
      fd.append('image', new Blob([octetsImage], { type: 'image/png' }), 'image.png');
      fd.append('mask', new Blob([octetsMasque], { type: 'image/png' }), 'mask.png');
      fd.append('prompt', consigne);
      fd.append('negative_prompt', NEGATIF_DEFAUT);
      fd.append('output_format', 'png');
      const res = await fetch('https://api.stability.ai/v2beta/stable-image/edit/inpaint', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.STABILITY_API_KEY}`, Accept: 'image/*' },
        body: fd
      });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        return json({ image: 'data:image/png;base64,' + versBase64(buf), moteur: 'stability' });
      }
      const txt = await res.text();
      return json({ error: `Fournisseur indisponible (${res.status}).`, detail: txt.slice(0, 300) }, 502);
    } catch (e) {
      return json({ error: 'Fournisseur injoignable.' }, 502);
    }
  }

  return json({ error: "Outpainting non configuré (ni binding AI, ni STABILITY_API_KEY)." }, 503);
}

export async function onRequestGet({ env }) {
  return json({
    service: 'outpaint',
    disponible: Boolean(env.AI || env.STABILITY_API_KEY),
    moteurs: [env.AI ? 'workers-ai' : null, env.STABILITY_API_KEY ? 'stability' : null].filter(Boolean)
  });
}
