/**
 * Scène 3D — Three.js 0.160
 * Thème : Algeria Tech Premium
 * Généré par Algeria Tech Generator
 * Hover interactif : raycaster + étiquettes KPI fluides
 */

export async function initScene3D(container) {
    const THREE = await import('https://unpkg.com/three@0.160.0/build/three.module.js');
    const { OrbitControls } = await import('https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js');

    const w = container.clientWidth || 600;
    const h = container.clientHeight || 520;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0e1a, 0.022);

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
    camera.position.set(0, 2, 22);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0, 0);
    container.style.position = 'relative';
    container.appendChild(renderer.domElement);

    // ── Couleurs palette ────────────────────────────────────────────────
    const hex = s => parseInt(s.replace('#', ''), 16);
    const c1 = hex('#D4A437');
    const c2 = hex('#2D8A5F');
    const c3 = hex('#B85042');

    // ── Éclairage ───────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.28));
    const lA = new THREE.PointLight(c1, 2.4, 65); lA.position.set(10, 12, 10); scene.add(lA);
    const lB = new THREE.PointLight(c2, 1.8, 55); lB.position.set(-12, -8, 6);  scene.add(lB);
    const lC = new THREE.PointLight(c3, 1.2, 40); lC.position.set(0, -10, -8);  scene.add(lC);

    // ── Objet central ───────────────────────────────────────────────────
    
    const centralGeo = new THREE.IcosahedronGeometry(2.4, 2);
    
    const crystal = new THREE.Mesh(centralGeo, new THREE.MeshStandardMaterial({
        color: c1, metalness: 0.82, roughness: 0.14, transparent: true, opacity: 0.88
    }));
    crystal.userData.kpi = { label: 'Observatoire du Marché de la Téléphonie…', value: 'Synthèse interactive · Source : tmpb0ytarax.csv', unit: '' };
    scene.add(crystal);

    const wireframe = new THREE.Mesh(
        new THREE.IcosahedronGeometry(2.46, 2),
        new THREE.MeshBasicMaterial({ color: c1, wireframe: true, transparent: true, opacity: 0.18 })
    );
    scene.add(wireframe);

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.2, 0.04, 8, 80),
        new THREE.MeshBasicMaterial({ color: c1, transparent: true, opacity: 0.35 })
    );
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    // ── Sphères orbitales avec étiquettes KPI ───────────────────────────
    const kpiData = [
        
        { label: "Valeur", value: 1, unit: "" }
        
    ];
    const orbColors = [c1, c2, c3, c2, c1];
    const orbs = kpiData.slice(0, 3).map((kpi, i) => {
        const radius = 5.5 + i * 1.8;
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.48, 22, 22),
            new THREE.MeshStandardMaterial({
                color: orbColors[i], emissive: orbColors[i], emissiveIntensity: 0.75, roughness: 0.2, metalness: 0.6
            })
        );
        mesh.userData.kpi = kpi;

        const halo = new THREE.Mesh(
            new THREE.SphereGeometry(0.78, 14, 14),
            new THREE.MeshBasicMaterial({ color: orbColors[i], transparent: true, opacity: 0.1, side: THREE.BackSide })
        );
        mesh.add(halo);

        // Orbite de référence
        const orbitPts = [];
        for (let s = 0; s <= 128; s++) {
            const a = (s / 128) * Math.PI * 2;
            orbitPts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius * 0.55));
        }
        scene.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(orbitPts),
            new THREE.LineBasicMaterial({ color: orbColors[i], transparent: true, opacity: 0.08 })
        ));

        const connGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const conn = new THREE.Line(connGeo, new THREE.LineBasicMaterial({ color: orbColors[i], transparent: true, opacity: 0.45 }));
        scene.add(mesh);
        scene.add(conn);
        return { mesh, conn, radius, phi: (i / 3) * Math.PI * 2, spd: 0.26 + i * 0.09 };
    });

    // ── Grille de fond sinusoïdale ───────────────────────────────────────
    const gRes = 40, gSize = 12;
    const fGeo = new THREE.BufferGeometry();
    const fVerts = new Float32Array((gRes + 1) * (gRes + 1) * 3);
    let vi = 0;
    for (let iy = 0; iy <= gRes; iy++) for (let ix = 0; ix <= gRes; ix++) {
        const x = (ix / gRes - 0.5) * gSize, z = (iy / gRes - 0.5) * gSize;
        const y = Math.sin(x * 1.1) * Math.cos(z * 1.1) * 0.5 + Math.sin(x * 2.3 + 1.2) * Math.cos(z * 1.7) * 0.22;
        fVerts[vi++] = x; fVerts[vi++] = y - 6; fVerts[vi++] = z;
    }
    fGeo.setAttribute('position', new THREE.BufferAttribute(fVerts, 3));
    scene.add(new THREE.Mesh(fGeo, new THREE.MeshStandardMaterial({ color: c2, wireframe: true, transparent: true, opacity: 0.09 })));

    // ── Nuage de particules ──────────────────────────────────────────────
    const N = 1800;
    const pp = new Float32Array(N * 3), pc = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
        pp[i * 3] = (Math.random() - 0.5) * 130;
        pp[i * 3 + 1] = (Math.random() - 0.5) * 130;
        pp[i * 3 + 2] = (Math.random() - 0.5) * 75 - 12;
        const col = new THREE.Color(c1).lerp(new THREE.Color(c2), Math.random());
        pc[i * 3] = col.r; pc[i * 3 + 1] = col.g; pc[i * 3 + 2] = col.b;
    }
    const pG = new THREE.BufferGeometry();
    pG.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    pG.setAttribute('color', new THREE.BufferAttribute(pc, 3));
    scene.add(new THREE.Points(pG, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0.5 })));

    // ── Tooltip hover ────────────────────────────────────────────────────
    const tt = document.createElement('div');
    tt.style.cssText = [
        'position:absolute', 'pointer-events:none',
        'background:rgba(10,14,26,.94)',
        'border:1px solid rgba(212,164,55,.6)',
        'border-radius:10px', 'padding:9px 16px',
        'font-family:var(--font-body,"Manrope",sans-serif)',
        'font-size:.72rem', 'letter-spacing:.04em',
        'color:#f4ede0', 'white-space:nowrap',
        'opacity:0', 'transition:opacity .15s ease',
        'box-shadow:0 6px 32px rgba(0,0,0,.65)',
        'backdrop-filter:blur(12px)',
        'z-index:20', 'transform:translate(-50%,-140%)',
        'text-align:center', 'line-height:1.6'
    ].join(';');
    container.appendChild(tt);

    // ── Raycaster ────────────────────────────────────────────────────────
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2(9999, 9999);
    let mxPx = 0, myPx = 0;

    renderer.domElement.addEventListener('pointermove', e => {
        const rect = renderer.domElement.getBoundingClientRect();
        mxPx = e.clientX - rect.left;
        myPx = e.clientY - rect.top;
        mouse.x = (mxPx / rect.width) * 2 - 1;
        mouse.y = -(myPx / rect.height) * 2 + 1;
    });
    renderer.domElement.addEventListener('pointerleave', () => {
        mouse.set(9999, 9999);
        tt.style.opacity = '0';
    });

    const hitTargets = [crystal, ...orbs.map(o => o.mesh)];

    // ── Contrôles orbitaux ───────────────────────────────────────────────
    const ctrl = new OrbitControls(camera, renderer.domElement);
    ctrl.enableDamping = true; ctrl.dampingFactor = 0.06;
    ctrl.autoRotate = true; ctrl.autoRotateSpeed = 0.55;
    ctrl.minDistance = 8; ctrl.maxDistance = 28;
    ctrl.enablePan = false;

    // ── ResizeObserver ───────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
        const nw = container.clientWidth, nh = container.clientHeight;
        if (!nw || !nh) return;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
    });
    ro.observe(container);

    // ── Boucle d'animation ───────────────────────────────────────────────
    const clock = new THREE.Clock();
    let frameId;

    (function animate() {
        frameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        crystal.rotation.y += 0.003;
        crystal.rotation.x += 0.001;
        wireframe.rotation.copy(crystal.rotation);
        ring.rotation.z += 0.004;

        lA.intensity = 2.4 + Math.sin(t * 1.2) * 0.4;
        lB.intensity = 1.8 + Math.sin(t * 0.8 + 1) * 0.3;

        orbs.forEach(o => {
            o.phi += o.spd * 0.008;
            o.mesh.position.set(
                Math.cos(o.phi) * o.radius,
                Math.sin(o.phi * 0.65) * 2.2,
                Math.sin(o.phi) * o.radius * 0.52
            );
            o.conn.geometry.setFromPoints([new THREE.Vector3(), o.mesh.position.clone()]);
        });

        // Hover raycasting
        if (mouse.x !== 9999) {
            ray.setFromCamera(mouse, camera);
            const hits = ray.intersectObjects(hitTargets, true);
            if (hits.length) {
                let obj = hits[0].object;
                while (obj && !obj.userData.kpi) obj = obj.parent;
                if (obj?.userData.kpi) {
                    const k = obj.userData.kpi;
                    const val = typeof k.value === 'number'
                        ? k.value.toLocaleString('fr-FR') + (k.unit ? ' ' + k.unit : '')
                        : String(k.value ?? '') + (k.unit ? ' ' + k.unit : '');
                    tt.innerHTML = `<span style="color:#d4a437;font-weight:700;display:block;margin-bottom:2px">${k.label}</span><span style="color:#ecd28a;font-size:.82em">${val}</span>`;
                    tt.style.left = mxPx + 'px';
                    tt.style.top  = myPx + 'px';
                    tt.style.opacity = '1';
                    renderer.domElement.style.cursor = 'crosshair';
                } else { tt.style.opacity = '0'; renderer.domElement.style.cursor = ''; }
            } else { tt.style.opacity = '0'; renderer.domElement.style.cursor = ''; }
        }

        ctrl.update();
        renderer.render(scene, camera);
    })();

    return () => {
        cancelAnimationFrame(frameId);
        ro.disconnect();
        ctrl.dispose();
        renderer.dispose();
        scene.traverse(o => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
                if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
                else o.material.dispose();
            }
        });
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        if (tt.parentNode) tt.parentNode.removeChild(tt);
    };
}
