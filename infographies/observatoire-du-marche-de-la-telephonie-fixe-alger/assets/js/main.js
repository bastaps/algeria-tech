/**
 * Main — Orchestration complète : animations, interactions, init
 * Thème Algeria Tech Premium
 */

import { initCharts } from './charts.js';
import { initDesignSwitcher } from './design-themes.js';
import { initAIPanel } from './ai-panel.js';
import { DATASET } from './data.js';

// ── Loader ────────────────────────────────────────────────────────────────────
// Attendre window.load garantit que Chart.js (defer) est prêt
window.addEventListener('load', () => {
    const loader = document.getElementById('loader');
    if (loader) setTimeout(() => loader.classList.add('fade-out'), 500);

    // Charts : Chart.js est maintenant disponible (defer exécuté)
    if (window.Chart) {
        initCharts();
    } else {
        // Sécurité : polling si chart.js tarde
        const poll = setInterval(() => {
            if (window.Chart) { clearInterval(poll); initCharts(); }
        }, 60);
        setTimeout(() => clearInterval(poll), 5000);
    }

    // Scène 3D
    const scene3dEl = document.getElementById('scene3d-canvas');
    if (scene3dEl) {
        import('./scene3d.js')
            .then(m => m.initScene3D?.(scene3dEl))
            .catch(() => {
                scene3dEl.innerHTML = '<p style="padding:56px;text-align:center;color:#94a3b8;font-size:14px;">WebGL non disponible sur ce navigateur</p>';
            });
    }

    initDesignSwitcher();
    initAIPanel();
});

// ── Scroll reveals ────────────────────────────────────────────────────────────
const revealEls = Array.from(document.querySelectorAll('.reveal'));

const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); }
    });
}, { threshold: 0.05 });
revealEls.forEach(el => revealObs.observe(el));

// Secours : forcer l'affichage de tout ce qui n'a pas encore reçu 'in' après 1.5s
setTimeout(() => {
    revealEls.forEach(el => { if (!el.classList.contains('in')) el.classList.add('in', 'reveal-forced'); });
}, 1500);

// ── KPI Counter animation ─────────────────────────────────────────────────────
function animateCounter(el, target, duration = 2000) {
    const isFloat = !Number.isInteger(target) || String(el.dataset.countTo).includes('.');
    const decimals = isFloat ? (String(el.dataset.countTo).split('.')[1]?.length || 1) : 0;
    const start = performance.now();

    function step(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = p < 1 ? 1 - Math.pow(1 - p, 4) : 1;   // ease-out-quart
        const val = target * eased;
        el.textContent = val.toLocaleString('fr-FR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

const counterObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            const target = parseFloat(e.target.dataset.countTo);
            if (!isNaN(target)) animateCounter(e.target, target);
            counterObs.unobserve(e.target);
        }
    });
}, { threshold: 0.6 });
document.querySelectorAll('[data-count-to]').forEach(el => counterObs.observe(el));

// ── Navigation active au scroll ───────────────────────────────────────────────
const sections = document.querySelectorAll('.section[id]');
const navLinks = document.querySelectorAll('.section-nav a');
window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(s => { if (scrollY >= s.offsetTop - 220) current = s.id; });
    navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href')?.slice(1) === current));
}, { passive: true });

// ── Parallax hero aurora ──────────────────────────────────────────────────────
const aurora = document.querySelector('.aurora-bg');
window.addEventListener('scroll', () => {
    if (aurora) aurora.style.transform = `translateY(${scrollY * 0.28}px)`;
}, { passive: true });

// ── Topbar collapse au scroll ─────────────────────────────────────────────────
const topbar = document.querySelector('.topbar');
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (topbar) topbar.classList.toggle('scrolled', y > 60);
    lastScroll = y;
}, { passive: true });

// ── FAB ───────────────────────────────────────────────────────────────────────
document.getElementById('fab-fullscreen')?.addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
});
document.getElementById('fab-top')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── Keyboard nav ──────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F') document.getElementById('fab-fullscreen')?.click();
});

// ── Toast global ─────────────────────────────────────────────────────────────
window.showToast = (msg, type = 'success') => {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.background = type === 'error' ? '#ef4444' : 'linear-gradient(135deg,var(--primary),var(--secondary))';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2600);
};

console.log(`✓ DataSlides · ${DATASET?.kpis?.length ?? 0} KPIs · ${DATASET?.charts?.length ?? 0} graphiques`);

// ═══════════════════════════════════════════════════════════════════════════════
//  SLIDE DECK — Navigation du contenu document
// ═══════════════════════════════════════════════════════════════════════════════
(function initSlideDeck() {
    const viewport = document.getElementById('slide-viewport');
    if (!viewport) return;

    const cards = Array.from(viewport.querySelectorAll('.slide-card'));
    const thumbs = Array.from(document.querySelectorAll('.slide-thumb'));
    const currentEl = document.getElementById('slide-current');
    const fill = document.getElementById('slide-fill');
    let current = 0;
    let playTimer = null;

    function goTo(idx, dir = 1) {
        if (idx === current) return;
        const prev = cards[current];
        const next = cards[idx];
        if (!next) return;

        prev.classList.remove('active');
        prev.classList.add('exit');
        next.style.transform = dir > 0 ? 'translateX(60px)' : 'translateX(-60px)';
        next.classList.add('active');

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                prev.classList.remove('exit');
                // Reset inline transform so CSS transition takes over
                next.style.transform = '';
            });
        });

        thumbs[current]?.classList.remove('active');
        thumbs[idx]?.classList.add('active');
        thumbs[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

        current = idx;
        if (currentEl) currentEl.textContent = idx + 1;
        const pct = cards.length > 1 ? (idx / (cards.length - 1)) * 100 : 100;
        if (fill) fill.style.width = pct + '%';
    }

    document.getElementById('slide-prev')?.addEventListener('click', () => {
        goTo((current - 1 + cards.length) % cards.length, -1);
    });
    document.getElementById('slide-next')?.addEventListener('click', () => {
        goTo((current + 1) % cards.length, 1);
    });
    thumbs.forEach((th, i) => th.addEventListener('click', () => goTo(i)));

    // Auto-play
    const playBtn = document.getElementById('slide-play');
    playBtn?.addEventListener('click', () => {
        if (playTimer) {
            clearInterval(playTimer);
            playTimer = null;
            playBtn.textContent = '▶';
            playBtn.classList.remove('playing');
        } else {
            playBtn.textContent = '⏸';
            playBtn.classList.add('playing');
            playTimer = setInterval(() => goTo((current + 1) % cards.length, 1), 3500);
        }
    });

    // Swipe touch
    let touchX = 0;
    viewport.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
    viewport.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 40) goTo(dx < 0
            ? (current + 1) % cards.length
            : (current - 1 + cards.length) % cards.length, dx < 0 ? 1 : -1);
    }, { passive: true });

    // Keyboard arrow keys
    document.addEventListener('keydown', e => {
        if (!document.getElementById('document')) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo((current + 1) % cards.length, 1);
        if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goTo((current - 1 + cards.length) % cards.length, -1);
    });

    // Init progress bar
    if (fill) fill.style.width = cards.length === 1 ? '100%' : '0%';
})();

// ═══════════════════════════════════════════════════════════════════════════════
//  TABLEAUX DYNAMIQUES — Tri et filtrage
// ═══════════════════════════════════════════════════════════════════════════════
(function initDocTables() {
    document.querySelectorAll('.doc-sortable').forEach(table => {
        const tbody = table.querySelector('tbody');
        const headers = Array.from(table.querySelectorAll('thead th.sortable'));
        const allRows = () => Array.from(tbody.querySelectorAll('tr'));

        // Tri colonne
        headers.forEach((th, colIdx) => {
            let asc = null;
            th.addEventListener('click', () => {
                asc = asc === true ? false : true;
                headers.forEach(h => { h.classList.remove('sort-asc', 'sort-desc'); h.querySelector('.sort-icon').textContent = '⇅'; });
                th.classList.add(asc ? 'sort-asc' : 'sort-desc');
                th.querySelector('.sort-icon').textContent = asc ? '▲' : '▼';

                const rows = allRows().filter(r => !r.classList.contains('filtered-out'));
                rows.sort((a, b) => {
                    const va = a.cells[colIdx]?.textContent.trim() || '';
                    const vb = b.cells[colIdx]?.textContent.trim() || '';
                    const na = parseFloat(va.replace(/[\s,]/g, ''));
                    const nb = parseFloat(vb.replace(/[\s,]/g, ''));
                    if (!isNaN(na) && !isNaN(nb)) return asc ? na - nb : nb - na;
                    return asc ? va.localeCompare(vb, 'fr') : vb.localeCompare(va, 'fr');
                });
                rows.forEach(r => tbody.appendChild(r));
                window.showToast?.(`Trié par « ${th.textContent.trim().replace(/[⇅▲▼]/g, '').trim()} » ${asc ? '▲' : '▼'}`);
            });
            th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') th.click(); });
        });
    });

    // Filtrage par recherche
    document.querySelectorAll('.doc-table-search').forEach(input => {
        const tableId = input.dataset.target;
        const table = document.getElementById('doc-table-' + tableId);
        if (!table) return;
        input.addEventListener('input', () => {
            const q = input.value.toLowerCase().trim();
            table.querySelectorAll('tbody tr').forEach(row => {
                const match = !q || row.textContent.toLowerCase().includes(q);
                row.classList.toggle('filtered-out', !match);
            });
        });
    });

    // Export CSV
    document.querySelectorAll('.doc-table-export-btn').forEach(btn => {
        const tableId = btn.dataset.table;
        const table = document.getElementById('doc-table-' + tableId);
        if (!table) return;
        btn.addEventListener('click', () => {
            const rows = Array.from(table.querySelectorAll('tr'))
                .filter(r => !r.classList.contains('filtered-out'));
            const csv = rows.map(r =>
                Array.from(r.cells).map(c => `"${c.textContent.trim().replace(/"/g, '""')}"`).join(',')
            ).join('\r\n');
            const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
            const a = Object.assign(document.createElement('a'), {
                href: URL.createObjectURL(blob),
                download: `tableau-${parseInt(tableId) + 1}.csv`,
            });
            a.click();
            URL.revokeObjectURL(a.href);
            window.showToast?.('CSV exporté');
        });
    });
})();
