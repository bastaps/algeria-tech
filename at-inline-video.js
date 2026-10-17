/* ═══════════════════════════════════════════════════════════
   at-inline-video.js — Bouton « Insérer une vidéo » dans le corps
   d'un article (à côté de « Insérer une photo »).

   • Upload d'un fichier vidéo local (glisser-déposer ou Ctrl+V).
   • Collage/saisie d'une URL :
       - YouTube            → iframe responsive native
       - Fichier direct     → <video> pointant vers l'URL telle quelle
       - Autre lien (TikTok, Instagram, Facebook, ...) → extraction
         automatique du flux via /api/extract-video-url (yt-dlp côté
         serveur), sans rien garder de la page d'origine.
   • Insertion à la position du curseur, sous forme d'un bloc HTML
     <div class="article-embed"> identique à celui du bouton Embed.

   Utilisation :  ATInlineVideo.attach('contenu');
                  ATInlineVideo.attach('siContenu');
   Auto-attache aux textareas #contenu et #siContenu au chargement.
═══════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    if (window.ATInlineVideo) return; // singleton

    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const REMOTE_API = 'https://dz-tech-press-api.onrender.com';
    const API_BASE = isLocal ? '' : REMOTE_API;
    const UPLOAD_URL = `${API_BASE}/api/upload-inline-video`;
    const EXTRACT_URL = `${API_BASE}/api/extract-video-url`;

    // ═══════════════════════════ STYLES ═══════════════════════════
    function injectStyle() {
        if (document.getElementById('at-inline-vid-style')) return;
        const css = `
.at-iv-btn{display:inline-flex;align-items:center;gap:7px;margin:8px 0 4px 8px;padding:8px 14px;
  border:1px dashed #f43f5e;border-radius:8px;background:rgba(244,63,94,.08);
  color:#f43f5e;font-weight:600;font-size:.9rem;cursor:pointer;transition:.15s;font-family:inherit;}
.at-iv-btn:hover{background:rgba(244,63,94,.16);}
.at-iv-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100000;
  display:flex;align-items:center;justify-content:center;padding:16px;}
.at-iv-overlay.hidden{display:none;}
.at-iv-box{background:var(--bg,#fff);color:var(--text,#111);width:100%;max-width:540px;border-radius:16px;
  padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.35);max-height:92vh;overflow:auto;}
.at-iv-box h3{margin:0 0 14px;font-size:1.15rem;display:flex;align-items:center;gap:8px;}
.at-iv-drop{border:2px dashed var(--border,#cbd5e1);border-radius:12px;padding:22px;text-align:center;
  cursor:pointer;transition:.15s;font-size:.9rem;color:var(--text-muted,#64748b);}
.at-iv-drop:hover,.at-iv-drop.drag{border-color:#f43f5e;background:rgba(244,63,94,.06);}
.at-iv-or{text-align:center;margin:10px 0;font-size:.8rem;color:var(--text-muted,#94a3b8);}
.at-iv-urlrow{display:flex;gap:8px;}
.at-iv-box input[type=url],.at-iv-box input[type=text]{width:100%;padding:9px 11px;border:1px solid var(--border,#cbd5e1);
  border-radius:8px;font-size:.9rem;background:var(--bg,#fff);color:var(--text,#111);box-sizing:border-box;}
.at-iv-check{flex-shrink:0;padding:0 14px;border:none;border-radius:8px;background:#f43f5e;color:#fff;
  font-weight:600;cursor:pointer;font-size:.85rem;font-family:inherit;}
.at-iv-check:disabled{opacity:.5;cursor:not-allowed;}
.at-iv-preview{margin:14px 0;text-align:center;min-height:1px;}
.at-iv-preview video{max-width:100%;max-height:260px;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.15);background:#000;}
.at-iv-status{font-size:.82rem;padding:8px 12px;border-radius:8px;margin-top:6px;line-height:1.4;}
.at-iv-status.info{background:rgba(244,63,94,.08);color:#f43f5e;}
.at-iv-status.error{background:#7f1d1d;color:#fca5a5;}
.at-iv-status.warn{background:#78350f;color:#fcd34d;}
.at-iv-actions{display:flex;gap:10px;margin-top:20px;}
.at-iv-actions button{flex:1;padding:11px;border-radius:9px;border:none;font-weight:700;cursor:pointer;font-size:.92rem;font-family:inherit;}
.at-iv-cancel{background:var(--border,#e2e8f0);color:var(--text,#111);}
.at-iv-insert{background:#f43f5e;color:#fff;}
.at-iv-insert:disabled{opacity:.5;cursor:not-allowed;}
.at-iv-hint{font-size:.75rem;color:var(--text-muted,#94a3b8);margin-top:8px;line-height:1.4;}`;
        const s = document.createElement('style');
        s.id = 'at-inline-vid-style';
        s.textContent = css;
        document.head.appendChild(s);
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    function ytId(url) {
        return (String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^&?]{11})/) || [])[1] || null;
    }
    function isYouTubeUrl(u) { return !!ytId(u); }
    function isDirectVideoUrl(u) { return /\.(mp4|webm|ogv|ogg|mov|m4v|avi|mkv)(\?|#|$)/i.test(u); }

    // ══════════════════ ÉDITION DU TEXTE SOURCE ══════════════════
    function insertAtCursor(ta, text) {
        const start = ta.selectionStart ?? ta.value.length;
        const end = ta.selectionEnd ?? ta.value.length;
        ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
        const pos = start + text.length;
        ta.focus(); ta.setSelectionRange(pos, pos);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function buildBlock(kind, src, title) {
        let inner;
        if (kind === 'youtube') {
            const id = ytId(src);
            inner = `<div class="video-embed" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;margin:0;background:#000"><iframe src="https://www.youtube-nocookie.com/embed/${id}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allowfullscreen loading="lazy" title="${escapeHtml(title || 'Vidéo')}"></iframe></div>`;
        } else {
            inner = `<video controls playsinline style="width:100%;border-radius:12px;background:#000" src="${src}"></video>`;
        }
        return `\n\n<div class="article-embed">${inner}</div>\n\n`;
    }

    // ══════════════════ UPLOAD / EXTRACTION ══════════════════
    async function uploadFile(file) {
        const fd = new FormData();
        fd.append('video', file);
        const r = await fetch(UPLOAD_URL, { method: 'POST', body: fd });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.url) throw new Error(data.message || "Échec de l'upload");
        const rel = data.url;
        const abs = (API_BASE && rel.startsWith('/')) ? API_BASE + rel : rel;
        return { src: abs, local: !!data.local };
    }
    async function extractFromUrl(url) {
        const r = await fetch(`${EXTRACT_URL}?url=${encodeURIComponent(url)}`);
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.directUrl) throw new Error(data.error || 'Extraction impossible');
        return data;
    }

    // ══════════════════ MODAL ══════════════════
    let overlay, state;
    function buildModal() {
        injectStyle();
        overlay = document.createElement('div');
        overlay.className = 'at-iv-overlay hidden';
        overlay.innerHTML = `
<div class="at-iv-box" role="dialog" aria-modal="true">
  <h3><i class="fas fa-film"></i> Insérer une vidéo dans l'article</h3>
  <div class="at-iv-drop" id="ativDrop" tabindex="0">
    <i class="fas fa-cloud-upload-alt" style="font-size:1.6rem;display:block;margin-bottom:8px;"></i>
    Cliquez ou glissez un fichier vidéo ici (ou Ctrl+V)<br><small>MP4, WebM, MOV... — 45 Mo max</small>
    <input type="file" id="ativFile" accept="video/*" hidden>
  </div>
  <div class="at-iv-or">— ou collez un lien (YouTube, TikTok, Instagram, Facebook, fichier direct...) —</div>
  <div class="at-iv-urlrow">
    <input type="url" id="ativUrl" placeholder="https://... ou Ctrl+V">
    <button type="button" class="at-iv-check" id="ativCheck" disabled>Vérifier</button>
  </div>
  <div class="at-iv-preview" id="ativPreview"></div>
  <p class="at-iv-hint"><i class="fas fa-info-circle"></i> La vidéo s'insère à l'endroit du curseur. Les liens tiers non-YouTube sont automatiquement nettoyés pour n'en extraire que le flux vidéo.</p>
  <div class="at-iv-actions">
    <button class="at-iv-cancel" id="ativCancel">Annuler</button>
    <button class="at-iv-insert" id="ativInsert" disabled>Insérer la vidéo</button>
  </div>
</div>`;
        document.body.appendChild(overlay);
        const $ = id => overlay.querySelector('#' + id);
        const drop = $('ativDrop'), fileIn = $('ativFile'), urlIn = $('ativUrl'), checkBtn = $('ativCheck');
        const preview = $('ativPreview'), insertBtn = $('ativInsert'), cancelBtn = $('ativCancel');

        function setResult(kind, src, opts = {}) {
            state.kind = kind; state.src = src || '';
            insertBtn.disabled = !src;
            if (!src) { preview.innerHTML = ''; return; }
            if (kind === 'youtube') {
                preview.innerHTML = `<video poster="https://img.youtube.com/vi/${ytId(src)}/hqdefault.jpg" controls muted></video><div class="at-iv-status info"><i class="fab fa-youtube"></i> Vidéo YouTube — s'affichera nativement</div>`;
            } else {
                preview.innerHTML = `<video controls src="${src}"></video>` + (opts.local
                    ? `<div class="at-iv-status warn"><i class="fas fa-exclamation-triangle"></i> Fichier local — non déployé sur le site (limite Cloudflare 25 Mo). Pour publier durablement, utilisez l'outil Téléchargeur Vidéo (republication YouTube).</div>`
                    : (opts.note ? `<div class="at-iv-status info"><i class="fas fa-check-circle"></i> ${opts.note}</div>` : ''));
            }
        }
        function setError(msg) {
            state.kind = null; state.src = '';
            insertBtn.disabled = true;
            preview.innerHTML = `<div class="at-iv-status error"><i class="fas fa-exclamation-triangle"></i> ${escapeHtml(msg)}</div>`;
        }
        function setBusy(msg) {
            insertBtn.disabled = true;
            preview.innerHTML = `<div class="at-iv-status info"><i class="fas fa-spinner fa-spin"></i> ${escapeHtml(msg)}</div>`;
        }

        async function handleFile(file) {
            if (!file.type.startsWith('video/')) { setError('Ce fichier n\'est pas une vidéo.'); return; }
            setBusy('Import du fichier…');
            try { const res = await uploadFile(file); setResult('file', res.src, { local: res.local }); }
            catch (err) { setError('Erreur upload : ' + err.message); }
        }

        async function handleUrl(url) {
            url = (url || '').trim();
            if (!url) { setResult(null, ''); return; }
            if (!/^https?:\/\//.test(url)) { setError('Lien invalide (doit commencer par http...)'); return; }
            if (isYouTubeUrl(url)) { setResult('youtube', url); return; }
            if (isDirectVideoUrl(url)) { setResult('file', url, { note: 'Fichier vidéo direct détecté.' }); return; }
            setBusy('Extraction de la vidéo depuis la page…');
            try {
                const data = await extractFromUrl(url);
                setResult('file', data.directUrl, { note: `Extrait${data.platform ? ' de ' + data.platform : ''} — lien direct (peut expirer après quelques heures).` });
            } catch (err) {
                setError(err.message + ' — essayez le bouton "Embed" avec le code d\'intégration officiel à la place.');
            }
        }

        drop.addEventListener('click', () => fileIn.click());
        drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
        drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
        fileIn.addEventListener('change', () => { if (fileIn.files[0]) handleFile(fileIn.files[0]); });

        function handlePasteVideo(e) {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.kind === 'file' && item.type.startsWith('video/')) {
                    e.preventDefault();
                    handleFile(item.getAsFile());
                    return;
                }
            }
        }
        drop.addEventListener('paste', handlePasteVideo);
        urlIn.addEventListener('paste', handlePasteVideo);

        urlIn.addEventListener('input', () => { checkBtn.disabled = !urlIn.value.trim(); });
        checkBtn.addEventListener('click', () => handleUrl(urlIn.value));
        urlIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); handleUrl(urlIn.value); } });
        urlIn.addEventListener('blur', () => { if (urlIn.value.trim()) handleUrl(urlIn.value); });

        cancelBtn.addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close(); });
        insertBtn.addEventListener('click', () => {
            if (!state.src) return;
            insertAtCursor(state.textarea, buildBlock(state.kind, state.src));
            close();
        });
        overlay._refs = { fileIn, urlIn, checkBtn, preview, insertBtn, setResult, setError, setBusy, handleFile, handleUrl };
    }
    function open(textarea) {
        if (!overlay) buildModal();
        state = { textarea, kind: null, src: '' };
        const r = overlay._refs;
        r.fileIn.value = ''; r.urlIn.value = ''; r.checkBtn.disabled = true;
        r.preview.innerHTML = ''; r.insertBtn.disabled = true;
        overlay.classList.remove('hidden');
    }
    function close() { if (overlay) overlay.classList.add('hidden'); }

    // ══════════════════ API PUBLIQUE ══════════════════
    function attach(textareaId) {
        injectStyle();
        const ta = typeof textareaId === 'string' ? document.getElementById(textareaId) : textareaId;
        if (!ta) { console.warn('[ATInlineVideo] textarea introuvable :', textareaId); return; }
        if (ta._atIVAttached) return;
        ta._atIVAttached = true;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'at-iv-btn';
        btn.innerHTML = '<i class="fas fa-film"></i> Insérer une vidéo';
        btn.title = 'Ajouter une vidéo dans le corps de l\'article';
        btn.addEventListener('click', () => open(ta));
        ta.parentNode.insertBefore(btn, ta);

        // Ctrl+V d'un fichier vidéo directement dans le textarea → ouvre la modale et importe
        ta.addEventListener('paste', e => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.kind === 'file' && item.type.startsWith('video/')) {
                    e.preventDefault();
                    open(ta);
                    setTimeout(() => { if (overlay?._refs) overlay._refs.handleFile(item.getAsFile()); }, 0);
                    break;
                }
            }
        });
    }

    window.ATInlineVideo = { attach };

    function autoAttach() {
        ['contenu', 'siContenu'].forEach(id => { if (document.getElementById(id)) attach(id); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoAttach);
    else autoAttach();
})();
