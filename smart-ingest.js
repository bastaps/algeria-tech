/* ═══════════════════════════════════════════════════════════
   smart-ingest.js — CONNECTÉ À SMART ENGINE (OLLAMA)
═══════════════════════════════════════════════════════════ */

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const REMOTE_API = 'https://dz-tech-press-api.onrender.com';
const API_BASE = isLocal ? '' : REMOTE_API;
const ENGINE_URL = `${API_BASE}/api/smart-generate`;

document.addEventListener('DOMContentLoaded', () => {
    initDateTime();
    fetchCurrentPositions();
    setupStyleSelector();

    document.getElementById('smartBox').addEventListener('input', function() {
        document.getElementById('charCount').textContent = this.value.length + " caractères";
    });
});

let selectedStyle = 'aps';

function setupStyleSelector() {
    const btns = document.querySelectorAll('.si-style-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedStyle = btn.dataset.style;
            if (selectedStyle === 'breve') {
                document.getElementById('siBreve').checked = true;
            }
        });
    });
}

function initDateTime() {
    const now = new Date();
    document.getElementById('siDate').value = now.toISOString().split('T')[0];
    document.getElementById('siHeure').value = now.toTimeString().slice(0,5);
}

// Fonction de mise à jour visuelle des boutons
function setStatus(id, state) {
    const btn = document.getElementById(id);
    const span = btn.querySelector('span');
    const icon = btn.querySelector('i');
    
    // Textes originaux
    const texts = {
        'translateBtn': 'Traduire en Français',
        'genBtn': "Générer l'Article Pro",
        'fillHubBtn': 'Remplir le Hub',
        'pdfBtn': 'PDF',
        'urlBtn': 'Importer'
    };

    if (state === 'loading') {
        btn.classList.add('si-btn-analyzing');
        btn.disabled = true;
        span.textContent = 'Traitement IA...';
        if(icon) icon.className = 'fas fa-spinner fa-spin';
    } 
    else if (state === 'success') {
        btn.classList.remove('si-btn-analyzing');
        btn.classList.add('si-btn-done');
        btn.disabled = false;
        span.textContent = 'Terminé ✓';
        if(icon) icon.className = 'fas fa-check';
        setTimeout(() => {
            btn.classList.remove('si-btn-done');
            span.textContent = texts[id];
            if(id === 'translateBtn') if(icon) icon.className = 'fas fa-language';
            if(id === 'genBtn') if(icon) icon.className = 'fas fa-pen-nib';
            if(id === 'fillHubBtn') if(icon) icon.className = 'fas fa-fill-drip';
            if(id === 'pdfBtn') if(icon) icon.className = 'fas fa-file-pdf';
            if(id === 'urlBtn') if(icon) icon.className = 'fas fa-globe';
        }, 3000);
    } 
    else if (state === 'error') {
        btn.classList.remove('si-btn-analyzing');
        btn.style.background = '#ef4444';
        btn.disabled = false;
        span.textContent = 'Échec !';
        if(icon) icon.className = 'fas fa-exclamation-triangle';
        setTimeout(() => {
            btn.style.background = '';
            span.textContent = texts[id];
        }, 3000);
    }
}

// 0b. IMPORT DEPUIS UNE URL
async function fetchFromUrl() {
    const url = document.getElementById('urlInput').value.trim();
    if (!url || !url.startsWith('http')) {
        alert("Veuillez saisir une URL valide (commençant par http...)");
        return;
    }
    setStatus('urlBtn', 'loading');
    try {
        const response = await fetch(`${API_BASE}/api/fetch-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erreur serveur');

        document.getElementById('smartBox').value = data.text;
        document.getElementById('charCount').textContent = data.text.length + " caractères";

        // Badge source
        const badge = document.getElementById('sourceBadge');
        badge.textContent = '🔗 Source : ' + url;
        badge.classList.remove('hidden');

        // Pré-remplir le champ source du formulaire
        document.getElementById('siSource').value = url;

        // Pré-remplir le titre si le formulaire est vide
        if (data.title && !document.getElementById('siTitre').value) {
            document.getElementById('siTitre').value = data.title;
        }

        window._sourceUrl = url;
        setStatus('urlBtn', 'success');
    } catch (e) {
        alert("Erreur lors de l'import : " + e.message);
        setStatus('urlBtn', 'error');
    }
}

// 0. TRANSCRIPTION PDF
async function transcribePDF(input) {
    const file = input.files[0];
    if(!file) return;

    setStatus('pdfBtn', 'loading');
    const formData = new FormData();
    formData.append('pdf', file);

    try {
        const response = await fetch(`${API_BASE}/api/transcribe-pdf`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        document.getElementById('smartBox').value = data.text;
        document.getElementById('charCount').textContent = data.text.length + " caractères";
        setStatus('pdfBtn', 'success');
    } catch (e) {
        alert("Erreur lors de la lecture du PDF : " + e.message);
        setStatus('pdfBtn', 'error');
    } finally {
        input.value = ''; // Reset input
    }
}

// 1. TRADUCTION VIA GOOGLE (Client-side)
async function translateContent() {
    const text = document.getElementById('smartBox').value.trim();
    if(!text) return;
    setStatus('translateBtn', 'loading');

    try {
        const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=fr&dt=t&q=${encodeURIComponent(text)}`);
        if(!r.ok) throw new Error();
        const d = await r.json();
        document.getElementById('smartBox').value = d[0].map(s => s[0]).join('');
        setStatus('translateBtn', 'success');
    } catch (e) {
        setStatus('translateBtn', 'error');
    }
}

// 2. GÉNÉRATION VIA SMART ENGINE (Python + Ollama)
async function generateProArticle() {
    const source = document.getElementById('smartBox').value.trim();
    if(!source) {
        alert("Veuillez d'abord déposer du texte dans le Dépôt Magique.");
        return;
    }
    
    setStatus('genBtn', 'loading');

    try {
        const response = await fetch(ENGINE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: source, style: selectedStyle })
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Erreur inconnue');

        // On stocke le résultat globalement pour le bouton "Remplir"
        window._lastAI = data;

        document.getElementById('previewContent').value = `# ${data.titre}\n\n${data.lead}\n\n${data.contenu}`;
        document.getElementById('previewZone').classList.remove('hidden');
        const styleLabels = { aps: 'APS', pro: 'PRO ÉTOFFÉ', breve: 'BRÈVE' };
        document.querySelector('.si-preview-head span').innerHTML = `<i class="fas fa-eye"></i> RÉDACTION ${styleLabels[selectedStyle] || 'APS'} (APERÇU)`;
        
        setStatus('genBtn', 'success');
    } catch (e) {
        console.error("Erreur Ingest:", e);
        alert("Erreur Moteur : " + e.message);
        setStatus('genBtn', 'error');
    }
}

// 3. REMPLIR LE FORMULAIRE DE DÉPLOIEMENT
function fillHub() {
    setStatus('fillHubBtn', 'loading');

    if (window._lastAI) {
        fillFromAI(window._lastAI);
        setStatus('fillHubBtn', 'success');
        return;
    }

    const rawText = document.getElementById('smartBox').value.trim();
    if (!rawText) {
        alert("Collez du texte dans le Dépôt Magique ou générez d'abord un article.");
        setStatus('fillHubBtn', 'error');
        return;
    }

    fillFromRawText(rawText);
    setStatus('fillHubBtn', 'success');
}

// Retire la 1re ligne (le titre) du contenu : il figure déjà dans le champ Titre,
// sinon l'article afficherait un titre en double (h1 + titre en tête du corps).
function stripLeadingTitle(content) {
    if (!content) return content;
    return content.replace(/^\s*#*[^\n]*\n+/, '');
}

function fillFromRawText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const titre = lines[0].replace(/^#+\s*/, '').substring(0, 200);
    document.getElementById('siTitre').value = titre;
    document.getElementById('siExtrait').value = lines.slice(1, 3).join(' ').substring(0, 300);
    let finalContent = stripLeadingTitle(text);
    if (window._embedCode) {
        finalContent = '<div class="article-embed">\n' + window._embedCode + '\n</div>\n\n' + finalContent;
    }
    document.getElementById('siContenu').value = finalContent;
    if (window._autoImage) {
        const imgPreview = document.getElementById('siImagePreview');
        imgPreview.innerHTML = `<img src="${window._autoImage}">`;
        imgPreview.classList.remove('hidden');
    }

    const contentLower = text.toLowerCase();
    let cat = "Algérie";
    if (/djezzy|mobilis|ooredoo|télécom/.test(contentLower)) cat = "Télécoms";
    else if (/mobile|smartphone/.test(contentLower)) cat = "Mobile";
    else if (/startup|incubateur/.test(contentLower)) cat = "Startups";
    else if (/\bia\b|intelligence artificielle|chatgpt|llm/.test(contentLower)) cat = "IA";
    else if (/fintech|paiement/.test(contentLower)) cat = "Fintech";
    else if (!/alg[ée]rie|wilaya|alger\b|arpce|anpt/.test(contentLower)) cat = "Monde";
    document.getElementById('siCategorie').value = cat;
}

function fillFromAI(data) {
    document.getElementById('siTitre').value = data.titre;
    document.getElementById('siExtrait').value = data.lead || '';
    document.getElementById('siTags').value = (data.tags || []).join(', ');
    const existingVideo = document.getElementById('siVideo').value;
    document.getElementById('siVideo').value = data.video || existingVideo || '';
    let finalContent = stripLeadingTitle(document.getElementById('previewContent').value);
    if (window._embedCode && !/article-embed/.test(finalContent)) {
        finalContent = '<div class="article-embed">\n' + window._embedCode + '\n</div>\n\n' + finalContent;
    }
    document.getElementById('siContenu').value = finalContent;

    const contentLower = (data.contenu || '').toLowerCase();
    const mentionsAlgerie = /alg[ée]rie|wilaya|alger\b|oran\b|constantine\b|arpce|anpt/.test(contentLower);
    let cat = mentionsAlgerie ? "Algérie" : "Monde";
    if (/djezzy|mobilis|ooredoo|télécom/.test(contentLower)) cat = "Télécoms";
    else if (/mobile|smartphone/.test(contentLower)) cat = "Mobile";
    else if (/startup|incubateur|accélérateur/.test(contentLower)) cat = "Startups";
    else if (/\bia\b|intelligence artificielle|chatgpt|llm\b/.test(contentLower)) cat = "IA";
    else if (/fintech|paiement électronique|banque en ligne/.test(contentLower)) cat = "Fintech";
    else if (mentionsAlgerie && /entreprise|société/.test(contentLower)) cat = "Entreprises";
    document.getElementById('siCategorie').value = data.categorie || cat;
}

// 4. DÉPLOIEMENT FINAL (Simulation ou API Node)
async function deployArticle(e) {
    e.preventDefault();
    const btn = document.getElementById('deployBtn');
    btn.disabled = true;
    btn.querySelector('.si-deploy-inner').innerHTML = '<i class="fas fa-spinner fa-spin"></i> DÉPLOIEMENT EN COURS...';

    const formData = new FormData(document.getElementById('smartIngestForm'));

    // La case "Brèves" n'est envoyée par le navigateur que si elle est cochée ;
    // on la traduit ici vers le champ "type" attendu par le serveur.
    formData.set('type', document.getElementById('siBreve').checked ? 'breve' : '');
    formData.delete('isBreve');

    // Gestion auto de l'image — priorité : upload > embed og:image > Unsplash
    if(!document.getElementById('siImage').files[0]) {
        formData.delete('image');
        if (window._autoImage) {
            formData.set('existingImage', window._autoImage);
        } else {
        const titre = document.getElementById('siTitre')?.value || '';
        const tags  = document.getElementById('siTags')?.value  || '';
        const cat   = document.getElementById('siCategorie')?.value || '';
        const txt   = (titre + ' ' + tags + ' ' + cat).toLowerCase();
        const U = 'https://images.unsplash.com/', P = '?w=1200&h=800&fit=crop&q=80';
        const POOL = { drone:['photo-1527977966376-1c8408f9f108'], ecologie:['photo-1441974231531-c6227db76b6e','photo-1473341304170-971dccb5ac1e'], satellite:['photo-1451187580459-43490279c0fa'], ia:['photo-1620712943543-bcc4688e7485'], cyber:['photo-1550751827-4bd374c3f58b'], cloud:['photo-1629654297299-c8506221ca97'], startup:['photo-1522202176988-66273c2fd55f','photo-1559136555-9303baea8ebd'], mobile:['photo-1511707171634-5f897ff02aa9'], telecoms:['photo-1544197150-b99a580bb7a8'], default:['photo-1518770660439-4636190af475','photo-1504384308090-c894fdcc538d','photo-1517694712202-14dd9538aa97'] };
        let key = 'default';
        if (/drone|uav|pilote.*aérien/.test(txt)) key='drone'; else if (/écologie|environnement|vert|solaire/.test(txt)) key='ecologie'; else if (/satellite|espace|spatial/.test(txt)) key='satellite'; else if (/\bia\b|\bai\b|chatgpt|llm|intelligence artificielle/.test(txt)) key='ia'; else if (/cyber|sécurit|hack/.test(txt)) key='cyber'; else if (/cloud|serveur|data.?center/.test(txt)) key='cloud'; else if (/startup|entrepreneur|incubateur/.test(txt)) key='startup'; else if (/smartphone|mobile|android|ios/.test(txt)) key='mobile'; else if (/télécom|ooredoo|djezzy|mobilis|5g|4g|fibre/.test(txt)) key='telecoms';
        const pool = POOL[key];
        formData.set('existingImage', U + pool[Math.floor(Math.random()*pool.length)] + P);
        } // fin else no _autoImage
    }

    try {
        // Remplace par ton endpoint de création réel (Node.js)
        const res = await fetch('/api/create-article', { method: 'POST', body: formData });
        if(res.ok) {
            // Purge le cache local + le cache du Service Worker (stale-while-revalidate)
            // pour que l'accueil affiche immédiatement le nouvel article/brève, pas une copie périmée.
            localStorage.removeItem('at_articles_cache');
            localStorage.removeItem('at_breves_cache');
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage('CLEAR_CACHE');
            }
            document.getElementById('siSuccessModal').classList.remove('hidden');
        } else {
            throw new Error();
        }
    } catch (e) {
        alert("L'article a été simulé. Branchez votre endpoint POST /api/create-article pour sauvegarder réellement.");
        document.getElementById('siSuccessModal').classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.querySelector('.si-deploy-inner').innerHTML = '<i class="fas fa-rocket"></i> DÉPLOYER L\'ARTICLE SUR LE SITE';
    }
}

async function fetchCurrentPositions() {
    try {
        const r = await fetch('/articles.json');
        const articles = await r.json();
        const container = document.getElementById('positionsSlots');
        container.innerHTML = articles.slice(0, 2).map(a => 
            `<div class="si-pos-slot"><span class="pos-num">#</span> <span class="pos-title">${a.titre.substring(0, 30)}...</span></div>`
        ).join('');
    } catch(e) {
        console.log("Impossible de lire articles.json");
    }
}


// ═══════════════════════════════════════════════════════════
// EMBED SOCIAL (Facebook, Instagram, X, TikTok, YouTube...)
// ═══════════════════════════════════════════════════════════
let _pendingEmbed = null;

function openEmbedModal() {
    document.getElementById('siEmbedModal').classList.remove('hidden');
    document.getElementById('embedCodeInput').value = '';
    document.getElementById('embedPreviewBox').classList.add('hidden');
    document.getElementById('embedPreviewBox').innerHTML = '';
    document.getElementById('embedCodeInput').focus();
}

function closeEmbedModal() {
    document.getElementById('siEmbedModal').classList.add('hidden');
}

function previewEmbed() {
    const code = document.getElementById('embedCodeInput').value.trim();
    if (!code) { alert('Collez un code embed (iframe, blockquote...) d\'abord.'); return; }
    const box = document.getElementById('embedPreviewBox');
    box.innerHTML = code;
    box.classList.remove('hidden');
    // Execute any scripts in the embed (for Twitter/X, Instagram, TikTok embeds)
    box.querySelectorAll('script').forEach(oldScript => {
        const s = document.createElement('script');
        if (oldScript.src) s.src = oldScript.src; else s.textContent = oldScript.textContent;
        oldScript.replaceWith(s);
    });
}

function extractEmbedSourceUrl(code) {
    // Facebook iframe: extract href param
    const fbMatch = code.match(/href=([^&"]+)/);
    if (fbMatch) {
        try { return decodeURIComponent(fbMatch[1]); } catch(e) {}
    }
    // Generic iframe src
    const srcMatch = code.match(/src=["']([^"']+)["']/);
    if (srcMatch) return srcMatch[1];
    // Blockquote with data-instgrm-permalink or cite
    const citeMatch = code.match(/cite=["']([^"']+)["']/);
    if (citeMatch) return citeMatch[1];
    const permalinkMatch = code.match(/data-instgrm-permalink=["']([^"']+)["']/);
    if (permalinkMatch) return permalinkMatch[1];
    return '';
}

function extractEmbedPageName(url) {
    // Extract page/account name from Facebook, Instagram, X URLs
    try {
        const u = new URL(url);
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length) return parts[0];
    } catch(e) {}
    return '';
}

async function applyEmbed() {
    const code = document.getElementById('embedCodeInput').value.trim();
    if (!code) { alert('Collez un code embed d\'abord.'); return; }

    _pendingEmbed = code;
    const sourceUrl = extractEmbedSourceUrl(code);
    const pageName = extractEmbedPageName(sourceUrl);

    closeEmbedModal();

    // Visual feedback — loading
    const btn = document.getElementById('embedBtn');
    const span = btn.querySelector('span');
    const icon = btn.querySelector('i');
    btn.classList.add('si-btn-analyzing');
    btn.disabled = true;
    span.textContent = 'Extraction...';
    icon.className = 'fas fa-spinner fa-spin';

    // Fill source fields
    if (sourceUrl) {
        document.getElementById('siSource').value = sourceUrl;
        window._sourceUrl = sourceUrl;
        const badge = document.getElementById('sourceBadge');
        badge.textContent = '📱 Embed : ' + (pageName || sourceUrl).substring(0, 60);
        badge.classList.remove('hidden');
    }

    // 1) Show embed inline (photo/vidéo visible directement)
    const inlinePreview = document.getElementById('embedInlinePreview');
    const isVideoUrl = /\/videos\/|\/watch[\/?]|\/reel[\/?]/.test(sourceUrl);
    let videoPlayerHtml = '';
    if (isVideoUrl && sourceUrl.includes('facebook.com')) {
        const videoUrl = encodeURIComponent(sourceUrl);
        videoPlayerHtml = `<iframe src="https://www.facebook.com/plugins/video.php?href=${videoUrl}&show_text=false&width=500" width="500" height="400" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>`;
    }
    inlinePreview.innerHTML = (videoPlayerHtml || code);
    inlinePreview.classList.remove('hidden');

    // 2) Fetch text + image + video from the post URL
    let fetchedText = '', fetchedTitle = '', fetchedImage = '', fetchedVideo = '';
    if (sourceUrl) {
        try {
            const r = await fetch(`${API_BASE}/api/fetch-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: sourceUrl })
            });
            if (r.ok) {
                const data = await r.json();
                fetchedText = data.text || '';
                fetchedTitle = data.title || '';
                fetchedImage = data.image || '';
                fetchedVideo = data.video || '';
            }
        } catch(e) {
            console.log('Embed fetch-url:', e.message);
        }
    }

    // 3) Show extracted image below embed ONLY if no embed iframe already visible
    const embedHasIframe = /<iframe/.test(inlinePreview.innerHTML);
    if (fetchedImage && !embedHasIframe) {
        inlinePreview.innerHTML += `<img src="${fetchedImage}" alt="Illustration extraite">`;
    }
    // 4) Show video link if found
    if (fetchedVideo) {
        inlinePreview.innerHTML += `<a class="si-embed-video-link" href="${fetchedVideo}" target="_blank"><i class="fas fa-play-circle"></i> Vidéo détectée : ${fetchedVideo.substring(0, 60)}...</a>`;
        document.getElementById('siVideo').value = fetchedVideo;
    } else if (sourceUrl && isVideoUrl) {
        // Seulement pour une vraie vidéo : sinon (post photo) siVideo resterait une
        // URL non-vidéo qui déclenche l'image de couverture flottante dans l'article
        // (deux images côte à côte avec l'embed). Pour une photo, on laisse siVideo vide.
        document.getElementById('siVideo').value = sourceUrl;
    }

    // 5) Fill Dépôt Magique with extracted text
    if (fetchedText) {
        document.getElementById('smartBox').value = fetchedText;
        document.getElementById('charCount').textContent = fetchedText.length + ' caractères';
    }

    // 6) Pre-fill title
    if (fetchedTitle) {
        document.getElementById('siTitre').value = fetchedTitle;
    }

    // 7) Store embed + image + video player for final article
    window._embedCode = videoPlayerHtml || code;
    window._embedImage = fetchedImage;

    // 8) Build preview with everything
    const previewContent = document.getElementById('previewContent');
    const previewZone = document.getElementById('previewZone');
    const lines = (fetchedText || '').split('\n').filter(Boolean);
    const title = fetchedTitle || lines[0] || pageName;
    const body = fetchedText ? lines.slice(fetchedTitle ? 0 : 1).join('\n\n') : '';

    let preview = `# ${title}\n\n`;
    if (body) preview += body + '\n\n';
    // Include embed (video player or original) in article — no duplicate thumbnail
    const embedForArticle = videoPlayerHtml || code;
    preview += `<div class="article-embed">\n${embedForArticle}\n</div>`;

    previewContent.value = preview;
    previewZone.classList.remove('hidden');
    document.querySelector('.si-preview-head span').innerHTML =
        `<i class="fas fa-eye"></i> ${fetchedText ? 'ARTICLE EXTRAIT' : 'EMBED INTÉGRÉ'} — Cliquez "Remplir" puis "Déployer"`;

    // 9) Auto-fill the form (like clicking "Remplir")
    document.getElementById('siExtrait').value = lines.slice(0, 2).join(' ').substring(0, 300);
    let finalContent = stripLeadingTitle(preview);
    document.getElementById('siContenu').value = finalContent;

    // Auto-detect category
    const contentLower = (fetchedText + ' ' + title).toLowerCase();
    let cat = 'Algérie';
    if (/djezzy|mobilis|ooredoo|télécom|algérie télécom|idoom/.test(contentLower)) cat = 'Télécoms';
    else if (/mobile|smartphone/.test(contentLower)) cat = 'Mobile';
    else if (/startup|incubateur/.test(contentLower)) cat = 'Startups';
    else if (/\bia\b|intelligence artificielle|chatgpt|llm/.test(contentLower)) cat = 'IA';
    else if (/fintech|paiement/.test(contentLower)) cat = 'Fintech';
    document.getElementById('siCategorie').value = cat;

    // Auto-set cover image pour la miniature de l'article (card/listing)
    if (fetchedImage) {
        window._autoImage = fetchedImage;
    }

    // Success feedback
    btn.classList.remove('si-btn-analyzing');
    btn.classList.add('si-btn-done');
    btn.disabled = false;
    span.textContent = 'Prêt ✓';
    icon.className = 'fas fa-check';
    setTimeout(() => {
        btn.classList.remove('si-btn-done');
        span.textContent = 'Embed';
        icon.className = 'fas fa-code';
    }, 5000);
}

function previewSIImage(e) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        const p = document.getElementById('siImagePreview');
        p.innerHTML = `<img src="${ev.target.result}">`;
        p.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}