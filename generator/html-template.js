'use strict';
/**
 * Algeria Tech Generator — Moteur HTML
 * Génère un rapport standalone de qualité ARPCE :
 * Three.js (cristal orbital + particules) · Chart.js (barres, courbe, donuts)
 * 5 thèmes · Compteurs animés · Reveal scroll · Export PDF
 */

// ─── Thèmes ──────────────────────────────────────────────────────────────────
const T = {
  nuit:      { bg:'#0a0e1a', bg2:'#111729', bg3:'#1a2238', bg4:'#232e4a',
               a1:'#d4a437', a2:'#2d8a5f', a3:'#b85042',
               cr:'#f4ede0', sl:'#94a3b8', mu:'rgba(244,237,224,.55)',
               g1:'rgba(212,164,55,.09)', g2:'rgba(45,138,95,.06)',
               pal:['#d4a437','#2d8a5f','#b85042','#4a6fa5','#c9994a','#45a877'],
               l1:0xd4a437,l2:0x2d8a5f,l3:0xb85042, lbl:'Nuit Algérienne' },
  desert:    { bg:'#0f0704', bg2:'#1a0f08', bg3:'#2a1a0e', bg4:'#3a2518',
               a1:'#f97316', a2:'#dc2626', a3:'#f59e0b',
               cr:'#fef3c7', sl:'#a1887f', mu:'rgba(254,243,199,.55)',
               g1:'rgba(249,115,22,.09)', g2:'rgba(220,38,38,.06)',
               pal:['#f97316','#f59e0b','#dc2626','#ea580c','#fbbf24','#ef4444'],
               l1:0xf97316,l2:0xdc2626,l3:0xf59e0b, lbl:'Désert Solaire' },
  emeraude:  { bg:'#020d06', bg2:'#071a0e', bg3:'#0d2b17', bg4:'#143d22',
               a1:'#10b981', a2:'#059669', a3:'#34d399',
               cr:'#ecfdf5', sl:'#6ee7b7', mu:'rgba(236,253,245,.55)',
               g1:'rgba(16,185,129,.09)', g2:'rgba(5,150,105,.06)',
               pal:['#10b981','#34d399','#059669','#6ee7b7','#065f46','#a7f3d0'],
               l1:0x10b981,l2:0x059669,l3:0x34d399, lbl:'Émeraude' },
  ocean:     { bg:'#010b18', bg2:'#041524', bg3:'#082030', bg4:'#0c2d40',
               a1:'#06b6d4', a2:'#0ea5e9', a3:'#38bdf8',
               cr:'#e0f7ff', sl:'#7dd3fc', mu:'rgba(224,247,255,.55)',
               g1:'rgba(6,182,212,.09)', g2:'rgba(14,165,233,.06)',
               pal:['#06b6d4','#38bdf8','#0ea5e9','#7dd3fc','#0284c7','#bae6fd'],
               l1:0x06b6d4,l2:0x0ea5e9,l3:0x38bdf8, lbl:'Océan Profond' },
  corporate: { bg:'#f0f4f8', bg2:'#e2e8f0', bg3:'#cbd5e1', bg4:'#94a3b8',
               a1:'#1d4ed8', a2:'#7c3aed', a3:'#0891b2',
               cr:'#0f172a', sl:'#475569', mu:'rgba(15,23,42,.55)',
               g1:'rgba(29,78,216,.07)', g2:'rgba(124,58,237,.05)',
               pal:['#1d4ed8','#7c3aed','#0891b2','#4f46e5','#0e7490','#6366f1'],
               l1:0x1d4ed8,l2:0x7c3aed,l3:0x0891b2, lbl:'Corporate Pro' }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const esc  = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const rgb  = hex => { const n=parseInt(String(hex).replace('#',''),16); return `${(n>>16)&255},${(n>>8)&255},${n&255}`; };
const fv   = v  => parseFloat(String(v||0).replace(',','.')) || 0;

// ─── Données graphiques ───────────────────────────────────────────────────────
// Fallback data by doc type when no stats are extracted
const FALLBACK = {
  telecom:    { labels:['T3-2024','T4-2024','T1-2025','T2-2025','T3-2025'], values:[50.6,51.3,51.7,52.4,53.6], d1lbl:['Mobile 4G','Internet fixe','FTTH','ADSL'], d1val:[88.7,11.3,37.6,32.3], d2lbl:['Couverture 4G','Non couvert'], d2val:[98,2], note:'Données illustratives — document image non lisible' },
  startup:    { labels:['2020','2021','2022','2023','2024'], values:[120,310,580,850,1200], d1lbl:['Fintech','Agritech','Healthtech','Edtech'], d1val:[32,25,22,21], d2lbl:['Levées réussies','En cours'], d2val:[68,32], note:'Données illustratives' },
  rapport:    { labels:['T1','T2','T3','T4'], values:[100,115,128,142], d1lbl:['Objectif A','Objectif B','Objectif C','Autre'], d1val:[40,30,20,10], d2lbl:['Réalisé','En cours'], d2val:[75,25], note:'Données illustratives' },
  presse:     { labels:['Jan','Fév','Mar','Avr','Mai'], values:[45,52,48,61,58], d1lbl:['Positif','Neutre','Négatif'], d1val:[55,30,15], d2lbl:['National','International'], d2val:[70,30], note:'Données illustratives' },
};

function buildCharts(data, t) {
  const stats = data.stats || [];
  const raw   = data.chartData || {};
  const fb    = FALLBACK[data.docType] || FALLBACK.rapport;
  const hasStats = stats.filter(s=>fv(s.numericValue)>0).length >= 2;

  /* Graphique principal : série temporelle ou comparaison */
  let main;
  if (raw.labels && raw.labels.length >= 2) {
    main = { title: raw.label||'Données', labels: raw.labels, values: raw.values, type: raw.type||'bar' };
  } else if (hasStats) {
    const top = stats.filter(s => fv(s.numericValue) > 0).slice(0,6);
    main = { title:'Indicateurs clés', labels: top.map(s=>s.label.substring(0,18)), values: top.map(s=>fv(s.numericValue)), type:'bar' };
  } else {
    main = { title: fb.note ? 'Tendance estimée' : 'Évolution', labels: fb.labels, values: fb.values, type:'bar', fallback: true };
  }

  /* Donut 1 : pourcentages ou top stats normalisés */
  const pct = stats.filter(s => s.unit==='%' && fv(s.numericValue)>0).slice(0,5);
  let d1;
  if (pct.length >= 2) {
    d1 = { title:'Répartition (%)', labels: pct.map(s=>s.label), values: pct.map(s=>fv(s.numericValue)) };
  } else if (hasStats) {
    const top = stats.filter(s=>fv(s.numericValue)>0).slice(0,4);
    const sum = top.reduce((a,s)=>a+fv(s.numericValue),0)||1;
    d1 = { title:'Part relative', labels: top.map(s=>s.label.substring(0,16)), values: top.map(s=>+((fv(s.numericValue)/sum*100).toFixed(1))) };
  } else {
    d1 = { title: 'Répartition', labels: fb.d1lbl, values: fb.d1val, fallback: true };
  }

  /* Donut 2 : complémentaire */
  let d2;
  const big = pct[0];
  if (big) {
    d2 = { title: esc(big.label), labels:[big.label,'Reste'], values:[fv(big.numericValue), Math.max(0,+(100-fv(big.numericValue)).toFixed(1))] };
  } else if (hasStats) {
    const [a,b,...r] = stats.filter(s=>fv(s.numericValue)>0);
    const rest = r.reduce((x,s)=>x+fv(s.numericValue),0);
    d2 = a && b ? { title:'Comparaison', labels:[a.label.substring(0,16),b.label.substring(0,16),'Autres'], values:[fv(a.numericValue),fv(b.numericValue),rest||1] }
                : { title:'Vue générale', labels:d1.labels.slice(0,2), values:d1.values.slice(0,2) };
  } else {
    d2 = { title: 'Bilan', labels: fb.d2lbl, values: fb.d2val, fallback: true };
  }

  /* Courbe : série temporelle si identifiée */
  let line = null;
  if (raw.labels && raw.labels.length >= 3 && /T[1-4]|20\d{2}/.test(String(raw.labels[0]))) {
    line = { title:'Évolution temporelle', labels: raw.labels, values: raw.values };
  } else if (!hasStats || main.fallback) {
    line = { title: 'Tendance générale', labels: fb.labels, values: fb.values.map((v,i)=>+(v*1.05**i).toFixed(2)) };
  }

  return { main, d1, d2, line };
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
function css(t) {
const r = rgb(t.a1), r2 = rgb(t.a2), rbg = rgb(t.bg);
return `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;scrollbar-color:${t.a1} ${t.bg2};scrollbar-width:thin}
html::-webkit-scrollbar{width:6px}html::-webkit-scrollbar-track{background:${t.bg2}}html::-webkit-scrollbar-thumb{background:${t.a1};border-radius:3px}
body{font-family:'Manrope',sans-serif;line-height:1.65;color:${t.cr};background:${t.bg};min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased}
body::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse at top right,${t.g1},transparent 52%),radial-gradient(ellipse at bottom left,${t.g2},transparent 52%);z-index:-2;pointer-events:none}
body::after{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.035 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>");opacity:.5;z-index:-1;pointer-events:none;mix-blend-mode:overlay}
a{color:${t.a1};text-decoration:none}
/* Loader */
#loader{position:fixed;inset:0;z-index:9999;background:${t.bg};display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1.4rem;transition:opacity .6s,visibility .6s}
#loader.out{opacity:0;visibility:hidden;pointer-events:none}
.ld-ring{width:52px;height:52px;border:2px solid ${t.bg3};border-top-color:${t.a1};border-radius:50%;animation:spin .85s linear infinite}
.ld-txt{font-family:'JetBrains Mono',monospace;font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;color:${t.a1}}
.ld-track{width:180px;height:2px;background:${t.bg3};border-radius:99px;overflow:hidden}
.ld-fill{height:100%;background:${t.a1};animation:lfill 1.8s ease-in-out forwards}
/* Topbar */
.topbar{position:sticky;top:0;z-index:100;backdrop-filter:blur(20px) saturate(1.4);background:rgba(${rbg},.88);border-bottom:1px solid rgba(${r},.13);padding:.85rem 2rem}
.tb-inner{max-width:1280px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:.55rem;font-family:'JetBrains Mono',monospace;font-size:.78rem;letter-spacing:.06em;color:${t.sl}}
.bmark{width:26px;height:26px;background:${t.a1};border-radius:5px;display:flex;align-items:center;justify-content:center;color:${t.bg};font-weight:700;font-size:.82rem;flex-shrink:0}
.snav{list-style:none;display:flex;gap:.25rem;flex-wrap:wrap}
.snav a{font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;color:${t.sl};padding:.28rem .6rem;border-radius:5px;transition:background .2s,color .2s}
.snav a:hover{background:rgba(${r},.1);color:${t.cr}}
.btn{display:inline-flex;align-items:center;gap:.4rem;padding:.45rem 1rem;border-radius:7px;font-family:'Manrope',sans-serif;font-size:.78rem;font-weight:600;cursor:pointer;transition:all .2s;border:1px solid transparent;text-decoration:none}
.btn-g{background:${t.a1};color:${t.bg};border-color:${t.a1}}
.btn-g:hover{box-shadow:0 0 22px rgba(${r},.45);transform:translateY(-1px)}
.btn-gh{background:transparent;color:${t.sl};border-color:rgba(${r},.22)}
.btn-gh:hover{border-color:${t.a1};color:${t.cr}}
/* Layout */
.wrap{max-width:1280px;margin:0 auto;padding:0 2rem}
.sec{padding:4.5rem 0}
.sec-alt{background:${t.bg2}}
.divider{height:1px;background:linear-gradient(to right,transparent,rgba(${r},.2),transparent);margin:0 2rem}
/* Typo */
.eyebrow{font-family:'JetBrains Mono',monospace;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:${t.a1};display:block;margin-bottom:.7rem}
.d1{font-family:'Fraunces',Georgia,serif;font-size:clamp(2.6rem,5vw,4.2rem);font-weight:500;line-height:1.06;color:${t.cr};margin-bottom:1.4rem}
.d2{font-family:'Fraunces',Georgia,serif;font-size:clamp(1.5rem,2.8vw,2.2rem);font-weight:500;line-height:1.12;color:${t.cr};margin-bottom:.9rem}
.lead{font-size:1rem;line-height:1.75;color:${t.sl};max-width:66ch}
.gold{color:${t.a1}} .em{color:${t.a2}} em{color:${t.a1}}
/* Hero */
.hero-grid{display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:center;min-height:calc(100vh - 58px);padding:3rem 0}
@media(max-width:860px){.hero-grid{grid-template-columns:1fr}}
.hero-3d{position:relative;height:500px;border-radius:18px;overflow:hidden;background:${t.bg2};box-shadow:0 0 80px -20px rgba(${r},.28),0 0 0 1px rgba(${r},.1)}
#scene3d{width:100%;height:100%}
.scene-hint{position:absolute;bottom:.9rem;left:50%;transform:translateX(-50%);font-family:'JetBrains Mono',monospace;font-size:.62rem;letter-spacing:.1em;color:${t.sl};opacity:.5;text-transform:uppercase;pointer-events:none;white-space:nowrap}
.hero-meta{display:flex;gap:1.4rem;margin-top:1.8rem;flex-wrap:wrap}
.hm-item{display:flex;flex-direction:column;gap:.18rem}
.hm-lbl{font-family:'JetBrains Mono',monospace;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:${t.sl}}
.hm-val{font-family:'JetBrains Mono',monospace;font-size:1.35rem;font-weight:700;color:${t.a1}}
/* KPI */
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:1px;background:rgba(${r},.08);border:1px solid rgba(${r},.08);border-radius:14px;overflow:hidden;margin-top:2rem}
.kpi{padding:1.7rem 1.5rem;background:${t.bg2};position:relative;overflow:hidden;transition:background .2s}
.kpi::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:${t.a1};transform:scaleX(0);transition:transform .4s}
.kpi:hover{background:rgba(${r},.06)}.kpi:hover::after{transform:scaleX(1)}
.kpi-lbl{font-family:'JetBrains Mono',monospace;font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;color:${t.sl};margin-bottom:.55rem}
.kpi-val{font-family:'JetBrains Mono',monospace;font-size:2.3rem;font-weight:700;color:${t.a1};line-height:1;letter-spacing:-.03em}
.kpi-val .u{font-size:.92rem;font-weight:400;color:${t.a1};opacity:.8;margin-left:.15rem}
.kpi-tr{margin-top:.4rem;font-size:.72rem;font-family:'JetBrains Mono',monospace;color:${t.a2};font-weight:500}
/* Data blocks */
.db{background:${t.bg2};border:1px solid rgba(${r},.1);border-radius:14px;padding:1.7rem;box-shadow:0 18px 55px -18px rgba(0,0,0,.4);transition:border-color .2s}
.db:hover{border-color:rgba(${r},.26)}
.db-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.3rem}
.db-hd h3{font-family:'Fraunces',serif;font-size:1.05rem;font-weight:500;color:${t.cr}}
.chart-wrap{position:relative;height:270px}
.chart-wrap.tall{height:330px}
.chart-wrap.short{height:220px}
.split{display:grid;grid-template-columns:1fr 1fr;gap:1.4rem;margin-top:1.4rem}
@media(max-width:700px){.split{grid-template-columns:1fr}}
/* Tableau */
.tbl-wrap{overflow-x:auto;margin-top:1.4rem;border-radius:9px;border:1px solid rgba(${r},.08)}
table{width:100%;border-collapse:collapse;font-family:'JetBrains Mono',monospace;font-size:.78rem}
th{padding:.75rem 1rem;text-align:left;background:rgba(${r},.06);color:${t.a1};font-weight:500;letter-spacing:.06em;font-size:.68rem;text-transform:uppercase;border-bottom:1px solid rgba(${r},.1)}
td{padding:.65rem 1rem;color:${t.sl};border-bottom:1px solid rgba(255,255,255,.04)}
td.n{text-align:right;color:${t.cr};font-weight:500}
tr:hover td{background:rgba(${r},.04)} tr:last-child td{border-bottom:none}
/* Findings */
.fl{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:.9rem;margin-top:1.4rem}
.fi{display:flex;align-items:flex-start;gap:.85rem;padding:1rem 1.2rem;background:${t.bg2};border:1px solid rgba(${r},.08);border-radius:11px;transition:border-color .2s,transform .18s}
.fi:hover{border-color:rgba(${r},.3);transform:translateX(4px)}
.fi-bul{color:${t.a1};font-size:.82rem;flex-shrink:0;margin-top:.1rem}
.fi-txt{font-size:.86rem;line-height:1.65;color:${t.sl}}
/* Thème badge */
.tbadge{display:inline-flex;align-items:center;gap:.35rem;font-family:'JetBrains Mono',monospace;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:${t.a1};border:1px solid rgba(${r},.22);padding:.22rem .65rem;border-radius:99px;background:rgba(${r},.06);margin-bottom:.9rem}
/* Footer */
footer{padding:2.2rem 2rem;border-top:1px solid rgba(${r},.1);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;background:${t.bg2}}
.ft-brand{font-family:'JetBrains Mono',monospace;font-size:.7rem;color:${t.sl}}
.ft-brand strong{color:${t.a1}}
/* Reveal */
.rv{opacity:0;transform:translateY(22px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1)}
.rv.on{opacity:1;transform:none}
/* Animations */
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes lfill{0%{width:0}75%{width:88%}100%{width:100%}}
`; }

// ─── Three.js (même technique que l'observatoire ARPCE) ──────────────────────
function code3d(t) { return `
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

(function initScene3D(){
  const cont = document.getElementById('scene3d');
  if(!cont) return;
  const W=cont.clientWidth, H=cont.clientHeight;

  const scene  = new THREE.Scene();
  scene.fog    = new THREE.FogExp2(${JSON.stringify(t.bg)}, 0.038);

  const cam    = new THREE.PerspectiveCamera(50, W/H, 0.1, 100);
  cam.position.set(0, 2, 13);

  const rend   = new THREE.WebGLRenderer({antialias:true, alpha:true, powerPreference:'high-performance'});
  rend.setSize(W,H);
  rend.setPixelRatio(Math.min(devicePixelRatio,2));
  rend.setClearColor(0,0);
  cont.appendChild(rend.domElement);

  /* Lumières */
  scene.add(new THREE.AmbientLight(0xffffff,.22));
  const lA=new THREE.PointLight(${t.l1},3.0,38); lA.position.set(5,5,6);   scene.add(lA);
  const lB=new THREE.PointLight(${t.l2},2.0,30); lB.position.set(-6,-3,5); scene.add(lB);
  const lC=new THREE.PointLight(${t.l3},1.2,24); lC.position.set(0,7,-4);  scene.add(lC);

  /* Cristal icosaèdre — cœur du marché */
  const cGeo = new THREE.IcosahedronGeometry(2.0,2);
  scene.add(new THREE.Mesh(cGeo, new THREE.MeshStandardMaterial({color:${t.l1},metalness:.75,roughness:.18,transparent:true,opacity:.16})));
  const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(2.06,2),
    new THREE.MeshBasicMaterial({color:${t.l1},wireframe:true,transparent:true,opacity:.38}));
  scene.add(wire);

  /* Anneau orbital */
  const ring=new THREE.Mesh(new THREE.TorusGeometry(5.2,.045,6,80),
    new THREE.MeshBasicMaterial({color:${t.l1},transparent:true,opacity:.14}));
  ring.rotation.x=Math.PI*.34; scene.add(ring);

  /* 3 orbes (opérateurs / segments) */
  const orbCfg=[
    {r:5.0,spd:.44,phi:0,           sz:.62,col:${t.l1}},
    {r:6.8,spd:.28,phi:Math.PI*.66, sz:.48,col:${t.l2}},
    {r:8.4,spd:.18,phi:Math.PI*1.3, sz:.38,col:${t.l3}}
  ];
  const orbs=orbCfg.map(o=>{
    const m=new THREE.Mesh(new THREE.SphereGeometry(o.sz,14,14),
      new THREE.MeshStandardMaterial({color:o.col,emissive:o.col,emissiveIntensity:.45,metalness:.55,roughness:.3}));
    scene.add(m); return {...o,mesh:m};
  });

  /* Lignes cristal→orbes */
  const lMat=new THREE.LineBasicMaterial({color:${t.l1},transparent:true,opacity:.16});
  const connLines=orbs.map(()=>{
    const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
    const l=new THREE.Line(g,lMat.clone()); scene.add(l); return l;
  });

  /* Champ de particules */
  const N=2000, pp=new Float32Array(N*3), pc=new Float32Array(N*3);
  const c1=new THREE.Color(${t.l1}), c2=new THREE.Color(${t.l2});
  for(let i=0;i<N;i++){
    pp[i*3]=(Math.random()-.5)*55; pp[i*3+1]=(Math.random()-.5)*55; pp[i*3+2]=(Math.random()-.5)*35-5;
    const mx=Math.random(); pc[i*3]=c1.r+(c2.r-c1.r)*mx; pc[i*3+1]=c1.g+(c2.g-c1.g)*mx; pc[i*3+2]=c1.b+(c2.b-c1.b)*mx;
  }
  const pG=new THREE.BufferGeometry();
  pG.setAttribute('position',new THREE.BufferAttribute(pp,3));
  pG.setAttribute('color',   new THREE.BufferAttribute(pc,3));
  scene.add(new THREE.Points(pG,new THREE.PointsMaterial({size:.1,vertexColors:true,transparent:true,opacity:.58})));

  /* Surface mathématique (fonction IA) — grille sinusoïdale */
  const gRes=40, gSize=12;
  const gVerts=new Float32Array((gRes+1)*(gRes+1)*3);
  let vi=0;
  for(let iy=0;iy<=gRes;iy++) for(let ix=0;ix<=gRes;ix++){
    const x=(ix/gRes-.5)*gSize, z=(iy/gRes-.5)*gSize;
    const y=Math.sin(x*1.1)*Math.cos(z*1.1)*.55+Math.sin(x*2.3+1.2)*Math.cos(z*1.7)*.25;
    gVerts[vi++]=x; gVerts[vi++]=y-4; gVerts[vi++]=z;
  }
  const gIdx=[];
  for(let iy=0;iy<gRes;iy++) for(let ix=0;ix<gRes;ix++){
    const a=iy*(gRes+1)+ix;
    gIdx.push(a,a+1,a+gRes+1, a+1,a+gRes+2,a+gRes+1);
  }
  const fGeo=new THREE.BufferGeometry();
  fGeo.setAttribute('position',new THREE.BufferAttribute(gVerts,3));
  fGeo.setIndex(gIdx);
  fGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(fGeo,new THREE.MeshStandardMaterial({color:${t.l2},wireframe:true,transparent:true,opacity:.1})));

  /* OrbitControls */
  const ctrl=new OrbitControls(cam,rend.domElement);
  ctrl.enableDamping=true; ctrl.dampingFactor=.06;
  ctrl.minDistance=5; ctrl.maxDistance=22;
  ctrl.autoRotate=true; ctrl.autoRotateSpeed=.65;

  /* Resize */
  new ResizeObserver(()=>{
    const w=cont.clientWidth,h=cont.clientHeight;
    rend.setSize(w,h); cam.aspect=w/h; cam.updateProjectionMatrix();
  }).observe(cont);

  /* Boucle */
  let tick=0;
  (function loop(){
    requestAnimationFrame(loop); tick+=.008;
    wire.rotation.y+=.003; wire.rotation.x+=.001;
    orbs.forEach((o,i)=>{
      o.phi+=o.spd*.01;
      o.mesh.position.set(Math.cos(o.phi)*o.r, Math.sin(o.phi*.7)*2, Math.sin(o.phi)*o.r*.54);
      connLines[i].geometry.setFromPoints([new THREE.Vector3(0,0,0),o.mesh.position.clone()]);
    });
    ring.rotation.z+=.0018;
    ctrl.update();
    rend.render(scene,cam);
  })();
})();
`; }

// ─── Chart.js + JS général ────────────────────────────────────────────────────
function codeJS(data, charts, t) {
  const pal  = JSON.stringify(t.pal);
  const mLbl = JSON.stringify(charts.main.labels);
  const mVal = JSON.stringify(charts.main.values);
  const mTyp = charts.main.type === 'pie' ? 'doughnut' : 'bar';
  const d1L  = JSON.stringify(charts.d1.labels);
  const d1V  = JSON.stringify(charts.d1.values);
  const d2L  = JSON.stringify(charts.d2.labels);
  const d2V  = JSON.stringify(charts.d2.values);
  const lnL  = charts.line ? JSON.stringify(charts.line.labels) : '[]';
  const lnV  = charts.line ? JSON.stringify(charts.line.values) : '[]';
  const hasSeries = !!(charts.line);
  const bg   = t.bg, bg2 = t.bg2, a1 = t.a1, a2 = t.a2, sl = t.sl, cr = t.cr;
  const ra1  = rgb(a1);

return `
/* ── Thème Chart.js ─────────────────────────────────────────────────────── */
function chartTheme(){
  if(!window.Chart) return;
  Chart.defaults.font.family="'Manrope',sans-serif";
  Chart.defaults.font.size=12;
  Chart.defaults.color='${sl}';
  Chart.defaults.borderColor='rgba(255,255,255,0.04)';
  Chart.defaults.plugins.legend.labels.color='${cr}';
  Chart.defaults.plugins.legend.labels.font={family:"'JetBrains Mono',monospace",size:10};
  Chart.defaults.plugins.tooltip.backgroundColor='rgba(${rgb(bg)},.95)';
  Chart.defaults.plugins.tooltip.titleColor='${a1}';
  Chart.defaults.plugins.tooltip.bodyColor='${cr}';
  Chart.defaults.plugins.tooltip.borderColor='rgba(${ra1},.35)';
  Chart.defaults.plugins.tooltip.borderWidth=1;
  Chart.defaults.plugins.tooltip.padding=12;
  Chart.defaults.plugins.tooltip.cornerRadius=8;
}

/* ── Graphique principal ─────────────────────────────────────────────────── */
function initMain(){
  const ctx=document.getElementById('chart-main');
  if(!ctx||!window.Chart) return;
  const pal=${pal};
  new Chart(ctx,{
    type:'${mTyp}',
    data:{
      labels:${mLbl},
      datasets:[{
        label:${JSON.stringify(charts.main.title)},
        data:${mVal},
        backgroundColor:${mLbl}.map((_,i)=>pal[i%pal.length]+'bb'),
        borderColor:     ${mLbl}.map((_,i)=>pal[i%pal.length]),
        borderWidth:1, borderRadius:${mTyp==='doughnut'?0:7},
        hoverBackgroundColor:${mLbl}.map((_,i)=>pal[i%pal.length]),
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:${mTyp==='doughnut'?'true':'false'}}},
      scales:${mTyp==='doughnut'?'{}':'{x:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:"'+sl+'"}},y:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:"'+sl+'"}}}'},
      animation:{duration:1200,easing:'easeOutQuart'}
    }
  });
}

/* ── Donut 1 ─────────────────────────────────────────────────────────────── */
function initD1(){
  const ctx=document.getElementById('chart-d1');
  if(!ctx||!window.Chart) return;
  const pal=${pal};
  new Chart(ctx,{
    type:'doughnut',
    data:{labels:${d1L},datasets:[{data:${d1V},backgroundColor:pal.slice(0,${d1L}.length),borderColor:'${bg2}',borderWidth:3,hoverOffset:8}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'60%',
      plugins:{legend:{position:'bottom',labels:{padding:12,font:{size:10}}}},
      animation:{duration:1100,easing:'easeOutQuart'}}
  });
}

/* ── Donut 2 ─────────────────────────────────────────────────────────────── */
function initD2(){
  const ctx=document.getElementById('chart-d2');
  if(!ctx||!window.Chart) return;
  const pal=${pal};
  new Chart(ctx,{
    type:'doughnut',
    data:{labels:${d2L},datasets:[{data:${d2V},backgroundColor:pal.slice(0,${d2L}.length),borderColor:'${bg2}',borderWidth:3,hoverOffset:8}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'60%',
      plugins:{legend:{position:'bottom',labels:{padding:12,font:{size:10}}}},
      animation:{duration:1100,easing:'easeOutQuart'}}
  });
}

${hasSeries ? `
/* ── Courbe d'évolution ──────────────────────────────────────────────────── */
function initLine(){
  const ctx=document.getElementById('chart-line');
  if(!ctx||!window.Chart) return;
  const vals=${lnV};
  const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
  new Chart(ctx,{
    type:'line',
    data:{
      labels:${lnL},
      datasets:[
        {label:${JSON.stringify(charts.line ? charts.line.title : '')},data:vals,
         borderColor:'${a1}',backgroundColor:'rgba(${ra1},.08)',
         tension:.35,pointRadius:5,pointBackgroundColor:'${a1}',
         pointBorderColor:'${bg}',pointBorderWidth:2,fill:true},
        {label:'Moyenne',data:vals.map(()=>avg),
         borderColor:'rgba(${rgb(a2)},.5)',borderDash:[5,3],
         tension:0,pointRadius:0,fill:false,borderWidth:1.5}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:true}},
      scales:{x:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'${sl}'}},
              y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'${sl}'}}},
      animation:{duration:1300,easing:'easeOutQuart'}
    }
  });
}` : ''}

/* ── Compteurs animés ────────────────────────────────────────────────────── */
function counters(){
  document.querySelectorAll('.cnt[data-t]').forEach(el=>{
    const tg=parseFloat(el.dataset.t)||0;
    const dc=parseInt(el.dataset.dc)||0;
    if(!tg) return;
    const dur=1800, t0=performance.now();
    (function tick(now){
      const p=Math.min((now-t0)/dur,1);
      const e=1-Math.pow(1-p,3);
      const v=tg*e;
      el.textContent=(dc>0?v.toFixed(dc):Math.round(v)).toLocaleString('fr-FR');
      if(p<1) requestAnimationFrame(tick);
    })(performance.now());
  });
}

/* ── Reveal au scroll ────────────────────────────────────────────────────── */
function reveal(){
  const obs=new IntersectionObserver(entries=>{
    entries.forEach((e,i)=>{ if(e.isIntersecting){ setTimeout(()=>e.target.classList.add('on'),i*65); obs.unobserve(e.target); } });
  },{threshold:.1,rootMargin:'0px 0px -35px 0px'});
  document.querySelectorAll('.rv').forEach(el=>obs.observe(el));
}

/* ── Export PDF ──────────────────────────────────────────────────────────── */
window.exportPDF=async function(){
  const btn=document.getElementById('btnpdf');
  if(btn){btn.textContent='⏳…';btn.disabled=true}
  try{
    const {jsPDF}=window.jspdf;
    const el=document.getElementById('mc');
    const cv=await html2canvas(el,{scale:1.4,useCORS:true,backgroundColor:'${bg}'});
    const img=cv.toDataURL('image/jpeg',.9);
    const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const pw=pdf.internal.pageSize.getWidth();
    const ph=cv.height*pw/cv.width;
    const pg=pdf.internal.pageSize.getHeight();
    let y=0;
    while(y<ph){if(y>0)pdf.addPage();pdf.addImage(img,'JPEG',0,-y,pw,ph);y+=pg;}
    pdf.save('algeria-tech-rapport.pdf');
  }catch(e){alert('Export PDF : '+e.message);}
  finally{if(btn){btn.textContent='PDF';btn.disabled=false}}
};

/* ── Loader ──────────────────────────────────────────────────────────────── */
function hideLoader(){ setTimeout(()=>{ const l=document.getElementById('loader'); if(l)l.classList.add('out'); },1300); }

/* ── Init ────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded',()=>{
  chartTheme(); initMain(); initD1(); initD2();
  ${hasSeries ? 'initLine();' : ''}
  counters(); reveal(); hideLoader();
});
`; }

// ─── Blocs HTML ───────────────────────────────────────────────────────────────
function kpiGrid(stats, t) {
  return (stats||[]).slice(0,6).map((s,i)=>`
  <div class="kpi rv" style="transition-delay:${i*.08}s">
    <div class="kpi-lbl">${esc(s.label)}</div>
    <div class="kpi-val"><span class="cnt" data-t="${fv(s.numericValue)}" data-dc="${s.unit==='%'||String(s.numericValue).includes('.')?2:0}">0</span><span class="u">${esc(s.unit)}</span></div>
    <div class="kpi-tr">${s.trend?`${s.trend.startsWith('+')?'▲':'▼'} ${esc(s.trend)}`:'&nbsp;'}</div>
  </div>`).join('');
}

function heroMeta(stats) {
  return (stats||[]).slice(0,3).map(s=>`
  <div class="hm-item">
    <span class="hm-lbl">${esc(s.label)}</span>
    <span class="hm-val"><span class="cnt" data-t="${fv(s.numericValue)}" data-dc="${s.unit==='%'||String(s.numericValue).includes('.')?2:0}">0</span> <small style="font-size:.7em;opacity:.7">${esc(s.unit)}</small></span>
  </div>`).join('');
}

function statsTable(stats) {
  if(!stats||!stats.length) return '';
  return `<div class="tbl-wrap"><table>
  <thead><tr><th>Indicateur</th><th>Valeur</th><th>Unité</th><th>Variation</th></tr></thead>
  <tbody>${(stats||[]).map(s=>`<tr>
    <td>${esc(s.label)}</td><td class="n">${esc(s.value)}</td><td>${esc(s.unit)}</td><td style="color:${s.trend&&s.trend.startsWith('+')?'#10b981':'#ef4444'}">${s.trend?esc(s.trend):'—'}</td>
  </tr>`).join('')}</tbody>
  </table></div>`;
}

function findingsBlock(pts, t) {
  if(!pts||!pts.length) return '';
  return `<section class="sec" id="synthese">
  <div class="wrap">
    <div class="rv"><span class="eyebrow">Synthèse · Points clés</span>
    <h2 class="d2">Éléments essentiels du document</h2>
    <p class="lead" style="margin-bottom:1.4rem">Extraits automatiquement à partir du document source.</p></div>
    <div class="fl">${pts.slice(0,8).map((p,i)=>`
    <div class="fi rv" style="transition-delay:${i*.06}s"><span class="fi-bul">✦</span><span class="fi-txt">${esc(p)}</span></div>`).join('')}
    </div>
  </div>
</section><div class="divider"></div>`;
}

function sectionsBlock(secs, t) {
  return (secs||[]).filter(s=>s.body).slice(0,3).map((s,i)=>`
<section class="sec${i%2===0?' sec-alt':''}">
  <div class="wrap"><div class="db rv">
    <div class="db-hd"><h3>${esc(s.title)}</h3></div>
    <p style="font-size:.9rem;line-height:1.78;color:${t.sl}">${esc(s.body)}</p>
  </div></div>
</section><div class="divider"></div>`).join('');
}

// ─── Assemblage final ─────────────────────────────────────────────────────────
function generateReport(data, themeName) {
  const t  = T[themeName] || T.nuit;
  const ch = buildCharts(data, t);
  const c  = css(t);
  const j3 = code3d(t);
  const jS = codeJS(data, ch, t);

  const nav = ['hero','kpis','graphiques','distribution','synthese'].map(id=>
    `<li><a href="#${id}">${{hero:'Accueil',kpis:'Indicateurs',graphiques:'Graphiques',distribution:'Distribution',synthese:'Synthèse'}[id]}</a></li>`
  ).join('');

  const lineSection = ch.line ? `
<div class="divider"></div>
<section class="sec sec-alt" id="evolution">
  <div class="wrap">
    <div class="rv"><span class="eyebrow">04 · Évolution temporelle</span>
    <h2 class="d2">${esc(ch.line.title)}</h2>
    <p class="lead" style="margin-bottom:1.5rem">Analyse de la tendance sur la période identifiée dans le document.</p></div>
    <div class="db rv">
      <div class="db-hd"><h3>Courbe d'évolution + moyenne mobile</h3></div>
      <div class="chart-wrap tall"><canvas id="chart-line"></canvas></div>
    </div>
  </div>
</section>` : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(data.title)} — Algeria Tech</title>
<meta name="description" content="${esc(data.subtitle||data.title)}">
<meta name="theme-color" content="${t.bg}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;1,9..144,400&family=Manrope:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
<style>${c}</style>
</head>
<body>

<div id="loader"><div class="ld-ring"></div><div class="ld-txt">Algeria Tech Generator</div><div class="ld-track"><div class="ld-fill"></div></div></div>

<header class="topbar">
  <div class="tb-inner">
    <div class="brand"><div class="bmark">✦</div><span>Algeria<strong style="color:${t.a1}">Tech</strong> Generator</span></div>
    <nav><ul class="snav">${nav}</ul></nav>
    <div style="display:flex;gap:.5rem;flex-shrink:0">
      <button class="btn btn-gh" onclick="window.close()||history.back()">← Retour</button>
      <button id="btnpdf" class="btn btn-g" onclick="exportPDF()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        PDF
      </button>
    </div>
  </div>
</header>

<div id="mc">

<!-- ══ HERO ══════════════════════════════════════════════════════════════════ -->
<section class="sec sec-alt" id="hero">
  <div class="wrap hero-grid">
    <div class="rv">
      <span class="eyebrow">Source · ${esc(data.source||'Algeria Tech Generator')}</span>
      <div class="tbadge">✦ Thème ${esc(t.lbl)}</div>
      <h1 class="d1">${esc(data.title)}</h1>
      <p class="lead">${esc(data.subtitle||'Rapport généré automatiquement à partir du document source.')}</p>
      <div class="hero-meta">
        ${heroMeta(data.stats)}
        <div class="hm-item">
          <span class="hm-lbl">Période</span>
          <span class="hm-val" style="font-size:.95rem;color:${t.sl}">${esc(data.date||'')}</span>
        </div>
      </div>
    </div>
    <div class="hero-3d rv" style="transition-delay:.18s">
      <div id="scene3d" aria-label="Constellation 3D — fonction IA et données"></div>
      <div class="scene-hint">Glisser · Zoomer · Explorer</div>
    </div>
  </div>
</section>

<div class="divider"></div>

<!-- ══ KPIs ══════════════════════════════════════════════════════════════════ -->
<section class="sec" id="kpis">
  <div class="wrap">
    <div class="rv">
      <span class="eyebrow">01 · Vue d'ensemble</span>
      <h2 class="d2">Les chiffres clés</h2>
      <p class="lead">Indicateurs extraits et analysés depuis <em>${esc(data.source||'le document')}</em>.</p>
    </div>
    <div class="kpi-grid">${kpiGrid(data.stats, t)}</div>
    ${statsTable(data.stats)}
  </div>
</section>

<div class="divider"></div>

<!-- ══ GRAPHIQUE PRINCIPAL ═══════════════════════════════════════════════════ -->
<section class="sec sec-alt" id="graphiques">
  <div class="wrap">
    <div class="rv">
      <span class="eyebrow">02 · Analyse des données</span>
      <h2 class="d2">${esc(ch.main.title)}</h2>
      <p class="lead">Visualisation des valeurs identifiées dans le document.</p>
    </div>
    <div class="db rv" style="margin-top:1.5rem">
      <div class="db-hd"><h3>${esc(ch.main.title)}</h3></div>
      <div class="chart-wrap tall"><canvas id="chart-main"></canvas></div>
    </div>
  </div>
</section>

<div class="divider"></div>

<!-- ══ DISTRIBUTIONS ═════════════════════════════════════════════════════════ -->
<section class="sec" id="distribution">
  <div class="wrap">
    <div class="rv">
      <span class="eyebrow">03 · Répartitions</span>
      <h2 class="d2">Analyse de distribution</h2>
      <p class="lead">Décomposition des indicateurs extraits du document.</p>
    </div>
    <div class="split">
      <div class="db rv">
        <div class="db-hd"><h3>${esc(ch.d1.title)}</h3></div>
        <div class="chart-wrap"><canvas id="chart-d1"></canvas></div>
      </div>
      <div class="db rv" style="transition-delay:.1s">
        <div class="db-hd"><h3>${esc(ch.d2.title)}</h3></div>
        <div class="chart-wrap"><canvas id="chart-d2"></canvas></div>
      </div>
    </div>
  </div>
</section>

${lineSection}

<div class="divider"></div>

${findingsBlock(data.keyPoints, t)}

${sectionsBlock(data.sections, t)}

</div><!-- /#mc -->

<footer>
  <div class="ft-brand">Généré par <strong>Algeria Tech Generator</strong> · Thème ${esc(t.lbl)} · ${new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}</div>
  <button class="btn btn-g" onclick="exportPDF()">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    Exporter PDF
  </button>
</footer>

<script type="module">${j3}</script>
<script>${jS}</script>
</body>
</html>`;
}

module.exports = { generateReport };
