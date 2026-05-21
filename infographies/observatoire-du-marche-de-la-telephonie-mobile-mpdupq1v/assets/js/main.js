/**
 * Orchestration principale — Algeria Tech Generator
 */

import { DATASET, fmt } from './data.js';
import { initCharts } from './charts.js';
import { initScene3D } from './scene3d.js';
import { exportJSON, exportPDF, sharePage, toggleFullscreen, toast } from './exports.js';

function animateCounter(el) {
  const target   = parseFloat(el.dataset.target) || 0;
  const decimals = parseInt(el.dataset.decimals || '0', 10);
  const suffix   = el.dataset.suffix || '';
  const dur = 1800, t0 = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 3);
  (function step(now) {
    const t = Math.min(1, (now - t0) / dur);
    const v = target * ease(t);
    el.textContent = v.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    if (t < 1) requestAnimationFrame(step);
    else el.dataset.done = '1';
  })(performance.now());
}

function initCounters() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting && !e.target.dataset.done) animateCounter(e.target); });
  }, { threshold: 0.4 });
  document.querySelectorAll('.counter').forEach(c => obs.observe(c));
}

function initReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

function initNavigation() {
  const links = document.querySelectorAll('.section-nav a');
  const sections = Array.from(links).map(l => document.querySelector(l.getAttribute('href')));
  function update() {
    const scrollY = window.scrollY + window.innerHeight / 3;
    let active = sections[0];
    for (const s of sections) { if (s && s.offsetTop <= scrollY) active = s; }
    links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + (active?.id || '')));
    document.querySelector('.topbar')?.classList.toggle('compact', window.scrollY > 100);
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
}

function bindEvents() {
  document.getElementById('btn-export-pdf')?.addEventListener('click', exportPDF);
  document.getElementById('btn-export-json')?.addEventListener('click', exportJSON);
  document.getElementById('btn-share')?.addEventListener('click', sharePage);
  document.getElementById('fab-fullscreen')?.addEventListener('click', toggleFullscreen);
  document.getElementById('fab-top')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function hideLoader() {
  setTimeout(() => document.getElementById('loader')?.classList.add('hidden'), 800);
}

window.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  initReveal();
  initNavigation();
  initCounters();

  if (window.Chart) {
    try { initCharts(); } catch (e) { console.error('Charts:', e); }
  }

  const el3d = document.getElementById('scene3d');
  if (el3d) {
    try { initScene3D(el3d); }
    catch (e) {
      console.error('Scene 3D:', e);
      el3d.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:#94a3b8;font:0.8rem monospace;text-align:center;padding:1rem">Scène 3D indisponible<br>(WebGL requis)</div>';
    }
  }

  hideLoader();
});
