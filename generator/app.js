/**
 * Algeria Tech Generator v4 — Frontend BI Premium
 * 10 thèmes · 10 animations · Three.js fond animé · Upload → API → Résultat
 */
import * as THREE from 'three';

let file = null, docType = 'auto', theme = 'nuit', animationType = 'constellation';

// ── 10 Configurations de thèmes ──────────────────────────────────────────────
const THEMES = {
  nuit:      { name:'Nuit Algérienne',  c1:0xd4a437, c2:0x2d8a5f, c3:0xb85042, bg:'#0a0e1a' },
  desert:    { name:'Désert Solaire',   c1:0xf97316, c2:0xdc2626, c3:0xf59e0b, bg:'#0f0704' },
  emeraude:  { name:'Émeraude',         c1:0x10b981, c2:0x059669, c3:0x34d399, bg:'#020d06' },
  ocean:     { name:'Océan Profond',    c1:0x06b6d4, c2:0x0ea5e9, c3:0x38bdf8, bg:'#010b18' },
  corporate: { name:'Corporate Pro',   c1:0x1d4ed8, c2:0x7c3aed, c3:0x0891b2, bg:'#0f1629' },
  rouge:     { name:'Rouge Premium',   c1:0xdc2626, c2:0xd4a437, c3:0xfca5a5, bg:'#160307' },
  aurore:    { name:'Aurore Boréale',  c1:0xa855f7, c2:0xec4899, c3:0x06b6d4, bg:'#0f0318' },
  cyber:     { name:'Cyber Neon',      c1:0x22c55e, c2:0x84cc16, c3:0x10b981, bg:'#000a00' },
  ivoire:    { name:'Ivoire & Or',     c1:0xeab308, c2:0xd4a437, c3:0xfbbf24, bg:'#1a1508' },
  dz:        { name:'Algeria Gold',    c1:0xd4a437, c2:0x006233, c3:0xff0000, bg:'#0a120a' },
};

// ── 10 Libellés d'animations ──────────────────────────────────────────────────
const ANIM_NAMES = {
  constellation: 'Constellation KPI',
  antennes:      'Champ de Signaux',
  globe:         'Globe Numérique',
  hexagones:     'Hexagones Données',
  vagues:        'Vagues de Données',
  cube:          'Cubes Financiers',
  neural:        'Réseau Neuronal',
  particules:    'Flux de Particules',
  pyramide:      'Pyramide Stratégique',
  cristal:       'Cristal de Données',
};

// ── Three.js fond animé ───────────────────────────────────────────────────────
let bgLights = [], bgMats = [], bgRenderer, bgScene;

function initBG() {
  const canvas = document.getElementById('bg-canvas');
  bgRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  bgRenderer.setClearColor(0, 0);
  bgRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  bgScene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
  cam.position.set(0, 0, 28);

  const lA = new THREE.PointLight(0xd4a437, 2.2, 60); lA.position.set(10, 10, 10); bgScene.add(lA);
  const lB = new THREE.PointLight(0x2d4a8a, 1.5, 50); lB.position.set(-10, -8, 5); bgScene.add(lB);
  bgScene.add(new THREE.AmbientLight(0xffffff, .3));
  bgLights = [lA, lB];

  // Particules étoilées
  const N = 2000, pp = new Float32Array(N * 3), pc = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pp[i*3]   = (Math.random() - .5) * 140;
    pp[i*3+1] = (Math.random() - .5) * 140;
    pp[i*3+2] = (Math.random() - .5) * 80 - 12;
    const c = new THREE.Color(0xd4a437).lerp(new THREE.Color(0x2d4a8a), Math.random());
    pc[i*3] = c.r; pc[i*3+1] = c.g; pc[i*3+2] = c.b;
  }
  const pG = new THREE.BufferGeometry();
  pG.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  pG.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  bgScene.add(new THREE.Points(pG, new THREE.PointsMaterial({ size: .1, vertexColors: true, transparent: true, opacity: .55 })));

  // Géométries wireframe
  const geos = [
    new THREE.IcosahedronGeometry(2.8, 1),
    new THREE.TorusGeometry(3.5, .7, 8, 32),
    new THREE.OctahedronGeometry(2.2),
    new THREE.TetrahedronGeometry(2.0),
  ];
  const poss = [[-9, 3, -6], [9, -4, -8], [3, 6, -4], [-4, -5, -5]];
  bgMats = geos.map(() => new THREE.MeshStandardMaterial({ color: 0xd4a437, wireframe: true, transparent: true, opacity: .14 }));
  const objs = geos.map((g, i) => {
    const m = new THREE.Mesh(g, bgMats[i]);
    m.position.set(...poss[i]);
    bgScene.add(m);
    return m;
  });

  window.addEventListener('resize', () => {
    cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
    bgRenderer.setSize(innerWidth, innerHeight);
  });
  bgRenderer.setSize(innerWidth, innerHeight);

  let mx = 0, my = 0;
  window.addEventListener('mousemove', e => {
    mx = (e.clientX / innerWidth - .5) * 2;
    my = (e.clientY / innerHeight - .5) * 2;
  });

  let t = 0;
  (function loop() {
    requestAnimationFrame(loop); t += .005;
    objs[0].rotation.x += .003; objs[0].rotation.y += .004;
    objs[1].rotation.x += .002; objs[1].rotation.z += .003;
    objs[2].rotation.y += .005; objs[2].rotation.x += .002;
    objs[3].rotation.y += .004; objs[3].rotation.z += .003;
    objs.forEach((o, i) => { o.position.y += Math.sin(t + i * 1.2) * .005; });
    cam.position.x += (mx * .8 - cam.position.x) * .02;
    cam.position.y += (-my * .5 - cam.position.y) * .02;
    cam.lookAt(0, 0, 0);
    bgRenderer.render(bgScene, cam);
  })();
}

function updateBGColors(t) {
  const cfg = THEMES[t] || THEMES.nuit;
  if (bgLights[0]) bgLights[0].color.setHex(cfg.c1);
  if (bgLights[1]) bgLights[1].color.setHex(cfg.c2);
  bgMats.forEach(m => m.color.setHex(cfg.c1));
}

// ── Upload ────────────────────────────────────────────────────────────────────
function initUpload() {
  const dz = document.getElementById('drop-zone');
  const inp = document.getElementById('file-input');
  const bb = document.getElementById('browse-btn');
  const gb = document.getElementById('gen-btn');

  bb.addEventListener('click', e => { e.stopPropagation(); inp.click(); });
  dz.addEventListener('click', () => inp.click());
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('over');
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  });
  inp.addEventListener('change', () => { if (inp.files[0]) setFile(inp.files[0]); });
  gb.addEventListener('click', generate);

  function setFile(f) {
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['pdf','ppt','pptx','doc','docx','txt'].includes(ext)) {
      toast('Format non supporté (PDF, PPT, Word, TXT)', 'error'); return;
    }
    file = f;
    const icons = { pdf:'📄', pptx:'📊', ppt:'📊', docx:'📝', doc:'📝', txt:'📰' };
    const sz = f.size < 1048576 ? (f.size / 1024).toFixed(1) + ' KB' : (f.size / 1048576).toFixed(1) + ' MB';
    const fl = document.getElementById('file-list');
    fl.hidden = false;
    fl.innerHTML = `<div class="fi-item">
      <span class="fi-ico">${icons[ext] || '📁'}</span>
      <div class="fi-info"><div class="fi-name">${f.name}</div><div class="fi-size">${sz} · ${ext.toUpperCase()}</div></div>
      <button class="fi-rm" onclick="clearFile()">✕</button>
    </div>`;
    gb.disabled = false;
  }
}

window.clearFile = function () {
  file = null;
  document.getElementById('file-list').hidden = true;
  document.getElementById('file-list').innerHTML = '';
  document.getElementById('gen-btn').disabled = true;
  document.getElementById('file-input').value = '';
};

// ── Génération ────────────────────────────────────────────────────────────────
const STEPS = [
  [10, 'Lecture du document…'],
  [28, 'Extraction du texte et des données…'],
  [48, 'Analyse statistique & NLP…'],
  [65, 'Détection des KPIs et séries temporelles…'],
  [80, 'Construction Three.js + Chart.js…'],
  [93, 'Génération CSS premium + Raycaster…'],
  [98, 'Finalisation et indexation…'],
];

async function generate() {
  if (!file) return;
  showScreen('loading');
  let si = 0;
  const iv = setInterval(() => {
    if (si < STEPS.length) { const [p, m] = STEPS[si++]; setProgress(p, m); }
  }, 800);
  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', docType);
    fd.append('theme', theme);
    fd.append('animationType', animationType);

    const r = await fetch('/api/generate', { method: 'POST', body: fd });
    if (!r.ok) {
      const e = await r.json().catch(() => ({ error: 'Erreur ' + r.status }));
      throw new Error(e.error || 'Erreur ' + r.status);
    }
    const result = await r.json();
    clearInterval(iv); setProgress(100, 'Infographie prête !');
    await delay(700);
    showResult(result);
  } catch (e) {
    clearInterval(iv); showScreen('upload'); toast(e.message, 'error');
  }
}

function setProgress(p, m) {
  document.getElementById('load-bar').style.width = p + '%';
  document.getElementById('load-step').textContent = m;
}

// ── Affichage résultat ────────────────────────────────────────────────────────
function showResult(result) {
  const url = result.url;
  const btnOpen = document.getElementById('btn-open');
  if (btnOpen) { btnOpen.href = url; btnOpen.textContent = '🚀 Ouvrir l\'infographie'; }
  const btnDl = document.getElementById('btn-dl');
  if (btnDl) { btnDl.onclick = () => window.open(url, '_blank'); }
  const titleEl = document.getElementById('result-title');
  if (titleEl) titleEl.textContent = result.title || 'Infographie générée';
  const urlEl = document.getElementById('result-url');
  if (urlEl) urlEl.textContent = url;
  document.getElementById('btn-back').onclick = backToUpload;
  document.getElementById('bg-canvas').style.opacity = '0';
  showScreen('result');
}

window.backToUpload = function () {
  showScreen('upload');
  document.getElementById('bg-canvas').style.opacity = '1';
  window.clearFile();
};

// ── Navigation ────────────────────────────────────────────────────────────────
function showScreen(name) {
  ['upload', 'loading', 'result'].forEach(s => {
    const el = document.getElementById('scr-' + s);
    el.hidden = (s !== name);
  });
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;padding:.7rem 1.3rem;border-radius:9px;font-size:.83rem;backdrop-filter:blur(12px);animation:slide-up .3s ease;max-width:340px;background:${type === 'error' ? 'rgba(239,68,68,.15)' : 'rgba(var(--accent-rgb),.15)'};border:1px solid ${type === 'error' ? 'rgba(239,68,68,.4)' : 'var(--border)'};color:var(--text);font-family:var(--font-body)`;
  el.textContent = msg; document.body.appendChild(el); setTimeout(() => el.remove(), 4200);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initBG();
  initUpload();

  // Thèmes (10)
  document.querySelectorAll('.theme-card').forEach(b => b.addEventListener('click', () => {
    theme = b.dataset.theme;
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll('.theme-card').forEach(d => d.classList.toggle('active', d === b));
    const cfg = THEMES[theme] || THEMES.nuit;
    document.getElementById('theme-label').textContent = cfg.name;
    updateBGColors(theme);
  }));

  // Animations 3D (10)
  document.querySelectorAll('.anim-card').forEach(b => b.addEventListener('click', () => {
    animationType = b.dataset.anim;
    document.querySelectorAll('.anim-card').forEach(d => d.classList.toggle('active', d === b));
    const name = ANIM_NAMES[animationType] || animationType;
    document.getElementById('anim-label').textContent = name;
  }));

  // Type de rapport
  document.querySelectorAll('.pill').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    b.classList.add('active'); docType = b.dataset.type;
  }));
});
