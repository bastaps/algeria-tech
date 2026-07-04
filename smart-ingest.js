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
    if(!window._lastAI) {
        alert("Aucun article généré à transférer.");
        return;
    }
    setStatus('fillHubBtn', 'loading');

    const data = window._lastAI;
    document.getElementById('siTitre').value = data.titre;
    document.getElementById('siExtrait').value = data.lead || '';
    document.getElementById('siTags').value = (data.tags || []).join(', ');
    document.getElementById('siVideo').value = data.video || '';
    document.getElementById('siContenu').value = document.getElementById('previewContent').value;

    // Détection auto de catégorie (fallback si l'IA ne fournit pas déjà data.categorie)
    const contentLower = (data.contenu || '').toLowerCase();
    const mentionsAlgerie = /alg[ée]rie|wilaya|alger\b|oran\b|constantine\b|arpce|anpt/.test(contentLower);
    let cat = mentionsAlgerie ? "Algérie" : "Monde";
    if(contentLower.includes("djezzy") || contentLower.includes("mobilis") || contentLower.includes("ooredoo") || contentLower.includes("télécom")) {
        cat = "Télécoms";
    } else if(contentLower.includes("mobile") || contentLower.includes("smartphone")) {
        cat = "Mobile";
    } else if(contentLower.includes("startup") || contentLower.includes("incubateur") || contentLower.includes("accélérateur")) {
        cat = "Startups";
    } else if(/\bia\b|intelligence artificielle|chatgpt|llm\b|machine learning/.test(contentLower)) {
        cat = "IA";
    } else if(contentLower.includes("fintech") || contentLower.includes("paiement électronique") || contentLower.includes("banque en ligne")) {
        cat = "Fintech";
    } else if(mentionsAlgerie && (contentLower.includes("entreprise") || contentLower.includes("société"))) {
        cat = "Entreprises";
    }
    document.getElementById('siCategorie').value = cat;
    if(data.categorie) document.getElementById('siCategorie').value = data.categorie;

    setStatus('fillHubBtn', 'success');
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

    // Gestion auto de l'image si vide — même logique que getAutoImage de script.js
    if(!document.getElementById('siImage').files[0]) {
        formData.delete('image');
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