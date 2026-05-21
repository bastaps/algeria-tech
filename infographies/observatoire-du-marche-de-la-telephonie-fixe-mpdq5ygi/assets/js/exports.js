/**
 * Exports — Algeria Tech Generator
 */

import { DATASET } from './data.js';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCSV(rows) {
  if (!rows?.length) return '';
  const ks = Object.keys(rows[0]);
  const esc = v => { const s = String(v??'').replace(/"/g,'""'); return /[";\n]/.test(s) ? '"'+s+'"' : s; };
  return '\ufeff' + [ks.join(';'), ...rows.map(r => ks.map(k => esc(r[k])).join(';'))].join('\n');
}

export function exportJSON() {
  downloadBlob(new Blob([JSON.stringify(DATASET, null, 2)], { type: 'application/json' }), 'observatoire_du_marche_de_la_telephonie_fixe_mpdq5ygi.json');
  toast('JSON exporté');
}

export function exportCSV() {
  const rows = DATASET.indicateurs.map(d => ({ Indicateur: d.label, Valeur: d.valeur, Unité: d.unite }));
  downloadBlob(new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' }), 'observatoire_du_marche_de_la_telephonie_fixe_mpdq5ygi_indicateurs.csv');
  toast('CSV exporté');
}

export async function exportPDF() {
  if (!window.jspdf || !window.html2canvas) { toast('Module PDF indisponible', true); return; }
  toast('Génération PDF…');
  const { jsPDF } = window.jspdf;
  const fab = document.querySelector('.fab-stack');
  if (fab) fab.style.visibility = 'hidden';
  try {
    const canvas = await html2canvas(document.querySelector('main'), {
      backgroundColor: '#0a0e1a', scale: 1.5, useCORS: true, logging: false,
      windowWidth: document.querySelector('main').scrollWidth
    });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    const img = canvas.toDataURL('image/jpeg', .85);
    const ih = canvas.height * pw / canvas.width;
    let left = ih, pos = 0;
    pdf.addImage(img, 'JPEG', 0, pos, pw, ih, '', 'FAST');
    left -= ph;
    while (left > 0) { pos = left - ih; pdf.addPage(); pdf.addImage(img, 'JPEG', 0, pos, pw, ih, '', 'FAST'); left -= ph; }
    pdf.save('observatoire_du_marche_de_la_telephonie_fixe_mpdq5ygi.pdf');
    toast('PDF exporté');
  } catch (e) { toast('Erreur export PDF', true); console.error(e); }
  finally { if (fab) fab.style.visibility = ''; }
}

export async function sharePage() {
  const txt = { title: DATASET.meta.titre, text: DATASET.meta.sousTitre, url: location.href };
  if (navigator.share) { try { await navigator.share(txt); return; } catch (e) {} }
  try { await navigator.clipboard.writeText(location.href); toast('Lien copié'); }
  catch { toast('Partage indisponible', true); }
}

export function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
  else document.exitFullscreen();
}

let _tt;
export function toast(message, isError = false) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = message;
  el.style.background = isError ? '#b85042' : '#2d8a5f';
  el.classList.add('show');
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.remove('show'), 2800);
}
