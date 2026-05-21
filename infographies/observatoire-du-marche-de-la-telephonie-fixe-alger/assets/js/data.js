/**
 * Dataset — Données structurées de l'infographie Algeria Tech Premium
 * Généré automatiquement par Telecom Generator
 */

export const DATASET = {"kpis": [{"label": "Valeur", "value": 1, "unit": "", "icon": "📊", "total": 422, "avg": 52.75, "max": 202, "min": 1, "trend": "up", "trend_pct": 0.0}], "rows": [{"Periode": "Point 1", "Valeur": 3}, {"Periode": "Point 2", "Valeur": 202}, {"Periode": "Point 3", "Valeur": 5}, {"Periode": "Point 4", "Valeur": 3}, {"Periode": "Point 5", "Valeur": 202}, {"Periode": "Point 6", "Valeur": 5}, {"Periode": "Point 7", "Valeur": 1}, {"Periode": "Point 8", "Valeur": 1}], "columns": ["Periode", "Valeur"], "label_column": "Periode", "numeric_columns": ["Valeur"], "charts": [{"id": "chart-1", "type": "bar", "title": "Valeur par Periode", "labels": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5", "Point 6", "Point 7", "Point 8"], "datasets": [{"label": "Valeur", "data": [3, 202, 5, 3, 202, 5, 1, 1]}]}, {"id": "chart-2", "type": "doughnut", "title": "Répartition · Point 8", "labels": ["Valeur"], "datasets": [{"label": "Valeurs", "data": [1]}]}, {"id": "chart-3", "type": "line", "title": "Évolution sur 8 points", "labels": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5", "Point 6", "Point 7", "Point 8"], "datasets": [{"label": "Valeur", "data": [3, 202, 5, 3, 202, 5, 1, 1]}]}, {"id": "chart-4", "type": "polarArea", "title": "Vue polaire · Valeur", "labels": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5", "Point 6", "Point 7", "Point 8"], "datasets": [{"label": "Valeur", "data": [3, 202, 5, 3, 202, 5, 1, 1]}]}, {"id": "chart-8", "type": "line", "fill": true, "title": "Tendance · Valeur", "labels": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5", "Point 6", "Point 7", "Point 8"], "datasets": [{"label": "Valeur", "data": [3, 202, 5, 3, 202, 5, 1, 1]}]}, {"id": "chart-9", "type": "doughnut", "title": "Répartition · Point 1", "labels": ["Valeur"], "datasets": [{"label": "Valeurs", "data": [3]}]}]};

export const THEME = {
    primary:    "#D4A437",
    secondary:  "#2D8A5F",
    accent:     "#B85042",
    background: "#0a0e1a",
    text:       "#F4EDE0",
};

/**
 * Formateurs de nombres et textes
 */
export const fmt = {
    nombre: (n) => {
        if (n === null || n === undefined) return "—";
        return Number(n).toLocaleString('fr-FR');
    },
    
    nombreEntier: (n) => {
        if (n === null || n === undefined) return "—";
        return Math.round(Number(n)).toLocaleString('fr-FR');
    },
    
    pourcent: (n, decimals = 1) => {
        if (n === null || n === undefined) return "—";
        return Number(n).toLocaleString('fr-FR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }) + '%';
    },
    
    pourcentTendance: (n) => {
        if (n === null || n === undefined) return "—";
        const sign = n >= 0 ? '+' : '';
        return sign + Number(n).toLocaleString('fr-FR', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }) + '%';
    },
    
    millions: (n) => {
        if (n === null || n === undefined) return "—";
        return Number(n).toLocaleString('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + ' M';
    },
    
    devise: (n, devise = 'DA') => {
        if (n === null || n === undefined) return "—";
        return Number(n).toLocaleString('fr-FR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }) + ' ' + devise;
    },
    
    texte: (s) => {
        if (s === null || s === undefined) return "—";
        return String(s);
    }
};

/**
 * Extraction de colonnes numériques
 */
export function getNumericValues(rows, column) {
    return rows
        .map(r => r[column])
        .filter(v => typeof v === 'number' && !isNaN(v));
}

/**
 * Calculs statistiques rapides
 */
export function stats(values) {
    const nums = values.filter(v => typeof v === 'number' && !isNaN(v));
    if (nums.length === 0) return { sum: 0, avg: 0, max: 0, min: 0, count: 0 };
    return {
        sum: nums.reduce((a, b) => a + b, 0),
        avg: nums.reduce((a, b) => a + b, 0) / nums.length,
        max: Math.max(...nums),
        min: Math.min(...nums),
        count: nums.length
    };
}

/**
 * Renommage et tri
 */
export function renameColumn(rows, oldName, newName) {
    return rows.map(r => {
        const copy = { ...r };
        if (oldName in copy) {
            copy[newName] = copy[oldName];
            delete copy[oldName];
        }
        return copy;
    });
}

/**
 * Groupement par clé
 */
export function groupBy(rows, key) {
    const groups = {};
    rows.forEach(r => {
        const k = r[key];
        if (!groups[k]) groups[k] = [];
        groups[k].push(r);
    });
    return groups;
}

/**
 * Filtrage simple
 */
export function filter(rows, predicate) {
    return rows.filter(predicate);
}

/**
 * Top N
 */
export function topN(rows, column, n = 10, direction = 'desc') {
    const sorted = [...rows].sort((a, b) => {
        const aVal = a[column] || 0;
        const bVal = b[column] || 0;
        return direction === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return sorted.slice(0, n);
}

console.log('📊 Dataset chargé :', DATASET);
