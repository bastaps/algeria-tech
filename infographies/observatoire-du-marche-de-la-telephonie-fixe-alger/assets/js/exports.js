/**
 * Exports — CSV / JSON / PDF / PPTX
 */

import { DATASET, fmt } from './data.js';
import { exportPPTX } from './pptx-export.js';

export function exportCSV() {
    const rows = DATASET.rows || [];
    const columns = DATASET.columns || [];
    
    if (!rows.length || !columns.length) {
        alert('Aucune donnée à exporter');
        return;
    }
    
    const csv = [
        columns.join(';'),
        ...rows.map(r => columns.map(c => {
            const v = r[c];
            if (v === null || v === undefined) return '';
            if (typeof v === 'string' && v.includes(';')) return `"${v}"`;
            return v;
        }).join(';'))
    ].join('\n');
    
    downloadFile(csv, 'data.csv', 'text/csv;charset=utf-8');
    showToast('CSV exporté');
}

export function exportJSON() {
    const json = JSON.stringify(DATASET, null, 2);
    downloadFile(json, 'data.json', 'application/json;charset=utf-8');
    showToast('JSON exporté');
}

export async function exportPDF() {
    if (!window.jspdf || !window.html2canvas) {
        showToast('Modules PDF non disponibles', 'error');
        return;
    }
    
    showToast('Génération PDF…');
    
    const { jsPDF } = window.jspdf;
    const element = document.querySelector('main');
    if (!element) return;
    
    try {
        const canvas = await html2canvas(element, {
            backgroundColor: '#0f0f23',
            scale: 1.5,
            useCORS: true,
            logging: false,
        });
        
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        const imgWidth = pdf.internal.pageSize.getWidth();
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 0;
        
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
        
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdf.internal.pageSize.getHeight();
        }
        
        pdf.save('infographie.pdf');
        showToast('PDF exporté');
    } catch (e) {
        console.error(e);
        showToast('Erreur lors de la génération du PDF', 'error');
    }
}

export async function sharePage() {
    const url = window.location.href;
    const title = document.title;
    
    if (navigator.share) {
        try {
            await navigator.share({ title, url });
            return;
        } catch (e) {
            console.log('Share cancelled or failed');
        }
    }
    
    // Fallback : copie dans le presse-papier
    try {
        await navigator.clipboard.writeText(url);
        showToast('Lien copié');
    } catch {
        showToast('Partage non supporté', 'error');
    }
}

function downloadFile(content, filename, type) {
    const blob = new Blob(['\ufeff' + content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.background = type === 'error' ? '#ef4444' : '#10b981';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// Event listeners
document.getElementById('export-csv')?.addEventListener('click', exportCSV);
document.getElementById('export-json')?.addEventListener('click', exportJSON);
document.getElementById('export-pdf')?.addEventListener('click', exportPDF);
document.getElementById('export-pptx')?.addEventListener('click', exportPPTX);
document.getElementById('export-share')?.addEventListener('click', sharePage);
document.getElementById('btn-share')?.addEventListener('click', sharePage);
document.getElementById('btn-export-pdf')?.addEventListener('click', exportPDF);

console.log('✓ Exports chargés');
