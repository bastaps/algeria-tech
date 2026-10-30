/* ═══════════════════════════════════════════════════════════
   smart-ingest.js — CONNECTÉ À SMART ENGINE (OLLAMA)
═══════════════════════════════════════════════════════════ */

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const REMOTE_API = 'https://dz-tech-press-api.onrender.com';

// Le Hub porte toutes les routes /api/*. En chemin relatif, la page servie par
// un autre port tombait sur une page HTML 404 : c'est l'origine exacte de
// l'erreur « Unexpected token < ». On vise donc le Hub explicitement.
const HUB_PORT = '3000';
const API_BASE = (function () {
    if (!isLocal) return '';                                // en ligne : mêmes routes /api/* (Pages Functions, session admin)
    if (window.location.port === HUB_PORT) return '';       // deja servi par le Hub
    return window.location.protocol + '//' + window.location.hostname + ':' + HUB_PORT;
})();
const ENGINE_URL = `${API_BASE}/api/smart-generate`;

// Une reponse HTML signifie « cette route n'existe pas ici ». On le dit en
// clair plutot que de laisser JSON.parse echouer sur un chevron.
async function lireJSON(res, quoi) {
    const type = res.headers.get('Content-Type') || '';
    const brut = await res.text();
    if (type.indexOf('json') === -1 || brut.trim().charAt(0) === '<') {
        throw new Error(
            quoi + " : le serveur a repondu du HTML au lieu de JSON (HTTP " + res.status + "). "
            + "Le Hub doit tourner sur le port " + HUB_PORT + " — verifiez `node server.js`.");
    }
    try { return JSON.parse(brut); }
    catch (e) { throw new Error(quoi + " : reponse illisible — " + brut.slice(0, 120)); }
}

// Pastille d'etat du Hub, dans l'en-tete.
async function verifierHub() {
    const dot = document.getElementById('hubDot');
    const lab = document.getElementById('hubLabel');
    if (!dot) return;
    try {
        const r = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
        const ok = r.ok;
        dot.classList.toggle('online', ok);
        dot.style.background = ok ? '' : 'var(--bad)';
        if (lab) lab.textContent = ok ? ('Hub :' + HUB_PORT) : 'Hub hors ligne';
    } catch (e) {
        dot.classList.remove('online');
        dot.style.background = 'var(--bad)';
        if (lab) lab.textContent = 'Hub hors ligne';
    }
}


/* ── Mode édition : ?edit=<id> recharge un article publié (le crayon du site) ── */
let articleEnEdition = null;   // { id, interactif, pdf, image, mediaPriority, source }

function lireFrontMatter(md) {
    const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return null;
    const get = (k) => {
        const r = m[1].match(new RegExp('^' + k + ':[ \t]*(.*)$', 'm'));
        return r ? r[1].trim().replace(/^["']|["']$/g, '').replace(/\\"/g, '"') : '';
    };
    const tagsM = m[1].match(/^tags:\s*\[(.*)\]/m);
    const tags = tagsM ? tagsM[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean) : [];
    return { get, tags, contenu: m[2].replace(/^\s+/, '') };
}

async function chargerArticleAEditer() {
    const params = new URLSearchParams(location.search);
    const id = params.get('edit');
    const brouillon = params.get('draft') === '1';
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return;
    const note = document.getElementById('deployNote');
    try {
        const r = await fetch(`${API_BASE}/${brouillon ? 'brouillons' : 'articles'}/${id}.md?t=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) throw new Error('Article introuvable (HTTP ' + r.status + ')');
        const fm = lireFrontMatter(await r.text());
        if (!fm) throw new Error("Format d'article illisible");
        const set = (i, v) => { const e = document.getElementById(i); if (e) e.value = v || ''; };
        set('siTitre', fm.get('titre')); set('siCategorie', fm.get('categorie'));
        set('siDate', fm.get('date')); set('siHeure', fm.get('heure'));
        set('siTags', fm.tags.join(', ')); set('siPosition', fm.get('position'));
        set('siExtrait', fm.get('extrait')); set('siARetenir', fm.get('aretenir'));
        set('siContenu', fm.contenu); set('siVideo', fm.get('video')); set('siSource', fm.get('source'));
        document.getElementById('siBreve').checked = fm.get('type') === 'breve';
        const pr = fm.get('mediaPriority') === 'image' ? 'siPriorityImage' : 'siPriorityVideo';
        const prEl = document.getElementById(pr); if (prEl) prEl.checked = true;
        window._autoImage = fm.get('image') || (brouillon ? fm.get('image_suggeree') : '') || '';
        articleEnEdition = { id, brouillon, interactif: fm.get('interactif'), pdf: fm.get('pdf'), image: fm.get('image') };
        if (brouillon) { const iu = document.getElementById('siImageUrl'); if (iu && window._autoImage) iu.value = window._autoImage; }
        const titre = document.querySelector('.si-deploy-inner');
        if (titre) titre.innerHTML = '<i class="fas fa-floppy-disk"></i> ENREGISTRER LES MODIFICATIONS';
        if (note) note.innerHTML = '<div class="si-note ok">' + (brouillon ? 'Brouillon <b>' + id + '</b> — relisez, corrigez, puis publiez (vérifiez surtout l’image et les faits).' : 'Modification de l’article <b>' + id + '</b> — l’image et la carte existantes sont conservées sauf si vous les remplacez.') + '</div>';
        document.getElementById('siContenu').dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e) {
        if (note) note.innerHTML = '<div class="si-note bad"><b>Chargement impossible.</b> ' + String(e.message || e).replace(/</g, '&lt;') + '</div>';
    }
}

// Embarqué dans le site (fenêtre par-dessus) : prévient la page parente.
function prevenirParent(type, extra) {
    try { if (window.parent !== window) window.parent.postMessage(Object.assign({ source: 'smart-ingest-pro', type }, extra || {}), location.origin); } catch (_) {}
}

document.addEventListener('DOMContentLoaded', () => {
    // Arrivée depuis le Téléchargeur Vidéo : ?url=… pré-remplit et lance l'import.
    try {
        const u = new URLSearchParams(location.search).get('url');
        const champ = document.getElementById('urlInput');
        if (u && /^https?:\/\//i.test(u) && champ) { champ.value = u; setTimeout(() => { try { fetchFromUrl(); } catch (_) {} }, 400); }
    } catch (_) {}
    initDateTime();
    chargerArticleAEditer();
    fetchCurrentPositions();
    setupStyleSelector();
    setupEngineSelector();
    setupDataSelector();
    setupHubDeploiement();
    setupMediasCorps();
    setupMediasPrincipaux();
    setupPalettes();
    verifierHub();
    setupIllustrationInput();
    setupVideoInput();
    setupDuelToggle();
    setupImportInteractif();
    setupApercuFormats();

    document.getElementById('smartBox').addEventListener('input', function() {
        document.getElementById('charCount').textContent = this.value.length + " caractères";
    });
});

let selectedStyle = 'aps';

function setupStyleSelector() {
    // Cloisonné au panneau des styles : les trois groupes partagent la classe
    // `.si-style-btn`, donc sans ce périmètre un clic ici effacerait la
    // sélection du moteur et celle des visualisations.
    const btns = document.querySelectorAll('#styleSelector .si-style-btn');
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

        // Le lien descend aussi dans le bloc « Article Interactif » : le même
        // sujet y sera préparé pour le rendu .html.
        const champBas = document.getElementById('aiUrlInput');
        if (champBas && !champBas.value.trim()) champBas.value = url;

        // Media Hub : ce que la page contenait comme photos/vidéos.
        ajouterAuMediaHub([
            { genre: 'image', url: data.image },
            { genre: 'video', url: data.video }
        ], 'og');
        scannerMediasSource(url);   // extraction fine, sans bloquer

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

    // Moteur heuristique : tout se fait ici, sans reseau ni cle.
    if (selectedEngine === 'heuristic') {
        try {
            const data = redactionHeuristique(source, selectedStyle);
            window._lastAI = data;
            document.getElementById('previewContent').value =
                `# ${data.titre}\n\n${data.lead}\n\n${data.contenu}`;
            document.getElementById('previewZone').classList.remove('hidden');
            const libelles = { aps: 'APS', pro: 'PRO ETOFFE', breve: 'BREVE' };
            document.querySelector('.si-preview-head span').innerHTML =
                `<i class="fas fa-eye"></i> REDACTION ${libelles[selectedStyle] || 'APS'} — HEURISTIQUE (APERCU)`;
            setStatus('genBtn', 'success');
        } catch (e) {
            console.error(e);
            alert('Moteur heuristique : ' + e.message);
            setStatus('genBtn', 'error');
        }
        return;
    }

    try {
        const response = await fetch(ENGINE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: source, style: selectedStyle, source_url: ((document.getElementById('urlInput') || {}).value || (document.getElementById('siSource') || {}).value || '').trim() })
        });

        const data = await lireJSON(response, 'Moteur de redaction');

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
        // Laisser l'apercu vide etait le vrai piege : le bouton « Remplir »
        // deversait alors le texte source tel quel, en un seul bloc, et
        // l'article partait ainsi sur le site comme dans le .html. On bascule
        // donc sur le moteur heuristique, en le disant clairement.
        try {
            // Mode IA obligatoire : le repli heuristique n'est autorisé que si l'API est expirée / sans crédit / clé refusée
            if (!/(401|402|403|429|quota|cr[ée]dit|expir|unauthorized|billing|api key|cl[ée] )/i.test(String(e.message))) { throw e; }
            const secours = redactionHeuristique(source, selectedStyle);
            window._lastAI = secours;
            document.getElementById('previewContent').value =
                `# ${secours.titre}\n\n${secours.lead}\n\n${secours.contenu}`;
            document.getElementById('previewZone').classList.remove('hidden');
            document.querySelector('.si-preview-head span').innerHTML =
                '<i class="fas fa-triangle-exclamation"></i> IA INDISPONIBLE — REPLI HEURISTIQUE';
            alert("Rédaction IA indisponible : " + e.message
                + "\n\nLe moteur heuristique a pris le relais — le texte est structuré,"
                + " mais sans réécriture par l'IA. Relancez « Générer » pour retenter.");
        } catch (e2) {
            alert("Erreur Moteur : " + e.message);
        }
        setStatus('genBtn', 'error');
    }
}

// 3. REMPLIR LE FORMULAIRE DE DÉPLOIEMENT
function fillHub() {
    setStatus('fillHubBtn', 'loading');

    if (window._lastAI) {
        fillFromAI(window._lastAI);
        normaliserARetenir();
        appliquerMediasAuFormulaire();
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
    normaliserARetenir();
    appliquerMediasAuFormulaire();
    setStatus('fillHubBtn', 'success');
}

// Retire la 1re ligne (le titre) du contenu : il figure déjà dans le champ Titre,
// sinon l'article afficherait un titre en double (h1 + titre en tête du corps).
function stripLeadingTitle(content) {
    if (!content) return content;
    return content.replace(/^\s*#*[^\n]*\n+/, '');
}

// ═══════════════════════════════════════════════════════════
// DATELINE AUTOMATIQUE — "Alger, [jour] [mois] [année] (Algeria Tech) — "
// ═══════════════════════════════════════════════════════════
function buildDateline() {
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    return `Alger, ${today} (Algeria Tech) — `;
}
// Retire un dateline déjà présent en tête (ex: "ALGER — ", "ALGER, 7 août 2026 (APS) — ")
// pour éviter d'en avoir deux quand on ajoute le nôtre.
function stripLeadingDateline(text) {
    if (!text) return text;
    return text.replace(/^[A-ZÀ-Ÿ][A-ZÀ-Ÿ' -]{1,24}(?:,\s*[^()\n]{0,40})?(?:\s*\([^)\n]{1,30}\))?\s*[—–-]\s+/, '');
}
function withDateline(text) {
    const body = stripLeadingDateline((text || '').replace(/^\s+/, ''));
    return buildDateline() + body;
}

function fillFromRawText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const titre = lines[0].replace(/^#+\s*/, '').substring(0, 200);
    document.getElementById('siTitre').value = titre;
    document.getElementById('siExtrait').value = lines.slice(1, 3).join(' ').substring(0, 300);
    let finalContent = withDateline(stripLeadingTitle(text));
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
    // Le moteur a lu une date dans le texte : elle prime sur celle du jour.
    if (data.date) document.getElementById('siDate').value = data.date;
    if (data.heure) document.getElementById('siHeure').value = data.heure;
    document.getElementById('siExtrait').value = data.lead || '';
    document.getElementById('siTags').value = (data.tags || []).join(', ');
    const existingVideo = document.getElementById('siVideo').value;
    document.getElementById('siVideo').value = data.video || existingVideo || '';
    let finalContent = withDateline(stripLeadingTitle(document.getElementById('previewContent').value));
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

    const versLocal = !isLocal || document.getElementById('tgtLocal').checked;       // en ligne : create-article écrit déjà sur GitHub
    const versGithub = isLocal && document.getElementById('tgtGithub').checked;      // /api/deploy-github n'existe que sur le Hub
    if (!versLocal && !versGithub) {
        const nb = document.getElementById('deployNote');
        if (nb) nb.innerHTML = '<div class="si-note bad">Cochez au moins une destination : Localhost et/ou GitHub.</div>';
        btn.disabled = false;
        btn.querySelector('.si-deploy-inner').innerHTML = '<i class="fas fa-rocket"></i> DÉPLOYER SUR ALGERIA TECH';
        return;
    }

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

    const noteBox = document.getElementById('deployNote');
    if (noteBox) noteBox.innerHTML = '';

    // Un identifiant décidé ici : l'article et sa carte doivent porter le même,
    // sinon le site ne sait pas les associer. `create-article` accepte un `id`.
    const idArticle = articleEnEdition ? articleEnEdition.id : String(Date.now());
    formData.set('id', idArticle);
    if (articleEnEdition) {
        if (articleEnEdition.interactif) formData.set('interactif', articleEnEdition.interactif);
        if (articleEnEdition.pdf) formData.set('existingPdf', articleEnEdition.pdf);
    }

    let cheminCarte = '';
    try {
        if (modeDeploiement !== 'simple') {
            if (noteBox) {
                noteBox.innerHTML = '<div class="si-note"><i class="fas fa-spinner fa-spin"></i>'
                    + ' Construction de la carte interactive…</div>';
            }
            cheminCarte = await publierCarte(idArticle);
            formData.set('interactif', cheminCarte);
        }
    } catch (e) {
        // La carte a échoué : on ne publie pas un article qui la référencerait à vide.
        if (noteBox) {
            noteBox.innerHTML = '<div class="si-note bad"><b>Carte interactive impossible.</b><br>'
                + String(e.message || e).replace(/</g, '&lt;')
                + '<br>Article non publié — choisissez « Article seul » pour publier sans carte.</div>';
        }
        btn.disabled = false;
        btn.querySelector('.si-deploy-inner').innerHTML =
            '<i class="fas fa-rocket"></i> DÉPLOYER SUR ALGERIA TECH';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/create-article`, { method: 'POST', body: formData });
        const data = await lireJSON(res, 'Publication');
        if (res.ok && data.success !== false) {
            if (modeDeploiement === 'site') { try { await regenererSite(); } catch (e) {} }
            if (cheminCarte && noteBox) {
                noteBox.innerHTML = '<div class="si-note ok">Carte publiée : ' + cheminCarte + '</div>';
            }
            if (versGithub) {
                if (noteBox) noteBox.innerHTML += '<div class="si-note"><i class="fas fa-spinner fa-spin"></i> Envoi vers GitHub (algeria-tech.pages.dev)…</div>';
                try {
                    const rg = await fetch(`${API_BASE}/api/deploy-github`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: idArticle, cleanupLocal: !versLocal })
                    });
                    const dg = await lireJSON(rg, 'Déploiement GitHub');
                    if (!rg.ok || dg.success === false) throw new Error(dg.message || ('HTTP ' + rg.status));
                    if (noteBox) noteBox.innerHTML += '<div class="si-note ok">GitHub : ' + dg.fichiers + ' fichier(s) poussé(s) — en ligne sur pages.dev dans ~1 min'
                        + (versLocal ? '' : ' (copie locale retirée)') + '.</div>';
                } catch (eg) {
                    if (noteBox) noteBox.innerHTML += '<div class="si-note bad"><b>GitHub : échec.</b> '
                        + String(eg.message || eg).replace(/</g, '&lt;')
                        + '<br>L’article reste enregistré en local ; recochez GitHub pour réessayer.</div>';
                    // Échec : on n'enlève jamais la copie locale.
                }
            }
            // Purge le cache local + le cache du Service Worker (stale-while-revalidate)
            // pour que l'accueil affiche immédiatement le nouvel article/brève, pas une copie périmée.
            localStorage.removeItem('at_articles_cache');
            localStorage.removeItem('at_breves_cache');
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage('CLEAR_CACHE');
            }
            document.getElementById('siSuccessModal').classList.remove('hidden');
            prevenirParent('publie', { id: idArticle });
            if (articleEnEdition && articleEnEdition.brouillon) {
                try { await fetch(`${API_BASE}/api/admin/drafts?id=${idArticle}`, { method: 'DELETE', credentials: 'same-origin' }); } catch (_) {}
            }
        } else {
            throw new Error(data.message || data.error || ('HTTP ' + res.status));
        }
    } catch (e) {
        // On ne prétend plus que l'article est parti : on dit ce qui a échoué.
        console.error('Publication :', e);
        if (noteBox) {
            noteBox.innerHTML = '<div class="si-note bad"><b>Publication refusée.</b><br>'
                + String(e.message || e).replace(/</g, '&lt;') + '</div>';
        } else {
            alert('Publication refusée : ' + (e.message || e));
        }
    } finally {
        btn.disabled = false;
        btn.querySelector('.si-deploy-inner').innerHTML = '<i class="fas fa-rocket"></i> DÉPLOYER L\'ARTICLE SUR LE SITE';
    }
}

async function fetchCurrentPositions() {
    try {
        const r = await fetch(`${API_BASE}/articles.json`);
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
    // L'image détectée doit se voir dans l'emplacement Smart Ingest dédié,
    // pas seulement rester en mémoire.
    if (fetchedImage) {
        window._autoImage = fetchedImage;
        const champSI = document.getElementById('siImageUrl');
        if (champSI && !champSI.value.trim()) {
            champSI.value = fetchedImage;
            setIllustration(fetchedImage);
        }
        // Et dans les Médias principaux, si l'utilisateur n'a rien mis.
        const champMedia = document.getElementById('mediaImageUrl');
        if (champMedia && !champMedia.value.trim()) {
            champMedia.value = fetchedImage;
            if (typeof apercusMediasPrincipaux === 'function') apercusMediasPrincipaux();
        }
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
    // Un fichier choisi manuellement prend le dessus sur une URL/collage précédent.
    window._autoImage = null;
    const urlIn = document.getElementById('siImageUrl');
    if (urlIn) urlIn.value = '';
    const reader = new FileReader();
    reader.onload = ev => {
        const p = document.getElementById('siImagePreview');
        p.innerHTML = `<img src="${ev.target.result}">`;
        p.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

// ═══════════════════════════════════════════════════════════
// ILLUSTRATION — collage (Ctrl+V) d'une image + URL directe
// ═══════════════════════════════════════════════════════════
async function uploadImageToServer(file) {
    const fd = new FormData();
    fd.append('photo', file);
    const r = await fetch(`${API_BASE}/api/upload-inline-image`, { method: 'POST', body: fd });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.url) throw new Error(data.message || "Échec de l'upload");
    return (API_BASE && data.url.startsWith('/')) ? API_BASE + data.url : data.url;
}

function setIllustration(url) {
    window._autoImage = url || null;
    const p = document.getElementById('siImagePreview');
    if (!p) return;
    if (url) {
        p.innerHTML = `<img src="${url}" onerror="this.parentNode.innerHTML='<small style=color:#ef4444>Image introuvable</small>'">`;
        p.classList.remove('hidden');
    } else {
        p.innerHTML = '';
        p.classList.add('hidden');
    }
}

function setupIllustrationInput() {
    const urlIn = document.getElementById('siImageUrl');
    const fileIn = document.getElementById('siImage');
    if (!urlIn) return;

    urlIn.addEventListener('input', () => {
        const u = urlIn.value.trim();
        if (u.startsWith('http') || u.startsWith('/')) {
            if (fileIn) fileIn.value = '';
            setIllustration(u);
        } else if (!u) {
            setIllustration('');
        }
    });

    async function handlePastedImage(file) {
        if (fileIn) fileIn.value = '';
        urlIn.value = '';
        urlIn.placeholder = 'Import en cours…';
        try {
            const url = await uploadImageToServer(file);
            setIllustration(url);
            urlIn.placeholder = 'ou URL d\'image (tous formats) / Ctrl+V pour coller';
        } catch (e) {
            urlIn.placeholder = 'ou URL d\'image (tous formats) / Ctrl+V pour coller';
            alert("Erreur import illustration : " + e.message);
        }
    }

    urlIn.addEventListener('paste', e => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                e.preventDefault();
                handlePastedImage(item.getAsFile());
                return;
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════
// VIDÉO / RÉSEAUX SOCIAUX — collage fichier/URL + extraction auto
// ═══════════════════════════════════════════════════════════
function isYouTubeUrl(u) {
    return /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))/.test(u);
}
function isDirectVideoUrl(u) {
    return /\.(mp4|webm|ogv|ogg|mov|m4v|avi|mkv)(\?|#|$)/i.test(u);
}

async function uploadVideoToServer(file) {
    const fd = new FormData();
    fd.append('video', file);
    const r = await fetch(`${API_BASE}/api/upload-inline-video`, { method: 'POST', body: fd });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.url) throw new Error(data.message || "Échec de l'upload");
    return { url: (API_BASE && data.url.startsWith('/')) ? API_BASE + data.url : data.url, local: !!data.local };
}

// Envoie un fichier vidéo local sur YouTube et renvoie UNIQUEMENT l'URL.
// Aucun article n'est créé : c'est l'utilisateur qui clique sur « Générer ».
async function uploadVideoToYoutube(file) {
    const fd = new FormData();
    fd.append('video', file);
    fd.append('privacy', 'unlisted');
    const r = await fetch(`${API_BASE}/api/youtube-upload-file`, { method: 'POST', body: fd });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.youtubeUrl) throw new Error((d.error || 'Échec') + (d.hint ? ' — ' + d.hint : ''));
    return d.youtubeUrl;
}

function setVideoStatus(html) {
    const box = document.getElementById('siVideoPreview');
    if (!box) return;
    box.innerHTML = html || '';
    box.classList.toggle('hidden', !html);
}

function renderVideoPreview(url, opts = {}) {
    if (!url) { setVideoStatus(''); return; }
    if (isYouTubeUrl(url)) {
        setVideoStatus(`<span class="si-embed-video-link"><i class="fab fa-youtube"></i> Vidéo YouTube détectée — s'affichera nativement</span>`);
    } else if (opts.local) {
        setVideoStatus(`<video controls src="${url}"></video><span class="si-embed-video-link si-video-warn"><i class="fas fa-exclamation-triangle"></i> Fichier local — non déployé sur le site (limite Cloudflare 25 Mo). Pour publier, utilisez l'outil Téléchargeur Vidéo (republication YouTube).</span>`);
    } else {
        setVideoStatus(`<video controls src="${url}" onerror="this.outerHTML='<span class=si-embed-video-link>Aperçu indisponible (une vidéo hébergée sur le site ne se lit qu après le déploiement, 2 à 4 min) — le lien est conservé</span>'"></video>`);
    }
}

async function handleVideoUrlEntered(url) {
    url = (url || '').trim();
    if (!url) { setVideoStatus(''); return; }
    if (!/^https?:\/\//.test(url)) return;
    if (isYouTubeUrl(url) || isDirectVideoUrl(url)) { renderVideoPreview(url); return; }

    setVideoStatus(`<span class="si-embed-video-link"><i class="fas fa-spinner fa-spin"></i> Extraction de la vidéo…</span>`);
    try {
        const r = await fetch(`${API_BASE}/api/extract-video-url?url=${encodeURIComponent(url)}`);
        const data = await r.json();
        if (!r.ok || !data.directUrl) throw new Error(data.error || 'Extraction impossible');
        document.getElementById('siVideo').value = data.directUrl;
        renderVideoPreview(data.directUrl);
    } catch (e) {
        setVideoStatus(`<span class="si-embed-video-link si-video-error"><i class="fas fa-exclamation-triangle"></i> ${e.message} — essayez le bouton "Embed" avec le code d'intégration officiel à la place.</span>`);
    }
}

function setupVideoInput() {
    const videoIn = document.getElementById('siVideo');
    if (!videoIn) return;

    // Vidéo locale collée/déposée → YouTube → l'URL YouTube remplace le fichier.
    const sendToYoutube = file => {
        const mb = (file.size / 1048576).toFixed(0);
        setVideoStatus(`<span class="si-embed-video-link"><i class="fas fa-spinner fa-spin"></i> Envoi de la vidéo (${mb} Mo) vers YouTube… patientez, ça peut prendre plusieurs minutes.</span>`);
        uploadVideoToYoutube(file)
            .then(url => {
                videoIn.value = url;
                renderVideoPreview(url);
            })
            .catch(async err => {
                // Repli : YouTube indisponible (en ligne, jeton expiré, non configuré…) → la vidéo est hébergée sur le site.
                setVideoStatus(`<span class="si-embed-video-link"><i class="fas fa-spinner fa-spin"></i> YouTube indisponible (${err.message}) — hébergement de la vidéo sur le site…</span>`);
                try {
                    const h = await uploadVideoToServer(file);
                    videoIn.value = h.url;
                    renderVideoPreview(h.url, { local: h.local });
                } catch (e2) {
                    setVideoStatus(`<span class="si-embed-video-link si-video-error"><i class="fas fa-exclamation-triangle"></i> Vidéo non envoyée : ${e2.message}</span>`);
                }
            });
    };

    videoIn.addEventListener('paste', e => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.kind === 'file' && item.type.startsWith('video/')) {
                e.preventDefault();
                sendToYoutube(item.getAsFile());
                return;
            }
        }
    });
    videoIn.addEventListener('dragover', e => e.preventDefault());
    videoIn.addEventListener('drop', e => {
        const f = [...(e.dataTransfer?.files || [])].find(x => x.type.startsWith('video/'));
        if (f) { e.preventDefault(); sendToYoutube(f); }
    });

    videoIn.addEventListener('change', () => handleVideoUrlEntered(videoIn.value));
    videoIn.addEventListener('blur', () => handleVideoUrlEntered(videoIn.value));
}


/* ═══════════════════════════════════════════════════════════════════════
   SMART INGEST PRO — ajouts
   Moteur heuristique · module Données · « À retenir » sans doublon
   ═══════════════════════════════════════════════════════════════════════ */

let selectedEngine = 'ia'; // mode IA par défaut ; l'heuristique ne sert qu'en secours quand l'API est expirée
let selectedData = 'figures';

function setupEngineSelector() {
    const zone = document.getElementById('engineSelector');
    if (!zone) return;
    zone.querySelectorAll('[data-engine]').forEach(b => {
        b.addEventListener('click', () => {
            zone.querySelectorAll('[data-engine]').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            selectedEngine = b.dataset.engine;
        });
    });
}

// Sélection MULTIPLE : on peut demander les chiffres clés, la frise et le
// graphique d'un seul coup. Chaque clic bascule sa vignette.
function setupDataSelector() {
    document.querySelectorAll('[data-data]').forEach(b => {
        b.addEventListener('click', () => {
            b.classList.toggle('active');
            majCompteurDonnees();
        });
    });
    majCompteurDonnees();
}

function donneesChoisies() {
    return [...document.querySelectorAll('[data-data].active')].map(b => b.dataset.data);
}

function majCompteurDonnees() {
    const cible = document.getElementById('dataCount');
    if (!cible) return;
    const n = donneesChoisies().length;
    cible.textContent = n ? (n + ' bloc' + (n > 1 ? 's' : '') + ' sélectionné' + (n > 1 ? 's' : ''))
                          : 'aucun bloc sélectionné';
}

/* ───────────────────────── moteur heuristique (gratuit) ───────────────── */

const SI_VIDES = new Set(('le la les un une des du de et ou mais donc or ni car que qui quoi dont ' +
    'ce cette ces cet il elle ils elles on nous vous je tu son sa ses leur leurs mon ma mes ton ta ' +
    'notre votre au aux avec sans pour par sur sous dans chez vers entre est sont ete etre avoir a ' +
    'ont plus moins tres tout tous toute toutes autre autres meme aussi ainsi apres avant depuis ' +
    'lors alors cependant toutefois enfin ensuite puis selon comme si ne pas plus jamais deja').split(' '));

function siSansAccent(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function siPhrases(texte) {
    // Les intertitres, listes et balises ne sont pas des phrases : sans ce
    // nettoyage, un « ## Contexte » se retrouve collé en tête d'un point clé.
    return String(texte || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/^#{1,6}\s.*$/gm, ' ')
        .replace(/^\s*[-*•+]\s+/gm, ' ')
        .replace(/[*_`>|]/g, ' ')
        .replace(/\s+/g, ' ')
        .match(/[^.!?]+[.!?]+/g) || [];
}

// On note chaque phrase : chiffres, unités, dates et verbes d'annonce pèsent le
// plus. Aucune phrase n'est reformulée — on ne garde que du texte d'origine.
function siNoterPhrases(texte) {
    return siPhrases(texte).map((p, i) => {
        const t = p.trim();
        let note = 0;
        note += Math.min((t.match(/\d/g) || []).length, 8) * 1.6;
        if (/\b(%|milliards?|millions?|dinars?|DA|USD|Mds|MW|km|Go|Mo|abonn)/i.test(t)) note += 3;
        if (/\b(20\d{2}|trimestre|semestre|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/i.test(t)) note += 2;
        if (/\b(annonc|lanc|prévoit|permettra|vise|objectif|décid|sign|approuv|inaugur|déploie)/i.test(t)) note += 2;
        if (i === 0) note += 2.5;
        return { texte: t, note, i };
    }).filter(p => p.texte.length > 40 && p.texte.length < 400);
}

function siMotsCles(texte, combien) {
    const freq = {};
    siSansAccent(texte).replace(/[^a-z0-9àâçéèêëîïôûùüÿñæœ' -]/g, ' ')
        .split(/[\s'-]+/)
        .forEach(m => {
            if (m.length < 4 || SI_VIDES.has(m)) return;
            freq[m] = (freq[m] || 0) + 1;
        });
    // Les noms propres du texte d'origine méritent leur majuscule.
    const propres = {};
    (String(texte).match(/\b[A-ZÀ-Ý][\wÀ-ÿ'-]{2,}/g) || []).forEach(m => {
        const k = siSansAccent(m);
        if (!SI_VIDES.has(k)) propres[k] = m;
    });
    return Object.keys(freq)
        .sort((a, b) => freq[b] - freq[a])
        .slice(0, combien || 6)
        .map(k => propres[k] || k);
}

/* ═══════════════════════════════════════════════════════════════════════
   MOTEUR HEURISTIQUE — extraction en quatre passes distinctes
   Chaque passe fait une seule chose et retire ce qu'elle a consommé, pour que
   la suivante ne retrouve pas les mêmes lignes. C'est ce cloisonnement qui
   évite le « bloc massif » et les datelines en double.
   ═══════════════════════════════════════════════════════════════════════ */

const MOIS_FR = {
    janvier: 1, 'février': 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
    juillet: 7, 'août': 8, aout: 8, septembre: 9, octobre: 10,
    novembre: 11, 'décembre': 12, decembre: 12
};

// Passe 1 — la ligne de publication. « Publié le 21 août 2026 à 10h30 »,
// « 21/08/2026 », « Le 21 août 2026 ». Elle est consommée, pas recopiée.
function siExtraireDate(lignes) {
    const motifs = [
        /^\s*(?:publi[ée]\s*(?:le)?|mis\s*à\s*jour\s*(?:le)?|le)?\s*(\d{1,2})\s+([a-zà-ÿ]+)\s+(\d{4})(?:\s*[àa]\s*(\d{1,2})\s*[h:]\s*(\d{2}))?\s*$/i,
        /^\s*(?:publi[ée]\s*(?:le)?|le)?\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})(?:\s*[àa]\s*(\d{1,2})\s*[h:]\s*(\d{2}))?\s*$/i
    ];
    for (let i = 0; i < Math.min(lignes.length, 6); i++) {
        const l = lignes[i];
        if (l.length > 60) continue;              // une phrase, pas une date
        for (let m = 0; m < motifs.length; m++) {
            const t = l.match(motifs[m]);
            if (!t) continue;
            let jour, mois, annee;
            if (m === 0) {
                jour = +t[1];
                mois = MOIS_FR[siSansAccent(t[2])] || MOIS_FR[t[2].toLowerCase()];
                annee = +t[3];
                if (!mois) continue;
            } else {
                jour = +t[1]; mois = +t[2]; annee = +t[3];
            }
            if (!(annee > 1990 && mois >= 1 && mois <= 12 && jour >= 1 && jour <= 31)) continue;
            const deux = n => String(n).padStart(2, '0');
            lignes.splice(i, 1);                  // consommée
            return {
                date: annee + '-' + deux(mois) + '-' + deux(jour),
                heure: t[4] ? deux(+t[4]) + ':' + t[5] : ''
            };
        }
    }
    return null;
}

// Passe 2 — le titre : première ligne courte, non ponctuée, avant tout le reste.
function siExtraireTitre(lignes) {
    for (let i = 0; i < Math.min(lignes.length, 4); i++) {
        const l = lignes[i].replace(/^#+\s*/, '').trim();
        if (l.length < 15 || l.length > 140) continue;
        if (/[.!?…]$/.test(l)) continue;          // une phrase, pas un titre
        if (/^(publi|par |source|photo|crédit)/i.test(l)) continue;
        lignes.splice(i, 1);
        return l;
    }
    // Rien de net : on prend la première phrase, tronquée.
    const secours = (lignes[0] || '').replace(/^#+\s*/, '').split(/(?<=[.!?])\s/)[0] || '';
    return secours.slice(0, 120).trim();
}

// Passe 3 — la dateline d'agence en tête de corps : « ALGER — », « Alger (APS) — ».
function siRetirerDatelineAgence(texte) {
    return texte.replace(
        /^\s*[A-ZÀ-Ý][A-ZÀ-Ýa-zà-ÿ'’\- ]{1,30}\s*(?:\([^)]{1,30}\))?\s*[—–-]\s*/, '').trim();
}

// Passe 4 — la mise en paragraphes. Un texte collé d'un site arrive souvent
// d'un seul tenant : on le redécoupe par phrases plutôt que de livrer un pavé.
function siParagraphes(texte, phrasesParBloc) {
    const nets = texte.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 40);
    if (nets.length >= 2) return nets;

    const lignes = texte.split('\n').map(l => l.trim()).filter(l => l.length > 40);
    if (lignes.length >= 3) return lignes;

    const phrases = (texte.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+/g) || [])
        .map(p => p.trim()).filter(Boolean);
    if (!phrases.length) return texte.trim() ? [texte.trim()] : [];

    // Decoupage adaptatif : on vise quatre blocs, de quoi nourrir un chapeau et
    // deux sections. Un bloc fige de trois phrases donnerait un article sans
    // intertitre des que la depeche est courte.
    const vise = 4;
    let taille = Math.max(2, Math.round(phrases.length / vise));
    if (phrasesParBloc && phrases.length >= phrasesParBloc * vise) taille = phrasesParBloc;
    const blocs = [];
    for (let i = 0; i < phrases.length; i += taille) {
        blocs.push(phrases.slice(i, i + taille).join(' '));
    }
    return blocs;
}

function redactionHeuristique(source, style) {
    const brut = String(source || '').trim();
    if (brut.length < 60) throw new Error('Texte source trop court.');

    // Un « À retenir » déjà rédigé est mis de côté avant tout découpage.
    const misDeCote = extraireARetenir(brut);
    const lignes = misDeCote.contenu.split('\n').map(l => l.trim()).filter(Boolean);
    window._siRetenirSource = misDeCote.points;

    const quand = siExtraireDate(lignes);
    const titre = siExtraireTitre(lignes);
    const corps = siRetirerDatelineAgence(lignes.join('\n'));

    const parBloc = style === 'breve' ? 2 : style === 'pro' ? 4 : 3;
    const paragraphes = siParagraphes(corps, parBloc);

    // Le chapeau : le premier paragraphe, ramené à deux phrases.
    const tete = paragraphes[0] || '';
    const lead = ((tete.match(/[^.!?]+[.!?]+/g) || [tete]).slice(0, 2).join(' ')).trim().slice(0, 320);

    const reste = paragraphes.slice(1);
    let contenu;
    if (style === 'breve') {
        contenu = paragraphes.slice(0, 3).join('\n\n');
    } else if (style === 'pro' && reste.length >= 3) {
        const t = Math.ceil(reste.length / 3);
        contenu = [
            '## Ce qu’il faut savoir\n\n' + reste.slice(0, t).join('\n\n'),
            '## Les faits\n\n' + reste.slice(t, t * 2).join('\n\n'),
            '## Ce que cela change\n\n' + reste.slice(t * 2).join('\n\n')
        ].filter(b => b.split('\n\n')[1]).join('\n\n');
    } else if (reste.length >= 2) {
        const m = Math.ceil(reste.length / 2);
        contenu = [
            '## Les faits\n\n' + reste.slice(0, m).join('\n\n'),
            '## Contexte\n\n' + reste.slice(m).join('\n\n')
        ].filter(b => b.split('\n\n')[1]).join('\n\n');
    } else {
        contenu = paragraphes.join('\n\n');
    }
    if (!contenu.trim()) contenu = paragraphes.join('\n\n') || corps;

    return {
        titre: titre,
        lead: lead,
        contenu: contenu,
        tags: siMotsCles(corps, 5),
        date: quand ? quand.date : '',
        heure: quand ? quand.heure : '',
        moteur: 'heuristique'
    };
}

/* ─────────────── « À retenir » : un seul bloc, le bon ─────────────────────
   Le site affiche déjà un encadré stylé (buildARetenir dans script.js) nourri
   par le champ « aretenir ». Laisser en plus une section « ## À retenir » dans
   le markdown produit deux fois la même chose à l'écran : on la retire du corps
   et on en verse le contenu dans le champ.                                   */

function extraireARetenir(markdown) {
    const texte = String(markdown || '');
    const bloc = texte.match(/^#{1,6}\s*[^\n]*À\s*retenir[^\n]*\n([\s\S]*?)(?=\n#{1,6}\s|\s*$)/im);
    if (!bloc) return { contenu: texte, points: [] };

    const points = bloc[1].split('\n')
        .map(l => l.replace(/^\s*[-*•+]\s*/, '').replace(/^\s*\d+[.)]\s*/, '').trim())
        .filter(l => l.length > 12);

    return { contenu: texte.replace(bloc[0], '').replace(/\n{3,}/g, '\n\n').trim(), points: points };
}

// « Alger, 21 août 2026 (Algeria Tech) — » signe l'article ; ce n'est pas un
// point à retenir. On la retire de la tête du point.
function siSansDateline(phrase) {
    return String(phrase || '').replace(
        /^\s*[\wÀ-ÿ'’\- ]{3,28},\s*(?:le\s+)?(?:\d{1,2}\s+[\wÀ-ÿ]+\s+\d{4}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})\s*(?:\([^)]*\))?\s*[—–-]\s*/,
        '').trim();
}

// Appelé après le remplissage du formulaire : déplace le bloc s'il existe.
function normaliserARetenir() {
    const champContenu = document.getElementById('siContenu');
    const champRetenir = document.getElementById('siARetenir');
    if (!champContenu || !champRetenir) return;

    // Points déjà présents dans la source, mis de côté avant restructuration.
    if (!champRetenir.value.trim() && (window._siRetenirSource || []).length) {
        champRetenir.value = window._siRetenirSource.map(siSansDateline).join('\n');
    }

    const out = extraireARetenir(champContenu.value);
    if (out.points.length) {
        champContenu.value = out.contenu;
        if (!champRetenir.value.trim()) {
            champRetenir.value = out.points.map(siSansDateline).join('\n');
        }
        return;
    }
    // Aucun bloc dans le texte : on propose les phrases les plus fortes.
    if (!champRetenir.value.trim()) {
        // Le chapeau est repris en tête du corps : sans dédoublonnage, la même
        // phrase reviendrait deux fois dans les points.
        const vus = new Set();
        const points = [];
        siNoterPhrases(champContenu.value)
            .sort((a, b) => b.note - a.note)
            .forEach(p => {
                const propre = siSansDateline(p.texte);
                const cle = siSansAccent(propre).replace(/[^a-z0-9]/g, '');
                if (!propre || vus.has(cle) || points.length >= 3) return;
                vus.add(cle);
                points.push({ texte: propre, i: p.i });
            });
        champRetenir.value = points.sort((a, b) => a.i - b.i)
            .map(p => p.texte).join('\n');
    }
}

/* ───────────────────────── module Visualisation de données ─────────────── */

let donneesTrouvees = null;

function siNombre(brut) {
    const n = parseFloat(String(brut).replace(/[  ]/g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
}

function scanDonnees() {
    const source = (document.getElementById('smartBox').value || '')
        + '\n' + (document.getElementById('siContenu').value || '');
    const sortie = document.getElementById('dataOut');

    const chiffres = [];
    const motif = /([+-]?\d[\d  .,]*)\s*(%|milliards?|millions?|milliers?|dinars?|DA|USD|€|\$|MW|km|Go|Mo|To|abonnés?|foyers?|points?)?/gi;
    let m;
    while ((m = motif.exec(source)) !== null) {
        const valeur = siNombre(m[1]);
        if (valeur === null || Math.abs(valeur) < 2) continue;
        const debut = Math.max(0, m.index - 70);
        const contexte = source.slice(debut, m.index).replace(/\s+/g, ' ').trim();
        const mots = contexte.split(' ').filter(Boolean).slice(-5).join(' ');
        chiffres.push({
            valeur: valeur,
            affiche: (m[1].trim() + (m[2] ? ' ' + m[2] : '')).trim(),
            libelle: (mots || 'Donnée').replace(/^[^\wÀ-ÿ]+/, '').slice(0, 46)
        });
        if (chiffres.length >= 40) break;
    }

    // Doublons : une même valeur répétée n'apporte rien de plus.
    const vus = new Set();
    const uniques = chiffres.filter(c => {
        const cle = c.affiche.toLowerCase();
        if (vus.has(cle)) return false;
        vus.add(cle); return true;
    });

    const tableaux = (source.match(/^\|.+\|\s*$(?:\n^\|.+\|\s*$)+/gm) || []);
    const annees = [...new Set((source.match(/\b20\d{2}\b/g) || []))].sort();

    donneesTrouvees = { chiffres: uniques, tableaux: tableaux, annees: annees };

    if (!uniques.length && !tableaux.length) {
        sortie.innerHTML = '<div class="si-data-empty">Aucune donnée chiffrée exploitable '
            + 'dans ce texte. Le module n\'invente rien : sans chiffre, pas de visuel.</div>';
        return;
    }

    let html = '';
    html += ligneData('fa-hashtag', 'Chiffres détectés', uniques.length);
    if (annees.length) html += ligneData('fa-calendar', 'Années repérées', annees.join(' · '));
    if (tableaux.length) html += ligneData('fa-table', 'Tableaux markdown', tableaux.length);
    uniques.slice(0, 6).forEach(c => {
        html += '<div class="si-data-item"><i class="fas fa-circle-dot" style="color:var(--gold);font-size:.6rem"></i>'
            + '<b>' + siEchap(c.affiche) + '</b><span>' + siEchap(c.libelle) + '</span></div>';
    });
    sortie.innerHTML = html;
}

function ligneData(icone, titre, valeur) {
    return '<div class="si-data-item"><i class="fas ' + icone + '" style="color:var(--gold)"></i>'
        + '<b>' + titre + '</b><span>' + siEchap(String(valeur)) + '</span></div>';
}

function siEchap(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Les blocs sont autonomes : styles en ligne, animations CSS, aucun script ni
   bibliothèque tierce. Ils s'affichent donc partout — site, e-mail, export. */

const OR = '#d4af37', OR_CLAIR = '#e5c76b', MARRON = '#2e2318', MARRON_F = '#181109';

function blocChiffres(chiffres) {
    const lot = chiffres.slice(0, 4);
    if (!lot.length) return '';
    const cases = lot.map((c, i) => `
      <div style="flex:1 1 160px;min-width:150px;background:linear-gradient(160deg,${MARRON} 0%,${MARRON_F} 100%);
                  border:1px solid rgba(212,175,55,.24);border-radius:16px;padding:18px 16px;
                  animation:atPop .5s ease-out ${i * 0.09}s both">
        <div style="font-size:1.85rem;font-weight:800;letter-spacing:-.03em;
                    background:linear-gradient(120deg,#8f6f22,#e5c76b 40%,#f2e0aa 55%,#b8912f);
                    -webkit-background-clip:text;background-clip:text;
                    -webkit-text-fill-color:transparent;color:transparent">${siEchap(c.affiche)}</div>
        <div style="font-size:.76rem;color:#a2907a;margin-top:6px;line-height:1.45">${siEchap(c.libelle)}</div>
      </div>`).join('');
    return `<div class="at-data at-data-figures" style="display:flex;flex-wrap:wrap;gap:12px;margin:22px 0">${cases}</div>`;
}

function blocGraphique(chiffres) {
    const lot = chiffres.slice(0, 6);
    if (lot.length < 2) return '';
    const max = Math.max(...lot.map(c => Math.abs(c.valeur))) || 1;
    const barres = lot.map((c, i) => {
        const h = Math.max(6, Math.round(Math.abs(c.valeur) / max * 100));
        return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;min-width:52px">
        <div style="font-size:.72rem;color:${OR_CLAIR};font-weight:600">${siEchap(c.affiche)}</div>
        <div style="width:100%;height:150px;display:flex;align-items:flex-end">
          <div style="width:100%;height:${h}%;border-radius:8px 8px 3px 3px;
                      background:linear-gradient(180deg,${OR_CLAIR},${OR} 60%,#8f6f22);
                      animation:atGrow .8s cubic-bezier(.22,1,.36,1) ${i * 0.1}s both;
                      transform-origin:bottom"></div>
        </div>
        <div style="font-size:.64rem;color:#a2907a;text-align:center;line-height:1.35">${siEchap(c.libelle.slice(0, 24))}</div>
      </div>`;
    }).join('');
    return `<div class="at-data at-data-chart" style="background:linear-gradient(160deg,${MARRON} 0%,${MARRON_F} 100%);
              border:1px solid rgba(212,175,55,.24);border-radius:18px;padding:22px 20px;margin:22px 0">
              <div style="font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;color:#a2907a;margin-bottom:16px">
                Les chiffres en un coup d'œil</div>
              <div style="display:flex;gap:12px;align-items:flex-end">${barres}</div>
            </div>`;
}

function blocTableau(markdown) {
    const lignes = markdown.trim().split('\n').map(l => l.trim());
    const cellules = l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    const entetes = cellules(lignes[0]);
    const corps = lignes.slice(1).filter(l => !/^\|[\s:-]+\|$/.test(l.replace(/\s/g, ''))
                                             && !/^[\s|:-]+$/.test(l));
    const th = entetes.map(h => `<th style="padding:11px 13px;text-align:left;font-size:.7rem;
        letter-spacing:.1em;text-transform:uppercase;color:${MARRON_F};font-weight:700">${siEchap(h)}</th>`).join('');
    const tr = corps.map((l, i) => {
        const tds = cellules(l).map(c => `<td style="padding:11px 13px;font-size:.85rem;
            color:#f3ece1;border-top:1px solid rgba(212,175,55,.12)">${siEchap(c)}</td>`).join('');
        return `<tr style="background:${i % 2 ? 'rgba(255,255,255,.02)' : 'transparent'}">${tds}</tr>`;
    }).join('');
    return `<div class="at-data at-data-table" style="margin:22px 0;border-radius:16px;overflow:hidden;
              border:1px solid rgba(212,175,55,.24)">
              <table style="width:100%;border-collapse:collapse">
                <thead style="background:linear-gradient(120deg,#8f6f22,#e5c76b 45%,#b8912f)">
                  <tr>${th}</tr></thead>
                <tbody style="background:linear-gradient(160deg,${MARRON} 0%,${MARRON_F} 100%)">${tr}</tbody>
              </table>
            </div>`;
}

function blocInfographie(donnees, titre) {
    const chiffres = blocChiffres(donnees.chiffres);
    const graphique = blocGraphique(donnees.chiffres);
    if (!chiffres && !graphique) return '';
    return `<div class="at-data at-data-info" style="margin:24px 0;padding:22px;border-radius:20px;
              background:linear-gradient(160deg,${MARRON} 0%,${MARRON_F} 100%);
              border:1px solid rgba(212,175,55,.24)">
              <div style="font-size:1rem;font-weight:600;margin-bottom:4px;
                          background:linear-gradient(120deg,#8f6f22,#e5c76b 40%,#f2e0aa 55%,#b8912f);
                          -webkit-background-clip:text;background-clip:text;
                          -webkit-text-fill-color:transparent;color:transparent">${siEchap(titre || 'Les données de l\'article')}</div>
              <div style="font-size:.72rem;color:#a2907a;margin-bottom:16px">Repères chiffrés relevés dans le texte</div>
              ${chiffres}${graphique}
            </div>`;
}


/* ═══════════ visualisations supplémentaires ═══════════
   Toutes autonomes : styles en ligne, animations CSS, aucune bibliothèque. */

function blocFrise(annees, source) {
    if (annees.length < 2) return '';
    const jalons = annees.slice(0, 6).map((an, i) => {
        const idx = source.indexOf(an);
        const autour = idx < 0 ? '' : source.slice(idx, idx + 150).replace(/\s+/g, ' ');
        const phrase = (autour.split(/(?<=[.!?])\s/)[0] || autour).slice(0, 110);
        return `
      <div style="display:flex;gap:14px;align-items:flex-start;
                  animation:atPop .5s ease-out ${i * 0.08}s both">
        <div style="flex:none;width:62px;text-align:right;font-weight:700;font-size:.95rem;
                    background:linear-gradient(120deg,#8f6f22,#e5c76b 45%,#b8912f);
                    -webkit-background-clip:text;background-clip:text;
                    -webkit-text-fill-color:transparent;color:transparent">${siEchap(an)}</div>
        <div style="flex:none;width:11px;display:flex;flex-direction:column;align-items:center">
          <span style="width:9px;height:9px;border-radius:50%;background:${OR};margin-top:5px"></span>
          <span style="flex:1;width:1px;background:rgba(212,175,55,.28);min-height:26px"></span>
        </div>
        <div style="font-size:.82rem;color:#f3ece1;line-height:1.55;padding-bottom:16px">${siEchap(phrase)}</div>
      </div>`;
    }).join('');
    return `<div class="at-data at-data-timeline" style="margin:22px 0;padding:22px;border-radius:18px;
              background:linear-gradient(160deg,${MARRON} 0%,${MARRON_F} 100%);
              border:1px solid rgba(212,175,55,.24)">
              <div style="font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;
                          color:#a2907a;margin-bottom:18px">Le fil des dates</div>
              ${jalons}
            </div>`;
}

function blocJauges(chiffres) {
    // Une jauge n'a de sens que pour un pourcentage.
    const pourcents = chiffres.filter(c => /%/.test(c.affiche)).slice(0, 5);
    if (!pourcents.length) return '';
    const lignes = pourcents.map((c, i) => {
        const pct = Math.max(0, Math.min(100, Math.abs(c.valeur)));
        return `
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:6px">
          <span style="color:#f3ece1">${siEchap(c.libelle)}</span>
          <b style="color:${OR_CLAIR}">${siEchap(c.affiche)}</b>
        </div>
        <div style="height:9px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden">
          <div style="height:100%;width:${pct}%;border-radius:99px;
                      background:linear-gradient(90deg,#8f6f22,${OR} 55%,${OR_CLAIR});
                      animation:atWidth 1s cubic-bezier(.22,1,.36,1) ${i * 0.1}s both"></div>
        </div>
      </div>`;
    }).join('');
    return `<div class="at-data at-data-gauge" style="margin:22px 0;padding:22px;border-radius:18px;
              background:linear-gradient(160deg,${MARRON} 0%,${MARRON_F} 100%);
              border:1px solid rgba(212,175,55,.24)">
              <div style="font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;
                          color:#a2907a;margin-bottom:16px">Les proportions</div>${lignes}</div>`;
}

function blocAnneau(chiffres) {
    const lot = chiffres.slice(0, 5);
    if (lot.length < 2) return '';
    const total = lot.reduce((s, c) => s + Math.abs(c.valeur), 0) || 1;
    const teintes = ['#e5c76b', '#d4af37', '#b8912f', '#8f6f22', '#6d5418'];
    let angle = 0;
    const parts = lot.map((c, i) => {
        const part = Math.abs(c.valeur) / total * 100;
        const seg = `${teintes[i]} ${angle}% ${angle + part}%`;
        angle += part;
        return { seg, part, c, teinte: teintes[i] };
    });
    const camembert = parts.map(p => p.seg).join(', ');
    const legende = parts.map(p => `
      <div style="display:flex;align-items:center;gap:9px;font-size:.78rem;margin-bottom:7px">
        <span style="width:11px;height:11px;border-radius:3px;background:${p.teinte};flex:none"></span>
        <span style="color:#f3ece1;flex:1">${siEchap(p.c.libelle)}</span>
        <b style="color:${OR_CLAIR}">${p.part.toFixed(1)} %</b>
      </div>`).join('');
    return `<div class="at-data at-data-donut" style="margin:22px 0;padding:22px;border-radius:18px;
              background:linear-gradient(160deg,${MARRON} 0%,${MARRON_F} 100%);
              border:1px solid rgba(212,175,55,.24);display:flex;gap:24px;
              align-items:center;flex-wrap:wrap">
              <div style="width:150px;height:150px;border-radius:50%;flex:none;
                          background:conic-gradient(${camembert});
                          mask:radial-gradient(circle,transparent 54%,#000 55%);
                          -webkit-mask:radial-gradient(circle,transparent 54%,#000 55%);
                          animation:atPop .6s ease-out both"></div>
              <div style="flex:1;min-width:190px">
                <div style="font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;
                            color:#a2907a;margin-bottom:12px">Répartition</div>${legende}</div>
            </div>`;
}

function blocComparateur(chiffres) {
    if (chiffres.length < 4) return '';
    const moitie = Math.floor(chiffres.length / 2);
    const paires = [];
    for (let i = 0; i < Math.min(4, moitie); i++) {
        paires.push([chiffres[i], chiffres[moitie + i]]);
    }
    const lignes = paires.map(([a, b], i) => {
        const gagnantA = Math.abs(a.valeur) >= Math.abs(b.valeur);
        const cellule = (c, gagne) => `
        <div style="flex:1;text-align:center;padding:11px 9px;border-radius:11px;
                    background:${gagne ? 'linear-gradient(120deg,#8f6f22,#e5c76b 50%,#b8912f)' : 'rgba(255,255,255,.05)'};
                    color:${gagne ? '#14100b' : '#f3ece1'};font-weight:${gagne ? 700 : 400}">
          <div style="font-size:1.02rem">${siEchap(c.affiche)}</div>
          <div style="font-size:.64rem;opacity:.75;margin-top:3px">${siEchap(c.libelle.slice(0, 26))}</div>
        </div>`;
        return `<div style="display:flex;gap:10px;align-items:stretch;margin-bottom:10px;
                    animation:atPop .5s ease-out ${i * 0.08}s both">
                  ${cellule(a, gagnantA)}
                  <div style="flex:none;align-self:center;font-size:.66rem;color:#a2907a">vs</div>
                  ${cellule(b, !gagnantA)}
                </div>`;
    }).join('');
    return `<div class="at-data at-data-compare" style="margin:22px 0;padding:22px;border-radius:18px;
              background:linear-gradient(160deg,${MARRON} 0%,${MARRON_F} 100%);
              border:1px solid rgba(212,175,55,.24)">
              <div style="font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;
                          color:#a2907a;margin-bottom:16px">Face à face</div>${lignes}</div>`;
}

function blocCompteurs(chiffres) {
    const lot = chiffres.slice(0, 3);
    if (!lot.length) return '';
    const cases = lot.map((c, i) => `
      <div style="flex:1 1 140px;text-align:center;padding:18px 12px;
                  animation:atPop .55s ease-out ${i * 0.12}s both">
        <div style="font-size:2.3rem;font-weight:800;letter-spacing:-.04em;line-height:1;
                    background:linear-gradient(120deg,#8f6f22,#e5c76b 38%,#f2e0aa 52%,#b8912f);
                    -webkit-background-clip:text;background-clip:text;
                    -webkit-text-fill-color:transparent;color:transparent">${siEchap(c.affiche)}</div>
        <div style="font-size:.7rem;color:#a2907a;margin-top:8px;line-height:1.4">${siEchap(c.libelle)}</div>
      </div>`).join('<div style="width:1px;background:rgba(212,175,55,.2);align-self:stretch"></div>');
    return `<div class="at-data at-data-counter" style="margin:22px 0;display:flex;flex-wrap:wrap;
              border-radius:18px;background:linear-gradient(160deg,${MARRON} 0%,${MARRON_F} 100%);
              border:1px solid rgba(212,175,55,.24)">${cases}</div>`;
}

function blocCitation(source) {
    // La phrase entre guillemets la plus longue fait la meilleure citation.
    const guillemets = source.match(/[«"]([^»"]{40,240})[»"]/g) || [];
    if (!guillemets.length) return '';
    const meilleure = guillemets.sort((a, b) => b.length - a.length)[0]
        .replace(/^[«"]\s*|\s*[»"]$/g, '');
    return `<div class="at-data at-data-quote" style="margin:24px 0;padding:24px 26px;border-radius:18px;
              background:linear-gradient(160deg,${MARRON} 0%,${MARRON_F} 100%);
              border:1px solid rgba(212,175,55,.24);border-left:4px solid ${OR};
              animation:atPop .5s ease-out both">
              <div style="font-size:2rem;line-height:1;color:${OR};opacity:.5">&laquo;</div>
              <div style="font-size:1.05rem;line-height:1.7;color:#f3ece1;font-style:italic;
                          margin:6px 0">${siEchap(meilleure)}</div>
            </div>`;
}

const STYLE_ANIM = `<style>
@keyframes atPop { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
@keyframes atGrow { from { transform:scaleY(0) } to { transform:scaleY(1) } }
@keyframes atWidth { from { width:0 } }
@media (prefers-reduced-motion: reduce) { .at-data * { animation:none !important } }
</style>`;

function insererDonnees() {
    if (!donneesTrouvees) scanDonnees();
    if (!donneesTrouvees) return;

    const choix = donneesChoisies();
    const sortie = document.getElementById('dataOut');
    if (!choix.length) {
        sortie.insertAdjacentHTML('afterbegin',
            '<div class="si-note warn">Choisissez au moins un type de visualisation.</div>');
        return;
    }

    const NL = String.fromCharCode(10);
    const source = (document.getElementById('smartBox').value || '')
        + NL + (document.getElementById('siContenu').value || '');
    const d = donneesTrouvees;

    const fabriques = {
        figures:  function () { return blocChiffres(d.chiffres); },
        counter:  function () { return blocCompteurs(d.chiffres); },
        chart:    function () { return blocGraphique(d.chiffres); },
        gauge:    function () { return blocJauges(d.chiffres); },
        donut:    function () { return blocAnneau(d.chiffres); },
        compare:  function () { return blocComparateur(d.chiffres); },
        timeline: function () { return blocFrise(d.annees, source); },
        quote:    function () { return blocCitation(source); },
        table:    function () { return d.tableaux.length ? blocTableau(d.tableaux[0]) : ''; },
        info:     function () { return blocInfographie(d, document.getElementById('siTitre').value); }
    };

    // Regle editoriale : l'article publie sur le site ne garde que les
    // tableaux. Tous les autres formats — slides, infographies, graphiques,
    // frises, jauges, anneaux, compteurs, comparateurs, citations en exergue —
    // sont mis de cote pour le fichier .html interactif.
    const posesArticle = [], posesCarte = [], vides = [];
    let morceaux = '';
    choix.forEach(function (cle) {
        const bloc = (fabriques[cle] || function () { return ''; })();
        if (!bloc) { vides.push(cle); return; }
        if (VISUELS_ARTICLE.indexOf(cle) >= 0) {
            morceaux += bloc + NL;
            posesArticle.push(cle);
        } else {
            ajouterVisuelInteractif(cle, bloc);
            posesCarte.push(cle);
        }
    });

    if (!morceaux && !posesCarte.length) {
        sortie.insertAdjacentHTML('afterbegin',
            '<div class="si-note warn">Aucun de ces formats ne se prete aux donnees de '
            + 'ce texte. Le module n&rsquo;invente rien.</div>');
        return;
    }

    if (morceaux) {
        const champ = document.getElementById('siContenu');
        // Les animations n'ont besoin d'etre declarees qu'une fois par article.
        const entete = /@keyframes atPop/.test(champ.value) ? '' : STYLE_ANIM + NL;
        champ.value = (champ.value.trim() + NL + NL + entete + morceaux).trim();
    }

    const nom = function (c) { return NOMS_VISUELS[c] || c; };
    let message = '';
    if (posesArticle.length) {
        message += '<b>Dans l&rsquo;article du site</b> : '
            + posesArticle.map(nom).join(', ') + '. ';
    }
    if (posesCarte.length) {
        message += '<b>Reserve au fichier .html</b> : '
            + posesCarte.map(nom).join(', ') + '. ';
    }
    if (vides.length) {
        message += 'Sans donnee exploitable : ' + vides.map(nom).join(', ') + '.';
    }
    sortie.insertAdjacentHTML('afterbegin',
        '<div class="si-note ' + (vides.length ? 'warn' : 'ok') + '">' + message + '</div>');
}

/* ═══════════════════════════════════════════════════════════════════════
   HUB DE DÉPLOIEMENT — Article Interactif intégré
   La carte est produite par l'application article-interactif (port 5000) :
   rien n'est recopié, donc rien ne se périme quand elle évolue.
   ═══════════════════════════════════════════════════════════════════════ */

const AI_PORT = '5000';
const AI_BASE = window.location.protocol + '//' + window.location.hostname + ':' + AI_PORT;

// En ligne (pas de Hub, pas de port 5000) : la carte est générée par le moteur Article Interactif sur GitHub Actions.
// La page dépose une demande (/api/interactif-demande) puis interroge /api/interactif-statut jusqu'au résultat (2 à 4 min).
const AI_EN_LIGNE = !isLocal;
let _carteEnLigne = null;
async function fetchCarte(route, init) {
    if (!AI_EN_LIGNE) return fetch(AI_BASE + route, init);
    const reponse = (obj, ok = true) => new Response(JSON.stringify(obj), { status: ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } });
    if (route === '/api/render') {
        return _carteEnLigne ? reponse({ html: _carteEnLigne.html }) : reponse({ error: 'Carte non générée.' }, false);
    }
    if (route !== '/api/generate') return fetch(API_BASE + route, init);   // fetch-url (en ligne), upload / wilayas (message « Hub local »)
    const corps = JSON.parse(init.body);
    const note = document.getElementById('carteNote');
    const extra = (typeof blocVisuelsPourCarte === 'function' && blocVisuelsPourCarte()) || '';
    const dem = await fetch(API_BASE + '/api/interactif-demande', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generer: corps, extra_visuals: extra })
    });
    const d = await dem.json().catch(() => ({}));
    if (!dem.ok || !d.job) return reponse({ error: d.message || 'Demande de carte refusée.' }, false);
    const t0 = Date.now();
    while (Date.now() - t0 < 12 * 60 * 1000) {
        await new Promise(r => setTimeout(r, 7000));
        if (note) note.innerHTML = '<div class="si-note"><i class="fas fa-spinner fa-spin"></i> Carte en cours de génération sur le serveur… '
            + Math.round((Date.now() - t0) / 1000) + ' s (comptez 2 à 4 minutes)</div>';
        const st = await fetch(API_BASE + '/api/interactif-statut?job=' + encodeURIComponent(d.job) + '&t=' + Date.now(), { cache: 'no-store' })
            .then(r => r.json()).catch(() => ({ etat: 'en_cours' }));
        if (st.etat === 'pret') { _carteEnLigne = st; return reponse(st.data); }
        if (st.etat === 'echec') return reponse({ error: st.message || 'Échec de la génération de la carte.' }, false);
    }
    return reponse({ error: 'Délai dépassé (12 min) : réessayez.' }, false);
}

let modeDeploiement = 'simple';
let derniereCarte = null;     // { data, html }

function setupHubDeploiement() {
    // Destinations : Localhost ET GitHub cochés par défaut à chaque ouverture (décision du 2026-10-30) ; plus de mémorisation de la dernière
    // sélection. En ligne (pages.dev), il n'y a pas de localhost : l'enregistrement va directement sur GitHub, le bloc est masqué.
    document.getElementById('tgtLocal').checked = true;
    document.getElementById('tgtGithub').checked = true;
    if (!isLocal) { const bloc = document.getElementById('deployTargets'); if (bloc) bloc.style.display = 'none'; }
    document.querySelectorAll('[data-mode]').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('[data-mode]').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            modeDeploiement = b.dataset.mode;
            document.getElementById('carteOptions')
                .classList.toggle('hidden', modeDeploiement === 'simple');
            derniereCarte = null;   // les options ont changé : la carte est à refaire
            // Le serveur a pu être lancé après la page : on revérifie au moment
            // où sa disponibilité compte vraiment.
            if (modeDeploiement !== 'simple') verifierArticleInteractif();
        });
    });

    verifierArticleInteractif();
    setInterval(verifierArticleInteractif, 30000);
    setInterval(verifierHub, 30000);
}

function majCompteurBlocs() { /* les puces ont ete retirees */ }

// La carte se genere avec l'ensemble de ses blocs : plus de puces a cocher,
// c'etait un doublon avec le module Visualisation de donnees.
// Deux exclusions tiennent par decision editoriale : la carte des wilayas et
// l'image a zones cliquables.
function blocsCarte() {
    return {
        chart: true, timeline: true, comparator: true, poll: true,
        related: true, density: true, qa: true, sources: true,
        map: false, visual: false
    };
}

async function verifierArticleInteractif() {
    const dot = document.getElementById('aiDot');
    if (!dot) return false;
    if (AI_EN_LIGNE) {
        dot.className = 'si-ai-dot online';
        dot.title = 'Article Interactif en ligne (génération sur le serveur, 2 à 4 min)';
        return true;
    }
    try {
        const r = await fetch(AI_BASE + '/api/wilayas', { cache: 'no-store' });
        const ok = r.ok;
        dot.className = 'si-ai-dot ' + (ok ? 'online' : 'offline');
        dot.title = ok ? 'Article Interactif en ligne (port ' + AI_PORT + ')'
                       : 'Article Interactif hors ligne';
        return ok;
    } catch (e) {
        dot.className = 'si-ai-dot offline';
        dot.title = 'Article Interactif hors ligne (port ' + AI_PORT + ')';
        return false;
    }
}

// Le texte envoyé à la carte : titre, chapeau puis contenu, comme le lirait un lecteur.
function texteArticleComplet() {
    const NL = String.fromCharCode(10);

    // Le bloc « Article Interactif » a sa propre matière : texte importé,
    // article Primeur… Quand elle existe, c'est elle qui part au rendu .html.
    const primeur = (document.getElementById('primeurTexte') || {}).value || '';
    const importe = (document.getElementById('aiTexte') || {}).value || '';
    const propre = (primeur.trim().length > 200 ? primeur : importe).trim();
    if (propre.length > 200) return propre;

    return [
        document.getElementById('siTitre').value.trim(),
        document.getElementById('siExtrait').value.trim(),
        document.getElementById('siContenu').value.trim()
    ].filter(Boolean).join(NL + NL);
}

async function construireCarte() {
    if (derniereCarte) return derniereCarte;
    _carteEnLigne = null;

    const texte = texteArticleComplet();
    if (texte.length < 80) throw new Error('Remplissez d’abord le titre et le contenu.');

    const medias = {};
    const img = (document.getElementById('mediaImageUrl').value
        || window._autoImage || document.getElementById('siImageUrl').value || '').trim();
    if (img) {
        medias.image = {
            url: img,
            caption: document.getElementById('mediaImageCaption').value.trim() || 'Illustration de l’article',
            hero: document.getElementById('mediaImageHero').checked
        };
    }
    const vid = (document.getElementById('mediaVideoUrl').value
        || document.getElementById('siVideo').value || '').trim();
    if (vid) {
        medias.video = {
            url: vid,
            caption: document.getElementById('mediaVideoCaption').value.trim() || 'Vidéo de l’article'
        };
    }
    const aud = document.getElementById('mediaAudioUrl').value.trim();
    if (aud) {
        medias.audio = {
            url: aud,
            caption: document.getElementById('mediaAudioCaption').value.trim() || 'Audio de l’article'
        };
    }
    const galerie = mediasCorps.filter(m => m.section === 'galerie' && m.genre === 'image')
        .map(m => ({ url: m.url, caption: m.nom }));

    const gen = await fetchCarte('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: texte,
            // Le sélecteur « Moteur de rédaction » commande vraiment le rendu :
            // « Générer avec IA » part en mode `real` côté Flask, qui enchaîne
            // OpenAI → Gemini → Mistral → Groq. C'était le bogue : la valeur
            // était figée sur « heuristic », donc le .html sortait toujours
            // heuristique, quel que soit le bouton coché.
            mode: (selectedEngine === 'ia' ? 'real' : 'heuristic'),
            primary_color: document.getElementById('carteePrimaire').value,
            accent_color: document.getElementById('carteAccent').value,
            dark_mode: document.getElementById('carteSombre').checked,
            source_url: document.getElementById('siSource').value.trim(),
            medias: medias,
            gallery: galerie,
            widgets: blocsCarte()
        })
    });
    const data = await lireJSON(gen, 'Article Interactif');
    if (data.error) throw new Error(data.error);

    // Les visualisations ecartees de l'article rejoignent ici le document
    // .html : le gabarit les pose juste avant la barre d'actions.
    const visuels = blocVisuelsPourCarte();
    if (visuels) data.extra_visuals = visuels;

    const rendu = await fetchCarte('/api/render', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const sortie = await lireJSON(rendu, 'Rendu de la carte');
    if (sortie.error) throw new Error(sortie.error);

    derniereCarte = { data: data, html: appliquerAmbiance(sortie.html) };
    return derniereCarte;
}

async function apercuCarte() {
    const note = document.getElementById('carteNote');
    const btn = document.getElementById('cartePreviewBtn');
    note.innerHTML = '<div class="si-note"><i class="fas fa-spinner fa-spin"></i> Construction de la carte…</div>';
    btn.disabled = true;
    try {
        if (!await verifierArticleInteractif()) {
            throw new Error('Article Interactif ne répond pas sur le port ' + AI_PORT
                + '. Lancez : python app.py dans article-interactif.');
        }
        const carte = await construireCarte();
        document.getElementById('carteFrame').srcdoc = carte.html;
        document.getElementById('siCarteModal').classList.remove('hidden');
        const blocs = Object.keys(carte.data).filter(k =>
            ['chart', 'timeline', 'comparator', 'poll', 'related', 'qa'].indexOf(k) >= 0);
        note.innerHTML = '<div class="si-note ok">Carte prête — '
            + Math.round(carte.html.length / 1024) + ' ko, blocs actifs : '
            + (blocs.join(', ') || 'aucun bloc chiffré dans ce texte') + '.</div>';
    } catch (e) {
        note.innerHTML = '<div class="si-note bad">' + String(e.message || e).replace(/</g, '&lt;') + '</div>';
    } finally {
        btn.disabled = false;
    }
}

function fermerCarte() {
    document.getElementById('siCarteModal').classList.add('hidden');
}

async function telechargerCarte() {
    const note = document.getElementById('carteNote');
    try {
        const carte = await construireCarte();
        const blob = new Blob([carte.html], { type: 'text/html;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (document.getElementById('siTitre').value || 'article')
            .replace(/[^\wÀ-ſ]+/g, '-').slice(0, 60) + '.html';
        a.click();
        URL.revokeObjectURL(a.href);
        note.innerHTML = '<div class="si-note ok">Carte téléchargée.</div>';
    } catch (e) {
        note.innerHTML = '<div class="si-note bad">' + String(e.message || e).replace(/</g, '&lt;') + '</div>';
    }
}

// Enregistre la carte sur le Hub sous le même identifiant que l'article,
// pour que le site sache les associer.
async function publierCarte(id) {
    const carte = await construireCarte();
    const r = await fetch(API_BASE + '/api/interactif', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, html: carte.html })
    });
    const out = await lireJSON(r, 'Enregistrement de la carte');
    if (!r.ok || out.success === false) {
        throw new Error(out.message || 'Carte refusée par le Hub.');
    }
    return out.url || ('interactifs/' + id + '.html');
}

async function regenererSite() {
    const r = await fetch(API_BASE + '/api/generate-static-files');
    return r.ok;
}

/* ═══════════════════════════════════════════════════════════════════════
   ALGERIA TECH BY BASTA — Studio rédaction pro
   Module médias · palettes · ambiances visuelles du rendu .html
   ═══════════════════════════════════════════════════════════════════════ */

/* ─────────────────────────── 3.1 médias du corps ─────────────────────── */

const mediasCorps = [];   // { genre, url, nom, section }

function setupMediasCorps() {
    const btnP = document.getElementById('btnAddPhoto');
    const btnV = document.getElementById('btnAddVideo');
    const btnL = document.getElementById('btnAddLink');
    if (!btnP) return;

    btnP.addEventListener('click', () => document.getElementById('inputAddPhoto').click());
    btnV.addEventListener('click', () => document.getElementById('inputAddVideo').click());
    btnL.addEventListener('click', ajouterMediaParLien);

    document.getElementById('inputAddPhoto').addEventListener('change', e => {
        televerserPlusieurs(Array.from(e.target.files), 'image');
        e.target.value = '';
    });
    document.getElementById('inputAddVideo').addEventListener('change', e => {
        televerserPlusieurs(Array.from(e.target.files), 'video');
        e.target.value = '';
    });
    dessinerMediasCorps();
}

async function televerserPlusieurs(fichiers, genre) {
    for (const f of fichiers) {
        try {
            const fd = new FormData();
            fd.append(genre === 'video' ? 'video' : 'photo', f);
            const route = genre === 'video' ? 'upload-inline-video' : 'upload-inline-image';
            const r = await fetch(`${API_BASE}/api/${route}`, { method: 'POST', body: fd });
            const out = await lireJSON(r, 'Téléversement');
            if (!out.url) throw new Error(out.message || 'refusé');
            mediasCorps.push({ genre: genre, url: out.url, nom: f.name, section: 'auto' });
        } catch (e) {
            alert('Import impossible (' + f.name + ') : ' + (e.message || e));
        }
    }
    dessinerMediasCorps();
}

function ajouterMediaParLien() {
    const lien = prompt("Adresse de la photo ou de la vidéo à insérer dans le corps :");
    if (!lien || !lien.trim()) return;
    const u = lien.trim();
    const genre = /\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i.test(u) || isYouTubeUrl(u) ? 'video' : 'image';
    mediasCorps.push({ genre: genre, url: u, nom: u.split('/').pop().slice(0, 40), section: 'auto' });
    dessinerMediasCorps();
}

function dessinerMediasCorps() {
    const liste = document.getElementById('bodyMediaList');
    const vide = document.getElementById('bodyMediaEmpty');
    const badge = document.getElementById('bodyMediaBadge');
    if (!liste) return;

    badge.textContent = mediasCorps.length;
    vide.classList.toggle('hidden', mediasCorps.length > 0);

    liste.innerHTML = mediasCorps.map((m, i) => {
        const icone = m.genre === 'video' ? 'fa-video' : 'fa-camera';
        const opts = ['auto', 'galerie', '1', '2', '3']
            .map(v => '<option value="' + v + '"' + (m.section === v ? ' selected' : '') + '>'
                + (v === 'auto' ? 'Auto' : v === 'galerie' ? 'Galerie' : 'Section ' + v)
                + '</option>').join('');
        return '<div class="si-media-row">'
            + '<i class="fas ' + icone + ' si-kind"></i>'
            + '<span class="si-name">' + siEchap(m.nom) + '</span>'
            + '<select data-sec="' + i + '">' + opts + '</select>'
            + '<button type="button" data-del="' + i + '" title="Retirer">&times;</button>'
            + '</div>';
    }).join('');

    liste.querySelectorAll('[data-del]').forEach(b => {
        b.addEventListener('click', () => {
            mediasCorps.splice(+b.dataset.del, 1);
            dessinerMediasCorps();
        });
    });
    liste.querySelectorAll('[data-sec]').forEach(s => {
        s.addEventListener('change', () => { mediasCorps[+s.dataset.sec].section = s.value; });
    });
}

/* ─────────────────────── 3.2 médias principaux ───────────────────────── */

function setupMediasPrincipaux() {
    const paires = [
        ['btnUploadImage', 'uploadImageInput', 'mediaImageUrl', 'image'],
        ['btnUploadVideo', 'uploadVideoInput', 'mediaVideoUrl', 'video'],
        ['btnUploadAudio', 'uploadAudioInput', 'mediaAudioUrl', 'audio']
    ];
    paires.forEach(([bId, iId, cId, genre]) => {
        const bouton = document.getElementById(bId);
        const entree = document.getElementById(iId);
        if (!bouton || !entree) return;
        bouton.addEventListener('click', () => entree.click());
        entree.addEventListener('change', async e => {
            const f = e.target.files[0];
            if (!f) return;
            // L'audio n'a pas d'endpoint dédié : on le lit sur place, sans réseau.
            if (genre === 'audio') {
                document.getElementById(cId).value = URL.createObjectURL(f);
                apercusMediasPrincipaux();
                return;
            }
            try {
                if (genre === 'video') {
                    document.getElementById(cId).value = 'Envoi vers YouTube en cours…';
                    document.getElementById(cId).value = await uploadVideoToYoutube(f);
                    apercusMediasPrincipaux();
                    return;
                }
                const fd = new FormData();
                fd.append(genre === 'video' ? 'video' : 'photo', f);
                const route = genre === 'video' ? 'upload-inline-video' : 'upload-inline-image';
                const r = await fetch(`${API_BASE}/api/${route}`, { method: 'POST', body: fd });
                const out = await lireJSON(r, 'Téléversement');
                if (!out.url) throw new Error(out.message || 'refusé');
                document.getElementById(cId).value = out.url;
                if (genre === 'image') { window._autoImage = out.url; }
                apercusMediasPrincipaux();
            } catch (err) {
                const c = document.getElementById(cId);
                if (c.value.startsWith('Envoi vers YouTube')) c.value = '';
                alert('Import impossible : ' + (err.message || err));
            }
        });
    });

    ['mediaImageUrl', 'mediaVideoUrl', 'mediaAudioUrl'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', apercusMediasPrincipaux);
    });
    const hero = document.getElementById('mediaImageHero');
    if (hero) hero.addEventListener('change', apercusMediasPrincipaux);

    // Ctrl+V d'un fichier collé, sur les trois champs
    ['mediaImageUrl', 'mediaVideoUrl', 'mediaAudioUrl'].forEach((id, n) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('paste', async e => {
            const items = (e.clipboardData || {}).items || [];
            for (const it of items) {
                if (it.kind !== 'file') continue;
                e.preventDefault();
                const genre = n === 0 ? 'image' : n === 1 ? 'video' : 'audio';
                if (genre === 'audio') {
                    el.value = URL.createObjectURL(it.getAsFile());
                    apercusMediasPrincipaux();
                    return;
                }
                try {
                    if (genre === 'video') {
                        el.value = 'Envoi vers YouTube en cours…';
                        el.value = await uploadVideoToYoutube(it.getAsFile());
                        apercusMediasPrincipaux();
                        return;
                    }
                    const fd = new FormData();
                    fd.append(genre === 'video' ? 'video' : 'photo', it.getAsFile());
                    const route = genre === 'video' ? 'upload-inline-video' : 'upload-inline-image';
                    const r = await fetch(`${API_BASE}/api/${route}`, { method: 'POST', body: fd });
                    const out = await lireJSON(r, 'Collage');
                    if (out.url) {
                        el.value = out.url;
                        if (genre === 'image') window._autoImage = out.url;
                        apercusMediasPrincipaux();
                    }
                } catch (err) { if (el.value.startsWith('Envoi vers YouTube')) el.value = ''; alert('Collage impossible : ' + (err.message || err)); }
                return;
            }
        });
    });
    apercusMediasPrincipaux();
}

function apercusMediasPrincipaux() {
    const img = (document.getElementById('mediaImageUrl').value || '').trim();
    const vid = (document.getElementById('mediaVideoUrl').value || '').trim();
    const aud = (document.getElementById('mediaAudioUrl').value || '').trim();

    const pImg = document.getElementById('previewImage');
    pImg.classList.toggle('hidden', !img);
    if (img) {
        const ken = document.getElementById('mediaImageHero').checked;
        pImg.innerHTML = '<img src="' + siEchap(img) + '" alt="" '
            + 'onerror="this.parentNode.innerHTML=\'<span style=color:#d97066>Image introuvable</span>\'">'
            + (ken ? '<div style="margin-top:7px;font-size:.68rem">Effet Ken Burns actif</div>' : '');
        window._autoImage = img;
    }

    const pVid = document.getElementById('previewVideo');
    pVid.classList.toggle('hidden', !vid);
    if (vid) {
        if (/^</.test(vid)) pVid.innerHTML = 'Code d’intégration enregistré.';
        else if (isYouTubeUrl(vid)) pVid.innerHTML = 'Vidéo YouTube détectée — affichage natif.';
        else if (isDirectVideoUrl(vid)) pVid.innerHTML = '<video controls preload="metadata" src="' + siEchap(vid) + '"></video>';
        else pVid.innerHTML = 'Lien enregistré.';
    }

    const pAud = document.getElementById('previewAudio');
    pAud.classList.toggle('hidden', !aud);
    if (aud) pAud.innerHTML = '<audio controls preload="none" src="' + siEchap(aud) + '"></audio>';

    const badge = document.getElementById('mainMediaBadge');
    if (badge) badge.textContent = [img, vid, aud].filter(Boolean).length;
}

/* ───────────────────── palettes & ambiances visuelles ────────────────── */

let ambianceActive = '';

function setupPalettes() {
    document.querySelectorAll('[data-pal]').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('[data-pal]').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            document.getElementById('carteePrimaire').value = b.dataset.p;
            document.getElementById('carteAccent').value = b.dataset.a;
            document.getElementById('themeBadge').textContent = b.textContent.trim();
            derniereCarte = null;   // la carte doit être refaite aux nouvelles couleurs
        });
    });

    // Bouger un sélecteur de couleur casse l'appartenance à une palette :
    // on le dit plutôt que de laisser une pastille mentir.
    ['carteePrimaire', 'carteAccent'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            document.querySelectorAll('[data-pal]').forEach(x => x.classList.remove('active'));
            document.getElementById('themeBadge').textContent = 'Couleurs libres';
            derniereCarte = null;
        });
    });

    const sombre = document.getElementById('carteSombre');
    if (sombre) sombre.addEventListener('change', () => { derniereCarte = null; });

    document.querySelectorAll('[data-amb]').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('[data-amb]').forEach(x => x.classList.remove('on'));
            b.classList.add('on');
            ambianceActive = b.dataset.amb;
            document.getElementById('ambianceNom').textContent = b.textContent.trim();
            derniereCarte = null;
        });
    });

    // Effets dynamiques : décor animé + gerbe aux gestes du lecteur.
    document.querySelectorAll('[data-fx]').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('[data-fx]').forEach(x => x.classList.remove('on'));
            b.classList.add('on');
            effetActif = b.dataset.fx;
            const nom = document.getElementById('effetNom');
            if (nom) nom.textContent = b.textContent.trim();
            derniereCarte = null;
        });
    });
}

/* ═══════════════════════════════════════════════════════════════════════
   AMBIANCES VISUELLES DU RENDU .HTML
   Une ambiance ne se contente plus de reteinter : elle refond l'expérience
   — navigation, densité, typographie, gestes, ornements vivants.
   Règle constante : aucune teinte en dur. Une ambiance ne travaille qu'avec
   les variables du gabarit (--primary-color, --accent-color, --surface…),
   sinon elle entrerait en conflit avec la palette choisie juste au-dessus.
   Forme : { css: '…', js: '…' } — `js` est facultatif (greffes vivantes).
   Interdit absolu : overflow:hidden sur .une-card. Cela ferait de la barre
   d'onglets — le sommaire — un bloc ordinaire qui remonte avec le texte.
   Pour rogner un décor, utiliser clip-path, qui ne crée pas de conteneur
   de défilement.
   ═══════════════════════════════════════════════════════════════════════ */

// Petit utilitaire commun aux ambiances qui posent un décor animé derrière
// la carte : un canvas plein écran, sous le contenu, coupé si l'utilisateur
// a demandé moins d'animations.
const AMB_CANVAS = `function atDecor(dessin){
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var cv = document.createElement('canvas');
  cv.className = 'at-decor';
  cv.setAttribute('aria-hidden','true');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none';
  document.body.appendChild(cv);
  var ctx = cv.getContext('2d'), W = 0, H = 0;
  function taille(){ W = cv.width = innerWidth; H = cv.height = innerHeight; }
  taille(); addEventListener('resize', taille);
  function accent(){
    return getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#ffb347';
  }
  (function boucle(t){ dessin(ctx, W, H, t || 0, accent); requestAnimationFrame(boucle); })();
}`;

const AMBIANCES = {

    /* ── Clean Tech : chaque section devient une fiche nette et aérée.
       Le remède au bloc de texte : la respiration vient de la mise en page. */
    cleantech: {
        css: `body{padding:26px 16px}
.une-card{border-radius:26px;box-shadow:0 26px 60px -30px rgba(0,0,0,.35)}
.header-une{padding:22px 30px}
.article-body{padding:30px 34px 22px}
.article-body h1{font-weight:300 !important;letter-spacing:-.028em;line-height:1.16}
.chapeau-wrap{border-left:4px solid var(--accent-color);padding-left:20px;background:var(--surface-2);border-radius:0 16px 16px 0;padding-top:14px;padding-bottom:14px}
.tabs-header-sticky{background:var(--card-bg);border-bottom:1px solid var(--line-color);padding:12px 0 14px;gap:8px}
.tab-btn{border-radius:12px !important;letter-spacing:.02em;font-weight:600;padding:11px 18px;border:1px solid transparent}
.tab-btn:hover{border-color:var(--border-color)}
.tab-btn.active{box-shadow:0 8px 18px -10px var(--primary-color)}
.tab-content{background:var(--card-bg);border:1px solid var(--border-color);border-radius:18px;padding:26px 28px !important;box-shadow:0 10px 26px -20px rgba(0,0,0,.45);margin-bottom:14px}
.tab-content p{font-size:1.04rem !important;line-height:1.85 !important;max-width:74ch}
.mt-para-sep{display:block;height:0;margin-top:18px}
.figure-card,.at-chart,.at-timeline,.at-poll,.table-container,.at-compare,.at-qa{border-radius:16px !important}
.figure-card{background:var(--surface-2);border:1px solid var(--border-color)}
.custom-table th{text-transform:uppercase;letter-spacing:.08em;font-size:.7rem}
.action-bar{border-top:1px solid var(--line-color)}
.rel-card{border-radius:16px}`
    },

    /* ── Glassmorphism : verre dépoli, halos diffus, bords lumineux. */
    glass: {
        css: `body{background-attachment:fixed;background-image:radial-gradient(760px 520px at 8% -4%,var(--accent-color),transparent 60%),radial-gradient(680px 520px at 96% 10%,var(--primary-light),transparent 58%)}
.une-card{background:rgba(255,255,255,.08) !important;backdrop-filter:blur(22px) saturate(150%);-webkit-backdrop-filter:blur(22px) saturate(150%);border:1px solid rgba(255,255,255,.24) !important;border-radius:30px}
.header-une{background:linear-gradient(135deg,rgba(255,255,255,.16),rgba(255,255,255,.04)) !important;backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,255,255,.22)}
.tabs-header-sticky{background:rgba(255,255,255,.10) !important;backdrop-filter:blur(16px);border-radius:20px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.18)}
.tab-content,.figure-card,.at-chart,.at-timeline,.at-poll,.table-container,.at-compare,.chapeau-wrap,.at-qa,.rel-card,.at-gallery{background:rgba(255,255,255,.10) !important;backdrop-filter:blur(18px) saturate(140%);-webkit-backdrop-filter:blur(18px) saturate(140%);border:1px solid rgba(255,255,255,.22) !important;border-radius:22px !important;box-shadow:0 18px 44px -22px rgba(0,0,0,.55)}
.tab-content{padding:24px 26px !important}
.tab-content p{line-height:1.85 !important}
.mt-para-sep{display:block;height:0;margin-top:18px}
.tab-btn{border-radius:999px !important;backdrop-filter:blur(10px)}
.tab-btn.active{background:rgba(255,255,255,.24) !important;color:var(--head-color) !important;border:1px solid rgba(255,255,255,.4)}
.like-btn,.share-icons a,.share-icons button,.btn-mode-toggle,.btn-voir-plus{background:rgba(255,255,255,.14) !important;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.22) !important}
.article-body h1{font-weight:200 !important;letter-spacing:-.03em}
.footer-une{background:rgba(255,255,255,.08) !important;backdrop-filter:blur(14px)}`
    },

    /* ── TIC : planche technique. Grille de fond, repères d'angle, libellés
       en petites capitales monospace — l'article se lit comme un schéma. */
    tic: {
        css: `body{background-image:linear-gradient(rgba(127,127,127,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(127,127,127,.06) 1px,transparent 1px);background-size:38px 38px;background-attachment:fixed}
.une-card{border-radius:6px}
.header-une{border-radius:6px 6px 0 0;padding:16px 26px}
.brand{font-family:'SF Mono',Consolas,monospace;text-transform:uppercase;letter-spacing:.16em;font-size:.74rem}
.article-body h1{font-weight:700 !important;letter-spacing:-.02em}
.tabs-header-sticky{border-bottom:2px solid var(--line-color);gap:4px}
.tab-btn{border-radius:4px !important;text-transform:uppercase;letter-spacing:.1em;font-size:.72rem;font-family:'SF Mono',Consolas,monospace}
.tab-content{position:relative;padding-left:18px !important;border-left:1px dashed var(--border-color)}
.tab-content::before{content:"";position:absolute;left:-4px;top:6px;width:7px;height:7px;background:var(--accent-color);transform:rotate(45deg)}
.figure-card,.at-chart,.at-timeline,.at-poll,.table-container,.at-compare{border-radius:4px !important;position:relative;border:1px solid var(--border-color)}
.figure-card{border-left:3px solid var(--accent-color)}
.figure-card::before,.figure-card::after{content:"";position:absolute;width:9px;height:9px;border:1px solid var(--accent-color);opacity:.6}
.figure-card::before{top:-1px;right:-1px;border-left:0;border-bottom:0}
.figure-card::after{bottom:-1px;left:-1px;border-right:0;border-top:0}
.fig-label,.rel-cat,.chart-sub,.tl-date{font-family:'SF Mono',Consolas,monospace;text-transform:uppercase;letter-spacing:.1em;font-size:.66rem}
.custom-table th{font-family:'SF Mono',Consolas,monospace;text-transform:uppercase;letter-spacing:.09em;font-size:.68rem}
.rel-card,.like-btn,.share-icons a,.share-icons button{border-radius:4px !important}`
    },

    /* ── Télécoms : tout respire le signal. Barres de réception, onde qui
       parcourt l'en-tête, fils de liaison entre les blocs. */
    telecoms: {
        css: `@keyframes atOnde{0%{background-position:0 100%}100%{background-position:200px 100%}}
@keyframes atPulse{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:1;transform:scale(1.25)}}
.header-une{position:relative;overflow:hidden}
.header-une::after{content:"";position:absolute;left:0;right:0;bottom:0;height:22px;background-repeat:repeat-x;background-size:200px 22px;background-image:radial-gradient(circle at 25px 34px,transparent 20px,var(--accent-color) 21px,transparent 22px),radial-gradient(circle at 125px 34px,transparent 20px,var(--accent-color) 21px,transparent 22px);opacity:.45;animation:atOnde 6s linear infinite}
.badge-fresh .dot{animation:atPulse 1.8s ease-in-out infinite}
.article-body h1{position:relative;padding-left:26px}
.article-body h1::before{content:"";position:absolute;left:0;top:.32em;width:14px;height:.85em;background:linear-gradient(var(--accent-color),var(--accent-color)) 0 100%/3px 34% no-repeat,linear-gradient(var(--accent-color),var(--accent-color)) 5px 100%/3px 62% no-repeat,linear-gradient(var(--accent-color),var(--accent-color)) 10px 100%/3px 100% no-repeat}
.tabs-header-sticky{gap:8px}
.tab-btn{border-radius:8px !important;position:relative}
.tab-btn.active::after{content:"";position:absolute;left:14px;right:14px;bottom:-3px;height:3px;border-radius:3px;background:var(--accent-color)}
.tab-content{position:relative;padding-left:22px !important}
.tab-content::before{content:"";position:absolute;left:6px;top:10px;bottom:10px;width:2px;background:repeating-linear-gradient(var(--accent-color) 0 6px,transparent 6px 12px);opacity:.45}
.figure-card,.at-chart,.at-timeline,.at-poll,.table-container{border-radius:12px !important;border-top:3px solid var(--accent-color)}
.figure-card{background:var(--surface-2)}
.tl-item{position:relative}
.at-timeline .tl-date{color:var(--accent-color);font-weight:800}
.share-icons a,.share-icons button{border-radius:10px}`
    },

    /* ── Mobile : on ne rétrécit pas, on adopte les codes natifs.
       Barre d'onglets en bas, en-tête d'application, tout en cartes,
       cibles tactiles de 44 px et retour au doigt sur chaque appui. */
    mobile: {
        css: `body{padding:0 !important;background:var(--surface-2);-webkit-tap-highlight-color:transparent}
.une-card{max-width:520px;border-radius:0;border-left:none;border-right:none;box-shadow:none;padding-bottom:96px}
.une-card:hover{transform:none !important}
.header-une{position:sticky;top:0;z-index:400;border-radius:0;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.15);box-shadow:0 6px 18px -12px rgba(0,0,0,.6)}
.brand{font-size:.82rem;font-weight:800}
.badge-date{display:none}
.header-tools{gap:6px}
.icon-btn{width:40px;height:40px;min-width:40px;border-radius:14px}
.article-body{padding:16px 14px 10px}
.article-body h1{font-size:1.6rem !important;line-height:1.22;letter-spacing:-.02em}
.chapeau-wrap{background:var(--surface-2);border-radius:18px;padding:14px 16px}
.chapeau{font-size:1rem !important}
.tab-content{background:var(--card-bg);border:1px solid var(--border-color);border-radius:20px;padding:18px 16px !important;margin-bottom:12px;box-shadow:0 8px 20px -16px rgba(0,0,0,.5)}
.tab-content p{font-size:1.02rem !important;line-height:1.75 !important}
.figure-card,.at-poll,.at-chart,.at-timeline,.table-container,.at-compare,.at-qa,.rel-card,.at-gallery{border-radius:20px !important}
.key-figures-grid{grid-template-columns:1fr 1fr !important;gap:10px}
.rel-grid{grid-template-columns:1fr !important}
/* Barre d'onglets fixée en bas, à la manière d'une application */
.tabs-header-sticky{position:fixed !important;left:0;right:0;bottom:0;top:auto !important;margin:0;z-index:600;background:var(--card-bg);border-top:1px solid var(--border-color);border-bottom:none;padding:6px 4px calc(6px + env(safe-area-inset-bottom)) 4px;box-shadow:0 -8px 26px -18px rgba(0,0,0,.7);flex-wrap:nowrap;gap:0}
.tabs-header-sticky [role=tablist]{flex-wrap:nowrap !important;width:100%;justify-content:space-around;overflow-x:auto;scrollbar-width:none;gap:0 !important}
.tabs-header-sticky [role=tablist]::-webkit-scrollbar{display:none}
.tab-btn{flex-direction:column;gap:3px !important;min-width:66px;min-height:52px;padding:6px 8px;border-radius:14px !important;font-size:.62rem;font-weight:700;letter-spacing:.01em;text-align:center;line-height:1.15}
.tab-btn i{font-size:1.2rem}
.tab-btn.active{background:transparent !important;color:var(--accent-color) !important;box-shadow:none !important}
.tab-btn.active i{color:var(--accent-color) !important}
.tab-btn:active{transform:scale(.94)}
/* Les réglages de lecture deviennent une pastille flottante */
.mode-switch{position:fixed;right:12px;bottom:80px;z-index:610;flex-direction:column;gap:8px;margin:0 !important}
.btn-mode-toggle{border-radius:999px;min-height:44px;box-shadow:0 10px 24px -14px rgba(0,0,0,.7)}
.action-bar{flex-direction:column;align-items:stretch;gap:12px}
.like-btn{justify-content:center;min-height:48px;border-radius:16px}
.share-icons{justify-content:space-between}
.share-icons a,.share-icons button{width:46px;height:46px}
.like-btn:active,.share-icons a:active,.share-icons button:active,.rel-card:active{transform:scale(.96)}
.footer-une{padding-bottom:100px}
.mt-toc{left:10px;right:10px;bottom:96px;top:auto;transform:none;max-width:none}
.mt-toc-open{bottom:150px}`
    },

    /* ── Satellite : poste de contrôle. Typo technique, plaques sombres,
       équerres d'angle, balayage radar et bandeau de télémétrie vivant. */
    satellite: {
        css: `@keyframes atScan{0%{transform:translateY(-100%)}100%{transform:translateY(2000%)}}
@keyframes atRadar{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
@keyframes atBlink{0%,100%{opacity:1}50%{opacity:.25}}
body{background-image:radial-gradient(circle at 78% 10%,rgba(255,255,255,.06) 0,transparent 42%),linear-gradient(rgba(127,127,127,.05) 1px,transparent 1px);background-size:auto,100% 46px;background-attachment:fixed}
.une-card{border-radius:4px;position:relative;clip-path:inset(0 round 4px)}
.une-card::after{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,transparent,var(--accent-color),transparent);opacity:.5;animation:atScan 9s linear infinite;pointer-events:none}
.header-une{border-radius:0;position:relative;overflow:hidden;padding:16px 26px}
.header-une::after{content:"";position:absolute;right:-40px;top:-40px;width:150px;height:150px;border-radius:50%;border:1px solid var(--accent-color);opacity:.35;background:conic-gradient(from 0deg,var(--accent-color) 0deg,transparent 60deg);animation:atRadar 4.5s linear infinite}
.brand,.badge-date,.fig-label,.tl-date,.rel-cat,.chart-sub{font-family:'SF Mono',Consolas,monospace !important;text-transform:uppercase;letter-spacing:.14em;font-size:.68rem}
.at-hud{display:flex;gap:18px;flex-wrap:wrap;align-items:center;font-family:'SF Mono',Consolas,monospace;font-size:.64rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted-color);background:var(--surface);border-top:1px solid var(--border-color);border-bottom:1px solid var(--border-color);padding:8px 26px}
.at-hud b{color:var(--accent-color);font-weight:700}
.at-hud .lien{display:inline-flex;align-items:center;gap:6px}
.at-hud .led{width:7px;height:7px;border-radius:50%;background:var(--accent-color);animation:atBlink 1.4s ease-in-out infinite}
.article-body h1{font-family:'SF Mono',Consolas,monospace !important;font-weight:600 !important;letter-spacing:-.02em;font-size:1.9rem !important}
.chapeau-wrap{position:relative;overflow:hidden;background:var(--surface);border:1px solid var(--border-color);padding:16px 18px}
.chapeau-wrap::after{content:"";position:absolute;right:-80px;top:-60px;width:230px;height:230px;border-radius:50%;border:1px solid var(--accent-color);opacity:.3;box-shadow:0 0 0 16px rgba(127,127,127,.04),0 0 0 34px rgba(127,127,127,.03)}
.tab-btn{border-radius:0 !important;font-family:'SF Mono',Consolas,monospace;text-transform:uppercase;letter-spacing:.12em;font-size:.68rem;border:1px solid transparent}
.tab-btn.active{border-color:var(--accent-color);background:transparent !important;color:var(--accent-color) !important;box-shadow:inset 0 0 22px -10px var(--accent-color)}
.tab-content,.figure-card,.at-chart,.at-timeline,.at-poll,.table-container,.at-compare{position:relative;border-radius:0 !important;background:var(--surface) !important;border:1px solid var(--border-color) !important}
.figure-card::before,.figure-card::after,.at-chart::before,.at-chart::after{content:"";position:absolute;width:12px;height:12px;border:1px solid var(--accent-color)}
.figure-card::before,.at-chart::before{top:-1px;left:-1px;border-right:0;border-bottom:0}
.figure-card::after,.at-chart::after{bottom:-1px;right:-1px;border-left:0;border-top:0}
.fig-value{font-family:'SF Mono',Consolas,monospace !important;font-variant-numeric:tabular-nums}
.custom-table th{font-family:'SF Mono',Consolas,monospace;text-transform:uppercase;letter-spacing:.1em;font-size:.66rem}
.like-btn,.share-icons a,.share-icons button,.btn-mode-toggle,.btn-voir-plus{border-radius:0 !important;font-family:'SF Mono',Consolas,monospace}
.footer-une{font-family:'SF Mono',Consolas,monospace;font-size:.7rem;letter-spacing:.08em}`,
        js: `(function(){
  var tete = document.querySelector('.header-une');
  if (!tete) return;
  var hud = document.createElement('div');
  hud.className = 'at-hud';
  hud.setAttribute('aria-hidden','true');
  var lat = (34 + Math.random()*4).toFixed(4), lon = (2 + Math.random()*4).toFixed(4);
  hud.innerHTML = '<span class="lien"><span class="led"></span> UPLINK <b>ACTIF</b></span>'
    + '<span>LAT <b>' + lat + '</b></span>'
    + '<span>LON <b>' + lon + '</b></span>'
    + '<span>SIGNAL <b id="atSig">— dBm</b></span>'
    + '<span>ORBITE <b id="atOrb">—</b></span>'
    + '<span>UTC <b id="atUtc">—</b></span>';
  tete.parentNode.insertBefore(hud, tete.nextSibling);
  var orb = 0;
  function tic(){
    var d = new Date();
    var p = function(n){ return (n<10?'0':'') + n; };
    var u = document.getElementById('atUtc');
    if (u) u.textContent = p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds());
    var s = document.getElementById('atSig');
    if (s) s.textContent = '-' + (62 + Math.round(Math.sin(Date.now()/2200)*6 + Math.random()*3)) + ' dBm';
    orb = (orb + 0.37) % 360;
    var o = document.getElementById('atOrb');
    if (o) o.textContent = orb.toFixed(1) + '\\u00b0';
  }
  tic(); setInterval(tic, 1000);
})();`
    },

    /* ── Futur : minimalisme radical, verre et néon. Le halo suit le curseur,
       les bords s'allument, tout le superflu disparaît. */
    futur: {
        css: `@keyframes atNeon{0%,100%{box-shadow:0 0 0 1px var(--accent-color),0 0 22px -6px var(--accent-color)}50%{box-shadow:0 0 0 1px var(--accent-color),0 0 40px -4px var(--accent-color)}}
@keyframes atRotor{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
body{position:relative;background-attachment:fixed;background-image:radial-gradient(900px 620px at 12% -6%,var(--primary-light),transparent 62%),radial-gradient(760px 560px at 92% 4%,var(--accent-color),transparent 58%)}
body::before{content:"";position:fixed;inset:-30%;z-index:0;pointer-events:none;opacity:.16;background:conic-gradient(from 0deg,transparent,var(--accent-color),transparent 40%);animation:atRotor 28s linear infinite;filter:blur(70px)}
.une-card{position:relative;z-index:1;background:rgba(255,255,255,.07) !important;backdrop-filter:blur(26px) saturate(150%);-webkit-backdrop-filter:blur(26px) saturate(150%);border:1px solid rgba(255,255,255,.18) !important;border-radius:34px;clip-path:inset(0 round 34px)}
.une-card::before{content:"";position:absolute;width:520px;height:520px;left:var(--mx,50%);top:var(--my,0);transform:translate(-50%,-50%);background:radial-gradient(circle,var(--accent-color),transparent 62%);opacity:.16;pointer-events:none;transition:opacity .3s}
.header-une{background:transparent !important;border-bottom:1px solid rgba(255,255,255,.14);padding:22px 30px}
.brand{font-weight:300;letter-spacing:.22em;text-transform:uppercase;font-size:.72rem}
.badge-date{background:transparent !important;border:1px solid rgba(255,255,255,.2)}
.article-body{padding:34px 38px 24px}
.article-body h1{font-weight:100 !important;letter-spacing:-.045em;font-size:2.9rem !important;line-height:1.06}
.chapeau{font-weight:200 !important;font-size:1.14rem !important;line-height:1.85 !important}
.chapeau-wrap{background:transparent;border:none;border-left:1px solid var(--accent-color);padding-left:20px}
.tabs-header-sticky{background:transparent !important;border-bottom:1px solid rgba(255,255,255,.12);gap:10px}
.tab-btn{border-radius:999px !important;letter-spacing:.06em;text-transform:lowercase;font-weight:300;font-size:.86rem;border:1px solid transparent;padding:10px 20px}
.tab-btn:hover{border-color:rgba(255,255,255,.22);background:transparent}
.tab-btn.active{background:transparent !important;color:var(--accent-color) !important;animation:atNeon 3.4s ease-in-out infinite}
.tab-content{padding:20px 0 8px !important}
.tab-content p{font-weight:300;line-height:1.95 !important;letter-spacing:.004em}
.figure-card,.at-chart,.at-timeline,.at-poll,.table-container,.at-compare,.at-qa,.rel-card{background:rgba(255,255,255,.06) !important;border:1px solid rgba(255,255,255,.14) !important;border-radius:26px !important;backdrop-filter:blur(16px);box-shadow:none}
.figure-card:hover,.rel-card:hover{border-color:var(--accent-color) !important;box-shadow:0 0 34px -14px var(--accent-color)}
.fig-value{font-weight:200 !important;letter-spacing:-.04em}
.action-bar{border-top:1px solid rgba(255,255,255,.12)}
.like-btn,.share-icons a,.share-icons button,.btn-mode-toggle,.btn-voir-plus{background:transparent !important;border:1px solid rgba(255,255,255,.2) !important;border-radius:999px !important;font-weight:300}
.like-btn:hover,.share-icons a:hover,.share-icons button:hover,.btn-voir-plus:hover{border-color:var(--accent-color) !important;box-shadow:0 0 26px -10px var(--accent-color)}
.footer-une{background:transparent !important;border-top:1px solid rgba(255,255,255,.12)}
#readingProgress .bar{box-shadow:0 0 16px var(--accent-color)}`,
        js: `(function(){
  var carte = document.querySelector('.une-card');
  if (!carte) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  addEventListener('mousemove', function(e){
    var r = carte.getBoundingClientRect();
    carte.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    carte.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
})();`
    },

    /* ── Espace : ciel profond, étoiles qui scintillent, halo planétaire. */
    espace: {
        css: `@keyframes atTwinkle{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes atDerive{0%{background-position:0 0,0 0,0 0}100%{background-position:0 -900px,0 -600px,0 -300px}}
body{background-attachment:fixed;background-image:radial-gradient(rgba(255,255,255,.55) .7px,transparent .7px),radial-gradient(rgba(255,255,255,.32) .6px,transparent .6px),radial-gradient(rgba(255,255,255,.18) .5px,transparent .5px);background-size:70px 70px,110px 110px,170px 170px;animation:atDerive 140s linear infinite}
body::after{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(rgba(255,255,255,.6) .8px,transparent .9px);background-size:220px 220px;animation:atTwinkle 4s ease-in-out infinite}
.une-card{border-radius:28px;position:relative;clip-path:inset(0 round 28px);box-shadow:0 30px 80px -30px rgba(0,0,0,.8),0 0 0 1px var(--border-color)}
.header-une{position:relative;overflow:hidden}
.header-une::after{content:"";position:absolute;left:-70px;bottom:-140px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle at 32% 32%,var(--accent-color),transparent 66%);opacity:.35;filter:blur(2px)}
.article-body h1{letter-spacing:-.03em;font-weight:300 !important}
.chapeau-wrap{background:linear-gradient(120deg,var(--surface),transparent);border-radius:20px;padding:16px 18px}
.tab-btn{border-radius:999px !important}
.tab-btn.active{box-shadow:0 0 26px -8px var(--accent-color)}
.figure-card,.at-chart,.at-timeline,.at-poll,.table-container,.at-compare,.rel-card{border-radius:22px !important;background:linear-gradient(150deg,var(--surface),var(--surface-2)) !important}
.figure-card:hover{box-shadow:0 0 40px -18px var(--accent-color)}
#readingProgress .bar{border-radius:0 6px 6px 0;box-shadow:0 0 18px var(--accent-color)}
.footer-une{position:relative;overflow:hidden}`
    },

    /* ── Innovation : atelier créatif. Bulles qui se déforment, cartes qui
       se soulèvent, coins généreux. */
    innovation: {
        css: `@keyframes atBlob{0%,100%{border-radius:46% 54% 62% 38%/48% 42% 58% 52%;transform:translate(0,0) rotate(0)}50%{border-radius:62% 38% 44% 56%/56% 62% 38% 44%;transform:translate(24px,-18px) rotate(12deg)}}
body{position:relative}
body::before,body::after{content:"";position:fixed;z-index:0;pointer-events:none;filter:blur(30px);opacity:.20;animation:atBlob 18s ease-in-out infinite}
body::before{width:420px;height:420px;left:-120px;top:-80px;background:var(--accent-color)}
body::after{width:380px;height:380px;right:-110px;bottom:-90px;background:var(--primary-light);animation-duration:23s;animation-direction:reverse}
.une-card{position:relative;z-index:1;border-radius:36px}
.header-une{border-radius:36px 36px 0 0}
.article-body h1{font-weight:800 !important;letter-spacing:-.035em;line-height:1.1}
.chapeau-wrap{background:var(--surface-2);border-radius:26px;padding:18px 20px}
.tab-btn{border-radius:999px !important;padding:11px 20px}
.tab-btn.active{transform:translateY(-2px)}
.figure-card,.at-poll,.at-chart,.at-timeline,.table-container,.at-compare,.at-qa,.rel-card,.at-gallery{border-radius:28px !important;transition:transform .3s cubic-bezier(.2,.8,.3,1),box-shadow .3s}
.figure-card:hover,.rel-card:hover,.at-chart:hover{transform:translateY(-6px) rotate(-.4deg);box-shadow:0 26px 44px -26px rgba(0,0,0,.5)}
.fig-icon{transform:rotate(-6deg)}
.like-btn,.btn-voir-plus{border-radius:999px !important}
.share-icons a:hover,.share-icons button:hover{transform:translateY(-5px) rotate(8deg)}
.footer-une{border-radius:0 0 36px 36px}`
    },

    /* ── Informatique : l'article prend l'allure d'un éditeur de code.
       Chrome de fenêtre, onglets carrés, gouttière et curseur clignotant. */
    informatique: {
        css: `@keyframes atCaret{0%,49%{opacity:1}50%,100%{opacity:0}}
body{font-family:'SF Mono',Consolas,'Courier New',monospace}
.une-card{border-radius:10px;clip-path:inset(0 round 10px);border:1px solid var(--border-color)}
.header-une{border-radius:0;padding:12px 18px;position:relative;padding-left:78px}
.header-une::before{content:"";position:absolute;left:18px;top:50%;transform:translateY(-50%);width:44px;height:12px;background:radial-gradient(circle at 6px 6px,#ff5f57 5px,transparent 6px),radial-gradient(circle at 22px 6px,#febc2e 5px,transparent 6px),radial-gradient(circle at 38px 6px,#28c840 5px,transparent 6px)}
.brand{font-size:.74rem;letter-spacing:.08em;text-transform:lowercase}
.article-body{padding:22px 26px 18px}
.article-body h1{font-family:inherit !important;font-weight:700 !important;font-size:1.7rem !important;letter-spacing:-.02em}
.article-body h1::after{content:"_";color:var(--accent-color);animation:atCaret 1.1s step-end infinite;margin-left:4px}
.chapeau-wrap{background:var(--surface);border-left:3px solid var(--accent-color);padding:14px 16px;border-radius:0 6px 6px 0}
.chapeau{font-family:inherit !important;font-size:.94rem !important;line-height:1.7 !important}
.tabs-header-sticky{gap:0;border-bottom:1px solid var(--line-color);padding:0}
.tab-btn{border-radius:0 !important;font-size:.74rem;padding:12px 16px;border-top:2px solid transparent;background:var(--surface-2)}
.tab-btn.active{background:var(--card-bg) !important;color:var(--head-color) !important;border-top-color:var(--accent-color);box-shadow:none !important}
.tab-content{position:relative;padding:18px 0 10px 46px !important}
.tab-content::before{content:"";position:absolute;left:30px;top:12px;bottom:12px;width:1px;background:var(--line-color)}
.tab-content p{font-family:inherit;font-size:.94rem !important;line-height:1.8 !important}
.figure-card,.at-chart,.at-timeline,.at-poll,.table-container,.at-compare{border-radius:6px !important;border:1px solid var(--border-color);background:var(--surface-2)}
.fig-value,.tl-date,.custom-table td,.custom-table th{font-family:inherit !important;font-variant-numeric:tabular-nums}
.custom-table th{text-transform:lowercase;letter-spacing:.04em}
.like-btn,.share-icons a,.share-icons button,.btn-mode-toggle,.btn-voir-plus{border-radius:6px !important;font-family:inherit}
.footer-une{font-family:inherit;font-size:.74rem}`
    },

    /* ── Science-fiction : panneaux biseautés, capitales, lignes de balayage
       et titre qui décroche par instants. */
    sf: {
        css: `@keyframes atGlitch{0%,92%,100%{transform:none;text-shadow:none}94%{transform:translateX(-2px);text-shadow:2px 0 var(--accent-color),-2px 0 var(--primary-light)}96%{transform:translateX(2px);text-shadow:-2px 0 var(--accent-color),2px 0 var(--primary-light)}}
@keyframes atSweep{0%{top:-10%}100%{top:110%}}
body{background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 4px);background-attachment:fixed}
.une-card{border-radius:0;position:relative;clip-path:polygon(26px 0,100% 0,100% calc(100% - 26px),calc(100% - 26px) 100%,0 100%,0 26px)}
.une-card::after{content:"";position:absolute;left:0;right:0;height:80px;background:linear-gradient(180deg,transparent,rgba(255,255,255,.05),transparent);animation:atSweep 7s linear infinite;pointer-events:none}
.header-une{border-radius:0;padding:18px 30px;clip-path:polygon(0 0,100% 0,100% 100%,34px 100%,0 calc(100% - 18px))}
.brand{text-transform:uppercase;letter-spacing:.28em;font-size:.7rem;font-weight:800}
.article-body h1{text-transform:uppercase;letter-spacing:.03em;font-weight:900 !important;animation:atGlitch 7s infinite}
.chapeau-wrap{border:1px solid var(--accent-color);padding:16px 18px;clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)}
.tab-btn{border-radius:0 !important;text-transform:uppercase;letter-spacing:.14em;font-size:.7rem;clip-path:polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)}
.tab-btn.active{background:var(--accent-color) !important;color:#0a0a0a !important}
.tab-content,.figure-card,.at-chart,.at-timeline,.at-poll,.table-container,.at-compare{border-radius:0 !important}
.figure-card,.at-chart,.at-poll,.table-container,.at-compare{background:var(--surface) !important;border:1px solid var(--border-color);clip-path:polygon(16px 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%,0 16px)}
.fig-label,.rel-cat,.chart-sub{text-transform:uppercase;letter-spacing:.16em;font-size:.64rem}
.fig-value{font-weight:900 !important;letter-spacing:-.02em}
.like-btn,.btn-voir-plus,.btn-mode-toggle{border-radius:0 !important;text-transform:uppercase;letter-spacing:.12em;font-size:.76rem;clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}
.share-icons a,.share-icons button{border-radius:0 !important}
.footer-une{border-radius:0;text-transform:uppercase;letter-spacing:.1em;font-size:.7rem}`
    },

    /* ── Data : tableau de bord. Chiffres alignés, onglets en sélecteur
       segmenté, tables zébrées, densité maîtrisée. */
    data: {
        css: `.une-card{border-radius:14px}
.header-une{border-radius:14px 14px 0 0;padding:16px 26px}
.article-body h1{font-weight:700 !important;letter-spacing:-.03em;font-size:1.95rem !important}
.chapeau-wrap{background:var(--surface-2);border-radius:10px;padding:14px 16px;border:1px solid var(--border-color)}
.tabs-header-sticky{background:var(--surface);border-radius:10px;padding:5px;gap:2px;border-bottom:none;border:1px solid var(--border-color)}
.tab-btn{border-radius:7px !important;font-size:.82rem;padding:8px 15px}
.tab-btn.active{box-shadow:0 2px 6px -2px rgba(0,0,0,.35)}
.key-figures-grid{gap:10px}
.figure-card{border-radius:10px !important;border:1px solid var(--border-color);background:var(--surface-2);position:relative;overflow:hidden}
.figure-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--accent-color)}
.fig-value{font-family:'SF Mono',Consolas,monospace !important;font-variant-numeric:tabular-nums;letter-spacing:-.045em;font-weight:800 !important}
.fig-label{text-transform:uppercase;letter-spacing:.1em;font-size:.66rem}
.at-chart,.at-timeline,.at-poll,.table-container,.at-compare{border-radius:10px !important;border:1px solid var(--border-color)}
.custom-table{font-variant-numeric:tabular-nums}
.custom-table th{text-transform:uppercase;letter-spacing:.09em;font-size:.68rem;background:var(--surface);position:sticky;top:0}
.custom-table tbody tr:nth-child(even){background:var(--surface-2)}
.custom-table td{font-variant-numeric:tabular-nums;padding-top:9px;padding-bottom:9px}
.custom-table td:not(:first-child){text-align:right}
.tab-content p{font-size:.98rem !important;line-height:1.7 !important}
.rel-card{border-radius:10px}
.like-btn,.share-icons a,.share-icons button,.btn-mode-toggle,.btn-voir-plus{border-radius:8px !important}`
    },

    /* ── Serveurs : baie de datacenter. Rails verticaux, voyants qui
       clignotent, mesures en chasse fixe. */
    serveurs: {
        css: `@keyframes atLed{0%,100%{opacity:1;box-shadow:0 0 8px var(--accent-color)}50%{opacity:.2;box-shadow:none}}
body{background-image:repeating-linear-gradient(90deg,rgba(127,127,127,.06) 0 2px,transparent 2px 9px);background-attachment:fixed}
.une-card{border-radius:8px;position:relative;border-left:6px solid var(--primary-color);border-right:6px solid var(--primary-color)}
.une-card::before,.une-card::after{content:"";position:absolute;top:14px;bottom:14px;width:2px;background:repeating-linear-gradient(var(--border-color) 0 10px,transparent 10px 22px)}
.une-card::before{left:-4px}
.une-card::after{right:-4px}
.header-une{border-radius:0;padding:14px 24px}
.brand{font-family:'SF Mono',Consolas,monospace;text-transform:uppercase;letter-spacing:.16em;font-size:.7rem}
.article-body h1{font-weight:700 !important;letter-spacing:-.02em}
.tab-btn{border-radius:4px !important;font-family:'SF Mono',Consolas,monospace;font-size:.74rem;letter-spacing:.06em}
.tab-content{padding-left:16px !important;border-left:1px solid var(--line-color)}
.figure-card,.at-chart,.at-timeline,.at-poll,.table-container,.at-compare{border-radius:6px !important;border:1px solid var(--border-color);border-left:4px solid var(--accent-color);background:var(--surface-2);position:relative}
.figure-card::after,.at-chart::after{content:"";position:absolute;right:10px;top:10px;width:7px;height:7px;border-radius:50%;background:var(--accent-color);animation:atLed 2.2s ease-in-out infinite}
.fig-value,.tl-date,.custom-table td{font-family:'SF Mono',Consolas,monospace !important;font-variant-numeric:tabular-nums}
.custom-table th{font-family:'SF Mono',Consolas,monospace;text-transform:uppercase;letter-spacing:.08em;font-size:.66rem}
.like-btn,.share-icons a,.share-icons button,.btn-mode-toggle,.btn-voir-plus{border-radius:4px !important}
.footer-une{font-family:'SF Mono',Consolas,monospace;font-size:.72rem;border-top:3px double var(--border-color)}`
    },

    /* ── Design : parti pris éditorial. Titraille fine et large, corps en
       romain, lettrine, filets d'un cheveu, beaucoup de blanc. */
    design: {
        css: `body{padding:36px 18px}
.une-card{border-radius:0;border:1px solid var(--line-color);box-shadow:none;max-width:820px}
.une-card:hover{transform:none}
.header-une{background:transparent !important;border-bottom:1px solid var(--line-color);border-radius:0;padding:22px 46px;color:var(--text-color)}
.header-une .brand,.header-une .badge-date,.header-une .icon-btn{color:var(--text-color)}
.brand{text-transform:uppercase;letter-spacing:.32em;font-size:.66rem;font-weight:600}
.article-body{padding:46px 56px 30px}
.article-body h1{font-family:Georgia,'Times New Roman',serif !important;font-weight:400 !important;font-size:3rem !important;letter-spacing:-.03em;line-height:1.08}
.chapeau-wrap{border:none;background:transparent;padding:0;margin-top:8px}
.chapeau{font-family:Georgia,'Times New Roman',serif !important;font-style:italic;font-size:1.22rem !important;line-height:1.8 !important}
.tabs-header-sticky{border-bottom:1px solid var(--line-color);gap:26px;padding:14px 0}
.tab-btn{border-radius:0 !important;letter-spacing:.18em;text-transform:uppercase;font-size:.66rem;padding:6px 0;background:transparent !important;border-bottom:2px solid transparent}
.tab-btn:hover{background:transparent !important;border-bottom-color:var(--line-color)}
.tab-btn.active{background:transparent !important;color:var(--head-color) !important;border-bottom-color:var(--accent-color);box-shadow:none !important}
.tab-btn i{display:none}
.tab-content{padding:26px 0 10px !important}
.tab-content p{font-family:Georgia,'Times New Roman',serif !important;font-size:1.1rem !important;line-height:1.95 !important;max-width:68ch}
.tab-content.active>p:first-of-type::first-letter{float:left;font-family:Georgia,serif;font-size:3.6rem;line-height:.82;padding:6px 12px 0 0;color:var(--accent-color)}
.figure-card,.at-chart,.at-timeline,.at-poll,.table-container,.at-compare,.rel-card{border-radius:0 !important;border:1px solid var(--line-color);background:transparent !important;box-shadow:none !important}
.fig-value{font-family:Georgia,serif !important;font-weight:400 !important}
.custom-table th{text-transform:uppercase;letter-spacing:.14em;font-size:.64rem;background:transparent}
.action-bar{border-top:1px solid var(--line-color)}
.like-btn,.btn-voir-plus,.btn-mode-toggle{border-radius:0 !important;text-transform:uppercase;letter-spacing:.14em;font-size:.7rem;background:transparent !important;border:1px solid var(--line-color) !important}
.share-icons a,.share-icons button{border-radius:0 !important;background:transparent !important;border:1px solid var(--line-color) !important}
.footer-une{background:transparent !important;border-top:1px solid var(--line-color);border-radius:0}`
    },

    /* ── Fintech : sérieux bancaire. Cartes pleines, chiffres alignés,
       onglets en sélecteur, hiérarchie sans fioritures. */
    fintech: {
        css: `.une-card{border-radius:18px;box-shadow:0 18px 44px -26px rgba(0,0,0,.4)}
.header-une{border-radius:18px 18px 0 0;padding:18px 28px;border-bottom:3px solid var(--accent-color)}
.brand{font-weight:800;letter-spacing:.04em}
.article-body h1{font-weight:800 !important;letter-spacing:-.03em}
.chapeau-wrap{background:var(--surface);border-radius:14px;padding:16px 18px;border:1px solid var(--border-color)}
.tabs-header-sticky{background:var(--surface);border:1px solid var(--border-color);border-radius:12px;padding:5px;gap:3px;border-bottom:none}
.tab-btn{border-radius:9px !important;font-weight:700;font-size:.84rem}
.key-figures-grid{gap:12px}
.figure-card{border-radius:14px !important;background:var(--card-bg) !important;border:1px solid var(--border-color);border-top:3px solid var(--accent-color);box-shadow:0 10px 22px -18px rgba(0,0,0,.5)}
.fig-value{font-variant-numeric:tabular-nums;font-weight:800 !important;letter-spacing:-.03em}
.fig-label{text-transform:uppercase;letter-spacing:.08em;font-size:.68rem;font-weight:700}
.at-chart,.at-timeline,.at-poll,.table-container,.at-compare,.at-qa,.rel-card{border-radius:14px !important;border:1px solid var(--border-color)}
.custom-table td{font-variant-numeric:tabular-nums}
.custom-table td:not(:first-child),.custom-table th:not(:first-child){text-align:right}
.custom-table th{text-transform:uppercase;letter-spacing:.07em;font-size:.68rem;font-weight:800}
.like-btn,.btn-voir-plus{border-radius:10px !important;font-weight:700}
.share-icons a,.share-icons button{border-radius:10px !important}
.btn-mode-toggle{border-radius:10px !important}
.footer-une{border-radius:0 0 18px 18px;border-top:1px solid var(--border-color)}`
    },

    /* ── Cybersécurité : console d'analyse. Chasse fixe, lignes de balayage,
       préfixes de terminal et pluie de caractères en fond. */
    cyber: {
        css: `@keyframes atCurseur{0%,49%{opacity:1}50%,100%{opacity:0}}
body{font-family:'SF Mono',Consolas,'Courier New',monospace;background-image:linear-gradient(rgba(127,127,127,.05) 1px,transparent 1px);background-size:100% 3px;background-attachment:fixed}
.at-decor{opacity:.14}
.une-card{position:relative;z-index:1;border-radius:6px;border:1px solid var(--accent-color)}
.header-une{border-radius:0;padding:12px 22px}
.brand{text-transform:uppercase;letter-spacing:.2em;font-size:.7rem}
.brand::before{content:"[ ";opacity:.7}
.brand::after{content:" ]";opacity:.7}
.article-body h1{font-family:inherit !important;font-weight:700 !important;font-size:1.7rem !important;letter-spacing:-.01em}
.article-body h1::before{content:"$ ";color:var(--accent-color)}
.article-body h1::after{content:"\\u2588";color:var(--accent-color);animation:atCurseur 1s step-end infinite;margin-left:3px;font-size:.9em}
.chapeau{font-family:inherit !important;font-size:.94rem !important;line-height:1.75 !important}
.chapeau-wrap{border:1px dashed var(--accent-color);padding:14px 16px;border-radius:4px}
.tab-btn{border-radius:3px !important;text-transform:uppercase;letter-spacing:.12em;font-size:.7rem;font-family:inherit;border:1px solid transparent}
.tab-btn::before{content:"> ";opacity:.55}
.tab-btn.active{background:transparent !important;color:var(--accent-color) !important;border-color:var(--accent-color);box-shadow:inset 0 0 20px -12px var(--accent-color)}
.tab-content{padding-left:14px !important;border-left:2px solid var(--border-color)}
.tab-content p{font-family:inherit;font-size:.93rem !important;line-height:1.8 !important}
.figure-card,.at-chart,.at-timeline,.at-poll,.table-container,.at-compare{border-radius:4px !important;border:1px solid var(--accent-color);background:var(--surface) !important}
.fig-label::before{content:"// ";opacity:.6}
.fig-value{font-family:inherit !important;font-variant-numeric:tabular-nums}
.custom-table th{font-family:inherit;text-transform:uppercase;letter-spacing:.1em;font-size:.66rem}
.like-btn,.share-icons a,.share-icons button,.btn-mode-toggle,.btn-voir-plus{border-radius:3px !important;font-family:inherit;border:1px solid var(--border-color) !important}
.footer-une{font-family:inherit;font-size:.72rem;letter-spacing:.06em}`,
        js: AMB_CANVAS + `
atDecor(function(ctx,W,H,t,accent){
  if (!ctx.__init){
    ctx.__init = 1; ctx.__col = []; ctx.__pas = 16;
    for (var i=0;i<Math.ceil(W/ctx.__pas);i++) ctx.__col[i] = Math.random()*H;
    ctx.__last = 0;
  }
  if (t - ctx.__last < 70) return;
  ctx.__last = t;
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = accent();
  ctx.font = '13px Consolas, monospace';
  var glyphes = '01<>{}[]#$%&/*+-=?!ABCDEF';
  for (var i=0;i<ctx.__col.length;i++){
    var c = glyphes.charAt(Math.floor(Math.random()*glyphes.length));
    ctx.fillText(c, i*ctx.__pas, ctx.__col[i]);
    ctx.__col[i] = ctx.__col[i] > H + Math.random()*260 ? 0 : ctx.__col[i] + 16;
  }
});`
    },

    /* ── Intelligence artificielle : réseau de neurones en fond, aura qui
       respire, formes très arrondies. */
    ia: {
        css: `@keyframes atRespire{0%,100%{opacity:.10;transform:scale(1)}50%{opacity:.20;transform:scale(1.06)}}
body{position:relative}
.at-decor{opacity:.5}
.une-card{position:relative;z-index:1;border-radius:32px}
.header-une{border-radius:32px 32px 0 0}
.article-body{position:relative}
.article-body::after{content:"";position:absolute;inset:-10px;pointer-events:none;background:radial-gradient(620px 400px at 12% 4%,var(--accent-color),transparent 62%);animation:atRespire 9s ease-in-out infinite}
.article-body>*:not(.tabs-header-sticky){position:relative;z-index:1}
.article-body h1{font-weight:300 !important;letter-spacing:-.03em;background:linear-gradient(100deg,var(--head-color),var(--accent-color));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.chapeau-wrap{background:linear-gradient(120deg,var(--surface),transparent);border-radius:24px;padding:16px 20px}
.tab-btn{border-radius:999px !important;font-weight:500}
.tab-btn.active{box-shadow:0 8px 24px -12px var(--accent-color)}
.figure-card,.at-poll,.at-chart,.at-timeline,.table-container,.at-compare,.at-qa,.rel-card{border-radius:24px !important;border:1px solid var(--border-color)}
.figure-card{background:linear-gradient(150deg,var(--surface-2),var(--surface)) !important}
.at-qa{box-shadow:0 0 40px -26px var(--accent-color)}
.like-btn,.btn-voir-plus,.share-icons a,.share-icons button,.btn-mode-toggle{border-radius:999px !important}
.footer-une{border-radius:0 0 32px 32px}`,
        js: AMB_CANVAS + `
atDecor(function(ctx,W,H,t,accent){
  if (!ctx.__n){
    ctx.__n = [];
    var total = Math.min(56, Math.round(W*H/26000));
    for (var i=0;i<total;i++) ctx.__n.push({
      x: Math.random()*W, y: Math.random()*H,
      vx: (Math.random()-.5)*.28, vy: (Math.random()-.5)*.28
    });
  }
  ctx.clearRect(0,0,W,H);
  var col = accent(), n = ctx.__n;
  for (var i=0;i<n.length;i++){
    var p = n[i];
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -1;
    if (p.y < 0 || p.y > H) p.vy *= -1;
    ctx.globalAlpha = .55; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 6.283); ctx.fill();
    for (var j=i+1;j<n.length;j++){
      var q = n[j], dx = p.x-q.x, dy = p.y-q.y, d = dx*dx + dy*dy;
      if (d < 20000){
        ctx.globalAlpha = .16 * (1 - d/20000);
        ctx.strokeStyle = col; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
});`
    }
};

/* ═══════════════════════════════════════════════════════════════════════
   EFFETS DYNAMIQUES
   Décor animé permanent + gerbe déclenchée aux gestes du lecteur (j'aime,
   partage, changement d'onglet…). Coupé net si le système demande moins
   d'animations : un effet ne doit jamais gêner la lecture.
   ═══════════════════════════════════════════════════════════════════════ */

let effetActif = '';

// « Aurore » n'a pas besoin du moteur de particules : un calque qui ondule suffit.
const EFFETS_CSS = {
    aurore: `@keyframes atAurore{0%{transform:translate3d(-6%,-4%,0) rotate(0);opacity:.55}50%{transform:translate3d(6%,4%,0) rotate(8deg);opacity:.85}100%{transform:translate3d(-6%,-4%,0) rotate(0);opacity:.55}}
body{position:relative;overflow-x:hidden}
.at-aurore{position:fixed;inset:-25%;z-index:0;pointer-events:none;filter:blur(80px);opacity:.45;background:radial-gradient(closest-side,var(--accent-color),transparent 70%) 20% 30%/60% 60% no-repeat,radial-gradient(closest-side,var(--primary-light),transparent 70%) 78% 22%/55% 55% no-repeat,radial-gradient(closest-side,var(--primary-soft),transparent 70%) 50% 82%/62% 62% no-repeat;animation:atAurore 22s ease-in-out infinite}
.une-card{position:relative;z-index:1}
@media (prefers-reduced-motion: reduce){.at-aurore{animation:none}}`
};

// Moteur commun : un canvas au-dessus de la carte, des particules, et des
// gerbes accrochées aux vrais gestes du lecteur.
const EFFETS_JS = `(function(){
  var NOM = window.__AT_EFFET || '';
  if (!NOM) return;

  // Aurore : un calque dedie plutot qu'un pseudo-element de <body>, sinon
  // les ambiances qui s'en servent deja (Futur, Innovation, Espace) le
  // perdraient au profit de l'effet.
  if (NOM === 'aurore'){
    var voile = document.createElement('div');
    voile.className = 'at-aurore';
    voile.setAttribute('aria-hidden','true');
    document.body.insertBefore(voile, document.body.firstChild);
    return;
  }
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var cv = document.createElement('canvas');
  cv.id = 'at-fx';
  cv.setAttribute('aria-hidden','true');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:850';
  document.body.appendChild(cv);
  var ctx = cv.getContext('2d'), W = 0, H = 0;
  function taille(){ W = cv.width = innerWidth; H = cv.height = innerHeight; }
  taille(); addEventListener('resize', taille, { passive: true });

  function teinte(){
    var c = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
    return c || '#ffb347';
  }
  function rvb(hex){
    hex = (hex || '').replace('#','');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var n = parseInt(hex || 'ffb347', 16);
    return [(n>>16)&255, (n>>8)&255, n&255];
  }
  function chaud(t){
    // dégradé braise : accent → orangé → rouge sombre, selon la vie restante
    var a = rvb(teinte());
    var b = [255, 150, 40], c = [190, 40, 10];
    var m = t < .5 ? [a, b, t*2] : [b, c, (t-.5)*2];
    var p = m[2];
    return 'rgb(' + Math.round(m[0][0]+(m[1][0]-m[0][0])*p) + ','
                  + Math.round(m[0][1]+(m[1][1]-m[0][1])*p) + ','
                  + Math.round(m[0][2]+(m[1][2]-m[0][2])*p) + ')';
  }

  var P = [], MAX = 620;
  function nait(p){ if (P.length < MAX) P.push(p); }

  function gerbe(x, y){
    var i, a, v;
    if (NOM === 'feux'){
      var teintes = [teinte(), '#ff5f7e', '#7ad7ff', '#ffe066', '#8affc1'];
      var col = teintes[Math.floor(Math.random()*teintes.length)];
      for (i = 0; i < 78; i++){
        a = Math.random()*6.283; v = 1.6 + Math.random()*4.4;
        nait({ x:x, y:y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, g:.045, vie:1, dv:.011, r:2.1, c:col, trainee:1 });
      }
    } else if (NOM === 'flammes'){
      for (i = 0; i < 34; i++){
        nait({ x:x + (Math.random()-.5)*22, y:y, vx:(Math.random()-.5)*.8, vy:-(1.1+Math.random()*2.3), g:-.012, vie:1, dv:.018, r:5+Math.random()*8, c:null, feu:1 });
      }
    } else if (NOM === 'etincelles'){
      for (i = 0; i < 46; i++){
        a = -Math.PI/2 + (Math.random()-.5)*2.4; v = 1.4 + Math.random()*4;
        nait({ x:x, y:y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, g:.075, vie:1, dv:.016, r:1.5, c:teinte(), trainee:1 });
      }
    } else { // particules
      for (i = 0; i < 40; i++){
        a = Math.random()*6.283; v = .6 + Math.random()*2.2;
        nait({ x:x, y:y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, g:.008, vie:1, dv:.012, r:2.4, c:teinte() });
      }
    }
  }

  // Décor permanent, discret : il vit sans rien demander au lecteur.
  var horloge = 0;
  function ambiance(){
    horloge++;
    if (NOM === 'flammes' && horloge % 2 === 0){
      for (var i = 0; i < 3; i++){
        nait({ x:Math.random()*W, y:H + 8, vx:(Math.random()-.5)*.5, vy:-(.7+Math.random()*1.5), g:-.008, vie:1, dv:.008, r:7+Math.random()*13, c:null, feu:1 });
      }
    } else if (NOM === 'etincelles' && horloge % 7 === 0){
      nait({ x:Math.random()*W, y:H + 6, vx:(Math.random()-.5)*.6, vy:-(.5+Math.random()*1.1), g:-.004, vie:1, dv:.005, r:1.4, c:teinte(), trainee:1 });
    } else if (NOM === 'particules' && horloge % 4 === 0){
      nait({ x:Math.random()*W, y:H + 6, vx:(Math.random()-.5)*.35, vy:-(.25+Math.random()*.6), g:0, vie:1, dv:.0035, r:1.6+Math.random()*2.2, c:teinte(), flotte:1 });
    } else if (NOM === 'feux' && horloge % 260 === 0){
      gerbe(W*(.2+Math.random()*.6), H*(.18+Math.random()*.35));
    }
  }

  function boucle(){
    ctx.clearRect(0,0,W,H);
    ambiance();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = P.length - 1; i >= 0; i--){
      var p = P[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vie -= p.dv;
      if (p.flotte) p.x += Math.sin((horloge + i) / 42) * .35;
      if (p.vie <= 0 || p.y > H + 60 || p.y < -80){ P.splice(i,1); continue; }
      ctx.globalAlpha = Math.max(0, Math.min(1, p.vie));
      if (p.feu){
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * (1.6 - p.vie*.6));
        g.addColorStop(0, chaud(1 - p.vie));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.6 - p.vie*.6), 0, 6.283); ctx.fill();
      } else if (p.trainee){
        ctx.strokeStyle = p.c; ctx.lineWidth = p.r;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx*2.4, p.y - p.vy*2.4); ctx.stroke();
      } else {
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(boucle);
  }
  boucle();

  // Les gestes qui comptent vraiment dans la carte déclenchent la gerbe.
  var CIBLES = '.like-btn,.share-icons a,.share-icons button,.tab-btn,.btn-mode-toggle,.btn-voir-plus,.icon-btn,.poll-opt,.rel-card';
  document.addEventListener('click', function(e){
    var el = e.target && e.target.closest ? e.target.closest(CIBLES) : null;
    if (!el) return;
    var r = el.getBoundingClientRect();
    gerbe(r.left + r.width/2, r.top + r.height/2);
  }, true);

  // Étincelles : une traînée légère suit le curseur, sans jamais saturer.
  if (NOM === 'etincelles'){
    var dernier = 0;
    addEventListener('mousemove', function(e){
      var t = Date.now();
      if (t - dernier < 42) return;
      dernier = t;
      nait({ x:e.clientX, y:e.clientY, vx:(Math.random()-.5)*.7, vy:(Math.random()-.5)*.7 + .3, g:.03, vie:1, dv:.03, r:1.3, c:teinte(), trainee:1 });
    }, { passive: true });
  }
})();`;

/* L'ambiance est greffée après la feuille du gabarit : elle l'emporte sans
   un seul !important sur les couleurs. Les scripts (télémétrie, décors,
   effets) partent en fin de <body>, quand le DOM de la carte existe. */
function appliquerAmbiance(html) {
    const amb = AMBIANCES[ambianceActive];
    const styles = [];
    const scripts = [];

    if (amb) {
        styles.push('<style id="at-ambiance">' + amb.css + '</style>');
        if (amb.js) scripts.push('<' + 'script>' + amb.js + '</' + 'script>');
    }
    if (effetActif) {
        if (EFFETS_CSS[effetActif]) {
            styles.push('<style id="at-effet">' + EFFETS_CSS[effetActif] + '</style>');
        }
        scripts.push('<' + 'script>window.__AT_EFFET=' + JSON.stringify(effetActif) + ';</' + 'script>');
        scripts.push('<' + 'script>' + EFFETS_JS + '</' + 'script>');
    }
    if (!styles.length && !scripts.length) return html;

    let sortie = html;
    if (styles.length) sortie = sortie.replace(/<\/head\s*>/i, styles.join('') + '</head>');
    if (scripts.length) {
        sortie = /<\/body\s*>/i.test(sortie)
            ? sortie.replace(/<\/body\s*>/i, scripts.join('') + '</body>')
            : sortie + scripts.join('');
    }
    return sortie;
}

/* ═══════════════════════════════════════════════════════════════════════
   DUEL DE RÉDACTION — le choix du journaliste
   Deux écritures de la même matière, côte à côte. Celle qui est cochée part
   au formulaire de déploiement ; l'autre est simplement oubliée.
   ═══════════════════════════════════════════════════════════════════════ */

const duel = { presse: null, enrichi: null, choix: null };

// La version enrichie est bâtie sur la version presse : même matière, jamais
// un second appel au modèle. On la découpe plus fin et on y greffe les
// visualisations cochées dans la colonne de gauche.
function duelEnrichir(base) {
    const NL = String.fromCharCode(10);
    const source = document.getElementById('smartBox').value || '';
    const corps = String(base.contenu || '');

    // Découpage plus fin : chaque section longue est scindée en deux.
    const morceaux = corps.split(/\n(?=##\s)/).map(b => b.trim()).filter(Boolean);
    const affine = morceaux.map(bloc => {
        const lignes = bloc.split(/\n{2,}/).filter(Boolean);
        if (lignes.length < 3) return bloc;
        const tete = lignes.shift();
        const moitie = Math.ceil(lignes.length / 2);
        return tete + NL + NL + lignes.slice(0, moitie).join(NL + NL)
             + NL + NL + '### Dans le détail' + NL + NL + lignes.slice(moitie).join(NL + NL);
    }).join(NL + NL);

    // Les visualisations demandées, si la matière s'y prête.
    if (!donneesTrouvees) { try { scanDonnees(); } catch (e) {} }
    const choix = (typeof donneesChoisies === 'function') ? donneesChoisies() : [];
    const poses = [];
    let visuels = '';
    if (donneesTrouvees && choix.length) {
        const d = donneesTrouvees;
        const fabriques = {
            figures: () => blocChiffres(d.chiffres),
            counter: () => blocCompteurs(d.chiffres),
            chart: () => blocGraphique(d.chiffres),
            gauge: () => blocJauges(d.chiffres),
            donut: () => blocAnneau(d.chiffres),
            compare: () => blocComparateur(d.chiffres),
            timeline: () => blocFrise(d.annees, source),
            quote: () => blocCitation(source),
            table: () => (d.tableaux.length ? blocTableau(d.tableaux[0]) : ''),
            info: () => blocInfographie(d, base.titre)
        };
        choix.forEach(cle => {
            const bloc = (fabriques[cle] || (() => ''))();
            if (bloc) { visuels += bloc + NL; poses.push(cle); }
        });
        if (visuels) visuels = STYLE_ANIM + NL + visuels;
    }

    return {
        titre: base.titre,
        lead: base.lead,
        contenu: (affine + (visuels ? NL + NL + visuels : '')).trim(),
        tags: base.tags,
        date: base.date,
        heure: base.heure,
        visuels: poses
    };
}

async function duelGenerer(quoi) {
    const note = document.getElementById('duelNote');
    const source = document.getElementById('smartBox').value.trim();
    if (source.length < 60) {
        note.innerHTML = '<div class="si-note warn">Déposez d’abord un texte source.</div>';
        return;
    }

    const boutons = ['duelPresseBtn', 'duelEnrichiBtn', 'duelDeuxBtn'];
    boutons.forEach(id => { document.getElementById(id).disabled = true; });
    note.innerHTML = '<div class="si-note"><i class="fas fa-spinner fa-spin"></i> Rédaction en cours…</div>';

    try {
        // La base commune : le moteur choisi à gauche.
        let base;
        if (selectedEngine === 'ia') {
            const r = await fetch(ENGINE_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: source, style: selectedStyle, source_url: ((document.getElementById('urlInput') || {}).value || (document.getElementById('siSource') || {}).value || '').trim() })
            });
            const data = await lireJSON(r, 'Moteur IA');
            if (!r.ok) throw new Error(data.error || 'Le moteur IA a refusé.');
            base = { titre: data.titre, lead: data.lead, contenu: data.contenu,
                     tags: data.tags || [], date: '', heure: '' };
        } else {
            base = redactionHeuristique(source, selectedStyle);
        }

        if (quoi === 'presse' || quoi === 'les-deux') {
            duel.presse = base;
            duelAfficher('presse', base);
        }
        if (quoi === 'enrichi' || quoi === 'les-deux') {
            duel.enrichi = duelEnrichir(base);
            duelAfficher('enrichi', duel.enrichi);
        }

        // Une seule version produite : elle est cochée d'office.
        const dispo = ['presse', 'enrichi'].filter(k => duel[k]);
        if (dispo.length === 1) duelCocher(dispo[0]);

        document.getElementById('duelBadge').textContent =
            dispo.length === 2 ? 'deux versions' : (dispo[0] === 'presse' ? 'version presse' : 'version enrichie');
        note.innerHTML = '<div class="si-note ok">'
            + (dispo.length === 2
                ? 'Les deux versions sont prêtes. Cochez celle que vous gardez.'
                : 'Version prête et cochée.') + '</div>';
    } catch (e) {
        note.innerHTML = '<div class="si-note bad">' + siEchap(e.message || e) + '</div>';
    } finally {
        boutons.forEach(id => { document.getElementById(id).disabled = false; });
    }
}

function duelAfficher(cle, article) {
    const corps = document.querySelector('[data-corps="' + cle + '"]');
    const stats = document.querySelector('[data-stats="' + cle + '"]');
    const col = document.querySelector('[data-duel="' + cle + '"]');
    if (!corps) return;

    const texte = String(article.contenu || '');
    const mots = texte.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
    const sections = (texte.match(/^##\s/gm) || []).length;
    const sousSections = (texte.match(/^###\s/gm) || []).length;

    // Aperçu lisible : on rend les intertitres, on masque le HTML des visuels.
    let apercu = texte
        .replace(/<style[\s\S]*?<\/style>/g, '')
        .replace(/<div class="at-data[\s\S]*?(?=\n<div class="at-data|\n*$)/g, '')
        .split(/\n{2,}/).map(b => {
            const t = b.trim();
            if (!t) return '';
            if (/^###\s/.test(t)) return '<h4>' + siEchap(t.replace(/^###\s*/, '')) + '</h4>';
            if (/^##\s/.test(t)) return '<h4>' + siEchap(t.replace(/^##\s*/, '')) + '</h4>';
            if (/^</.test(t)) return '';
            return '<p>' + siEchap(t.slice(0, 400)) + (t.length > 400 ? '…' : '') + '</p>';
        }).filter(Boolean).join('');

    const puces = (article.visuels || []).map(v =>
        '<span class="si-duel-viz"><i class="fas fa-chart-simple"></i>' + siEchap(v) + '</span>').join('');

    corps.innerHTML = '<div class="si-duel-titre">' + siEchap(article.titre || '') + '</div>'
        + '<div class="si-duel-lead">' + siEchap(article.lead || '') + '</div>'
        + (puces ? '<div style="margin-bottom:10px">' + puces + '</div>' : '')
        + apercu;

    stats.textContent = mots + ' mots · ' + sections + ' section' + (sections > 1 ? 's' : '')
        + (sousSections ? ' · ' + sousSections + ' sous-titres' : '')
        + ((article.visuels || []).length ? ' · ' + article.visuels.length + ' visuels' : '');

    col.classList.remove('vide');
    const radio = col.querySelector('input[type="radio"]');
    radio.disabled = false;
    radio.onchange = () => duelCocher(cle);
}

function duelCocher(cle) {
    duel.choix = cle;
    document.querySelectorAll('.si-duel-col').forEach(c => {
        c.classList.toggle('choisi', c.dataset.duel === cle);
    });
    const radio = document.querySelector('input[name="duelChoix"][value="' + cle + '"]');
    if (radio) radio.checked = true;
    document.getElementById('duelAdopterBtn').disabled = false;
}

function duelAdopter() {
    const note = document.getElementById('duelNote');
    const cle = duel.choix;
    if (!cle || !duel[cle]) {
        note.innerHTML = '<div class="si-note warn">Cochez d’abord une version.</div>';
        return;
    }
    const article = duel[cle];

    // On passe par le chemin d'origine de Smart Ingest : dateline, catégorie,
    // « À retenir ». Rien n'est court-circuité.
    window._lastAI = article;
    document.getElementById('previewContent').value =
        '# ' + article.titre + '\n\n' + article.lead + '\n\n' + article.contenu;
    document.getElementById('previewZone').classList.remove('hidden');
    fillFromAI(article);
    normaliserARetenir();

    // La carte devra être refaite : le texte a changé.
    derniereCarte = null;

    note.innerHTML = '<div class="si-note ok">Version <b>'
        + (cle === 'presse' ? 'presse' : 'enrichie')
        + '</b> adoptée — le formulaire est rempli, prêt pour le déploiement.</div>';
    document.getElementById('siTitre').scrollIntoView({ behavior: 'smooth', block: 'center' });
}


/* ═══════════════════════════════════════════════════════════════════════
   4 · RESTRUCTURATION MEGA-TURBO
   4.1 interrupteur du duel · 4.2 Media Hub · 4.3 import du bloc interactif
   4.4 article « Primeur »
   Rien n'est retiré : ces fonctions s'ajoutent aux chemins existants.
   ═══════════════════════════════════════════════════════════════════════ */

/* ─────────────────── 4.1 duel de rédaction : activer / désactiver ────── */

let duelActif = true;

function setupDuelToggle() {
    const bascule = document.getElementById('duelToggle');
    if (!bascule) return;
    const carte = bascule.closest('.si-card');
    const txt = document.getElementById('duelToggleTxt');

    const appliquer = () => {
        duelActif = bascule.checked;
        carte.classList.toggle('si-off', !duelActif);
        if (txt) txt.textContent = duelActif ? 'Activé' : 'Désactivé';
        // Un duel éteint ne doit pas rester déclenchable au clavier.
        carte.querySelectorAll('#duelBody button, #duelBody input')
             .forEach(el => { el.disabled = !duelActif; });
        if (duelActif) {
            // On rend la main aux règles d'origine : « Adopter » reste bloqué
            // tant qu'aucune version n'a été cochée.
            const adopter = document.getElementById('duelAdopterBtn');
            if (adopter) adopter.disabled = !duel.choix;
            document.querySelectorAll('input[name="duelChoix"]')
                    .forEach(r => { r.disabled = !duel[r.value]; });
        }
    };

    bascule.addEventListener('change', appliquer);
    // L'état par défaut du HTML fait foi ; on se contente de le refléter.
    if (!bascule.checked) appliquer();
}

/* ───────────────────────────── 4.2 Media Hub ─────────────────────────── */

// Les médias trouvés dans la source. Un même média peut porter plusieurs
// rôles : une, vidéo principale, galerie.
const mediaHub = [];        // { genre, url, origine, roles: [] }

function ajouterAuMediaHub(items, origine) {
    let ajoutes = 0;
    (items || []).forEach(it => {
        const u = String((it && it.url) || '').trim();
        if (!u || u.length < 6) return;
        if (/^data:image\/(gif|svg)/i.test(u)) return;                 // pixels espions
        if (mediaHub.some(m => m.url === u)) return;
        mediaHub.push({
            genre: it.genre || 'image',
            url: u,
            origine: origine || 'source',
            roles: []
        });
        ajoutes++;
    });
    if (ajoutes) dessinerMediaHub();
    return ajoutes;
}

function dessinerMediaHub() {
    const grille = document.getElementById('mediaHubGrid');
    const vide = document.getElementById('mediaHubEmpty');
    const badge = document.getElementById('mediaHubBadge');
    if (!grille) return;

    badge.textContent = mediaHub.length;
    vide.classList.toggle('hidden', mediaHub.length > 0);

    grille.innerHTML = mediaHub.map((m, i) => {
        const vignette = m.genre === 'video'
            ? '<div class="si-mh-vid"><i class="fas fa-circle-play"></i></div>'
            : '<img class="si-mh-thumb" src="' + siEchap(m.url) + '" alt="" loading="lazy" '
              + 'data-mh-img="' + i + '">';
        const r = m.roles;
        return '<div class="si-mh-item' + (r.length ? ' used' : '') + '" data-mh="' + i + '">'
            + '<span class="si-mh-kind">' + (m.genre === 'video' ? 'vidéo' : 'photo') + '</span>'
            + vignette
            + '<div class="si-mh-acts">'
            + (m.genre === 'video'
                ? '<button type="button" data-role="video" data-i="' + i + '"'
                  + (r.indexOf('video') >= 0 ? ' class="on"' : '') + '>Vidéo</button>'
                : '<button type="button" data-role="une" data-i="' + i + '"'
                  + (r.indexOf('une') >= 0 ? ' class="on"' : '') + '>Une</button>')
            + '<button type="button" data-role="galerie" data-i="' + i + '"'
            + (r.indexOf('galerie') >= 0 ? ' class="on"' : '') + '>Galerie</button>'
            + '<button type="button" data-role="off" data-i="' + i + '" title="Retirer">&times;</button>'
            + '</div></div>';
    }).join('');

    // Une vignette morte se signale, elle ne laisse pas un cadre vide.
    grille.querySelectorAll('[data-mh-img]').forEach(img => {
        img.addEventListener('error', () => {
            img.style.display = 'none';
            img.insertAdjacentHTML('afterend',
                '<div class="si-mh-vid"><i class="fas fa-image"></i></div>');
        });
    });

    grille.querySelectorAll('[data-role]').forEach(b => {
        b.addEventListener('click', () => mediaHubAction(b.dataset.role, +b.dataset.i));
    });
}

function mediaHubAction(role, i) {
    const m = mediaHub[i];
    if (!m) return;
    const note = document.getElementById('mediaHubNote');

    if (role === 'off') {
        mediaHub.splice(i, 1);
        dessinerMediaHub();
        return;
    }

    if (role === 'une') {
        document.getElementById('mediaImageUrl').value = m.url;
        const leg = document.getElementById('mediaImageCaption');
        if (!leg.value.trim()) leg.value = 'Photo extraite de la source';
        document.getElementById('siImageUrl').value = m.url;
        window._autoImage = m.url;
        apercusMediasPrincipaux();
        mediaHub.forEach(x => { x.roles = x.roles.filter(r => r !== 'une'); });
        m.roles.push('une');
        note.innerHTML = '<div class="si-note ok">Photo placée en une de l’article.</div>';
    }

    if (role === 'video') {
        document.getElementById('mediaVideoUrl').value = m.url;
        const leg = document.getElementById('mediaVideoCaption');
        if (!leg.value.trim()) leg.value = 'Vidéo extraite de la source';
        document.getElementById('siVideo').value = m.url;
        apercusMediasPrincipaux();
        mediaHub.forEach(x => { x.roles = x.roles.filter(r => r !== 'video'); });
        m.roles.push('video');
        note.innerHTML = '<div class="si-note ok">Vidéo définie comme média principal.</div>';
    }

    if (role === 'galerie') {
        if (m.roles.indexOf('galerie') >= 0) {
            const k = mediasCorps.findIndex(x => x.url === m.url);
            if (k >= 0) mediasCorps.splice(k, 1);
            m.roles = m.roles.filter(r => r !== 'galerie');
        } else {
            if (!mediasCorps.some(x => x.url === m.url)) {
                mediasCorps.push({
                    genre: m.genre, url: m.url,
                    nom: m.url.split('/').pop().slice(0, 40) || 'média source',
                    section: 'galerie'
                });
            }
            m.roles.push('galerie');
        }
        dessinerMediasCorps();
        note.innerHTML = '<div class="si-note ok">Galerie : '
            + mediasCorps.filter(x => x.section === 'galerie').length + ' média(s).</div>';
    }

    derniereCarte = null;   // les médias ont changé : la carte est à refaire
    dessinerMediaHub();
}

function mediaHubToutGalerie() {
    mediaHub.forEach((m, i) => {
        if (m.roles.indexOf('galerie') < 0) mediaHubAction('galerie', i);
    });
}

function viderMediaHub() {
    mediaHub.length = 0;
    dessinerMediaHub();
    const note = document.getElementById('mediaHubNote');
    if (note) note.innerHTML = '';
}

// Extraction fine : l'application Article Interactif (Flask) sait lire toutes
// les images et vidéos du corps d'une page, là où le Hub ne renvoie que
// l'og:image. On l'interroge quand elle répond, sinon on ne casse rien.
async function scannerMediasSource(urlForcee) {
    const note = document.getElementById('mediaHubNote');
    const btn = document.getElementById('mediaHubScanBtn');
    const url = (urlForcee
        || document.getElementById('urlInput').value
        || document.getElementById('aiUrlInput').value
        || window._sourceUrl || '').trim();

    if (!url || !/^https?:\/\//i.test(url)) {
        if (!urlForcee && note) {
            note.innerHTML = '<div class="si-note warn">Aucune URL source : collez d’abord un lien '
                + 'dans le Dépôt Magique.</div>';
        }
        return 0;
    }

    if (btn) btn.disabled = true;
    if (note && !urlForcee) {
        note.innerHTML = '<div class="si-note"><i class="fas fa-spinner fa-spin"></i> Extraction des médias…</div>';
    }
    try {
        const r = await fetchCarte('/api/fetch-url', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });
        const d = await lireJSON(r, 'Extraction des médias');
        if (d.error) throw new Error(d.error);

        const lot = []
            .concat((d.extracted_images || []).map(u => ({ genre: 'image', url: u })))
            .concat((d.extracted_videos || []).map(u => ({ genre: 'video', url: u })));
        if (d.extracted_image) lot.unshift({ genre: 'image', url: d.extracted_image });
        if (d.extracted_video) lot.push({ genre: 'video', url: d.extracted_video });

        const n = ajouterAuMediaHub(lot, url);

        // Le texte propre de la page alimente aussi le bloc interactif s'il est vide.
        const zone = document.getElementById('aiTexte');
        if (zone && !zone.value.trim() && d.text && d.text.length > 200) {
            zone.value = d.text.trim();
            majCompteurInteractif();
        }

        if (note) {
            note.innerHTML = n
                ? '<div class="si-note ok">' + n + ' média(s) récupéré(s) de la source.</div>'
                : '<div class="si-note warn">Aucun média exploitable sur cette page.</div>';
        }
        return n;
    } catch (e) {
        if (note && !urlForcee) {
            note.innerHTML = '<div class="si-note bad">Extraction impossible — '
                + String(e.message || e).replace(/</g, '&lt;')
                + '<br>L’application Article Interactif doit tourner (port ' + AI_PORT + ').</div>';
        }
        return 0;
    } finally {
        if (btn) btn.disabled = false;
    }
}

// « Remplir » doit aussi poser la photo et la vidéo, pas seulement le texte.
function appliquerMediasAuFormulaire() {
    const une = mediaHub.find(m => m.genre === 'image' && m.roles.indexOf('une') >= 0)
             || mediaHub.find(m => m.genre === 'image');
    const vid = mediaHub.find(m => m.genre === 'video' && m.roles.indexOf('video') >= 0)
             || mediaHub.find(m => m.genre === 'video');

    const champImg = document.getElementById('mediaImageUrl');
    const champSiImg = document.getElementById('siImageUrl');
    if (une && !champImg.value.trim() && !(champSiImg.value || '').trim()) {
        champImg.value = une.url;
        champSiImg.value = une.url;
        window._autoImage = une.url;
        const leg = document.getElementById('mediaImageCaption');
        if (!leg.value.trim()) leg.value = 'Photo extraite de la source';
        if (une.roles.indexOf('une') < 0) une.roles.push('une');
    }

    const champVid = document.getElementById('mediaVideoUrl');
    const champSiVid = document.getElementById('siVideo');
    if (vid && !champVid.value.trim() && !(champSiVid.value || '').trim()) {
        champVid.value = vid.url;
        champSiVid.value = vid.url;
        const leg = document.getElementById('mediaVideoCaption');
        if (!leg.value.trim()) leg.value = 'Vidéo extraite de la source';
        if (vid.roles.indexOf('video') < 0) vid.roles.push('video');
    }

    apercusMediasPrincipaux();
    dessinerMediaHub();

    // L'aperçu du formulaire suit l'illustration retenue.
    const img = (champSiImg.value || '').trim();
    if (img) {
        const box = document.getElementById('siImagePreview');
        box.innerHTML = '<img src="' + siEchap(img) + '">';
        box.classList.remove('hidden');
    }
}

/* ──────────────── 4.3 bloc interactif : importer un article ──────────── */

function majCompteurInteractif() {
    const zone = document.getElementById('aiTexte');
    const compteur = document.getElementById('aiCharCount');
    const badge = document.getElementById('aiImportBadge');
    if (!zone || !compteur) return;
    const n = zone.value.trim().length;
    compteur.textContent = n
        ? n + ' caractères — source du rendu .html'
        : '0 caractère — reprise du formulaire';
    if (badge) badge.textContent = n ? Math.round(n / 1000) + ' k' : 'vide';
    derniereCarte = null;
}

function setupImportInteractif() {
    const zone = document.getElementById('aiDropZone');
    const entree = document.getElementById('aiFileInput');
    const texte = document.getElementById('aiTexte');
    if (!zone || !entree) return;

    zone.addEventListener('click', () => entree.click());
    ['dragover', 'dragenter'].forEach(ev => zone.addEventListener(ev, e => {
        e.preventDefault(); zone.classList.add('si-drop-over');
    }));
    ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, () =>
        zone.classList.remove('si-drop-over')));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        if (e.dataTransfer.files.length) importerDocumentInteractif(e.dataTransfer.files[0]);
    });
    entree.addEventListener('change', e => {
        if (e.target.files.length) importerDocumentInteractif(e.target.files[0]);
        e.target.value = '';
    });

    if (texte) texte.addEventListener('input', majCompteurInteractif);

    // Entrée dans le champ URL = importer, comme le bouton.
    const champ = document.getElementById('aiUrlInput');
    if (champ) champ.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); importerPourInteractif(); }
    });

    majCompteurInteractif();
}

function noteInteractif(html) {
    const n = document.getElementById('aiImportNote');
    if (n) n.innerHTML = html;
}

async function importerDocumentInteractif(fichier) {
    const icone = document.getElementById('aiDropIcon');
    const label = document.getElementById('aiDropLabel');
    const remise = () => setTimeout(() => {
        icone.className = 'fas fa-cloud-upload-alt';
        label.textContent = 'Déposer ou cliquer pour importer '
            + '(.pdf, .docx, .html, .txt, .md, .webp, .png, .jpg)';
    }, 4000);

    // Une image déposée ici n'est pas un texte : elle devient l'illustration.
    if (/^image\//.test(fichier.type) || /\.(webp|png|jpe?g|gif|svg|bmp)$/i.test(fichier.name)) {
        const lect = new FileReader();
        lect.onload = ev => {
            document.getElementById('mediaImageUrl').value = ev.target.result;
            const leg = document.getElementById('mediaImageCaption');
            if (!leg.value.trim()) leg.value = fichier.name;
            apercusMediasPrincipaux();
            icone.className = 'fas fa-check-circle';
            label.textContent = 'Image « ' + fichier.name + ' » placée en illustration.';
            remise();
        };
        lect.readAsDataURL(fichier);
        return;
    }

    icone.className = 'fas fa-spinner fa-spin';
    label.textContent = 'Lecture de « ' + fichier.name + ' »…';
    try {
        const fd = new FormData();
        fd.append('file', fichier);
        const r = await fetchCarte('/api/upload', { method: 'POST', body: fd });
        const d = await lireJSON(r, 'Import du document');
        if (d.error) throw new Error(d.error);

        document.getElementById('aiTexte').value = (d.text || '').trim();
        majCompteurInteractif();
        icone.className = 'fas fa-check-circle';
        label.textContent = 'Document « ' + fichier.name + ' » importé.';
        noteInteractif('<div class="si-note ok">Texte prêt pour le rendu .html — '
            + (d.text || '').trim().length + ' caractères.</div>');
        remise();
    } catch (e) {
        icone.className = 'fas fa-triangle-exclamation';
        label.textContent = 'Lecture impossible.';
        noteInteractif('<div class="si-note bad">' + String(e.message || e).replace(/</g, '&lt;')
            + '<br>L’application Article Interactif doit tourner (port ' + AI_PORT + ').</div>');
        remise();
    }
}

async function importerPourInteractif() {
    const champ = document.getElementById('aiUrlInput');
    const btn = document.getElementById('aiUrlBtn');
    let url = (champ.value || '').trim();
    if (!url) {
        // Le lien du Dépôt Magique fait office de défaut : c'est le même sujet.
        url = (document.getElementById('urlInput').value || '').trim();
        champ.value = url;
    }
    if (!url) { noteInteractif('<div class="si-note warn">Collez un lien à importer.</div>'); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    btn.disabled = true;
    noteInteractif('<div class="si-note"><i class="fas fa-spinner fa-spin"></i> Lecture du lien…</div>');
    try {
        let texte = '', via = 'Article Interactif';
        try {
            const r = await fetchCarte('/api/fetch-url', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url })
            });
            const d = await lireJSON(r, 'Import du lien');
            if (d.error) throw new Error(d.error);
            texte = (d.text || '').trim();
            const lot = []
                .concat((d.extracted_images || []).map(u => ({ genre: 'image', url: u })))
                .concat((d.extracted_videos || []).map(u => ({ genre: 'video', url: u })));
            ajouterAuMediaHub(lot, url);
        } catch (e1) {
            // Article Interactif éteint ou page coriace : le Hub sait aussi lire
            // une page (proxy lecteur puis navigateur complet).
            const r2 = await fetch(API_BASE + '/api/fetch-url', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url })
            });
            const d2 = await lireJSON(r2, 'Import du lien (Hub)');
            if (d2.error) throw new Error(d2.error);
            texte = (d2.text || '').trim();
            via = 'Hub';
            ajouterAuMediaHub([
                { genre: 'image', url: d2.image },
                { genre: 'video', url: d2.video }
            ], url);
        }

        if (!texte) throw new Error('Aucun texte extrait de cette page.');
        document.getElementById('aiTexte').value = texte;
        majCompteurInteractif();

        const src = document.getElementById('siSource');
        if (!src.value.trim()) src.value = url;

        noteInteractif('<div class="si-note ok">Article importé via ' + via + ' — '
            + texte.length + ' caractères, prêt pour le rendu .html interactif.</div>');
    } catch (e) {
        noteInteractif('<div class="si-note bad">' + String(e.message || e).replace(/</g, '&lt;') + '</div>');
    } finally {
        btn.disabled = false;
    }
}

/* ─────────────────────── 4.4 article « Primeur » ─────────────────────── */

// Le texte de départ du Primeur : la matière du bloc interactif, sinon celle
// du Dépôt Magique, sinon le contenu déjà saisi dans le formulaire.
function sourcePrimeur() {
    const bas = (document.getElementById('aiTexte').value || '').trim();
    if (bas.length > 150) return bas;
    const haut = (document.getElementById('smartBox').value || '').trim();
    if (haut.length > 150) return haut;
    return [
        document.getElementById('siTitre').value,
        document.getElementById('siExtrait').value,
        document.getElementById('siContenu').value
    ].filter(Boolean).join('\n\n').trim();
}

async function genererPrimeur() {
    const btn = document.getElementById('primeurBtn');
    const badge = document.getElementById('primeurBadge');
    const note = document.getElementById('primeurNote');
    const source = sourcePrimeur();

    if (source.length < 150) {
        note.innerHTML = '<div class="si-note warn">Importez d’abord un article '
            + '(lien, fichier) ou collez du texte dans le Dépôt Magique.</div>';
        return;
    }

    btn.disabled = true;
    badge.textContent = 'rédaction…';
    note.innerHTML = '<div class="si-note"><i class="fas fa-spinner fa-spin"></i> '
        + 'Rédaction premium en cours — 600 à 900 mots, tableaux compris…</div>';
    try {
        const r = await fetch(ENGINE_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            // « pro » : le prompt magazine premium du Hub — analyse, mise en
            // perspective, tableaux Markdown. C'est le niveau visé par le .html.
            body: JSON.stringify({ text: source, style: 'pro' })
        });
        const d = await lireJSON(r, 'Article Primeur');
        if (!r.ok || d.error) throw new Error(d.error || ('HTTP ' + r.status));

        window._primeur = d;
        const md = '# ' + d.titre + '\n\n' + (d.lead || '') + '\n\n' + (d.contenu || '');
        document.getElementById('primeurTexte').value = md;
        document.getElementById('primeurZone').classList.remove('hidden');
        document.getElementById('primeurHead').innerHTML =
            '<i class="fas fa-crown"></i> ARTICLE PRIMEUR — ' + (d.categorie || 'ALGÉRIE').toUpperCase();

        // Le rendu .html part de ce texte : la carte doit être refaite.
        derniereCarte = null;
        badge.textContent = Math.round(md.length / 1000) + ' k';
        note.innerHTML = '<div class="si-note ok">Article Primeur prêt — '
            + md.split(/\s+/).length + ' mots. Il alimente désormais le rendu .html '
            + 'du Hub de déploiement.</div>';
    } catch (e) {
        badge.textContent = 'échec';
        note.innerHTML = '<div class="si-note bad">' + String(e.message || e).replace(/</g, '&lt;') + '</div>';
    } finally {
        btn.disabled = false;
    }
}

// Découpe le Primeur en sections nettes quand l'IA n'a pas mis de titres :
// c'est ce découpage que le moteur de rendu transforme en onglets, au lieu
// d'un bloc de texte unique.
function structurerPrimeur() {
    const zone = document.getElementById('primeurTexte');
    const note = document.getElementById('primeurNote');
    let texte = (zone.value || '').trim();
    if (!texte) {
        texte = sourcePrimeur();
        if (!texte) {
            note.innerHTML = '<div class="si-note warn">Rien à structurer.</div>';
            return;
        }
    }

    const lignes = texte.split('\n');
    const titre = (lignes[0] || '').replace(/^#+\s*/, '').trim();
    const corps = lignes.slice(1).join('\n').trim();

    if (/^##\s/m.test(corps)) {
        note.innerHTML = '<div class="si-note ok">Le texte porte déjà ses sections — '
            + (corps.match(/^##\s/gm) || []).length + ' onglets seront produits.</div>';
        return;
    }

    // Les paragraphes existants sont conservés tels quels : on ne réécrit pas,
    // on répartit.
    const paras = corps.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    if (paras.length < 3) {
        note.innerHTML = '<div class="si-note warn">Texte trop court pour un découpage '
            + 'en sections (3 paragraphes minimum).</div>';
        return;
    }

    const chapeau = paras[0];
    const reste = paras.slice(1);
    const tiers = Math.max(1, Math.ceil(reste.length / 3));
    const faits = reste.slice(0, tiers);
    const analyse = reste.slice(tiers, tiers * 2);
    const suite = reste.slice(tiers * 2);

    const puces = faits.join(' ')
        .split(/([.!?])\s+/).reduce((acc, part, i, arr) => {
            if (i % 2 === 0) acc.push((part + (arr[i + 1] || '')).trim());
            return acc;
        }, [])
        .filter(s => s.length > 45).slice(0, 4)
        .map(s => '- ' + s).join('\n');

    const out = ['# ' + titre, '', chapeau, '',
        '## Les faits', '', faits.join('\n\n')];
    if (puces) out.push('', '## Points clés', '', puces);
    if (analyse.length) out.push('', '## Analyse', '', analyse.join('\n\n'));
    if (suite.length) out.push('', '## Ce qui suit', '', suite.join('\n\n'));

    zone.value = out.join('\n');
    document.getElementById('primeurZone').classList.remove('hidden');
    derniereCarte = null;
    note.innerHTML = '<div class="si-note ok">Texte découpé en sections : '
        + (out.join('\n').match(/^##\s/gm) || []).length
        + ' onglets pour le rendu .html.</div>';
}

// Le Primeur remonte dans le formulaire de publication, en passant par le
// chemin d'origine (dateline, catégorie, « À retenir »).
function primeurVersFormulaire() {
    const note = document.getElementById('primeurNote');
    const md = (document.getElementById('primeurTexte').value || '').trim();
    if (!md) {
        note.innerHTML = '<div class="si-note warn">Générez d’abord l’article Primeur.</div>';
        return;
    }

    const base = window._primeur || {};
    const lignes = md.split('\n');
    const titre = (base.titre || lignes[0] || '').replace(/^#+\s*/, '').trim();
    const suite = lignes.slice(1).map(l => l.trim()).filter(Boolean);
    const lead = base.lead || suite[0] || '';

    document.getElementById('previewContent').value = md;
    document.getElementById('previewZone').classList.remove('hidden');
    document.querySelector('.si-preview-head span').innerHTML =
        '<i class="fas fa-crown"></i> ARTICLE PRIMEUR (APERÇU)';

    window._lastAI = {
        titre: titre, lead: lead, contenu: md,
        tags: base.tags || [], categorie: base.categorie || '', video: base.video || ''
    };
    fillFromAI(window._lastAI);
    normaliserARetenir();
    appliquerMediasAuFormulaire();

    note.innerHTML = '<div class="si-note ok">Formulaire rempli avec l’article Primeur — '
        + 'prêt pour le déploiement.</div>';
    document.getElementById('siTitre').scrollIntoView({ behavior: 'smooth', block: 'center' });
}


/* ═══════════════════════════════════════════════════════════════════════
   5 · APERÇU MULTI-ÉCRANS DU RENDU .HTML
   Mobile · Tablette · PC. On ne touche pas au document : on change la
   taille de la fenêtre qui l'affiche, comme un vrai appareil.
   ═══════════════════════════════════════════════════════════════════════ */

const FORMATS_APERCU = {
    mobile:   { l: 390, h: 844,  nom: 'mobile 390 × 844' },
    tablette: { l: 834, h: 1112, nom: 'tablette 834 × 1112' },
    pc:       { l: 0,   h: 0,    nom: 'pleine largeur' }   // 0 = 100 %
};

let formatApercuActif = 'pc';
let apercuPaysage = false;

function setupApercuFormats() {
    const barre = document.getElementById('siDevices');
    if (!barre) return;

    barre.querySelectorAll('[data-dev]').forEach(b => {
        b.addEventListener('click', () => {
            // Changer d'appareil repart en portrait : garder l'orientation
            // précédente donnait une tablette « 1112 × 834 » sans qu'on l'ait
            // demandé.
            if (b.dataset.dev !== formatApercuActif) apercuPaysage = false;
            appliquerFormatApercu(b.dataset.dev);
        });
    });

    const rot = document.getElementById('siDevRotate');
    if (rot) rot.addEventListener('click', () => {
        apercuPaysage = !apercuPaysage;
        appliquerFormatApercu(formatApercuActif);
    });

    appliquerFormatApercu('pc');
}

function appliquerFormatApercu(cle) {
    const f = FORMATS_APERCU[cle] || FORMATS_APERCU.pc;
    const cadre = document.getElementById('carteFrame');
    const scene = document.getElementById('siFrameStage');
    const taille = document.getElementById('siDevSize');
    const rot = document.getElementById('siDevRotate');
    if (!cadre || !scene) return;

    formatApercuActif = cle;
    document.querySelectorAll('#siDevices [data-dev]').forEach(b => {
        b.classList.toggle('active', b.dataset.dev === cle);
    });

    if (!f.l) {
        // PC : la fenêtre reprend toute la largeur disponible.
        apercuPaysage = false;
        scene.classList.remove('si-dev-on');
        cadre.style.width = '100%';
        cadre.style.height = '72vh';
        if (taille) taille.textContent = f.nom;
        if (rot) { rot.disabled = true; rot.classList.remove('active'); }
        return;
    }

    const largeur = apercuPaysage ? f.h : f.l;
    const hauteur = apercuPaysage ? f.l : f.h;
    scene.classList.add('si-dev-on');
    cadre.style.width = largeur + 'px';
    cadre.style.height = hauteur + 'px';
    if (taille) {
        taille.textContent = largeur + ' × ' + hauteur + ' px'
            + (apercuPaysage ? ' — paysage' : ' — portrait');
    }
    if (rot) { rot.disabled = false; rot.classList.toggle('active', apercuPaysage); }
}

/* ═══════════════════════════════════════════════════════════════════════
   6 · RÉPARTITION DES VISUALISATIONS
   Règle éditoriale : l'article publié sur le site ne garde QUE les
   tableaux. Slides, infographies, graphiques, frises, jauges, anneaux,
   compteurs, comparateurs et citations mises en exergue partent dans le
   fichier .html interactif — c'est là qu'ils sont à leur place.
   ═══════════════════════════════════════════════════════════════════════ */

// Ce qui a été fabriqué pour le .html mais volontairement tenu hors du
// markdown de l'article : { cle, titre, html }.
const visuelsInteractifs = [];

// Seuls ces formats ont le droit d'entrer dans le corps de l'article.
const VISUELS_ARTICLE = ['table'];

const NOMS_VISUELS = {
    figures: 'Chiffres clés', counter: 'Compteurs', chart: 'Graphique',
    gauge: 'Jauges', donut: 'Anneau', compare: 'Comparateur',
    timeline: 'Frise', table: 'Tableau', quote: 'Citation',
    info: 'Infographie'
};

function ajouterVisuelInteractif(cle, html) {
    const i = visuelsInteractifs.findIndex(v => v.cle === cle);
    const item = { cle: cle, titre: NOMS_VISUELS[cle] || cle, html: html };
    if (i >= 0) visuelsInteractifs[i] = item;   // un seul bloc par format
    else visuelsInteractifs.push(item);
    derniereCarte = null;                        // la carte est à refaire
    majBandeauVisuels();
}

function viderVisuelsInteractifs() {
    visuelsInteractifs.length = 0;
    derniereCarte = null;
    majBandeauVisuels();
}

function majBandeauVisuels() {
    const box = document.getElementById('visuelsInteractifsBox');
    if (!box) return;
    if (!visuelsInteractifs.length) {
        box.innerHTML = '';
        return;
    }
    box.innerHTML = '<div class="si-note ok"><b>Réservé au fichier .html — '
        + visuelsInteractifs.length + ' bloc' + (visuelsInteractifs.length > 1 ? 's' : '')
        + '</b> : ' + visuelsInteractifs.map(v => v.titre).join(', ')
        + '. L’article du site n’affichera que les tableaux. '
        + '<button type="button" class="si-mini-btn" onclick="viderVisuelsInteractifs()">'
        + 'Tout retirer</button></div>';
}

// Le bloc greffé dans le .html rendu, juste avant la barre d'actions.
function blocVisuelsPourCarte() {
    if (!visuelsInteractifs.length) return '';
    return STYLE_ANIM
        + '<section class="at-visuels reveal" style="margin:26px 0">'
        + '<h2 style="font-size:1.12rem;margin:0 0 14px;display:flex;align-items:center;gap:10px">'
        + '<i class="fas fa-chart-pie" style="color:var(--accent-color)"></i> '
        + 'Les données en images</h2>'
        + visuelsInteractifs.map(v => v.html).join('\n')
        + '</section>';
}
