/**
 * Design Themes Engine — Telecom Generator
 * 5 thèmes visuels complets avec animations canvas
 */

const DESIGNS = {
    quantum: {
        label: 'Quantum',
        icon: '⚡',
        desc: '5G · Néon violet',
        vars: {
            '--primary': '#8B5CF6', '--secondary': '#06B6D4', '--accent': '#EC4899',
            '--bg-dark': '#0F0F23', '--surface': '#1A1A35',
            '--glass-bg': 'rgba(15,15,35,0.75)', '--glass-border': 'rgba(255,255,255,0.08)',
            '--text-light': '#F3F4F6', '--text-dim': '#9CA3AF',
        },
        start: startQuantumBg,
    },
    cosmos: {
        label: 'Cosmos',
        icon: '🛰',
        desc: 'Espace · Satellites',
        vars: {
            '--primary': '#A78BFA', '--secondary': '#60A5FA', '--accent': '#FCD34D',
            '--bg-dark': '#020410', '--surface': '#0A0E2A',
            '--glass-bg': 'rgba(10,14,42,0.82)', '--glass-border': 'rgba(167,139,250,0.2)',
            '--text-light': '#E8EAF6', '--text-dim': '#94A3B8',
        },
        start: startCosmosBg,
    },
    neon: {
        label: 'NeonCity',
        icon: '🌆',
        desc: 'Cyberpunk · Néon',
        vars: {
            '--primary': '#00FFFF', '--secondary': '#FF00FF', '--accent': '#00FF41',
            '--bg-dark': '#000000', '--surface': '#080808',
            '--glass-bg': 'rgba(0,0,0,0.9)', '--glass-border': 'rgba(0,255,255,0.25)',
            '--text-light': '#E0FFFF', '--text-dim': '#4DD0E1',
        },
        start: startNeonBg,
    },
    bloom: {
        label: 'Bloom',
        icon: '🌸',
        desc: 'Startup · Lumineux',
        vars: {
            '--primary': '#7C3AED', '--secondary': '#2563EB', '--accent': '#EC4899',
            '--bg-dark': '#F8FAFC', '--surface': '#FFFFFF',
            '--glass-bg': 'rgba(255,255,255,0.92)', '--glass-border': 'rgba(0,0,0,0.07)',
            '--text-light': '#0F172A', '--text-dim': '#64748B',
        },
        start: startBloomBg,
    },
    enterprise: {
        label: 'Enterprise',
        icon: '🏢',
        desc: 'Corporate · Pro',
        vars: {
            '--primary': '#3B82F6', '--secondary': '#0EA5E9', '--accent': '#F59E0B',
            '--bg-dark': '#0D1B2A', '--surface': '#1B2A3B',
            '--glass-bg': 'rgba(13,27,42,0.85)', '--glass-border': 'rgba(255,255,255,0.07)',
            '--text-light': '#E2E8F0', '--text-dim': '#94A3B8',
        },
        start: startEnterpriseBg,
    },
};

let currentCanvas = null;
let currentAnimId = null;

export function applyDesign(name) {
    const design = DESIGNS[name];
    if (!design) return;

    // Stop previous animation
    if (currentAnimId) { cancelAnimationFrame(currentAnimId); currentAnimId = null; }
    if (currentCanvas) { currentCanvas.remove(); currentCanvas = null; }

    // Apply CSS vars
    const root = document.documentElement;
    Object.entries(design.vars).forEach(([k, v]) => root.style.setProperty(k, v));

    // Apply body class
    document.body.dataset.design = name;
    localStorage.setItem('design', name);

    // Highlight active swatch
    document.querySelectorAll('.design-swatch').forEach(s =>
        s.classList.toggle('active', s.dataset.design === name)
    );

    // Start background
    if (design.start) currentCanvas = design.start();
}

export function getDesigns() { return DESIGNS; }
export function initDesignSwitcher() {
    document.querySelectorAll('.design-swatch').forEach(s =>
        s.addEventListener('click', () => applyDesign(s.dataset.design))
    );
    const saved = localStorage.getItem('design') || 'quantum';
    applyDesign(saved);
}

// ── QUANTUM ──────────────────────────────────────────────────────────────────
function startQuantumBg() {
    const cv = mkCanvas();
    const ctx = cv.getContext('2d');
    const nodes = Array.from({ length: 60 }, () => ({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * 0.0003,
        vy: (Math.random() - 0.5) * 0.0003,
        r: Math.random() * 2 + 1,
    }));
    function draw() {
        currentAnimId = requestAnimationFrame(draw);
        ctx.clearRect(0, 0, cv.width, cv.height);
        const W = cv.width, H = cv.height;
        nodes.forEach(n => {
            n.x = (n.x + n.vx + 1) % 1;
            n.y = (n.y + n.vy + 1) % 1;
        });
        // Lines between close nodes
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = (nodes[i].x - nodes[j].x) * W;
                const dy = (nodes[i].y - nodes[j].y) * H;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 150) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(139,92,246,${0.15 * (1 - d / 150)})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(nodes[i].x * W, nodes[i].y * H);
                    ctx.lineTo(nodes[j].x * W, nodes[j].y * H);
                    ctx.stroke();
                }
            }
        }
        nodes.forEach(n => {
            ctx.beginPath();
            ctx.arc(n.x * W, n.y * H, n.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(139,92,246,0.5)';
            ctx.fill();
        });
    }
    draw();
    return cv;
}

// ── COSMOS ───────────────────────────────────────────────────────────────────
function startCosmosBg() {
    const cv = mkCanvas();
    const ctx = cv.getContext('2d');
    const stars = Array.from({ length: 250 }, () => ({
        x: Math.random(), y: Math.random(),
        r: Math.random() * 1.4 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.008 + 0.003,
    }));
    let t = 0;
    function draw() {
        currentAnimId = requestAnimationFrame(draw);
        ctx.clearRect(0, 0, cv.width, cv.height);
        const W = cv.width, H = cv.height;
        t += 0.005;

        // Nebula glow blobs
        [
            [0.75, 0.2, 350, '167,139,250'],
            [0.15, 0.7, 280, '96,165,250'],
            [0.5, 0.5, 200, '253,211,77'],
        ].forEach(([bx, by, br, c]) => {
            const gx = bx + Math.sin(t * 0.3) * 0.05;
            const gy = by + Math.cos(t * 0.25) * 0.05;
            const g = ctx.createRadialGradient(gx * W, gy * H, 0, gx * W, gy * H, br);
            g.addColorStop(0, `rgba(${c},0.07)`);
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        });

        // Stars twinkle
        stars.forEach(s => {
            const alpha = 0.25 + Math.sin(t * s.speed + s.phase) * 0.25;
            ctx.beginPath();
            ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.fill();
        });

        // Satellite
        const satX = W / 2 + Math.cos(t * 0.4) * W * 0.38;
        const satY = H / 2 + Math.sin(t * 0.27) * H * 0.22;
        ctx.save();
        ctx.translate(satX, satY);
        ctx.rotate(t * 0.4);
        ctx.shadowColor = 'rgba(167,139,250,0.8)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = 'rgba(167,139,250,0.85)';
        ctx.fillRect(-9, -4, 18, 8);
        ctx.fillStyle = 'rgba(96,165,250,0.9)';
        ctx.fillRect(-26, -2, 15, 4);
        ctx.fillRect(11, -2, 15, 4);
        ctx.shadowBlur = 0;
        ctx.restore();

        // Second smaller satellite
        const s2x = W * 0.2 + Math.cos(t * 0.6 + 2) * W * 0.15;
        const s2y = H * 0.3 + Math.sin(t * 0.5 + 1) * H * 0.12;
        ctx.save();
        ctx.translate(s2x, s2y);
        ctx.rotate(-t * 0.6);
        ctx.fillStyle = 'rgba(253,211,77,0.7)';
        ctx.fillRect(-5, -2, 10, 4);
        ctx.fillStyle = 'rgba(96,165,250,0.7)';
        ctx.fillRect(-14, -1.5, 8, 3);
        ctx.fillRect(6, -1.5, 8, 3);
        ctx.restore();
    }
    draw();
    return cv;
}

// ── NEON CITY ─────────────────────────────────────────────────────────────────
function startNeonBg() {
    const cv = mkCanvas();
    const ctx = cv.getContext('2d');
    let t = 0;
    const particles = Array.from({ length: 40 }, () => ({
        x: Math.random(),
        y: Math.random(),
        speed: Math.random() * 0.0008 + 0.0004,
        color: ['0,255,255', '255,0,255', '0,255,65'][Math.floor(Math.random() * 3)],
        trail: [],
    }));

    function draw() {
        currentAnimId = requestAnimationFrame(draw);
        ctx.clearRect(0, 0, cv.width, cv.height);
        const W = cv.width, H = cv.height;
        t += 0.012;

        // Grid
        const gs = 56;
        for (let x = 0; x < W; x += gs) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H);
            ctx.strokeStyle = 'rgba(0,255,255,0.04)'; ctx.lineWidth = 1; ctx.stroke();
        }
        for (let y = 0; y < H; y += gs) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y);
            ctx.strokeStyle = 'rgba(0,255,255,0.04)'; ctx.lineWidth = 1; ctx.stroke();
        }

        // Scanlines
        for (let y = 0; y < H; y += 3) {
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.fillRect(0, y, W, 1.5);
        }

        // Neon horizon pulse
        const hy = H * 0.6;
        const hg = ctx.createLinearGradient(0, hy - 40, 0, hy + 40);
        hg.addColorStop(0, 'transparent');
        hg.addColorStop(0.5, `rgba(0,255,255,${0.03 + Math.sin(t) * 0.02})`);
        hg.addColorStop(1, 'transparent');
        ctx.fillStyle = hg; ctx.fillRect(0, hy - 40, W, 80);

        // Moving particles with trails
        particles.forEach(p => {
            p.y = (p.y - p.speed + 1) % 1;
            p.trail.unshift({ x: p.x * W, y: p.y * H });
            if (p.trail.length > 20) p.trail.pop();
            p.trail.forEach((pt, i) => {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 1.5 - i * 0.06, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${p.color},${(1 - i / 20) * 0.6})`;
                ctx.fill();
            });
        });

        // Vertical neon bars
        [0.2, 0.5, 0.8].forEach((bx, i) => {
            const barGlow = ctx.createLinearGradient(bx * W - 2, 0, bx * W + 2, 0);
            barGlow.addColorStop(0, 'transparent');
            barGlow.addColorStop(0.5, `rgba(0,255,255,${0.06 + Math.sin(t + i) * 0.03})`);
            barGlow.addColorStop(1, 'transparent');
            ctx.fillStyle = barGlow;
            ctx.fillRect(bx * W - 20, 0, 40, H);
        });
    }
    draw();
    return cv;
}

// ── BLOOM ─────────────────────────────────────────────────────────────────────
function startBloomBg() {
    const cv = mkCanvas();
    const ctx = cv.getContext('2d');
    let t = 0;
    const blobs = [
        { x: 0.18, y: 0.25, r: 380, c: '124,58,237', sp: 0.0007 },
        { x: 0.82, y: 0.55, r: 440, c: '37,99,235',  sp: 0.0005 },
        { x: 0.45, y: 0.82, r: 300, c: '236,72,153', sp: 0.0009 },
        { x: 0.65, y: 0.15, r: 250, c: '16,185,129', sp: 0.0006 },
    ];

    function draw() {
        currentAnimId = requestAnimationFrame(draw);
        ctx.clearRect(0, 0, cv.width, cv.height);
        const W = cv.width, H = cv.height;
        t += 0.004;

        blobs.forEach((b, i) => {
            const bx = (b.x + Math.sin(t * b.sp * 800 + i * 1.3) * 0.08) * W;
            const by = (b.y + Math.cos(t * b.sp * 700 + i * 1.1) * 0.08) * H;
            const g = ctx.createRadialGradient(bx, by, 0, bx, by, b.r);
            g.addColorStop(0, `rgba(${b.c},0.12)`);
            g.addColorStop(0.5, `rgba(${b.c},0.05)`);
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        });

        // Subtle grid dots
        const dotStep = 40;
        for (let x = 0; x < W; x += dotStep) {
            for (let y = 0; y < H; y += dotStep) {
                ctx.beginPath();
                ctx.arc(x, y, 1, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,0,0,0.04)';
                ctx.fill();
            }
        }
    }
    draw();
    return cv;
}

// ── ENTERPRISE ────────────────────────────────────────────────────────────────
function startEnterpriseBg() {
    const cv = mkCanvas();
    const ctx = cv.getContext('2d');
    let t = 0;
    const lines = Array.from({ length: 8 }, (_, i) => ({ phase: i * 0.8, speed: 0.0003 + i * 0.0001 }));

    function draw() {
        currentAnimId = requestAnimationFrame(draw);
        ctx.clearRect(0, 0, cv.width, cv.height);
        const W = cv.width, H = cv.height;
        t += 0.005;

        // Subtle mesh
        for (let x = 0; x < W; x += 80) {
            for (let y = 0; y < H; y += 80) {
                ctx.strokeStyle = 'rgba(59,130,246,0.04)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x, y, 80, 80);
            }
        }

        // Data flow lines
        lines.forEach((l, i) => {
            const y = (i / lines.length + (t * l.speed * 200)) % 1 * H;
            const g = ctx.createLinearGradient(0, y, W, y);
            g.addColorStop(0, 'transparent');
            g.addColorStop(0.3, `rgba(59,130,246,0.06)`);
            g.addColorStop(0.7, `rgba(14,165,233,0.06)`);
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.fillRect(0, y - 1, W, 2);
        });

        // Corner accent
        const cg = ctx.createRadialGradient(W, 0, 0, W, 0, 500);
        cg.addColorStop(0, 'rgba(59,130,246,0.08)');
        cg.addColorStop(1, 'transparent');
        ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
    }
    draw();
    return cv;
}

// ── Helper ────────────────────────────────────────────────────────────────────
function mkCanvas() {
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none';
    cv.width = window.innerWidth;
    cv.height = window.innerHeight;
    window.addEventListener('resize', () => {
        cv.width = window.innerWidth;
        cv.height = window.innerHeight;
    });
    document.body.appendChild(cv);
    return cv;
}
