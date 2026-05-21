/**
 * Graphiques Chart.js — générés par Algeria Tech Generator v3
 */

import { DATASET, fmt, PALETTE } from './data.js';

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
        tooltip: { callbacks: { label: c => fmt.kpi(c.parsed.y, ind[c.dataIndex]?.unite) + (ind[c.dataIndex]?.unite ? ' ' + ind[c.dataIndex].unite : '') } }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#94a3b8', maxRotation: 35 } },
        y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#94a3b8' } }
      },
      animation: { duration: 1400, easing: 'easeOutQuart' }
    }
  });
}

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
        tooltip: { callbacks: { label: c => fmt.pourcentSimple(c.parsed) + '%' } }
      },
      animation: { animateRotate: true, animateScale: true, duration: 1400 }
    }
  });
}

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
        tooltip: { callbacks: { label: c => fmt.pourcentSimple(c.parsed) + '%' } }
      },
      animation: { animateRotate: true, animateScale: true, duration: 1200 }
    }
  });
}


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
          label: "Parc abonnés (millions)",
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

export function initCharts() {
  applyTheme();
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      if (CHARTS[id]) return;
      const ctx = entry.target.getContext('2d');
      switch (id) {
        case 'chart-indicateurs': CHARTS[id] = chartIndicateurs(ctx); break;
        case 'chart-repartition': CHARTS[id] = chartRepartition(ctx); break;
        case 'chart-distribution':CHARTS[id] = chartDistribution(ctx); break;
        case 'chart-evolution':  CHARTS[id] = chartEvolution(ctx); break;
        case 'chart-barh':        CHARTS[id] = chartBarH(ctx); break;
        case 'chart-comparatif':  CHARTS[id] = chartComparatif(ctx); break;
      }
      if (CHARTS[id]) obs.unobserve(entry.target);
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('canvas[id^="chart-"]').forEach(c => obs.observe(c));
}
