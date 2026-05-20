/**
 * Algeria Tech Generator — Frontend
 * Three.js background · Upload · API → iframe plein écran
 */
import * as THREE from 'three';

let file = null, docType = 'auto', theme = 'nuit';

const COLORS = {
  nuit:      [0xd4a437, 0x2d8a5f, 0xb85042],
  desert:    [0xf97316, 0xdc2626, 0xf59e0b],
  emeraude:  [0x10b981, 0x059669, 0x34d399],
  ocean:     [0x06b6d4, 0x0ea5e9, 0x38bdf8],
  corporate: [0x1d4ed8, 0x7c3aed, 0x0891b2],
};

// ── Three.js fond animé ───────────────────────────────────────────────────────
let lights = [], meshMats = [];

function initBG() {
  const canvas = document.getElementById('bg-canvas');
  const rend = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  rend.setClearColor(0, 0);
  rend.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene  = new THREE.Scene();
  const cam    = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 200);
  cam.position.set(0, 0, 28);

  const lA = new THREE.PointLight(0xd4a437, 2.2, 60); lA.position.set(10,10,10); scene.add(lA);
  const lB = new THREE.PointLight(0x2d4a8a, 1.5, 50); lB.position.set(-10,-8,5); scene.add(lB);
  scene.add(new THREE.AmbientLight(0xffffff, .3));
  lights = [lA, lB];

  // Particules
  const N = 1600, pp = new Float32Array(N*3), pc = new Float32Array(N*3);
  for (let i=0; i<N; i++) {
    pp[i*3]=(Math.random()-.5)*120; pp[i*3+1]=(Math.random()-.5)*120; pp[i*3+2]=(Math.random()-.5)*70-10;
    const c=new THREE.Color(0xd4a437).lerp(new THREE.Color(0x2d4a8a),Math.random());
    pc[i*3]=c.r; pc[i*3+1]=c.g; pc[i*3+2]=c.b;
  }
  const pG=new THREE.BufferGeometry();
  pG.setAttribute('position',new THREE.BufferAttribute(pp,3));
  pG.setAttribute('color',new THREE.BufferAttribute(pc,3));
  scene.add(new THREE.Points(pG,new THREE.PointsMaterial({size:.12,vertexColors:true,transparent:true,opacity:.6})));

  // Géométries
  const geos = [new THREE.IcosahedronGeometry(2.8,1), new THREE.TorusGeometry(3.5,.7,8,32), new THREE.OctahedronGeometry(2.2)];
  const poss = [[-8,3,-5],[8,-4,-8],[3,5,-3]];
  const mats = geos.map(()=>new THREE.MeshStandardMaterial({color:0xd4a437,wireframe:true,transparent:true,opacity:.15}));
  meshMats = mats;
  const objs = geos.map((g,i)=>{ const m=new THREE.Mesh(g,mats[i]); m.position.set(...poss[i]); scene.add(m); return m; });

  window.addEventListener('resize', ()=>{ cam.aspect=innerWidth/innerHeight; cam.updateProjectionMatrix(); rend.setSize(innerWidth,innerHeight); });
  rend.setSize(innerWidth, innerHeight);

  let mx=0,my=0;
  window.addEventListener('mousemove',e=>{ mx=(e.clientX/innerWidth-.5)*2; my=(e.clientY/innerHeight-.5)*2; });

  let t=0;
  (function loop(){ requestAnimationFrame(loop); t+=.005;
    objs[0].rotation.x+=.003; objs[0].rotation.y+=.004;
    objs[1].rotation.x+=.002; objs[1].rotation.z+=.003;
    objs[2].rotation.y+=.005; objs[2].rotation.x+=.002;
    objs.forEach((o,i)=>{ o.position.y+=Math.sin(t+i*1.2)*.005; });
    cam.position.x+=(mx*.8-cam.position.x)*.02;
    cam.position.y+=(-my*.5-cam.position.y)*.02;
    cam.lookAt(0,0,0);
    rend.render(scene,cam);
  })();
}

function updateBGColors(cols) {
  const [c1,c2] = cols;
  if (lights[0]) lights[0].color.setHex(c1);
  if (lights[1]) lights[1].color.setHex(c2);
  meshMats.forEach(m=>m.color.setHex(c1));
}

// ── Upload ────────────────────────────────────────────────────────────────────
function initUpload() {
  const dz=document.getElementById('drop-zone');
  const inp=document.getElementById('file-input');
  const bb=document.getElementById('browse-btn');
  const gb=document.getElementById('gen-btn');

  bb.addEventListener('click', e=>{ e.stopPropagation(); inp.click(); });
  dz.addEventListener('click', ()=>inp.click());
  dz.addEventListener('dragover', e=>{ e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', ()=>dz.classList.remove('over'));
  dz.addEventListener('drop', e=>{ e.preventDefault(); dz.classList.remove('over'); if(e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); });
  inp.addEventListener('change', ()=>{ if(inp.files[0]) setFile(inp.files[0]); });
  gb.addEventListener('click', generate);

  function setFile(f) {
    const ext=f.name.split('.').pop().toLowerCase();
    if (!['pdf','ppt','pptx','doc','docx','txt'].includes(ext)) { toast('Format non supporté (PDF, PPT, Word, TXT)', 'error'); return; }
    file=f;
    const icons={pdf:'📄',pptx:'📊',ppt:'📊',docx:'📝',doc:'📝',txt:'📰'};
    const sz=f.size<1048576?(f.size/1024).toFixed(1)+' KB':(f.size/1048576).toFixed(1)+' MB';
    const fl=document.getElementById('file-list');
    fl.hidden=false;
    fl.innerHTML=`<div class="fi-item">
      <span class="fi-ico">${icons[ext]||'📁'}</span>
      <div class="fi-info"><div class="fi-name">${f.name}</div><div class="fi-size">${sz}</div></div>
      <button class="fi-rm" onclick="clearFile()">✕</button>
    </div>`;
    gb.disabled=false;
  }
}

window.clearFile = function() {
  file=null;
  document.getElementById('file-list').hidden=true;
  document.getElementById('file-list').innerHTML='';
  document.getElementById('gen-btn').disabled=true;
  document.getElementById('file-input').value='';
};

// ── Génération ────────────────────────────────────────────────────────────────
const STEPS=[
  [12,'Lecture du document…'],
  [30,'Extraction du texte…'],
  [52,'Analyse des données…'],
  [68,'Détection des statistiques…'],
  [82,'Construction Three.js + Charts…'],
  [95,'Finalisation du rapport…'],
];

async function generate() {
  if (!file) return;
  showScreen('loading');
  let si=0;
  const iv=setInterval(()=>{ if(si<STEPS.length){ const [p,m]=STEPS[si++]; setProgress(p,m); } },700);
  try {
    const fd=new FormData(); fd.append('file',file); fd.append('type',docType); fd.append('theme',theme);
    const r=await fetch('/api/generate',{method:'POST',body:fd});
    if(!r.ok){ const e=await r.json().catch(()=>({error:'Erreur '+r.status})); throw new Error(e.error||'Erreur '+r.status); }
    const result=await r.json();
    clearInterval(iv); setProgress(100,'Infographie prête !');
    await delay(600);
    showResult(result);
  } catch(e) {
    clearInterval(iv); showScreen('upload'); toast(e.message,'error');
  }
}

function setProgress(p,m) {
  document.getElementById('load-bar').style.width=p+'%';
  document.getElementById('load-step').textContent=m;
}

// ── Affichage résultat ────────────────────────────────────────────────────────
function showResult(result) {
  const url = result.url;
  // Lien "Ouvrir l'infographie"
  const btnOpen = document.getElementById('btn-open');
  if (btnOpen) { btnOpen.href = url; btnOpen.textContent = '🚀 Ouvrir l\'infographie'; }
  // Lien de téléchargement → ouvrir dans nouvel onglet
  const btnDl = document.getElementById('btn-dl');
  if (btnDl) { btnDl.onclick = () => window.open(url, '_blank'); }
  // Info titre
  const titleEl = document.getElementById('result-title');
  if (titleEl) titleEl.textContent = result.title || 'Infographie générée';
  const urlEl = document.getElementById('result-url');
  if (urlEl) urlEl.textContent = url;
  document.getElementById('btn-back').onclick = backToUpload;
  document.getElementById('bg-canvas').style.opacity = '0';
  showScreen('result');
}

window.backToUpload=function() {
  showScreen('upload');
  document.getElementById('bg-canvas').style.opacity='1';
  window.clearFile();
};

// ── Navigation ────────────────────────────────────────────────────────────────
function showScreen(name) {
  ['upload','loading','result'].forEach(s=>{
    const el=document.getElementById('scr-'+s);
    el.hidden=(s!==name);
  });
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type='info') {
  const el=document.createElement('div');
  el.style.cssText=`position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;padding:.7rem 1.3rem;border-radius:9px;font-size:.83rem;backdrop-filter:blur(12px);animation:slide-up .3s ease;max-width:320px;background:${type==='error'?'rgba(239,68,68,.15)':'rgba(var(--accent-rgb),.15)'};border:1px solid ${type==='error'?'rgba(239,68,68,.4)':'var(--border)'};color:var(--text);font-family:var(--font-body)`;
  el.textContent=msg; document.body.appendChild(el); setTimeout(()=>el.remove(),4000);
}

function delay(ms){return new Promise(r=>setTimeout(r,ms))}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', ()=>{
  initBG();
  initUpload();

  // Thèmes
  document.querySelectorAll('.tp-dot').forEach(b=>b.addEventListener('click',()=>{
    theme=b.dataset.theme;
    document.documentElement.dataset.theme=theme;
    document.querySelectorAll('.tp-dot').forEach(d=>d.classList.toggle('active',d===b));
    updateBGColors(COLORS[theme]);
  }));

  // Type
  document.querySelectorAll('.pill').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));
    b.classList.add('active'); docType=b.dataset.type;
  }));
});
