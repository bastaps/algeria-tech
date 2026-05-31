/**
 * Graphiques Chart.js — Domain: health — Algeria Tech Generator v4
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
  C.defaults.plugins.tooltip.titleColor  = PALETTE[0];
  C.defaults.plugins.tooltip.bodyColor   = '#f4ede0';
  C.defaults.plugins.tooltip.borderColor = PALETTE[0] + '66';
  C.defaults.plugins.tooltip.borderWidth = 1;
  C.defaults.plugins.tooltip.padding     = 12;
  C.defaults.plugins.tooltip.cornerRadius= 8;
}

const CHARTS = {};


function chartStackedBar(ctx) {
  const rep = DATASET.repartition.slice(0,4);
  const ind = DATASET.indicateurs.slice(0,4);
  if (!rep.length || !ind.length) return null;
  return new Chart(ctx, {
    type:'bar',
    data:{labels:ind.map(d=>d.label),datasets:rep.map((r,i)=>({
      label:r.label, data:ind.map(d=>+(d.valeur*r.valeur/100).toFixed(1)),
      backgroundColor:r.couleur+'cc', borderColor:r.couleur, borderWidth:1, borderRadius:i===rep.length-1?6:0, stack:'stack0'
    }))},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true}},
      scales:{x:{stacked:true,grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#94a3b8'}},y:{stacked:true,grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#94a3b8'}}},
      animation:{duration:1400,easing:'easeOutQuart'} }
  });
}

function chartLineArea(ctx) {
  const ind = DATASET.indicateurs;
  if (ind.length < 2) return null;
  return new Chart(ctx, {
    type:'line',
    data:{labels:ind.map(d=>d.label),datasets:[
      {label:'Tendance',data:ind.map(d=>d.valeur),borderColor:PALETTE[0],backgroundColor:PALETTE[0]+'22',tension:.45,pointRadius:6,pointBackgroundColor:PALETTE[0],fill:true},
      {label:'Référence',data:ind.map(d=>d.valeur*0.9),borderColor:PALETTE[1]+'88',borderDash:[4,3],tension:.3,pointRadius:3,fill:false,borderWidth:1.5}
    ]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:true}},
      scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#94a3b8'}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#94a3b8'}}},
      animation:{duration:1400,easing:'easeOutQuart'} }
  });
}

function chartRepartition(ctx) {
  const rep = DATASET.repartition;
  if (!rep.length) return null;
  return new Chart(ctx, {
    type: 'doughnut',
    data: { labels:rep.map(d=>d.label), datasets:[{data:rep.map(d=>d.valeur),backgroundColor:rep.map(d=>d.couleur),borderColor:'#111729',borderWidth:3,hoverOffset:14}] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'62%',
      plugins:{legend:{position:'bottom',labels:{padding:12,usePointStyle:true}}, tooltip:{callbacks:{label:c=>fmt.pourcentSimple(c.parsed)+'%'}}},
      animation:{animateRotate:true,animateScale:true,duration:1400} }
  });
}

function chartRadar(ctx) {
  const ind = DATASET.indicateurs.slice(0,6);
  if (ind.length < 3) return null;
  const max = Math.max(...ind.map(d=>d.valeur)) || 1;
  return new Chart(ctx, {
    type:'radar',
    data:{labels:ind.map(d=>d.label),datasets:[
      {label:'Indicateurs',data:ind.map(d=>+(d.valeur/max*100).toFixed(1)),borderColor:PALETTE[0],backgroundColor:PALETTE[0]+'33',pointBackgroundColor:PALETTE[0],pointBorderColor:'#fff',pointHoverBackgroundColor:'#fff',borderWidth:2}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      scales:{r:{angleLines:{color:'rgba(255,255,255,.1)'},grid:{color:'rgba(255,255,255,.08)'},pointLabels:{color:'#94a3b8',font:{size:10}},ticks:{backdropColor:'transparent',color:'#64748b',font:{size:9}}}},
      plugins:{legend:{display:false}},
      animation:{duration:1400,easing:'easeOutQuart'} }
  });
}

function chartIndicateurs(ctx) {
  const ind = DATASET.indicateurs;
  if (!ind.length) return null;
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ind.map(d => d.label),
      datasets: [{ label:'Valeur', data:ind.map(d=>d.valeur),
        backgroundColor:ind.map(d=>d.couleur+'bb'), borderColor:ind.map(d=>d.couleur),
        borderWidth:1, borderRadius:7 }]
    },
    options: { responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>fmt.kpi(c.parsed.y,ind[c.dataIndex]?.unite)+(ind[c.dataIndex]?.unite?' '+ind[c.dataIndex].unite:'')}}},
      scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#94a3b8',maxRotation:35}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#94a3b8'}}},
      animation:{duration:1400,easing:'easeOutQuart'} }
  });
}

function chartDistribution(ctx) {
  const rep = DATASET.repartition.slice(0,2);
  if (rep.length < 2) return null;
  const top = rep[0];
  return new Chart(ctx, {
    type:'doughnut',
    data:{labels:[top.label,'Reste'],datasets:[{data:[top.valeur,Math.max(0,100-top.valeur)],backgroundColor:[top.couleur,'#1a2238'],borderColor:'#111729',borderWidth:3,hoverOffset:10}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'68%',
      plugins:{legend:{position:'bottom',labels:{padding:10,usePointStyle:true}},tooltip:{callbacks:{label:c=>fmt.pourcentSimple(c.parsed)+'%'}}},
      animation:{animateRotate:true,animateScale:true,duration:1200} }
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
        case 'chart-stacked': CHARTS[id] = chartStackedBar(ctx); break;
        case 'chart-line-area': CHARTS[id] = chartLineArea(ctx); break;
        case 'chart-repartition': CHARTS[id] = chartRepartition(ctx); break;
        case 'chart-radar': CHARTS[id] = chartRadar(ctx); break;
        case 'chart-indicateurs': CHARTS[id] = chartIndicateurs(ctx); break;
        case 'chart-distribution': CHARTS[id] = chartDistribution(ctx); break;
      }
      if (CHARTS[id]) obs.unobserve(entry.target);
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('canvas[id^="chart-"]').forEach(c => obs.observe(c));
}
