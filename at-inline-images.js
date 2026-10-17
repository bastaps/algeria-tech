/* ═══════════════════════════════════════════════════════════
   at-inline-images.js — Insertion + APERÇU VISUEL des photos
   dans le corps d'un article.

   • Bouton « Insérer une photo » sous le textarea Markdown :
     upload (ou URL) → alignement / taille / légende → insertion
     à la position du curseur.
   • Panneau « Aperçu visuel » sous le textarea : affiche les
     VRAIES images (pas le code). On clique une photo pour :
       - l'agrandir/réduire (poignée à tirer ou boutons +/−)
       - changer son placement (gauche/centre/droite/pleine largeur)
       - la déplacer dans le texte (monter / descendre)
       - éditer sa légende
       - la supprimer
     Toute modification m'à jour le texte de l'article en direct,
     sans avoir à publier.

   Utilisation :  ATInlineImages.attach('contenu');
                  ATInlineImages.attach('siContenu');
   Auto-attache aux textareas #contenu et #siContenu au chargement.
═══════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    if (window.ATInlineImages) return; // singleton

    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const REMOTE_API = 'https://dz-tech-press-api.onrender.com';
    const API_BASE = isLocal ? '' : REMOTE_API;
    const UPLOAD_URL = `${API_BASE}/api/upload-inline-image`;

    const genId = () => 'ph_' + Math.random().toString(36).slice(2, 8);

    // ═══════════════════════════ STYLES ═══════════════════════════
    function injectStyle() {
        if (document.getElementById('at-inline-img-style')) return;
        const css = `
/* — Bouton — */
.at-ii-btn{display:inline-flex;align-items:center;gap:7px;margin:8px 0 4px;padding:8px 14px;
  border:1px dashed var(--primary,#0ea5e9);border-radius:8px;background:rgba(14,165,233,.08);
  color:var(--primary,#0ea5e9);font-weight:600;font-size:.9rem;cursor:pointer;transition:.15s;font-family:inherit;}
.at-ii-btn:hover{background:rgba(14,165,233,.16);}
/* — Modal d'ajout — */
.at-ii-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100000;
  display:flex;align-items:center;justify-content:center;padding:16px;}
.at-ii-overlay.hidden{display:none;}
.at-ii-box{background:var(--bg,#fff);color:var(--text,#111);width:100%;max-width:520px;border-radius:16px;
  padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.35);max-height:92vh;overflow:auto;}
.at-ii-box h3{margin:0 0 14px;font-size:1.15rem;display:flex;align-items:center;gap:8px;}
.at-ii-drop{border:2px dashed var(--border,#cbd5e1);border-radius:12px;padding:22px;text-align:center;
  cursor:pointer;transition:.15s;font-size:.9rem;color:var(--text-muted,#64748b);}
.at-ii-drop:hover,.at-ii-drop.drag{border-color:var(--primary,#0ea5e9);background:rgba(14,165,233,.06);}
.at-ii-or{text-align:center;margin:10px 0;font-size:.8rem;color:var(--text-muted,#94a3b8);}
.at-ii-box input[type=url],.at-ii-box input[type=text]{width:100%;padding:9px 11px;border:1px solid var(--border,#cbd5e1);
  border-radius:8px;font-size:.9rem;background:var(--bg,#fff);color:var(--text,#111);box-sizing:border-box;}
.at-ii-preview{margin:14px 0;text-align:center;}
.at-ii-preview img{max-width:100%;max-height:200px;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.15);}
.at-ii-label{display:block;font-size:.78rem;font-weight:600;margin:12px 0 5px;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted,#64748b);}
.at-ii-align{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
.at-ii-align button{padding:9px 4px;border:1px solid var(--border,#cbd5e1);border-radius:8px;background:transparent;
  cursor:pointer;font-size:.72rem;color:inherit;display:flex;flex-direction:column;align-items:center;gap:4px;font-family:inherit;}
.at-ii-align button i{font-size:1rem;}
.at-ii-align button.on{border-color:var(--primary,#0ea5e9);background:rgba(14,165,233,.12);color:var(--primary,#0ea5e9);font-weight:700;}
.at-ii-range{display:flex;align-items:center;gap:10px;}
.at-ii-range input{flex:1;}
.at-ii-range span{min-width:46px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;}
.at-ii-actions{display:flex;gap:10px;margin-top:20px;}
.at-ii-actions button{flex:1;padding:11px;border-radius:9px;border:none;font-weight:700;cursor:pointer;font-size:.92rem;font-family:inherit;}
.at-ii-cancel{background:var(--border,#e2e8f0);color:var(--text,#111);}
.at-ii-insert{background:var(--primary,#0ea5e9);color:#fff;}
.at-ii-insert:disabled{opacity:.5;cursor:not-allowed;}
.at-ii-hint{font-size:.75rem;color:var(--text-muted,#94a3b8);margin-top:8px;line-height:1.4;}

/* — Panneau d'aperçu visuel — */
.at-preview-wrap{margin:6px 0 4px;border:1px solid var(--border,#cbd5e1);border-radius:12px;overflow:hidden;}
.at-preview-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;
  background:rgba(14,165,233,.08);font-size:.82rem;font-weight:600;color:var(--primary,#0ea5e9);cursor:pointer;user-select:none;}
.at-preview-head .at-pv-hint{font-weight:400;color:var(--text-muted,#64748b);font-size:.75rem;}
.at-preview{padding:16px 18px;background:var(--bg,#fff);color:var(--text,#111);max-height:520px;overflow:auto;font-size:.95rem;line-height:1.6;}
.at-preview.collapsed{display:none;}
.at-preview:empty::before{content:"Les photos que vous insérez apparaîtront ici. Cliquez une photo pour l'ajuster.";
  color:var(--text-muted,#94a3b8);font-style:italic;font-size:.85rem;}
.at-preview img{max-width:100%;}
.at-preview .at-photo{cursor:pointer;transition:outline .12s;}
.at-preview .at-photo.at-sel{outline:3px solid var(--primary,#0ea5e9);outline-offset:3px;border-radius:6px;position:relative;}
/* Poignée de redimensionnement */
.at-resize-h{position:absolute;right:-7px;top:50%;transform:translateY(-50%);width:16px;height:44px;
  background:var(--primary,#0ea5e9);border:2px solid #fff;border-radius:8px;cursor:ew-resize;z-index:5;
  box-shadow:0 2px 8px rgba(0,0,0,.3);touch-action:none;}
.at-resize-h::after{content:"";position:absolute;inset:0;margin:auto;width:2px;height:18px;background:#fff;border-radius:2px;}
/* Barre d'outils flottante de la photo sélectionnée */
.at-fig-tools{position:absolute;top:-46px;left:50%;transform:translateX(-50%);display:flex;gap:2px;
  background:#1e293b;padding:5px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.35);z-index:10;white-space:nowrap;}
.at-fig-tools button{width:32px;height:32px;border:none;background:transparent;color:#e2e8f0;border-radius:7px;
  cursor:pointer;font-size:.85rem;display:inline-flex;align-items:center;justify-content:center;transition:.12s;}
.at-fig-tools button:hover{background:rgba(255,255,255,.15);color:#fff;}
.at-fig-tools button.on{background:var(--primary,#0ea5e9);color:#fff;}
.at-fig-tools .at-sep{width:1px;background:rgba(255,255,255,.2);margin:2px 3px;}
.at-fig-tools .at-del:hover{background:#ef4444;color:#fff;}
.at-fig-size{color:#fff;font-size:.72rem;display:inline-flex;align-items:center;padding:0 4px;min-width:38px;justify-content:center;font-variant-numeric:tabular-nums;}

/* — Rendu final des photos (identique à style.css, dupliqué pour smart-ingest) — */
.at-photo{margin:20px 0;max-width:100%;}
.at-photo img{width:100%;height:auto;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.14);display:block;}
.at-photo figcaption{font-size:.85rem;color:var(--text-muted,#64748b);text-align:center;margin-top:7px;font-style:italic;}
.at-photo--center{margin-left:auto;margin-right:auto;width:var(--w,70%);}
.at-photo--full{width:100%;}
.at-photo--left{float:left;width:var(--w,45%);margin:6px 24px 16px 0;}
.at-photo--right{float:right;width:var(--w,45%);margin:6px 0 16px 24px;}
.at-preview::after{content:"";display:block;clear:both;}
@media(max-width:640px){.at-photo--left,.at-photo--right{float:none;width:100%!important;margin:18px 0;}.at-photo--center{width:100%!important;}}`;
        const s = document.createElement('style');
        s.id = 'at-inline-img-style';
        s.textContent = css;
        document.head.appendChild(s);
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    }

    // ══════════════════ SÉRIALISATION <figure> ══════════════════
    // Une seule ligne : évite que marked (breaks:true) n'injecte des <br>.
    function serFig(o) {
        const styleAttr = o.align !== 'full' ? ` style="--w:${o.w}%"` : '';
        const alt = (o.alt || o.cap || '').replace(/"/g, '&quot;');
        const cap = o.cap ? `<figcaption>${escapeHtml(o.cap)}</figcaption>` : '';
        return `<figure class="at-photo at-photo--${o.align}"${styleAttr} data-ph="${o.id}"><img src="${o.src}" alt="${alt}" loading="lazy">${cap}</figure>`;
    }
    function buildFigure(url, align, width, caption, id) {
        const fig = serFig({ src: url, align, w: width, cap: (caption || '').trim(), id: id || genId() });
        return `\n\n${fig}\n\n`;
    }
    function parseFig(s) {
        return {
            src:   (s.match(/<img[^>]*\bsrc="([^"]*)"/) || [])[1] || '',
            alt:   (s.match(/<img[^>]*\balt="([^"]*)"/) || [])[1] || '',
            align: (s.match(/at-photo--(\w+)/) || [])[1] || 'center',
            w:     (s.match(/--w:(\d+)%/) || [])[1] || '70',
            cap:   (s.match(/<figcaption>([\s\S]*?)<\/figcaption>/) || [])[1] || '',
            id:    (s.match(/data-ph="([^"]*)"/) || [])[1] || ''
        };
    }
    const figRe = id => new RegExp('<figure\\b[^>]*data-ph="' + id + '"[\\s\\S]*?<\\/figure>');

    // ══════════════════ ÉDITION DU TEXTE SOURCE ══════════════════
    function insertAtCursor(ta, text) {
        const start = ta.selectionStart ?? ta.value.length;
        const end = ta.selectionEnd ?? ta.value.length;
        ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
        const pos = start + text.length;
        ta.focus(); ta.setSelectionRange(pos, pos);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function updateFig(ta, id, mut) {
        const re = figRe(id);
        const m = ta.value.match(re);
        if (!m) return;
        const o = parseFig(m[0]);
        mut(o);
        ta.value = ta.value.replace(re, serFig(o));
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function moveFig(ta, id, dir) {
        const blocks = ta.value.split(/\n{2,}/);
        const i = blocks.findIndex(b => b.includes('data-ph="' + id + '"'));
        if (i < 0) return;
        const j = i + dir;
        if (j < 0 || j >= blocks.length) return;
        [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
        ta.value = blocks.join('\n\n');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function removeFig(ta, id) {
        ta.value = ta.value.replace(figRe(id), '').replace(/\n{3,}/g, '\n\n');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    // Attribue un data-ph aux <figure> qui n'en ont pas (contenu déjà existant)
    function normalizeIds(ta) {
        let changed = false;
        ta.value = ta.value.replace(/<figure\b(?![^>]*data-ph=)([^>]*)>/g, (m, attrs) => {
            changed = true;
            return `<figure${attrs} data-ph="${genId()}">`;
        });
        if (changed) ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // ══════════════════ UPLOAD ══════════════════
    async function uploadFile(file) {
        const fd = new FormData();
        fd.append('photo', file);
        const r = await fetch(UPLOAD_URL, { method: 'POST', body: fd });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.url) throw new Error(data.message || 'Échec de l\'upload');
        const rel = data.url;
        const abs = (API_BASE && rel.startsWith('/')) ? API_BASE + rel : rel;
        return { insert: rel, display: abs };
    }

    // ══════════════════ MODAL D'AJOUT ══════════════════
    let overlay, state;
    function buildModal() {
        injectStyle();
        overlay = document.createElement('div');
        overlay.className = 'at-ii-overlay hidden';
        overlay.innerHTML = `
<div class="at-ii-box" role="dialog" aria-modal="true">
  <h3><i class="fas fa-image"></i> Insérer une photo dans l'article</h3>
  <div class="at-ii-drop" id="atiiDrop" tabindex="0">
    <i class="fas fa-cloud-upload-alt" style="font-size:1.6rem;display:block;margin-bottom:8px;"></i>
    Cliquez ou glissez une image ici<br><small>JPG, PNG, GIF, WebP — 12 Mo max</small>
    <input type="file" id="atiiFile" accept="image/*" hidden>
  </div>
  <div class="at-ii-or">— ou collez une adresse d'image —</div>
  <input type="url" id="atiiUrl" placeholder="https://exemple.com/photo.jpg ou Ctrl+V une image">
  <div class="at-ii-preview" id="atiiPreview"></div>
  <span class="at-ii-label">Placement</span>
  <div class="at-ii-align" id="atiiAlign">
    <button data-align="left"><i class="fas fa-align-left"></i>Gauche<br>(texte autour)</button>
    <button data-align="center" class="on"><i class="fas fa-align-center"></i>Centré</button>
    <button data-align="right"><i class="fas fa-align-right"></i>Droite<br>(texte autour)</button>
    <button data-align="full"><i class="fas fa-arrows-alt-h"></i>Pleine<br>largeur</button>
  </div>
  <span class="at-ii-label">Taille</span>
  <div class="at-ii-range">
    <input type="range" id="atiiWidth" min="25" max="100" value="60" step="5">
    <span id="atiiWidthVal">60%</span>
  </div>
  <span class="at-ii-label">Légende (optionnel)</span>
  <input type="text" id="atiiCaption" placeholder="Légende affichée sous la photo">
  <p class="at-ii-hint"><i class="fas fa-info-circle"></i> La photo s'insère à l'endroit du curseur. Vous pourrez ensuite l'agrandir et la déplacer directement dans l'aperçu visuel ci-dessous. Ajoutez autant de photos que vous voulez.</p>
  <div class="at-ii-actions">
    <button class="at-ii-cancel" id="atiiCancel">Annuler</button>
    <button class="at-ii-insert" id="atiiInsert" disabled>Insérer la photo</button>
  </div>
</div>`;
        document.body.appendChild(overlay);
        const $ = id => overlay.querySelector('#' + id);
        const drop = $('atiiDrop'), fileIn = $('atiiFile'), urlIn = $('atiiUrl');
        const preview = $('atiiPreview'), widthIn = $('atiiWidth'), widthVal = $('atiiWidthVal');
        const captionIn = $('atiiCaption'), insertBtn = $('atiiInsert'), cancelBtn = $('atiiCancel');
        const alignWrap = $('atiiAlign');

        function setPreview(displayUrl, insertUrl) {
            state.url = (insertUrl !== undefined ? insertUrl : displayUrl) || '';
            insertBtn.disabled = !state.url;
            preview.innerHTML = displayUrl ? `<img src="${displayUrl}" onerror="this.parentNode.innerHTML='<small style=color:#ef4444>Image introuvable</small>'">` : '';
        }
        drop.addEventListener('click', () => fileIn.click());
        drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
        drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
        fileIn.addEventListener('change', () => { if (fileIn.files[0]) handleFile(fileIn.files[0]); });
        document.addEventListener('paste', e => {
            if (overlay.classList.contains('hidden')) return;
            const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    handleFile(item.getAsFile());
                    break;
                }
            }
        });
        async function handleFile(file) {
            if (!file.type.startsWith('image/')) { alert('Ce fichier n\'est pas une image.'); return; }
            setPreview(URL.createObjectURL(file), '');
            insertBtn.disabled = true; insertBtn.textContent = 'Upload…';
            try { const res = await uploadFile(file); setPreview(res.display, res.insert); }
            catch (err) { alert('Erreur upload : ' + err.message + '\nVous pouvez coller une URL d\'image à la place.'); setPreview(''); }
            finally { insertBtn.textContent = 'Insérer la photo'; }
        }
        urlIn.addEventListener('input', () => {
            const u = urlIn.value.trim();
            if (u.startsWith('http') || u.startsWith('/')) setPreview(u); else setPreview('');
        });
        // Ctrl+V image dans le champ URL ou dans la zone de drop → upload direct
        function handlePasteImage(e) {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    e.preventDefault();
                    handleFile(item.getAsFile());
                    return;
                }
            }
        }
        urlIn.addEventListener('paste', handlePasteImage);
        drop.addEventListener('paste', handlePasteImage);
        alignWrap.addEventListener('click', e => {
            const b = e.target.closest('button'); if (!b) return;
            alignWrap.querySelectorAll('button').forEach(x => x.classList.remove('on'));
            b.classList.add('on'); state.align = b.dataset.align;
            widthIn.disabled = state.align === 'full'; widthVal.style.opacity = state.align === 'full' ? .4 : 1;
        });
        widthIn.addEventListener('input', () => { state.width = widthIn.value; widthVal.textContent = widthIn.value + '%'; });
        cancelBtn.addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close(); });
        insertBtn.addEventListener('click', () => {
            if (!state.url) return;
            const id = genId();
            insertAtCursor(state.textarea, buildFigure(state.url, state.align, state.width, captionIn.value, id));
            close();
            // Sélectionne la nouvelle photo dans l'aperçu
            const pv = state.textarea._atPreview;
            if (pv) { pv._render(); pv._select(id); }
        });
        overlay._refs = { fileIn, urlIn, preview, widthIn, widthVal, captionIn, insertBtn, alignWrap, setPreview, handleFile };
    }
    function open(textarea) {
        if (!overlay) buildModal();
        state = { textarea, url: '', align: 'center', width: '60' };
        const r = overlay._refs;
        r.fileIn.value = ''; r.urlIn.value = ''; r.captionIn.value = '';
        r.widthIn.value = '60'; r.widthIn.disabled = false; r.widthVal.textContent = '60%'; r.widthVal.style.opacity = 1;
        r.alignWrap.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.align === 'center'));
        r.setPreview('');
        overlay.classList.remove('hidden');
    }
    function close() { if (overlay) overlay.classList.add('hidden'); }

    // ══════════════════ APERÇU VISUEL INTERACTIF ══════════════════
    function renderMarkdown(raw) {
        if (window.marked) { try { return marked.parse(raw, { breaks: true, gfm: true }); } catch (e) {} }
        // Fallback minimal si marked absent
        return raw.split(/\n{2,}/).map(b => /^\s*<figure/.test(b) ? b : `<p>${escapeHtml(b).replace(/\n/g, '<br>')}</p>`).join('');
    }

    function buildPreview(ta) {
        injectStyle();
        const wrap = document.createElement('div');
        wrap.className = 'at-preview-wrap';
        wrap.innerHTML = `
<div class="at-preview-head">
  <span><i class="fas fa-eye"></i> Aperçu visuel <span class="at-pv-hint">— cliquez une photo pour l'ajuster</span></span>
  <span class="at-pv-toggle"><i class="fas fa-chevron-up"></i></span>
</div>
<div class="at-preview"></div>`;
        ta.parentNode.insertBefore(wrap, ta.nextSibling);
        const pv = wrap.querySelector('.at-preview');
        const head = wrap.querySelector('.at-preview-head');
        const toggleIcon = wrap.querySelector('.at-pv-toggle i');
        let selId = null;

        head.addEventListener('click', () => {
            pv.classList.toggle('collapsed');
            toggleIcon.className = pv.classList.contains('collapsed') ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
        });

        function render() {
            normalizeIds(ta);
            pv.innerHTML = renderMarkdown(ta.value);
            if (selId && pv.querySelector(`figure[data-ph="${selId}"]`)) decorate(selId);
        }
        function clearDecor() {
            pv.querySelectorAll('.at-fig-tools,.at-resize-h').forEach(n => n.remove());
            pv.querySelectorAll('.at-photo.at-sel').forEach(n => n.classList.remove('at-sel'));
        }
        function select(id) { selId = id; render(); }
        function decorate(id) {
            clearDecor();
            const fig = pv.querySelector(`figure[data-ph="${id}"]`);
            if (!fig) return;
            fig.classList.add('at-sel');
            const cur = parseFig(fig.outerHTML);

            // Barre d'outils
            const tools = document.createElement('div');
            tools.className = 'at-fig-tools';
            tools.innerHTML = `
<button data-a="left" title="Aligner à gauche (texte autour)"><i class="fas fa-align-left"></i></button>
<button data-a="center" title="Centrer"><i class="fas fa-align-center"></i></button>
<button data-a="right" title="Aligner à droite (texte autour)"><i class="fas fa-align-right"></i></button>
<button data-a="full" title="Pleine largeur"><i class="fas fa-arrows-alt-h"></i></button>
<span class="at-sep"></span>
<button data-w="-1" title="Réduire"><i class="fas fa-minus"></i></button>
<span class="at-fig-size">${cur.align === 'full' ? '100%' : cur.w + '%'}</span>
<button data-w="1" title="Agrandir"><i class="fas fa-plus"></i></button>
<span class="at-sep"></span>
<button data-m="-1" title="Déplacer vers le haut"><i class="fas fa-arrow-up"></i></button>
<button data-m="1" title="Déplacer vers le bas"><i class="fas fa-arrow-down"></i></button>
<span class="at-sep"></span>
<button data-cap="1" title="Légende"><i class="fas fa-closed-captioning"></i></button>
<button class="at-del" data-del="1" title="Supprimer"><i class="fas fa-trash"></i></button>`;
            tools.querySelectorAll('[data-a]').forEach(b => b.classList.toggle('on', b.dataset.a === cur.align));
            fig.appendChild(tools);

            // Poignée de redimensionnement (sauf pleine largeur)
            if (cur.align !== 'full') addResizeHandle(fig, id);

            // Actions barre d'outils
            tools.addEventListener('click', e => {
                const b = e.target.closest('button'); if (!b) return;
                e.stopPropagation();
                if (b.dataset.a) { updateFig(ta, id, o => { o.align = b.dataset.a; }); select(id); }
                else if (b.dataset.w) {
                    updateFig(ta, id, o => { o.w = String(Math.max(20, Math.min(100, (+o.w || 70) + (+b.dataset.w) * 5))); });
                    select(id);
                } else if (b.dataset.m) { moveFig(ta, id, +b.dataset.m); select(id); }
                else if (b.dataset.cap) {
                    const val = prompt('Légende de la photo :', cur.cap);
                    if (val !== null) { updateFig(ta, id, o => { o.cap = val.trim(); }); select(id); }
                } else if (b.dataset.del) {
                    if (confirm('Supprimer cette photo de l\'article ?')) { removeFig(ta, id); selId = null; render(); }
                }
            });
        }

        function addResizeHandle(fig, id) {
            const h = document.createElement('div');
            h.className = 'at-resize-h';
            h.title = 'Tirer pour agrandir / réduire';
            fig.appendChild(h);
            h.addEventListener('pointerdown', e => {
                e.preventDefault(); e.stopPropagation();
                const container = pv.getBoundingClientRect().width || 600;
                const startX = e.clientX;
                const startW = +parseFig(fig.outerHTML).w || 70;
                const sizeLabel = fig.querySelector('.at-fig-size');
                h.setPointerCapture(e.pointerId);
                let curW = startW;
                function mv(ev) {
                    const deltaPct = (ev.clientX - startX) / container * 100;
                    curW = Math.max(20, Math.min(100, Math.round((startW + deltaPct) / 5) * 5));
                    fig.style.setProperty('--w', curW + '%');
                    if (sizeLabel) sizeLabel.textContent = curW + '%';
                }
                function up(ev) {
                    h.releasePointerCapture(e.pointerId);
                    h.removeEventListener('pointermove', mv);
                    h.removeEventListener('pointerup', up);
                    updateFig(ta, id, o => { o.w = String(curW); });
                    select(id);
                }
                h.addEventListener('pointermove', mv);
                h.addEventListener('pointerup', up);
            });
        }

        // Clic sur une photo → sélection ; clic ailleurs → désélection
        pv.addEventListener('click', e => {
            const fig = e.target.closest('.at-photo');
            if (fig && fig.dataset.ph) {
                if (fig.dataset.ph !== selId) select(fig.dataset.ph);
            } else if (!e.target.closest('.at-fig-tools')) {
                selId = null; clearDecor();
            }
        });

        // Re-render quand le texte change (debounce)
        let t;
        ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 150); });

        ta._atPreview = { _render: render, _select: select };
        render();
        return ta._atPreview;
    }

    // ══════════════════ API PUBLIQUE ══════════════════
    function attach(textareaId) {
        injectStyle();
        const ta = typeof textareaId === 'string' ? document.getElementById(textareaId) : textareaId;
        if (!ta) { console.warn('[ATInlineImages] textarea introuvable :', textareaId); return; }
        if (ta._atIIAttached) return;
        ta._atIIAttached = true;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'at-ii-btn';
        btn.innerHTML = '<i class="fas fa-camera-retro"></i> Insérer une photo';
        btn.title = 'Ajouter une photo dans le corps de l\'article';
        btn.addEventListener('click', () => open(ta));
        ta.parentNode.insertBefore(btn, ta);

        // Ctrl+V image directement dans le textarea → ouvre la modale et upload
        ta.addEventListener('paste', e => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    open(ta);
                    // Attend que la modale soit construite puis lance l'upload
                    setTimeout(() => { if (overlay?._refs) overlay._refs.handleFile(item.getAsFile()); }, 0);
                    break;
                }
            }
        });

        buildPreview(ta);
    }

    window.ATInlineImages = { attach, open, _build: buildFigure };

    function autoAttach() {
        ['contenu', 'siContenu'].forEach(id => { if (document.getElementById(id)) attach(id); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoAttach);
    else autoAttach();
})();
