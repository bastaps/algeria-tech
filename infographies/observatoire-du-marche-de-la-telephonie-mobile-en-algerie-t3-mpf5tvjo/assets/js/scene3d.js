/**
 * Scène 3D — « Champ de Signaux » Télécom
 * Algeria Tech Generator v3 — Raycaster + Tooltip KPI
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
  container.style.position = 'relative';
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
  const wireG = new THREE.Mesh(gGeo.clone(), new THREE.MeshBasicMaterial({ color:0xd4a437, wireframe:true, transparent:true, opacity:.15 }));
  wireG.rotation.x = -Math.PI/2; wireG.position.y = -0.998; scene.add(wireG);

  // Antennes KPI
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
      new THREE.CylinderGeometry(.05, .08, h, 8),
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
    grp.userData = { kpi, tipPos: new THREE.Vector3(positions[i].x, h-1, positions[i].z), tip, colorHex };
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

  // Particules de poussière
  const dustN = 200, dp = new Float32Array(dustN*3);
  for (let i=0;i<dustN;i++) { dp[i*3]=(Math.random()-.5)*22; dp[i*3+1]=Math.random()*8; dp[i*3+2]=(Math.random()-.5)*22; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position',new THREE.BufferAttribute(dp,3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color:0xd4a437, size:.04, transparent:true, opacity:.4, blending:THREE.AdditiveBlending, depthWrite:false }));
  scene.add(dust);

  // Arcs entre antennes
  const arcs = [];
  function pickPair() { const a=Math.floor(Math.random()*3); let b=Math.floor(Math.random()*2); if(b>=a)b++; return [a,b]; }
  for (let i=0;i<20;i++) {
    const [a,b] = pickPair();
    const p = new THREE.Mesh(new THREE.SphereGeometry(.07,8,8),
      new THREE.MeshBasicMaterial({ color:0xd4a437, transparent:true, opacity:.9, blending:THREE.AdditiveBlending }));
    scene.add(p);
    arcs.push({ p, from:a, to:b, t:Math.random(), speed:.18+Math.random()*.2, arcH:2.5+Math.random()*2.5 });
  }
  function resetArc(arc) { const [a,b]=pickPair(); arc.from=a;arc.to=b;arc.t=0; }

  // OrbitControls
  const ctrl = new OrbitControls(camera, renderer.domElement);
  ctrl.enableDamping=true; ctrl.dampingFactor=.06; ctrl.autoRotate=true; ctrl.autoRotateSpeed=.5;
  ctrl.enablePan=false; ctrl.minDistance=10; ctrl.maxDistance=22;
  ctrl.maxPolarAngle=Math.PI*.49; ctrl.minPolarAngle=Math.PI*.18; ctrl.target.set(0,.5,0);

  // Tooltip
  const tt = document.createElement('div');
  tt.style.cssText = [
    'position:absolute', 'pointer-events:none',
    'background:rgba(17,23,41,.95)', 'backdrop-filter:blur(10px)',
    'border:1px solid rgba(212,164,55,.55)', 'border-radius:10px',
    'padding:9px 14px',
    'font-family:var(--font-body,"Manrope",sans-serif)',
    'font-size:.72rem', 'letter-spacing:.04em',
    'color:#f4ede0', 'white-space:nowrap',
    'opacity:0', 'transition:opacity .2s ease',
    'z-index:20', 'text-align:center', 'line-height:1.6'
  ].join(';');
  container.appendChild(tt);

  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2(9999, 9999);
  let mxPx = 0, myPx = 0;

  renderer.domElement.addEventListener('pointermove', e => {
    const rect = renderer.domElement.getBoundingClientRect();
    mxPx = e.clientX - rect.left; myPx = e.clientY - rect.top;
    mouse.x = ((e.clientX-rect.left)/rect.width)*2-1;
    mouse.y = -((e.clientY-rect.top)/rect.height)*2+1;
  });
  renderer.domElement.addEventListener('pointerleave', () => {
    mouse.set(9999, 9999); tt.style.opacity = '0';
  });

  // ResizeObserver
  const ro = new ResizeObserver(() => {
    const nw = container.clientWidth, nh = container.clientHeight;
    camera.aspect=nw/nh; camera.updateProjectionMatrix(); renderer.setSize(nw,nh);
  });
  ro.observe(container);

  // Boucle d'animation
  const clock = new THREE.Clock();
  const tv = new THREE.Vector3();
  let fid;

  (function animate() {
    fid = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(),.05), t = clock.getElapsedTime();

    antennas.forEach((ant,i) => { const s=1+Math.sin(t*2.5+i*1.3)*.15; ant.userData.tip.scale.set(s,s,s); });
    rings.forEach(({ring}) => {
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

    // Raycasting
    if (mouse.x !== 9999) {
      ray.setFromCamera(mouse, camera);
      const hits = ray.intersectObjects(antennas, true);
      if (hits.length) {
        let p = hits[0].object;
        while (p && !p.userData.kpi) p = p.parent;
        if (p?.userData.kpi) {
          const k = p.userData.kpi;
          const val = typeof k.valeur === 'number'
            ? k.valeur.toLocaleString('fr-FR') + (k.unite ? ' ' + k.unite : '')
            : String(k.valeur ?? '') + (k.unite ? ' ' + k.unite : '');
          tt.innerHTML = `<span style="color:#d4a437;font-weight:700;display:block;margin-bottom:2px">${k.label}</span><span style="color:#ecd28a;font-size:.82em">${val}</span>`;
          tt.style.left = (mxPx + 14) + 'px';
          tt.style.top  = (myPx + 14) + 'px';
          tt.style.opacity = '1';
          renderer.domElement.style.cursor = 'crosshair';
        } else { tt.style.opacity = '0'; renderer.domElement.style.cursor = ''; }
      } else { tt.style.opacity = '0'; renderer.domElement.style.cursor = ''; }
    }

    ctrl.update();
    renderer.render(scene, camera);
  })();

  return { dispose() {
    cancelAnimationFrame(fid); ro.disconnect(); ctrl.dispose(); renderer.dispose();
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
    if (tt.parentNode) tt.parentNode.removeChild(tt);
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }};
}
