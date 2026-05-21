/**
 * Charts — Visualisations Chart.js premium
 * Thème Algeria Tech Premium
 */

import { DATASET, THEME, fmt } from './data.js';

// ── Palette thème ─────────────────────────────────────────────────────────────
const C = [
    "#D4A437",
    "#2D8A5F",
    "#B85042",
    "#F59E0B",
    "#10B981",
    "#6366F1",
    "#EC4899",
    "#14B8A6",
];

const BG = "#0a0e1a";

// ── Config globale Chart.js ───────────────────────────────────────────────────
Chart.defaults.font.family    = "'Manrope', sans-serif";
Chart.defaults.font.size      = 16;
Chart.defaults.color          = "#A89880";
Chart.defaults.borderColor    = "rgba(255,255,255,0.05)";
Chart.defaults.plugins.legend.labels.color   = "#F4EDE0";
Chart.defaults.plugins.legend.labels.padding = 18;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.tooltip.backgroundColor = "rgba(10,10,30,0.95)";
Chart.defaults.plugins.tooltip.titleColor    = "#D4A437";
Chart.defaults.plugins.tooltip.bodyColor     = "#F4EDE0";
Chart.defaults.plugins.tooltip.borderColor   = "#D4A437";
Chart.defaults.plugins.tooltip.borderWidth   = 1;
Chart.defaults.plugins.tooltip.padding       = 14;
Chart.defaults.plugins.tooltip.cornerRadius  = 10;

// ── Instances ─────────────────────────────────────────────────────────────────
const INSTANCES = {};

// ── Helper : gradient canvas ──────────────────────────────────────────────────
function mkGrad(ctx, color, alpha1 = 0.55, alpha2 = 0.0) {
    const [r, g, b] = hexToRgb(color);
    const g2 = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height || 300);
    g2.addColorStop(0, `rgba(${r},${g},${b},${alpha1})`);
    g2.addColorStop(1, `rgba(${r},${g},${b},${alpha2})`);
    return g2;
}

function hexToRgb(hex) {
    const m = hex.replace('#','').match(/../g);
    return m ? m.map(h => parseInt(h, 16)) : [139, 92, 246];
}

function alpha(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
}

// ── Fabrique de dataset visuel ────────────────────────────────────────────────
function buildDatasets(def, canvasCtx) {
    return (def.datasets || []).map((ds, i) => {
        const color = C[i % C.length];
        const isArea = def.fill || def.type === 'line';
        const isDough = def.type === 'doughnut' || def.type === 'pie';
        const isPolar = def.type === 'polarArea';

        let bg;
        if (isDough || isPolar) {
            bg = C.map(c => alpha(c, 0.82));
        } else if (isArea) {
            bg = mkGrad(canvasCtx, color, 0.45, 0.02);
        } else {
            bg = alpha(color, 0.75);
        }

        return {
            ...ds,
            borderColor:        isDough || isPolar ? C.map(c => alpha(c, 1)) : color,
            backgroundColor:    bg,
            fill:               def.fill || false,
            tension:            0.42,
            borderWidth:        isDough || isPolar ? 2 : 2.5,
            pointRadius:        def.type === 'line' ? 5 : 0,
            pointBackgroundColor: color,
            pointBorderColor:   BG,
            pointBorderWidth:   2,
            pointHoverRadius:   8,
            pointHoverBackgroundColor: color,
            hoverOffset:        isDough ? 12 : 0,
        };
    });
}

// ── Options communes ──────────────────────────────────────────────────────────
function buildOptions(def) {
    const isRound  = def.type === 'doughnut' || def.type === 'pie' || def.type === 'polarArea' || def.type === 'radar';

    const animation = {
        duration: 1400,
        easing:   'easeOutQuart',
    };

    const scales = isRound ? {} : {
        y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.04)', drawTicks: false },
            border: { display: false },
            ticks: {
                callback: v => fmt.nombre(v),
                padding: 8,
            },
        },
        x: {
            grid: { display: false },
            border: { display: false },
            ticks: { padding: 6 },
        },
    };

    if (def.stacked) {
        scales.x.stacked = true;
        scales.y.stacked = true;
    }

    return {
        responsive:          true,
        maintainAspectRatio: true,
        animation,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: {
                position:  isRound && def.type !== 'radar' ? 'right' : 'top',
                labels: { padding: 18, usePointStyle: true, pointStyleWidth: 10 },
            },
            tooltip: {
                padding: 14,
                cornerRadius: 10,
                callbacks: {
                    label: ctx => ` ${ctx.dataset.label}: ${fmt.nombre(ctx.parsed.y ?? ctx.parsed)}`,
                },
            },
        },
        scales,
    };
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderChart(def) {
    const el = document.getElementById(def.id);
    if (!el || INSTANCES[def.id]) return;

    const ctx = el.getContext('2d');
    INSTANCES[def.id] = new Chart(ctx, {
        type:    def.type,
        data: {
            labels:   def.labels || [],
            datasets: buildDatasets(def, ctx),
        },
        options: buildOptions(def),
    });
}

// ── Init : charge tous les charts au scroll (lazy) ────────────────────────────
export function initCharts() {
    const chartDefs = DATASET.charts || [];

    const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                const def = chartDefs.find(c => c.id === e.target.id);
                if (def) renderChart(def);
                obs.unobserve(e.target);
            }
        });
    }, { threshold: 0.15 });

    chartDefs.forEach(def => {
        const el = document.getElementById(def.id);
        if (el) obs.observe(el);
    });

    // Charger immédiatement les charts déjà visibles
    chartDefs.forEach(def => {
        const el = document.getElementById(def.id);
        if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) renderChart(def);
        }
    });
}

// ── Mise à jour dynamique (pour design switcher) ──────────────────────────────
export function updateChartsColors() {
    Object.values(INSTANCES).forEach(chart => {
        chart.data.datasets.forEach((ds, i) => {
            const c = C[i % C.length];
            if (Array.isArray(ds.borderColor)) return;
            ds.borderColor     = c;
            if (typeof ds.backgroundColor === 'string' && ds.backgroundColor.startsWith('rgba')) {
                ds.backgroundColor = alpha(c, 0.75);
            }
        });
        chart.update('none');
    });
}

console.log('📊 Charts engine prêt ·', (DATASET.charts || []).length, 'graphiques');
