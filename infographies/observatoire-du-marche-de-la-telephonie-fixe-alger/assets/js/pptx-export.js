/**
 * PPTX Export — Génère une présentation PowerPoint à partir des données
 * Dépendance : PptxGenJS (chargé depuis CDN dans index.html)
 */

import { DATASET, THEME, fmt } from './data.js';

export async function exportPPTX() {
    if (!window.PptxGenJS) {
        alert('PptxGenJS non chargé. Vérifiez votre connexion internet.');
        return;
    }

    const pptx = new window.PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.title = document.title || 'Infographie Telecom';

    const PRI = THEME.primary || '#8B5CF6';
    const SEC = THEME.secondary || '#06B6D4';
    const BG  = THEME.background || '#0F0F23';
    const TXT = THEME.text || '#F3F4F6';

    // ── Slide 1 : Titre ─────────────────────────────────────────────────────
    const s1 = pptx.addSlide();
    s1.background = { color: BG.replace('#', '') };

    s1.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 0.08,
        fill: { color: PRI.replace('#', '') },
    });

    s1.addText(document.querySelector('.hero-title')?.textContent?.trim() || 'Observatoire TIC', {
        x: 0.8, y: 1.5, w: 10.4, h: 1.5,
        fontSize: 36, bold: true, color: TXT.replace('#', ''),
        fontFace: 'Calibri',
    });

    s1.addText(document.querySelector('.hero-lead')?.textContent?.trim() || 'Synthèse interactive', {
        x: 0.8, y: 3.2, w: 10.4, h: 0.6,
        fontSize: 18, color: '9CA3AF', fontFace: 'Calibri',
    });

    s1.addText(document.querySelector('.eyebrow')?.textContent?.trim() || '', {
        x: 0.8, y: 4.2, w: 10.4, h: 0.4,
        fontSize: 12, color: PRI.replace('#', ''), fontFace: 'Courier New',
    });

    s1.addText('Généré par Telecom Generator', {
        x: 0.8, y: 5.2, w: 10.4, h: 0.4,
        fontSize: 10, color: '4B5563', fontFace: 'Calibri',
    });

    // ── Slide 2 : KPIs ──────────────────────────────────────────────────────
    const kpis = DATASET.kpis || [];
    if (kpis.length > 0) {
        const s2 = pptx.addSlide();
        s2.background = { color: BG.replace('#', '') };
        s2.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: PRI.replace('#', '') } });
        s2.addText('Indicateurs Clés', {
            x: 0.5, y: 0.3, w: 11, h: 0.7,
            fontSize: 24, bold: true, color: PRI.replace('#', ''),
        });

        const cols = Math.min(kpis.length, 4);
        const cw = 11 / cols;
        kpis.slice(0, 4).forEach((kpi, i) => {
            const cx = 0.5 + i * cw;
            s2.addShape(pptx.ShapeType.roundRect, {
                x: cx, y: 1.2, w: cw - 0.2, h: 2.5,
                fill: { color: '1A1A35' },
                line: { color: PRI.replace('#', ''), width: 1 },
                rectRadius: 0.12,
            });
            s2.addText(String(kpi.value ?? '—'), {
                x: cx + 0.1, y: 1.5, w: cw - 0.4, h: 1,
                fontSize: 28, bold: true, color: PRI.replace('#', ''),
                align: 'center',
            });
            s2.addText((kpi.label || '').toUpperCase(), {
                x: cx + 0.1, y: 2.6, w: cw - 0.4, h: 0.5,
                fontSize: 9, color: '9CA3AF', align: 'center', charSpacing: 2,
            });
            if (kpi.trend != null) {
                const up = kpi.trend >= 0;
                s2.addText(`${up ? '▲' : '▼'} ${Math.abs(kpi.trend).toFixed(2)}%`, {
                    x: cx + 0.1, y: 3.2, w: cw - 0.4, h: 0.35,
                    fontSize: 10, color: up ? '10B981' : 'EF4444', align: 'center',
                });
            }
        });
    }

    // ── Slide 3 : Graphiques (screenshot via html2canvas) ──────────────────
    const chartSlide = pptx.addSlide();
    chartSlide.background = { color: BG.replace('#', '') };
    chartSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: PRI.replace('#', '') } });
    chartSlide.addText('Visualisations', {
        x: 0.5, y: 0.3, w: 11, h: 0.7, fontSize: 24, bold: true, color: PRI.replace('#', ''),
    });

    if (window.html2canvas) {
        const chartSection = document.getElementById('charts');
        if (chartSection) {
            try {
                const canvas = await html2canvas(chartSection, {
                    backgroundColor: BG,
                    scale: 1.2,
                    logging: false,
                });
                const imgData = canvas.toDataURL('image/png');
                chartSlide.addImage({ data: imgData, x: 0.5, y: 1.1, w: 11, h: 4.6 });
            } catch {
                chartSlide.addText('Graphiques non disponibles en export', {
                    x: 0.5, y: 2.5, w: 11, h: 1, fontSize: 14, color: '9CA3AF', align: 'center',
                });
            }
        }
    }

    // ── Slide 4 : Données table ─────────────────────────────────────────────
    const rows = DATASET.rows || [];
    const cols = DATASET.columns || [];
    if (rows.length > 0 && cols.length > 0) {
        const s4 = pptx.addSlide();
        s4.background = { color: BG.replace('#', '') };
        s4.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: PRI.replace('#', '') } });
        s4.addText('Données Détaillées', {
            x: 0.5, y: 0.3, w: 11, h: 0.7, fontSize: 24, bold: true, color: PRI.replace('#', ''),
        });

        const tableRows = [
            cols.map(c => ({ text: c, options: { bold: true, color: 'FFFFFF', fill: { color: PRI.replace('#', '') } } })),
            ...rows.slice(0, 15).map(row =>
                cols.map(c => ({
                    text: String(row[c] ?? ''),
                    options: { color: TXT.replace('#', ''), fill: { color: '1A1A35' } },
                }))
            ),
        ];

        s4.addTable(tableRows, {
            x: 0.5, y: 1.2, w: 11,
            fontSize: 10,
            border: { type: 'solid', pt: 0.5, color: '2D2D4A' },
            autoPage: true,
            autoPageRepeatHeader: true,
        });
    }

    // ── Save ─────────────────────────────────────────────────────────────────
    const filename = (document.title || 'infographie').replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'telecom';
    await pptx.writeFile({ fileName: `${filename}.pptx` });
    window.showToast?.('✓ Présentation PPTX exportée');
}

// ── Upload PDF/PPTX via server.py ────────────────────────────────────────────
export async function parsePDF(file) {
    const b64 = await fileToBase64(file);
    const res = await fetch('/api/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: b64 }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.text;
}

export async function parsePPTX(file) {
    const b64 = await fileToBase64(file);
    const res = await fetch('/api/parse-pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: b64 }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    // Extraire les tables de données si disponibles
    const tables = data.slides?.flatMap(s => s.tables || []).filter(t => t.length > 1) || [];
    if (tables.length > 0) {
        const headers = tables[0][0];
        const rows = tables[0].slice(1).map(row => {
            const obj = {};
            headers.forEach((h, i) => {
                const v = row[i] ?? '';
                obj[h] = v !== '' && !isNaN(v) ? Number(v) : v;
            });
            return obj;
        });
        return { headers, rows, type: 'table' };
    }

    // Sinon retourner le texte concaténé
    const text = data.slides?.map(s => s.texts?.join('\n')).join('\n\n') || '';
    return { text, type: 'text' };
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
