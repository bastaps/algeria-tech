'use strict';
/**
 * Algeria Tech — Moteur infographies premium v2
 *
 * Génère un dossier multi-fichiers dans infographies/ au niveau
 * de qualité du blueprint observatoire-telephonie-mobile-algerie :
 *   index.html · assets/css/styles.css · assets/js/{data,charts,scene3d,main,exports}.js
 *
 * Usage : const { buildInfographie } = require('./generator/infographie-builder');
 *         const result = await buildInfographie(data, { theme, type });
 */

const fs   = require('fs');
const path = require('path');

const ROOT         = path.join(__dirname, '..');
const INFOGRAPHIES = path.join(ROOT, 'infographies');
const BLUEPRINT    = path.join(INFOGRAPHIES, 'observatoire-telephonie-mobile-algerie');
const INTERACTIFS  = path.join(INFOGRAPHIES, 'interactifs-list.json');

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function slugify(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtN(n) {
  const v = parseFloat(n) || 0;
  if (v >= 1e6) return (v / 1e6).toFixed(2).replace('.', ',') + ' M';
  if (v >= 1e3) return Math.round(v).toLocaleString('fr-FR');
  if (String(n).includes('.') || String(n).includes(',')) return parseFloat(n).toFixed(2).replace('.', ',');
  return String(Math.round(v));
}

// ─── Palette par type de document ─────────────────────────────────────────────

const PALETTES = {
  telecom: ['#D4A437','#2D8A5F','#B85042','#4A6FA5','#6CC298','#D16B5D'],
  internet:['#D4A437','#2D8A5F','#B85042','#06b6d4','#94a3b8','#c9994a'],
  startup: ['#10b981','#D4A437','#7c3aed','#0ea5e9','#f59e0b','#ef4444'],
  rapport: ['#D4A437','#2D8A5F','#B85042','#4A6FA5','#94a3b8','#354265'],
  presse:  ['#0ea5e9','#D4A437','#B85042','#2D8A5F','#7c3aed','#94a3b8'],
};

// ─── Mettre à jour interactifs-list.json ───────────────────────────────────────

function updateList(slug, title) {
  let list = [];
  if (fs.existsSync(INTERACTIFS)) {
    try { list = JSON.parse(fs.readFileSync(INTERACTIFS, 'utf8')); } catch (e) {}
  }
  list = list.filter(e => e.name !== slug);
  list.unshift({
    name: slug,
    title: title,
    url: `/infographies/${slug}/`,
    type: 'interactive-folder',
    modified: new Date().toISOString(),
    thumbnail: `/infographies/${slug}/thumbnail.jpg`
  });
  fs.writeFileSync(INTERACTIFS, JSON.stringify(list, null, 2), 'utf8');
}

// ─── Génération data.js ────────────────────────────────────────────────────────

function genDataJS(data, pal) {
  const { title, subtitle, date, source, docType, stats = [], keyPoints = [], sections = [], chartData = {} } = data;
  const hasTime = chartData.labels && chartData.labels.length >= 3;

  // KPIs : max 6 stats significatives
  const kpis = stats.filter(s => parseFloat(s.numericValue) > 0).slice(0, 6).map(s => ({
    label:   s.label,
    valeur:  s.numericValue,
    unite:   s.unit,
    icon:    s.icon || '📊',
    trend:   s.trend || null
  }));

  // Répartition
  const pctStats = stats.filter(s => s.unit === '%' && parseFloat(s.numericValue) > 0).slice(0, 6);
  const repartition = pctStats.length >= 2
    ? pctStats.map((s, i) => ({ label: s.label, valeur: parseFloat(s.numericValue), couleur: pal[i % pal.length] }))
    : (() => {
        const top = stats.filter(s => parseFloat(s.numericValue) > 0).slice(0, 4);
        const sum = top.reduce((a, s) => a + parseFloat(s.numericValue), 0) || 1;
        return top.map((s, i) => ({
          label: s.label,
          valeur: +(parseFloat(s.numericValue) / sum * 100).toFixed(1),
          couleur: pal[i % pal.length]
        }));
      })();

  // Indicateurs (pour graphiques barres)
  const indicateurs = stats.filter(s => parseFloat(s.numericValue) > 0).slice(0, 6).map((s, i) => ({
    label:   s.label.substring(0, 22),
    valeur:  parseFloat(s.numericValue),
    unite:   s.unit,
    couleur: pal[i % pal.length]
  }));

  // Evolution temporelle
  const evolution = hasTime
    ? chartData.labels.map((l, i) => ({ periode: l, valeur: chartData.values[i] || 0 }))
    : [];

  // Synthèse
  const syntheseClé = keyPoints.slice(0, 3).map((pt, i) => ({
    titre:       `Enseignement ${i + 1}`,
    chiffre:     kpis[i] ? fmtN(kpis[i].valeur) + (kpis[i].unite ? ' ' + kpis[i].unite.substring(0, 8) : '') : '—',
    contexte:    kpis[i] ? kpis[i].label : 'Indicateur clé',
    description: pt.substring(0, 200)
  }));

  return `/**
 * Dataset généré automatiquement — Algeria Tech Generator
 * Source  : ${title.replace(/\*\//g, '')}
 * Période : ${date}
 * Généré le : ${new Date().toLocaleDateString('fr-FR')}
 */

export const DOC_TYPE = ${JSON.stringify(docType)};

export const PALETTE = ${JSON.stringify(pal, null, 2)};

export const DATASET = {

  meta: {
    titre:    ${JSON.stringify(title)},
    sousTitre:${JSON.stringify(subtitle || '')},
    source:   ${JSON.stringify(source || '')},
    periode:  ${JSON.stringify(date || '')},
    dateMaj:  ${JSON.stringify(date || '')}
  },

  kpis: ${JSON.stringify(kpis, null, 2)},

  repartition: ${JSON.stringify(repartition, null, 2)},

  indicateurs: ${JSON.stringify(indicateurs, null, 2)},

  evolution: ${JSON.stringify(evolution, null, 2)},

  keyPoints: ${JSON.stringify(keyPoints.slice(0, 8), null, 2)},

  syntheseClé: ${JSON.stringify(syntheseClé, null, 2)},

  sections: ${JSON.stringify(sections.slice(0, 3), null, 2)}
};

export const fmt = {
  nombre:        (n) => Math.round(n).toLocaleString('fr-FR'),
  millions:      (n) => (n / 1e6).toFixed(2).replace('.', ',') + ' M',
  millionsCourt: (n) => (n / 1e6).toFixed(1).replace('.', ',') + ' M',
  pourcent:      (n) => parseFloat(n).toFixed(2).replace('.', ',') + '%',
  pourcentSimple:(n) => parseFloat(n).toFixed(1).replace('.', ',') + '%',
  kpi: (n, unit) => {
    const v = parseFloat(n) || 0;
    if (unit === '%') return v.toFixed(2).replace('.', ',') + '%';
    if (v >= 1e6) return (v / 1e6).toFixed(2).replace('.', ',') + ' M';
    if (v >= 1e3) return Math.round(v).toLocaleString('fr-FR');
    return String(v);
  }
};
`;
}

// ─── Génération charts.js ──────────────────────────────────────────────────────

function genChartsJS(data, pal) {
  const hasTime = data.chartData && data.chartData.labels && data.chartData.labels.length >= 3;
  const hasPct  = (data.stats || []).filter(s => s.unit === '%').length >= 2;
  const hasInd  = (data.stats || []).filter(s => parseFloat(s.numericValue) > 0).length >= 2;
  const chartLabel = data.chartData ? (data.chartData.label || 'Évolution') : 'Indicateurs';

  return `/**
 * Graphiques Chart.js — générés par Algeria Tech Generator
 */

import { DATASET, fmt, PALETTE } from './data.js';

// ── Thème global ──────────────────────────────────────────────────────────────
function applyTheme() {
  const C = window.Chart;
  if (!C) return;
  C.defaults.font.family       = "'Manrope', sans-serif";
  C.defaults.font.size         = 12;
  C.defaults.color             = '#94a3b8';
  C.defaults.borderColor       = 'rgba(255,255,255,0.06)';
  C.defaults.plugins.legend.labels.color = '#f4ede0';
  C.defaults.plugins.legend.labels.font  = { family:"'JetBrains Mono',monospace", size:11 };
  C.defaults.plugins.tooltip.backgroundColor = 'rgba(17,23,41,.95)';
  C.defaults.plugins.tooltip.titleColor  = '#d4a437';
  C.defaults.plugins.tooltip.bodyColor   = '#f4ede0';
  C.defaults.plugins.tooltip.borderColor = 'rgba(212,164,55,.4)';
  C.defaults.plugins.tooltip.borderWidth = 1;
  C.defaults.plugins.tooltip.padding     = 12;
  C.defaults.plugins.tooltip.cornerRadius= 8;
}

const CHARTS = {};

// ── 1. Indicateurs clés (barres) ─────────────────────────────────────────────
function chartIndicateurs(ctx) {
  const ind = DATASET.indicateurs;
  if (!ind.length) return null;
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ind.map(d => d.label),
      datasets: [{
        label: 'Valeur',
        data: ind.map(d => d.valeur),
        backgroundColor: ind.map(d => d.couleur + 'bb'),
        borderColor:     ind.map(d => d.couleur),
        borderWidth: 1,
        borderRadius: 7
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: c => fmt.kpi(c.parsed.y, ind[c.dataIndex]?.unite) + ' ' + (ind[c.dataIndex]?.unite||'') } }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#94a3b8', maxRotation: 35 } },
        y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#94a3b8' } }
      },
      animation: { duration: 1400, easing: 'easeOutQuart' }
    }
  });
}

// ── 2. Répartition (donut) ───────────────────────────────────────────────────
function chartRepartition(ctx) {
  const rep = DATASET.repartition;
  if (!rep.length) return null;
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: rep.map(d => d.label),
      datasets: [{
        data: rep.map(d => d.valeur),
        backgroundColor: rep.map(d => d.couleur),
        borderColor: '#111729',
        borderWidth: 3,
        hoverOffset: 14
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true } },
        tooltip: { callbacks: { label: c => fmt.pourcentSimple(c.parsed) } }
      },
      animation: { animateRotate: true, animateScale: true, duration: 1400 }
    }
  });
}

// ── 3. Distribution comparative (donut 2) ────────────────────────────────────
function chartDistribution(ctx) {
  const rep = DATASET.repartition.slice(0, 2);
  if (rep.length < 2) return null;
  const top = rep[0];
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [top.label, 'Reste'],
      datasets: [{
        data: [top.valeur, Math.max(0, 100 - top.valeur)],
        backgroundColor: [top.couleur, '#1a2238'],
        borderColor: '#111729',
        borderWidth: 3,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 10, usePointStyle: true } },
        tooltip: { callbacks: { label: c => fmt.pourcentSimple(c.parsed) } }
      },
      animation: { animateRotate: true, animateScale: true, duration: 1200 }
    }
  });
}

${hasTime ? `
// ── 4. Évolution temporelle (line) ───────────────────────────────────────────
function chartEvolution(ctx) {
  const ev = DATASET.evolution;
  if (!ev.length) return null;
  const vals = ev.map(d => d.valeur);
  const avg  = vals.reduce((a, b) => a + b, 0) / vals.length;
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: ev.map(d => d.periode),
      datasets: [
        {
          label: ${JSON.stringify(chartLabel)},
          data: vals,
          borderColor: PALETTE[0],
          backgroundColor: PALETTE[0] + '18',
          tension: 0.35,
          pointRadius: 5,
          pointBackgroundColor: PALETTE[0],
          pointBorderColor: '#111729',
          pointBorderWidth: 2,
          fill: true
        },
        {
          label: 'Moyenne',
          data: vals.map(() => avg),
          borderColor: 'rgba(148,163,184,.5)',
          borderDash: [5, 3],
          tension: 0,
          pointRadius: 0,
          fill: false,
          borderWidth: 1.5
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#94a3b8' } }
      },
      animation: { duration: 1500, easing: 'easeOutQuart' }
    }
  });
}
` : ''}

// ── 5. Répartition en barres horizontales ────────────────────────────────────
function chartBarH(ctx) {
  const rep = DATASET.repartition;
  if (!rep.length) return null;
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rep.map(d => d.label),
      datasets: [{
        label: 'Part (%)',
        data: rep.map(d => d.valeur),
        backgroundColor: rep.map(d => d.couleur + 'bb'),
        borderColor:     rep.map(d => d.couleur),
        borderWidth: 1,
        borderRadius: 5
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { max: 100, grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#94a3b8', callback: v => v + '%' } },
        y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#f4ede0' } }
      },
      animation: { duration: 1300, easing: 'easeOutQuart' }
    }
  });
}

// ── 6. Comparatif double barres (indicateurs vs répartition) ─────────────────
function chartComparatif(ctx) {
  const ind = DATASET.indicateurs.slice(0, 4);
  if (ind.length < 2) return null;
  const max = Math.max(...ind.map(d => d.valeur));
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ind.map(d => d.label),
      datasets: [
        {
          label: 'Valeur absolue',
          data: ind.map(d => d.valeur),
          backgroundColor: ind.map(d => d.couleur + 'bb'),
          borderColor:     ind.map(d => d.couleur),
          borderWidth: 1, borderRadius: 6, yAxisID: 'y'
        },
        {
          label: 'Part relative (%)',
          data: ind.map(d => +(d.valeur / max * 100).toFixed(1)),
          type: 'line',
          borderColor: '#d4a437',
          backgroundColor: 'transparent',
          pointRadius: 5,
          pointBackgroundColor: '#d4a437',
          tension: 0.3,
          yAxisID: 'y2'
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true } },
      scales: {
        y:  { position: 'left',  grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#94a3b8' } },
        y2: { position: 'right', grid: { display: false }, ticks: { color: '#d4a437', callback: v => v + '%' } },
        x:  { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#f4ede0' } }
      },
      animation: { duration: 1400, easing: 'easeOutQuart' }
    }
  });
}

// ── Init lazy (IntersectionObserver) ─────────────────────────────────────────
export function initCharts() {
  applyTheme();
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      if (CHARTS[id]) return; // déjà initialisé
      const ctx = entry.target.getContext('2d');
      switch (id) {
        case 'chart-indicateurs': CHARTS[id] = chartIndicateurs(ctx); break;
        case 'chart-repartition': CHARTS[id] = chartRepartition(ctx); break;
        case 'chart-distribution':CHARTS[id] = chartDistribution(ctx); break;
        ${hasTime ? "case 'chart-evolution':  CHARTS[id] = chartEvolution(ctx); break;" : ''}
        case 'chart-barh':        CHARTS[id] = chartBarH(ctx); break;
        case 'chart-comparatif':  CHARTS[id] = chartComparatif(ctx); break;
      }
      if (CHARTS[id]) obs.unobserve(entry.target);
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('canvas[id^="chart-"]').forEach(c => obs.observe(c));
}
`;
}

// ─── Génération scene3d.js ────────────────────────────────────────────────────

function genScene3DJS(docType, pal) {
  const isTelecom  = docType === 'telecom';
  const isInternet = docType === 'internet';

  if (isTelecom) {
    // Scène "Champ de Signaux" (inspirée du blueprint)
    return `/**
 * Scène 3D — « Champ de Signaux »
 * Générée par Algeria Tech Generator
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { DATASET, PALETTE } from './data.js';

export function initScene3D(container) {
  const w = container.clientWidth, h = container.clientHeight;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0e1a, 0.032);

  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
  camera.position.set(8, 6, 12);
  camera.lookAt(0, 1, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0, 0);
  container.appendChild(renderer.domElement);

  // Lumières
  scene.add(new THREE.AmbientLight(0xf4ede0, 0.25));
  const moon = new THREE.DirectionalLight(0xc9d6f5, 0.4); moon.position.set(5, 10, 5); scene.add(moon);
  const gold = new THREE.PointLight(0xd4a437, 0.8, 25); gold.position.set(-6, 4, -4); scene.add(gold);

  // Sol low-poly
  const gGeo = new THREE.PlaneGeometry(24, 24, 48, 48);
  const gPos = gGeo.attributes.position;
  for (let i = 0; i < gPos.count; i++) {
    const x = gPos.getX(i), y = gPos.getY(i), d = Math.sqrt(x*x+y*y);
    gPos.setZ(i, Math.sin(x*.5)*.15 + Math.cos(y*.4)*.12 + Math.sin(d*.3)*.1 - d*.05);
  }
  gGeo.computeVertexNormals();
  const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ color:0x1a2238, flatShading:true, metalness:.05, roughness:.85 }));
  ground.rotation.x = -Math.PI/2; ground.position.y = -1; scene.add(ground);
  const wire = new THREE.Mesh(gGeo.clone(), new THREE.MeshBasicMaterial({ color:0xd4a437, wireframe:true, transparent:true, opacity:.15 }));
  wire.rotation.x = -Math.PI/2; wire.position.y = -0.998; scene.add(wire);

  // KPIs → antennes avec hauteur proportionnelle
  const kpis = DATASET.kpis.slice(0, 3);
  const vals = kpis.map(k => Math.abs(parseFloat(k.valeur)) || 1);
  const maxV = Math.max(...vals), minV = Math.min(...vals);
  const positions = [{ x:-3.5, z:1 }, { x:3.5, z:1.5 }, { x:0, z:-3 }];
  const antennas  = [];

  kpis.forEach((kpi, i) => {
    const colorHex = parseInt((PALETTE[i]||'#D4A437').replace('#',''), 16);
    const h = 2.8 + ((vals[i]-minV)/(maxV-minV||1)) * 1.7;
    const grp = new THREE.Group();

    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(.05,.08,h,8),
      new THREE.MeshStandardMaterial({ color:0x1a2238, metalness:.7, roughness:.3, emissive:colorHex, emissiveIntensity:.15 })
    );
    mast.position.y = h/2-1; grp.add(mast);

    const haubanMat = new THREE.LineBasicMaterial({ color:colorHex, transparent:true, opacity:.35 });
    for (let a=0;a<3;a++) {
      const ang = (a/3)*Math.PI*2;
      const pts = [new THREE.Vector3(0,h-1,0), new THREE.Vector3(Math.cos(ang)*.6,-1,Math.sin(ang)*.6)];
      grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), haubanMat));
    }

    const tip = new THREE.Mesh(new THREE.SphereGeometry(.15,16,16),
      new THREE.MeshStandardMaterial({ color:colorHex, emissive:colorHex, emissiveIntensity:1.5 }));
    tip.position.y = h-1; grp.add(tip);

    const halo = new THREE.Mesh(new THREE.SphereGeometry(.4,16,16),
      new THREE.MeshBasicMaterial({ color:colorHex, transparent:true, opacity:.18, side:THREE.BackSide }));
    halo.position.y = h-1; grp.add(halo);

    const pl = new THREE.PointLight(colorHex, 1.2, 8); pl.position.y = h-1; grp.add(pl);

    grp.position.set(positions[i].x, 0, positions[i].z);
    grp.userData = { kpi, tipPos: new THREE.Vector3(positions[i].x,h-1,positions[i].z), tip, colorHex };
    scene.add(grp);
    antennas.push(grp);
  });

  // Anneaux d'ondes
  const rings = [];
  antennas.forEach(ant => {
    for (let i=0;i<5;i++) {
      const r = new THREE.Mesh(
        new THREE.RingGeometry(1,1.05,64),
        new THREE.MeshBasicMaterial({ color:ant.userData.colorHex, side:THREE.DoubleSide, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending })
      );
      r.rotation.x = -Math.PI/2;
      r.position.copy(ant.userData.tipPos); r.position.y = -0.92;
      r.userData = { phase:(i/5)*3.0 };
      scene.add(r); rings.push({ ring:r, ant });
    }
  });

  // Arcs de communication
  const arcs = [];
  function pickPair() { const a=Math.floor(Math.random()*3); let b=Math.floor(Math.random()*2); if(b>=a)b++; return [a,b]; }
  for (let i=0;i<20;i++) {
    const [a,b] = pickPair();
    const colorHex = parseInt((PALETTE[0]||'#D4A437').replace('#',''),16);
    const p = new THREE.Mesh(new THREE.SphereGeometry(.07,8,8),
      new THREE.MeshBasicMaterial({ color:colorHex, transparent:true, opacity:.9, blending:THREE.AdditiveBlending }));
    scene.add(p);
    arcs.push({ p, from:a, to:b, t:Math.random(), speed:.18+Math.random()*.2, arcH:2.5+Math.random()*2.5 });
  }
  function resetArc(arc) { const [a,b]=pickPair(); arc.from=a;arc.to=b;arc.t=0; }

  // Poussière
  const dustN = 200, dp = new Float32Array(dustN*3);
  for (let i=0;i<dustN;i++) { dp[i*3]=(Math.random()-.5)*22; dp[i*3+1]=Math.random()*8; dp[i*3+2]=(Math.random()-.5)*22; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position',new THREE.BufferAttribute(dp,3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color:0xd4a437, size:.04, transparent:true, opacity:.4, blending:THREE.AdditiveBlending, depthWrite:false }));
  scene.add(dust);

  // Controls
  const ctrl = new OrbitControls(camera, renderer.domElement);
  ctrl.enableDamping=true; ctrl.dampingFactor=.06; ctrl.autoRotate=true; ctrl.autoRotateSpeed=.5;
  ctrl.enablePan=false; ctrl.minDistance=10; ctrl.maxDistance=22;
  ctrl.maxPolarAngle=Math.PI*.49; ctrl.minPolarAngle=Math.PI*.18; ctrl.target.set(0,.5,0);

  // Tooltip
  const tt = document.createElement('div');
  tt.style.cssText='position:absolute;pointer-events:none;background:rgba(17,23,41,.95);backdrop-filter:blur(10px);border:1px solid rgba(212,164,55,.4);border-radius:8px;padding:8px 12px;font-family:"JetBrains Mono",monospace;font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#f4ede0;opacity:0;transition:opacity .2s;z-index:10;white-space:nowrap';
  container.appendChild(tt);
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  renderer.domElement.addEventListener('pointermove', e => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX-rect.left)/rect.width)*2-1;
    mouse.y = -((e.clientY-rect.top)/rect.height)*2+1;
    tt.style.left = (e.clientX-rect.left+14)+'px';
    tt.style.top  = (e.clientY-rect.top+14)+'px';
  });

  // Resize
  const ro = new ResizeObserver(() => {
    const nw = container.clientWidth, nh = container.clientHeight;
    camera.aspect=nw/nh; camera.updateProjectionMatrix(); renderer.setSize(nw,nh);
  });
  ro.observe(container);

  // Boucle
  const clock = new THREE.Clock();
  const tv = new THREE.Vector3();
  let fid;
  (function animate() {
    fid = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(),.05), t = clock.getElapsedTime();
    antennas.forEach((ant,i) => { const s=1+Math.sin(t*2.5+i*1.3)*.15; ant.userData.tip.scale.set(s,s,s); });
    rings.forEach(({ring, ant}) => {
      const ct=((t+ring.userData.phase)%3.5)/3.5;
      const sc=.5+ct*7.5; ring.scale.set(sc,sc,sc);
      ring.material.opacity=.65*Math.min(ct*6,1)*(1-ct);
    });
    arcs.forEach(arc => {
      arc.t+=dt*arc.speed; if(arc.t>=1) resetArc(arc);
      if(antennas[arc.from]&&antennas[arc.to]) {
        tv.lerpVectors(antennas[arc.from].userData.tipPos, antennas[arc.to].userData.tipPos, arc.t);
        arc.p.position.set(tv.x, tv.y+4*arc.t*(1-arc.t)*arc.arcH, tv.z);
        arc.p.material.opacity=.9*Math.sin(arc.t*Math.PI);
      }
    });
    const dp2=dust.geometry.attributes.position;
    for(let i=0;i<dustN;i++){const idx=i*3+1;dp2.array[idx]+=dt*.15;if(dp2.array[idx]>8)dp2.array[idx]=0;}
    dp2.needsUpdate=true; dust.rotation.y+=dt*.02;
    ray.setFromCamera(mouse,camera);
    const hits=ray.intersectObjects(antennas,true);
    if(hits.length) { let p=hits[0].object; while(p&&!p.userData.kpi)p=p.parent; if(p?.userData.kpi){const k=p.userData.kpi;tt.textContent=k.label+' · '+k.valeur+' '+k.unite;tt.style.opacity='1';renderer.domElement.style.cursor='pointer';}}
    else { tt.style.opacity='0'; renderer.domElement.style.cursor='grab'; }
    ctrl.update();
    renderer.render(scene, camera);
  })();

  return { dispose() {
    cancelAnimationFrame(fid); ro.disconnect(); ctrl.dispose(); renderer.dispose();
    scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});
    if(tt.parentNode)tt.parentNode.removeChild(tt);
    if(renderer.domElement.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);
  }};
}
`;
  }

  // Scène générique "Data Sphere" pour internet, rapport, startup, presse
  return `/**
 * Scène 3D — « Constellation de données »
 * Générée par Algeria Tech Generator
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { DATASET, PALETTE } from './data.js';

export function initScene3D(container) {
  const w = container.clientWidth, h = container.clientHeight;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0e1a, 0.028);

  const camera = new THREE.PerspectiveCamera(50, w/h, 0.1, 200);
  camera.position.set(0, 0, 22);

  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, powerPreference:'high-performance' });
  renderer.setSize(w,h); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0,0); container.appendChild(renderer.domElement);

  const c1 = parseInt((PALETTE[0]||'#D4A437').replace('#',''),16);
  const c2 = parseInt((PALETTE[1]||'#2D8A5F').replace('#',''),16);
  const c3 = parseInt((PALETTE[2]||'#B85042').replace('#',''),16);

  scene.add(new THREE.AmbientLight(0xffffff,.3));
  const lA = new THREE.PointLight(c1,2.2,60); lA.position.set(10,10,10); scene.add(lA);
  const lB = new THREE.PointLight(c2,1.5,50); lB.position.set(-10,-8,5); scene.add(lB);

  // Cristal central (icosaèdre)
  const cGeo = new THREE.IcosahedronGeometry(2.2,2);
  const crystal = new THREE.Mesh(cGeo, new THREE.MeshStandardMaterial({ color:c1, metalness:.8, roughness:.15, envMapIntensity:1, wireframe:false, transparent:true, opacity:.85 }));
  scene.add(crystal);
  const wireFrame = new THREE.Mesh(new THREE.IcosahedronGeometry(2.26,2), new THREE.MeshBasicMaterial({ color:c1, wireframe:true, transparent:true, opacity:.2 }));
  scene.add(wireFrame);

  // Sphères orbitales (KPIs)
  const kpis = DATASET.kpis.slice(0,3);
  const orbColors = [c1, c2, c3];
  const orbs = kpis.map((kpi, i) => {
    const r = 5 + i * 1.5;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(.35,16,16),
      new THREE.MeshStandardMaterial({ color:orbColors[i], emissive:orbColors[i], emissiveIntensity:.8 }));
    const connGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const conn = new THREE.Line(connGeo, new THREE.LineBasicMaterial({ color:orbColors[i], transparent:true, opacity:.4 }));
    scene.add(mesh); scene.add(conn);
    return { mesh, conn, r, phi: (i/3)*Math.PI*2, spd: .28+i*.09 };
  });

  // Surface sinusoïdale (fonction IA)
  const gRes=36, gSize=10;
  const fGeo = new THREE.BufferGeometry();
  const fVerts = new Float32Array((gRes+1)*(gRes+1)*3);
  let vi=0;
  for(let iy=0;iy<=gRes;iy++) for(let ix=0;ix<=gRes;ix++){
    const x=(ix/gRes-.5)*gSize, z=(iy/gRes-.5)*gSize;
    const y=Math.sin(x*1.1)*Math.cos(z*1.1)*.5+Math.sin(x*2.3+1.2)*Math.cos(z*1.7)*.22;
    fVerts[vi++]=x; fVerts[vi++]=y-5; fVerts[vi++]=z;
  }
  fGeo.setAttribute('position',new THREE.BufferAttribute(fVerts,3));
  scene.add(new THREE.Mesh(fGeo, new THREE.MeshStandardMaterial({ color:c2, wireframe:true, transparent:true, opacity:.1 })));

  // Particules
  const N=1600, pp=new Float32Array(N*3), pc=new Float32Array(N*3);
  for(let i=0;i<N;i++){
    pp[i*3]=(Math.random()-.5)*120; pp[i*3+1]=(Math.random()-.5)*120; pp[i*3+2]=(Math.random()-.5)*70-10;
    const c=new THREE.Color(c1).lerp(new THREE.Color(c2),Math.random());
    pc[i*3]=c.r; pc[i*3+1]=c.g; pc[i*3+2]=c.b;
  }
  const pG=new THREE.BufferGeometry();
  pG.setAttribute('position',new THREE.BufferAttribute(pp,3));
  pG.setAttribute('color',new THREE.BufferAttribute(pc,3));
  scene.add(new THREE.Points(pG,new THREE.PointsMaterial({size:.1,vertexColors:true,transparent:true,opacity:.55})));

  const ctrl = new OrbitControls(camera, renderer.domElement);
  ctrl.enableDamping=true; ctrl.dampingFactor=.06; ctrl.autoRotate=true; ctrl.autoRotateSpeed=.6;
  ctrl.minDistance=8; ctrl.maxDistance=26;

  const ro = new ResizeObserver(()=>{
    const nw=container.clientWidth,nh=container.clientHeight;
    camera.aspect=nw/nh; camera.updateProjectionMatrix(); renderer.setSize(nw,nh);
  });
  ro.observe(container);

  const clock = new THREE.Clock();
  const tv = new THREE.Vector3();
  let fid;
  (function animate(){
    fid=requestAnimationFrame(animate);
    const t=clock.getElapsedTime(), dt=Math.min(clock.getDelta(),.05);
    crystal.rotation.y+=.003; crystal.rotation.x+=.001;
    wireFrame.rotation.copy(crystal.rotation);
    orbs.forEach(o=>{
      o.phi+=o.spd*.008;
      o.mesh.position.set(Math.cos(o.phi)*o.r, Math.sin(o.phi*.7)*2, Math.sin(o.phi)*o.r*.55);
      o.conn.geometry.setFromPoints([new THREE.Vector3(),o.mesh.position.clone()]);
    });
    ctrl.update(); renderer.render(scene,camera);
  })();

  return { dispose(){
    cancelAnimationFrame(fid); ro.disconnect(); ctrl.dispose(); renderer.dispose();
    scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});
    if(renderer.domElement.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);
  }};
}
`;
}

// ─── Génération main.js ───────────────────────────────────────────────────────

function genMainJS(hasTime) {
  return `/**
 * Orchestration principale — Algeria Tech Generator
 */

import { DATASET, fmt } from './data.js';
import { initCharts } from './charts.js';
import { initScene3D } from './scene3d.js';
import { exportJSON, exportPDF, sharePage, toggleFullscreen, toast } from './exports.js';

function animateCounter(el) {
  const target   = parseFloat(el.dataset.target) || 0;
  const decimals = parseInt(el.dataset.decimals || '0', 10);
  const suffix   = el.dataset.suffix || '';
  const dur = 1800, t0 = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 3);
  (function step(now) {
    const t = Math.min(1, (now - t0) / dur);
    const v = target * ease(t);
    el.textContent = v.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    if (t < 1) requestAnimationFrame(step);
    else el.dataset.done = '1';
  })(performance.now());
}

function initCounters() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting && !e.target.dataset.done) animateCounter(e.target); });
  }, { threshold: 0.4 });
  document.querySelectorAll('.counter').forEach(c => obs.observe(c));
}

function initReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

function initNavigation() {
  const links = document.querySelectorAll('.section-nav a');
  const sections = Array.from(links).map(l => document.querySelector(l.getAttribute('href')));
  function update() {
    const scrollY = window.scrollY + window.innerHeight / 3;
    let active = sections[0];
    for (const s of sections) { if (s && s.offsetTop <= scrollY) active = s; }
    links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + (active?.id || '')));
    document.querySelector('.topbar')?.classList.toggle('compact', window.scrollY > 100);
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
}

function bindEvents() {
  document.getElementById('btn-export-pdf')?.addEventListener('click', exportPDF);
  document.getElementById('btn-export-json')?.addEventListener('click', exportJSON);
  document.getElementById('btn-share')?.addEventListener('click', sharePage);
  document.getElementById('fab-fullscreen')?.addEventListener('click', toggleFullscreen);
  document.getElementById('fab-top')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function hideLoader() {
  setTimeout(() => document.getElementById('loader')?.classList.add('hidden'), 800);
}

window.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  initReveal();
  initNavigation();
  initCounters();

  if (window.Chart) {
    try { initCharts(); } catch (e) { console.error('Charts:', e); }
  }

  const el3d = document.getElementById('scene3d');
  if (el3d) {
    try { initScene3D(el3d); }
    catch (e) {
      console.error('Scene 3D:', e);
      el3d.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:#94a3b8;font:0.8rem monospace;text-align:center;padding:1rem">Scène 3D indisponible<br>(WebGL requis)</div>';
    }
  }

  hideLoader();
});
`;
}

// ─── Génération exports.js ────────────────────────────────────────────────────

function genExportsJS(slug, title) {
  const safeName = slug.replace(/-/g, '_');
  return `/**
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
  return '\\ufeff' + [ks.join(';'), ...rows.map(r => ks.map(k => esc(r[k])).join(';'))].join('\\n');
}

export function exportJSON() {
  downloadBlob(new Blob([JSON.stringify(DATASET, null, 2)], { type: 'application/json' }), '${safeName}.json');
  toast('JSON exporté');
}

export function exportCSV() {
  const rows = DATASET.indicateurs.map(d => ({ Indicateur: d.label, Valeur: d.valeur, Unité: d.unite }));
  downloadBlob(new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' }), '${safeName}_indicateurs.csv');
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
    pdf.save('${safeName}.pdf');
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
`;
}

// ─── Génération index.html ────────────────────────────────────────────────────

function genIndexHTML(data, slug, pal) {
  const { title, subtitle, date, source, docType, stats = [], keyPoints = [], sections = [] } = data;
  const hasTime = data.chartData && data.chartData.labels && data.chartData.labels.length >= 3;
  const typeLabels = { telecom:'Télécommunications', internet:'Internet & Réseaux', startup:'Startups & Innovation', rapport:'Rapport Officiel', presse:'Article de Presse' };
  const typeLabel = typeLabels[docType] || 'Rapport';

  // KPI cards
  const kpiCards = stats.filter(s => parseFloat(s.numericValue) > 0).slice(0, 6).map((s, i) => {
    const dec = s.unit === '%' || String(s.numericValue).includes('.') ? 2 : 0;
    const target = parseFloat(s.numericValue);
    const disp = target >= 1e6 ? (target / 1e6).toFixed(2).replace('.', ',') + ' M' : String(Math.round(target));
    return `
      <div class="kpi-card reveal" style="transition-delay:${i * 0.08}s">
        <div class="kpi-icon">${esc(s.icon || '📊')}</div>
        <div class="kpi-value">
          <span class="counter" data-target="${target}" data-decimals="${dec}">${disp}</span>
          <span class="kpi-unit">${esc(s.unit)}</span>
        </div>
        <div class="kpi-label">${esc(s.label)}</div>
        ${s.trend ? `<div class="kpi-trend">${s.trend.startsWith('+') ? '▲' : '▼'} ${esc(s.trend)}</div>` : ''}
      </div>`;
  }).join('');

  // Hero meta
  const heroMeta = stats.filter(s => parseFloat(s.numericValue) > 0).slice(0, 3).map(s => {
    const dec = s.unit === '%' || String(s.numericValue).includes('.') ? 2 : 0;
    return `<div class="hero-meta-item">
        <span class="hero-meta-label">${esc(s.label)}</span>
        <span class="hero-meta-value">
          <span class="counter" data-target="${parseFloat(s.numericValue)}" data-decimals="${dec}">0</span>
          <small style="font-size:.7em;opacity:.7"> ${esc(s.unit)}</small>
        </span>
      </div>`;
  }).join('');

  // Findings
  const findings = keyPoints.slice(0, 6).map((pt, i) => `
      <div class="finding-item reveal" style="transition-delay:${i * 0.07}s">
        <span class="finding-bullet">✦</span>
        <span>${esc(pt)}</span>
      </div>`).join('');

  // Synthèse cards
  const synthCards = stats.filter(s => parseFloat(s.numericValue) > 0).slice(0, 3).map((s, i) => {
    const pts = keyPoints[i] || '';
    return `
      <div class="synth-card reveal" style="transition-delay:${i * 0.1}s">
        <div class="synth-chiffre">
          <span class="counter" data-target="${parseFloat(s.numericValue)}" data-decimals="${s.unit === '%' ? 2 : 0}">0</span>
          <small> ${esc(s.unit)}</small>
        </div>
        <div class="synth-label">${esc(s.label)}</div>
        ${pts ? `<p class="synth-desc">${esc(pts.substring(0, 150))}</p>` : ''}
      </div>`;
  }).join('');

  // Sections textuelles
  const sectionsHTML = sections.filter(s => s.body).slice(0, 3).map((s, i) => `
  <section class="section${i % 2 ? ' section-alt' : ''}" id="section-${i}">
    <div class="container">
      <div class="data-block reveal">
        <h3>${esc(s.title)}</h3>
        <p style="font-size:.9rem;line-height:1.8;color:var(--slate-300)">${esc(s.body)}</p>
      </div>
    </div>
  </section>`).join('');

  // Navigation
  const navItems = [
    ['#vue-ensemble', 'Vue d\'ensemble'],
    ['#indicateurs',  'Indicateurs'],
    hasTime ? ['#evolution', 'Évolution'] : null,
    ['#repartition',  'Répartition'],
    keyPoints.length ? ['#synthese', 'Synthèse'] : null,
  ].filter(Boolean).map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join('\n        ');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }
}
</script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — Algeria Tech</title>
  <meta name="description" content="${esc(subtitle || title)} · ${esc(typeLabel)} · Données ${esc(date)}">
  <meta name="theme-color" content="#0a0e1a">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(subtitle || '')}">
  <meta property="og:type" content="website">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400&family=JetBrains+Mono:wght@400;500;700&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/styles.css">

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js" defer></script>
</head>
<body>

<!-- LOADER -->
<div id="loader" role="status">
  <div class="loader-content">
    <div class="loader-mark"></div>
    <div class="loader-text">Algeria Tech · ${esc(typeLabel)}</div>
    <div class="loader-bar"></div>
  </div>
</div>

<!-- TOPBAR -->
<header class="topbar">
  <div class="container topbar-inner">
    <a href="/infographies/" class="brand">
      <span class="brand-mark">A</span>
      <span><em>Algeria Tech</em> · ${esc(typeLabel)}</span>
    </a>
    <nav aria-label="Sections">
      <ul class="section-nav">
        ${navItems}
      </ul>
    </nav>
    <div class="topbar-actions">
      <button id="btn-share" class="btn btn-ghost" aria-label="Partager">
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      </button>
      <button id="btn-export-pdf" class="btn btn-gold">
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        PDF
      </button>
    </div>
  </div>
</header>

<main id="mc">

<!-- ── HERO ── -->
<section class="section hero" id="hero">
  <div class="container hero" style="padding-top:0">
    <div class="hero-content reveal">
      <span class="eyebrow">Source · ${esc(source || 'Algeria Tech')} — ${esc(date)}</span>
      <h1 class="display-1">
        ${esc(title).split(' ').slice(0, 3).join('<br>\n        ')}
        ${title.split(' ').length > 3 ? `<br><em class="gold">${esc(title.split(' ').slice(3, 6).join(' '))}</em>` : ''}
      </h1>
      ${subtitle ? `<p class="lead">${esc(subtitle)}</p>` : ''}
      <div class="hero-meta">
        ${heroMeta}
        <div class="hero-meta-item">
          <span class="hero-meta-label">Période</span>
          <span class="hero-meta-value">${esc(date)}</span>
        </div>
        <div class="hero-meta-item">
          <span class="hero-meta-label">Type</span>
          <span class="hero-meta-value">${esc(typeLabel)}</span>
        </div>
      </div>
    </div>
    <div class="hero-visual">
      <div id="scene3d" class="scene3d-container"></div>
    </div>
  </div>
</section>
<div class="divider"></div>

<!-- ── VUE D'ENSEMBLE (KPIs) ── -->
<section class="section" id="vue-ensemble">
  <div class="container">
    <div class="section-header reveal">
      <span class="eyebrow">01 · Vue d'ensemble</span>
      <h2 class="display-2">Indicateurs <span class="gold">clés</span></h2>
      <p class="lead">Métriques extraites automatiquement depuis le document source.</p>
    </div>
    <div class="kpi-grid">
      ${kpiCards || '<p style="color:var(--slate-400);font-size:.9rem">Aucun indicateur numérique détecté dans ce document.</p>'}
    </div>
  </div>
</section>
<div class="divider"></div>

<!-- ── INDICATEURS (barres + comparatif) ── -->
<section class="section section-alt" id="indicateurs">
  <div class="container">
    <div class="section-header reveal">
      <span class="eyebrow">02 · Analyse</span>
      <h2 class="display-2">Indicateurs <em class="gold">détaillés</em></h2>
    </div>
    <div class="charts-row charts-2col">
      <div class="chart-card reveal">
        <h3 class="chart-title">Valeurs par indicateur</h3>
        <div class="chart-wrap tall"><canvas id="chart-indicateurs"></canvas></div>
      </div>
      <div class="chart-card reveal" style="transition-delay:.1s">
        <h3 class="chart-title">Analyse comparative</h3>
        <div class="chart-wrap tall"><canvas id="chart-comparatif"></canvas></div>
      </div>
    </div>
  </div>
</section>
<div class="divider"></div>

${hasTime ? `
<!-- ── EVOLUTION ── -->
<section class="section" id="evolution">
  <div class="container">
    <div class="section-header reveal">
      <span class="eyebrow">03 · Évolution</span>
      <h2 class="display-2">Tendance <span class="gold">temporelle</span></h2>
    </div>
    <div class="chart-card chart-wide reveal">
      <h3 class="chart-title">${esc(data.chartData.label || 'Évolution')} avec moyenne mobile</h3>
      <div class="chart-wrap tall"><canvas id="chart-evolution"></canvas></div>
    </div>
  </div>
</section>
<div class="divider"></div>
` : ''}

<!-- ── REPARTITION ── -->
<section class="section${hasTime ? ' section-alt' : ''}" id="repartition">
  <div class="container">
    <div class="section-header reveal">
      <span class="eyebrow">${hasTime ? '04' : '03'} · Répartition</span>
      <h2 class="display-2">Distribution <em class="gold">relative</em></h2>
    </div>
    <div class="charts-row charts-2col">
      <div class="chart-card reveal">
        <h3 class="chart-title">Répartition en proportions</h3>
        <div class="chart-wrap"><canvas id="chart-repartition"></canvas></div>
      </div>
      <div class="chart-card reveal" style="transition-delay:.1s">
        <h3 class="chart-title">Indicateur dominant</h3>
        <div class="chart-wrap"><canvas id="chart-distribution"></canvas></div>
      </div>
    </div>
    <div class="chart-card chart-wide reveal" style="margin-top:1.5rem">
      <h3 class="chart-title">Barres comparatives</h3>
      <div class="chart-wrap"><canvas id="chart-barh"></canvas></div>
    </div>
  </div>
</section>
<div class="divider"></div>

${findings ? `
<!-- ── POINTS CLÉS ── -->
<section class="section" id="analyse">
  <div class="container">
    <div class="section-header reveal">
      <span class="eyebrow">Synthèse · Points clés</span>
      <h2 class="display-2">Éléments <em class="gold">essentiels</em></h2>
      <p class="lead">Extraits automatiquement du document source.</p>
    </div>
    <div class="findings-grid">
      ${findings}
    </div>
  </div>
</section>
<div class="divider"></div>
` : ''}

${synthCards ? `
<!-- ── SYNTHESE ── -->
<section class="section section-alt" id="synthese">
  <div class="container">
    <div class="section-header reveal">
      <span class="eyebrow">Conclusions</span>
      <h2 class="display-2">Synthèse <span class="gold">finale</span></h2>
    </div>
    <div class="synth-grid">
      ${synthCards}
    </div>
  </div>
</section>
<div class="divider"></div>
` : ''}

${sectionsHTML}

<!-- ── FOOTER ── -->
<footer class="footer">
  <div class="container footer-inner">
    <div>
      <div class="footer-brand"><span class="footer-mark">✦</span> Algeria<em>Tech</em></div>
      <p class="footer-copy">Infographie générée par Algeria Tech Generator · ${new Date().getFullYear()}</p>
    </div>
    <div class="footer-meta">
      <span>Source : ${esc(source || 'Algeria Tech')}</span>
      <span>Période : ${esc(date)}</span>
      <span>${esc(typeLabel)}</span>
    </div>
    <div class="footer-actions">
      <button id="btn-export-json" class="btn btn-ghost" style="font-size:.78rem">JSON</button>
      <button onclick="exportCSV&&exportCSV()" class="btn btn-ghost" style="font-size:.78rem">CSV</button>
    </div>
  </div>
</footer>

</main>

<!-- FAB -->
<div class="fab-stack">
  <button id="fab-top" class="fab" title="Haut de page" aria-label="Haut de page">↑</button>
  <button id="fab-fullscreen" class="fab" title="Plein écran" aria-label="Plein écran">⛶</button>
</div>

<script type="module" src="assets/js/main.js"></script>
</body>
</html>
`;
}

// ─── CSS additionnel (KPI grid, charts layout, findings, synth) ──────────────

function genExtraCSS() {
  // On copie le blueprint CSS + ajout des composants spécifiques au générateur
  const bluePrintCSS = fs.readFileSync(path.join(BLUEPRINT, 'assets', 'css', 'styles.css'), 'utf8');
  return bluePrintCSS + `

/* ── Composants additionnels Algeria Tech Generator ─────────────────────── */

/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1px;
  background: rgba(212,164,55,.08);
  border: 1px solid rgba(212,164,55,.08);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-top: 2rem;
}
.kpi-card {
  padding: 1.8rem 1.6rem;
  background: var(--ink-800);
  position: relative;
  overflow: hidden;
  transition: background .2s;
}
.kpi-card::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 2px;
  background: var(--gold-500);
  transform: scaleX(0);
  transition: transform .4s var(--ease-out-expo);
}
.kpi-card:hover { background: rgba(212,164,55,.06); }
.kpi-card:hover::after { transform: scaleX(1); }
.kpi-icon { font-size: 1.4rem; margin-bottom: .6rem; }
.kpi-value {
  font-family: var(--font-mono);
  font-size: 2rem;
  font-weight: 700;
  color: var(--gold-500);
  line-height: 1;
  margin-bottom: .4rem;
}
.kpi-unit {
  font-size: .85rem;
  font-weight: 400;
  opacity: .7;
  margin-left: .15rem;
}
.kpi-label {
  font-family: var(--font-mono);
  font-size: .65rem;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--slate-300);
  margin-bottom: .3rem;
}
.kpi-trend {
  font-family: var(--font-mono);
  font-size: .72rem;
  color: var(--emerald-400);
}

/* Charts */
.charts-row { display: flex; gap: 1.5rem; margin-top: 2rem; flex-wrap: wrap; }
.charts-2col > * { flex: 1; min-width: 280px; }
.chart-card {
  background: var(--ink-800);
  border: 1px solid rgba(212,164,55,.08);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  box-shadow: var(--shadow-card);
}
.chart-wide { width: 100%; margin-top: 1.5rem; }
.chart-title {
  font-family: var(--font-mono);
  font-size: .72rem;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--slate-300);
  margin-bottom: 1rem;
}
.chart-wrap { position: relative; height: 260px; }
.chart-wrap.tall { height: 320px; }

/* Scene 3D */
.scene3d-container {
  width: 100%;
  height: 420px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--ink-900);
  border: 1px solid rgba(212,164,55,.1);
}

/* Hero layout */
.section.hero > .container.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;
}
@media (max-width: 900px) {
  .section.hero > .container.hero { grid-template-columns: 1fr; }
  .hero-visual { order: -1; }
  .scene3d-container { height: 280px; }
}

/* Findings */
.findings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}
.finding-item {
  display: flex;
  gap: .75rem;
  align-items: flex-start;
  padding: 1rem 1.2rem;
  background: var(--ink-800);
  border: 1px solid rgba(212,164,55,.08);
  border-radius: var(--radius-md);
  font-size: .88rem;
  line-height: 1.7;
}
.finding-bullet {
  color: var(--gold-500);
  flex-shrink: 0;
  margin-top: .15rem;
}

/* Synthèse */
.synth-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}
.synth-card {
  background: var(--ink-800);
  border: 1px solid rgba(212,164,55,.12);
  border-radius: var(--radius-lg);
  padding: 2rem 1.8rem;
  box-shadow: var(--shadow-card);
}
.synth-chiffre {
  font-family: var(--font-mono);
  font-size: 2.4rem;
  font-weight: 700;
  color: var(--gold-500);
  line-height: 1;
  margin-bottom: .6rem;
}
.synth-label {
  font-size: .85rem;
  font-weight: 600;
  color: var(--cream-100);
  margin-bottom: .6rem;
  text-transform: uppercase;
  letter-spacing: .06em;
  font-family: var(--font-mono);
}
.synth-desc { font-size: .84rem; color: var(--slate-300); line-height: 1.7; }

/* Footer */
.footer {
  background: var(--ink-800);
  border-top: 1px solid rgba(212,164,55,.1);
  padding: 2.5rem 0;
  margin-top: 0;
}
.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.5rem;
}
.footer-brand {
  font-family: var(--font-display);
  font-size: 1.1rem;
  color: var(--cream-100);
  margin-bottom: .3rem;
}
.footer-mark { color: var(--gold-500); margin-right: .3rem; }
.footer-copy { font-size: .75rem; color: var(--slate-400); }
.footer-meta { display: flex; flex-direction: column; gap: .3rem; font-size: .75rem; color: var(--slate-400); font-family: var(--font-mono); }
.footer-actions { display: flex; gap: .5rem; }

/* Toast */
.toast {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 9999;
  padding: .7rem 1.2rem;
  border-radius: var(--radius-md);
  font-size: .82rem;
  font-family: var(--font-mono);
  color: white;
  opacity: 0;
  transform: translateY(8px);
  transition: all .25s;
  pointer-events: none;
}
.toast.show { opacity: 1; transform: translateY(0); }

/* Data block */
.data-block {
  background: var(--ink-800);
  border: 1px solid rgba(212,164,55,.08);
  border-radius: var(--radius-md);
  padding: 2rem;
  box-shadow: var(--shadow-card);
}
.data-block h3 {
  font-family: var(--font-display);
  font-size: 1.2rem;
  color: var(--gold-500);
  margin-bottom: 1rem;
}
`;
}

// ─── Fonction principale ───────────────────────────────────────────────────────

async function buildInfographie(data, opts = {}) {
  const { docType = 'rapport' } = data;
  const pal = PALETTES[docType] || PALETTES.rapport;

  // Slug unique = titre + timestamp court
  const baseSlug = slugify(data.title || 'rapport');
  const slug = baseSlug + '-' + Date.now().toString(36);

  // Dossier
  const dir   = path.join(INFOGRAPHIES, slug);
  const assetsJS  = path.join(dir, 'assets', 'js');
  const assetsCSS = path.join(dir, 'assets', 'css');
  ensureDir(assetsJS);
  ensureDir(assetsCSS);

  // Écriture des fichiers
  fs.writeFileSync(path.join(dir, 'index.html'),         genIndexHTML(data, slug, pal),  'utf8');
  fs.writeFileSync(path.join(assetsCSS, 'styles.css'),   genExtraCSS(),                  'utf8');
  fs.writeFileSync(path.join(assetsJS, 'data.js'),       genDataJS(data, pal),           'utf8');
  fs.writeFileSync(path.join(assetsJS, 'charts.js'),     genChartsJS(data, pal),         'utf8');
  fs.writeFileSync(path.join(assetsJS, 'scene3d.js'),    genScene3DJS(docType, pal),     'utf8');
  fs.writeFileSync(path.join(assetsJS, 'main.js'),       genMainJS(!!(data.chartData?.labels?.length >= 3)), 'utf8');
  fs.writeFileSync(path.join(assetsJS, 'exports.js'),    genExportsJS(slug, data.title), 'utf8');

  // Mise à jour interactifs-list.json
  updateList(slug, data.title);

  return {
    slug,
    url:   `/infographies/${slug}/`,
    path:  dir,
    title: data.title
  };
}

module.exports = { buildInfographie };
