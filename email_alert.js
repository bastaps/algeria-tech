'use strict';
/* ═══════════════════════════════════════════════════════════════
   EMAIL_ALERT.JS — Algeria Tech
   Alertes email automatiques : nouveaux textes réglementaires
   ─────────────────────────────────────────────────────────────
   Config .env requise :
     SMTP_HOST     smtp-relay.brevo.com (Brevo) | smtp.gmail.com
     SMTP_PORT     587
     SMTP_USER     votre-login@smtp-provider.com
     SMTP_PASS     votre-mot-de-passe-ou-api-key
     SMTP_FROM     Algeria Tech Veille <no-reply@algeria-tech.dz>
     BASE_URL      https://algeria-tech.pages.dev  (pour les liens)
═══════════════════════════════════════════════════════════════ */

const nodemailer = require('nodemailer');
const https      = require('https');
const crypto     = require('crypto');
const path       = require('path');
const fs         = require('fs');

const SUBS_FILE  = path.join(__dirname, 'subscribers.json');
const BASE_URL   = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

/* ═══════════════════════════════════════════════════════════════
   PERSISTANCE ABONNÉS
═══════════════════════════════════════════════════════════════ */
function loadSubs() {
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8')); }
  catch { return { list: [], lastAlert: null }; }
}
function saveSubs(d) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(d, null, 2));
}

/* ── Ajouter un abonné ─────────────────────────────────────── */
function subscribe(email) {
  email = (email || '').toLowerCase().trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, error: 'Email invalide.' };

  const data = loadSubs();
  if (data.list.find(s => s.email === email))
    return { ok: false, error: 'Déjà abonné.' };

  const token = crypto.randomBytes(20).toString('hex');
  data.list.push({ email, token, subscribedAt: new Date().toISOString() });
  saveSubs(data);
  console.log(`[EMAIL] ✅ Abonné : ${email}`);
  return { ok: true, message: `Inscription confirmée pour ${email}.` };
}

/* ── Supprimer un abonné par token ─────────────────────────── */
function unsubscribe(token) {
  const data = loadSubs();
  const before = data.list.length;
  data.list = data.list.filter(s => s.token !== token);
  if (data.list.length === before) return { ok: false, error: 'Token inconnu.' };
  saveSubs(data);
  return { ok: true };
}

/* ── Lister les abonnés ────────────────────────────────────── */
function getSubscribers() {
  return loadSubs().list;
}

/* ═══════════════════════════════════════════════════════════════
   RÉSUMÉ MISTRAL — 3 points clés d'un texte réglementaire
═══════════════════════════════════════════════════════════════ */
function generateSummary(texte, apiKey) {
  const src   = texte.source === 'ARPCE' ? 'publication ARPCE' : 'texte du Journal Officiel Algérien';
  const desc  = texte.pertinence || texte.description || '';
  const prompt =
`Tu es un expert juridique en réglementation TIC algérienne.
Résume ce ${src} en EXACTEMENT 3 points courts (1 phrase chacun, max 25 mots par point), en français, sans numérotation.
Chaque point doit être factuel, précis, accessible au lecteur non-juriste.
Réponds UNIQUEMENT en JSON : { "points": ["point1", "point2", "point3"] }

Texte : ${texte.type || ''} ${texte.numero ? 'N°' + texte.numero : ''} — ${texte.titre}
${desc ? 'Contexte : ' + desc.substring(0, 300) : ''}`;

  const payload = JSON.stringify({
    model:           'mistral-small-latest',
    messages:        [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature:     0.1,
    max_tokens:      300,
  });

  return new Promise((resolve) => {
    const opts = {
      hostname: 'api.mistral.ai',
      path:     '/v1/chat/completions',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(raw);
          const p = JSON.parse(r.choices[0].message.content);
          resolve(Array.isArray(p.points) ? p.points.slice(0, 3) : []);
        } catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.setTimeout(20000, () => { req.destroy(); resolve([]); });
    req.write(payload);
    req.end();
  });
}

/* ═══════════════════════════════════════════════════════════════
   TEMPLATE EMAIL HTML
═══════════════════════════════════════════════════════════════ */
function buildEmailHTML(batches, unsubToken) {
  const unsubLink = `${BASE_URL}/api/unsubscribe?token=${unsubToken}`;
  const siteLink  = `${BASE_URL}/reglementaire`;

  const typeIcons = {
    'Loi':                 '⚖️',
    'Décret présidentiel': '👑',
    'Décret exécutif':     '🔨',
    'Arrêté':              '📋',
    "Appel d'offres":      '🤝',
    'Communiqué':          '📢',
    'Décision':            '⚡',
    'Avis':                'ℹ️',
    'Rapport':             '📊',
    'Consultation publique':'💬',
  };

  const totalTexts = batches.length;
  const today = new Date().toLocaleDateString('fr-DZ', { day:'numeric', month:'long', year:'numeric' });
  const sourceLabel = batches.every(b => b.source === 'ARPCE') ? 'ARPCE'
                    : batches.every(b => b.source !== 'ARPCE') ? 'Journal Officiel'
                    : 'Journal Officiel & ARPCE';

  const cardsHTML = batches.map(b => {
    const icon      = typeIcons[b.texte.type] || '📜';
    const joRef     = b.texte.source === 'ARPCE'
      ? `<span style="color:#388e3c">ARPCE</span>`
      : `<span style="color:#1565c0">JO N°${b.texte.jo_numero || ''} · ${b.texte.jo_date_fr || ''}</span>`;
    const link      = b.texte.url || b.texte.jo_url || siteLink;
    const btnColor  = b.texte.source === 'ARPCE' ? '#2e7d32' : '#1a237e';

    const pointsHTML = b.points.length
      ? `<p style="margin:14px 0 6px;font-weight:700;color:#333;font-size:14px">Résumé en 3 points :</p>
         <ul style="margin:0;padding-left:18px;color:#444;font-size:14px;line-height:1.7">
           ${b.points.map(p => `<li>${p}</li>`).join('')}
         </ul>`
      : `<p style="color:#666;font-size:13px;font-style:italic">${b.texte.pertinence || b.texte.description || ''}</p>`;

    return `
    <div style="background:#f9f9fb;border-left:4px solid ${btnColor};border-radius:6px;padding:18px 20px;margin:18px 0">
      <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:6px">
        <span style="font-size:20px">${icon}</span>
        <span style="background:#e8eaf6;color:#3f51b5;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:.03em">${b.texte.type || 'Texte réglementaire'}</span>
        <span style="font-size:12px;color:#888">${joRef}</span>
      </div>
      <h3 style="margin:8px 0 4px;color:#111;font-size:15px;line-height:1.4;font-weight:700">${b.texte.titre}</h3>
      ${b.texte.numero ? `<p style="margin:0 0 10px;color:#888;font-size:12px">Référence : N° ${b.texte.numero}</p>` : ''}
      ${pointsHTML}
      <div style="margin-top:16px">
        <a href="${link}" target="_blank"
           style="background:${btnColor};color:#fff;padding:9px 20px;border-radius:5px;text-decoration:none;font-size:13px;font-weight:600;display:inline-block">
          Consulter le document »
        </a>
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Algeria Tech — Veille Réglementaire TIC</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,Helvetica,sans-serif">

<div style="max-width:620px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)">

  <!-- EN-TÊTE -->
  <div style="background:linear-gradient(135deg,#1a237e 0%,#0d47a1 100%);padding:28px 32px;text-align:center">
    <p style="margin:0 0 4px;color:#90caf9;font-size:13px;letter-spacing:.08em;text-transform:uppercase">Veille Réglementaire TIC</p>
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">🔔 Algeria Tech</h1>
    <p style="margin:10px 0 0;color:#bbdefb;font-size:14px">${today}</p>
  </div>

  <!-- INTRO -->
  <div style="padding:24px 32px 4px">
    <p style="margin:0;color:#333;font-size:15px;line-height:1.6">
      Bonjour,<br><br>
      La veille automatique <strong>Algeria Tech</strong> a détecté
      <strong>${totalTexts} nouveau${totalTexts > 1 ? 'x textes' : ' texte'}</strong>
      lié${totalTexts > 1 ? 's' : ''} aux TIC dans les dernières publications
      <strong>${sourceLabel}</strong>.
    </p>
  </div>

  <!-- CARTES TEXTES -->
  <div style="padding:8px 32px 16px">
    ${cardsHTML}
  </div>

  <!-- BOUTON VOIR TOUT -->
  <div style="text-align:center;padding:0 32px 28px">
    <a href="${siteLink}" target="_blank"
       style="background:#e8eaf6;color:#1a237e;padding:11px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">
      📋 Voir toutes les publications sur Algeria Tech
    </a>
  </div>

  <!-- PIED DE PAGE -->
  <div style="background:#f5f5f5;border-top:1px solid #e0e0e0;padding:18px 32px;text-align:center">
    <p style="margin:0 0 6px;font-size:12px;color:#999">
      Vous recevez cet email car vous êtes abonné à la veille réglementaire Algeria Tech.
    </p>
    <p style="margin:0;font-size:12px">
      <a href="${unsubLink}" style="color:#e53935;text-decoration:none;font-weight:600">
        Me désabonner
      </a>
      &nbsp;·&nbsp;
      <a href="${siteLink}" style="color:#1a237e;text-decoration:none">
        algeria-tech.pages.dev
      </a>
    </p>
  </div>

</div>

</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════════════
   EMAIL TEXTE (fallback sans HTML)
═══════════════════════════════════════════════════════════════ */
function buildEmailText(batches, unsubToken) {
  const lines = [
    '=== Algeria Tech — Veille Réglementaire TIC ===',
    `Date : ${new Date().toLocaleDateString('fr-DZ')}`,
    '',
    `${batches.length} nouveau(x) texte(s) TIC détecté(s) :`,
    '',
  ];
  batches.forEach(b => {
    lines.push(`[${b.texte.type}] ${b.texte.titre}`);
    if (b.texte.jo_numero) lines.push(`  → JO N°${b.texte.jo_numero} du ${b.texte.jo_date_fr}`);
    if (b.points.length) {
      lines.push('  Résumé :');
      b.points.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
    }
    lines.push(`  Lien : ${b.texte.url || b.texte.jo_url || ''}`);
    lines.push('');
  });
  lines.push(`Se désabonner : ${BASE_URL}/api/unsubscribe?token=${unsubToken}`);
  return lines.join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   ENVOI PRINCIPAL
   sendAlerts(newTextes, apiKey)
   • newTextes : tableau d'items (format JORADP ou ARPCE)
   • apiKey    : clé Mistral pour les résumés
═══════════════════════════════════════════════════════════════ */
async function sendAlerts(newTextes, apiKey) {
  if (!newTextes || newTextes.length === 0) return 0;

  const data = loadSubs();
  if (!data.list || data.list.length === 0) {
    console.log('[EMAIL] Aucun abonné — email non envoyé.');
    return 0;
  }

  /* Vérifier config SMTP */
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[EMAIL] ⚠️  SMTP_USER / SMTP_PASS non configurés dans .env — email ignoré.');
    return 0;
  }

  /* Limiter à 5 textes max par email (éviter les emails trop longs) */
  const textes = newTextes.slice(0, 5);
  console.log(`[EMAIL] Génération des résumés Mistral pour ${textes.length} texte(s)…`);

  /* Générer les résumés en parallèle */
  const summaries = await Promise.all(
    textes.map(t => apiKey ? generateSummary(t, apiKey) : Promise.resolve([]))
  );

  const batches = textes.map((t, i) => ({ texte: t, points: summaries[i] || [] }));

  /* Créer le transporter SMTP */
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port:   parseInt(process.env.SMTP_PORT  || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });

  const fromAddr = process.env.SMTP_FROM || `Algeria Tech Veille <${process.env.SMTP_USER}>`;
  const subject  = `🔔 ${textes.length} nouveau${textes.length > 1 ? 'x' : ''} texte${textes.length > 1 ? 's' : ''} TIC — Algeria Tech Veille`;

  let sent = 0;
  for (const sub of data.list) {
    try {
      const html = buildEmailHTML(batches, sub.token);
      const text = buildEmailText(batches, sub.token);
      await transporter.sendMail({
        from:    fromAddr,
        to:      sub.email,
        subject,
        html,
        text,
      });
      console.log(`[EMAIL] ✅ Envoyé à ${sub.email}`);
      sent++;
    } catch (e) {
      console.error(`[EMAIL] ❌ Échec pour ${sub.email} : ${e.message}`);
    }
  }

  data.lastAlert = new Date().toISOString();
  saveSubs(data);
  console.log(`[EMAIL] 📨 ${sent}/${data.list.length} email(s) envoyé(s).`);
  return sent;
}

/* ═══════════════════════════════════════════════════════════════
   EMAIL DE TEST — vérifier que le SMTP fonctionne
═══════════════════════════════════════════════════════════════ */
async function sendTestEmail(to) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS)
    return { ok: false, error: 'SMTP non configuré.' };

  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp-relay.brevo.com',
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls:    { rejectUnauthorized: false },
  });

  try {
    await transporter.verify();
    await transporter.sendMail({
      from:    process.env.SMTP_FROM || `Algeria Tech <${process.env.SMTP_USER}>`,
      to,
      subject: '✅ Algeria Tech Veille — Email de test',
      html:    `<div style="font-family:Arial;max-width:500px;margin:32px auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px">
        <h2 style="color:#1a237e">✅ Configuration SMTP OK !</h2>
        <p>Votre système d'alertes email Algeria Tech est correctement configuré.</p>
        <p>Vous recevrez désormais des alertes automatiques dès qu'un nouveau texte réglementaire TIC est détecté dans le Journal Officiel ou sur le site ARPCE.</p>
        <p style="color:#888;font-size:12px;margin-top:24px">Algeria Tech — Veille Réglementaire TIC Algérie</p>
      </div>`,
      text: 'Configuration SMTP OK ! Algeria Tech Veille est opérationnel.',
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { subscribe, unsubscribe, getSubscribers, sendAlerts, sendTestEmail };
