/**
 * AI Panel — Interface Claude pour analyser et dialoguer sur les données
 * Utilise le proxy local server.py ou appel direct à l'API
 */

import { DATASET } from './data.js';

const API_URL = '/api/ai';

let history = [];

function getApiKey() { return localStorage.getItem('claude_key') || ''; }
function setApiKey(k) { localStorage.setItem('claude_key', k.trim()); }

function buildSystemPrompt() {
    const kpis = (DATASET.kpis || []).map(k => `${k.label}: ${k.value}`).join(', ');
    const rows = (DATASET.rows || []).slice(0, 10);
    const cols = (DATASET.columns || []).join(', ');
    return `Tu es un analyste expert en télécommunications et TIC.
Tu as accès à ces données :
- KPIs : ${kpis || 'non disponibles'}
- Colonnes : ${cols || 'non disponibles'}
- Données (extrait) : ${JSON.stringify(rows, null, 0).slice(0, 800)}

Réponds en français, de façon concise et professionnelle.
Utilise des chiffres précis quand tu cites les données.
Format markdown autorisé pour les listes.`;
}

async function callClaude(userMsg) {
    const key = getApiKey();
    if (!key) throw new Error('Clé API Claude requise');

    history.push({ role: 'user', content: userMsg });

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            api_key: key,
            system: buildSystemPrompt(),
            messages: history,
        }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    history.push({ role: 'assistant', content: data.text });
    return data.text;
}

function appendMsg(text, role) {
    const box = document.getElementById('ai-messages');
    if (!box) return;
    const div = document.createElement('div');
    div.className = `ai-msg ${role}`;
    div.textContent = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
}

function clearLoading() {
    document.querySelector('.ai-msg.loading')?.remove();
}

export function initAIPanel() {
    const toggle = document.getElementById('ai-toggle');
    const box    = document.getElementById('ai-chat-box');
    const keyIn  = document.getElementById('ai-key-input');
    const keySave = document.getElementById('ai-key-save');
    const input  = document.getElementById('ai-user-input');
    const send   = document.getElementById('ai-send');

    if (!toggle || !box) return;

    // Restore saved key
    if (keyIn && getApiKey()) {
        keyIn.value = '••••••••' + getApiKey().slice(-4);
    }

    toggle.addEventListener('click', () => box.classList.toggle('open'));
    document.addEventListener('click', e => {
        if (!box.contains(e.target) && e.target !== toggle) box.classList.remove('open');
    });

    keySave?.addEventListener('click', () => {
        const k = keyIn.value.trim();
        if (k && !k.startsWith('••')) {
            setApiKey(k);
            keyIn.value = '••••••••' + k.slice(-4);
            window.showToast?.('✓ Clé API sauvegardée');
        }
    });

    // Quick action buttons
    document.querySelectorAll('.ai-quick').forEach(btn => {
        btn.addEventListener('click', () => {
            const prompt = btn.dataset.prompt;
            if (prompt) sendMessage(prompt);
        });
    });

    async function sendMessage(text) {
        if (!text.trim()) return;
        if (!getApiKey()) {
            appendMsg('⚠ Entrez votre clé API Claude (sk-ant-...) et cliquez Sauver.', 'bot');
            return;
        }

        appendMsg(text, 'user');
        if (input) input.value = '';
        if (send) send.disabled = true;

        const loading = appendMsg('…', 'loading');
        try {
            const reply = await callClaude(text);
            clearLoading();
            appendMsg(reply, 'bot');
        } catch (err) {
            clearLoading();
            appendMsg('⚠ ' + err.message, 'bot');
        } finally {
            if (send) send.disabled = false;
        }
    }

    send?.addEventListener('click', () => sendMessage(input?.value || ''));
    input?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input.value); }
    });

    // Auto-welcome message
    if (document.getElementById('ai-messages')?.children.length === 0) {
        setTimeout(() => {
            appendMsg('👋 Bonjour ! Je suis votre assistant IA. Entrez votre clé Claude API ci-dessus, puis posez-moi n\'importe quelle question sur vos données télécom.', 'bot');
        }, 500);
    }
}
