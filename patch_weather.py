#!/usr/bin/env python3
# patch_weather.py — remplace la section météo dans script.js et style.css

# ─── 1. script.js ────────────────────────────────────────────────────────────
with open('E:/algeria-tech/script.js', 'rb') as f:
    js = f.read()

JS_NEW = u'''// ===== METEO =====
const WMO_FR = {
    0:'Ciel degage', 1:'Principalement degage', 2:'Partiellement nuageux', 3:'Couvert',
    45:'Brouillard', 48:'Brouillard givrant',
    51:'Bruine legere', 53:'Bruine moderee', 55:'Bruine dense',
    61:'Pluie legere', 63:'Pluie moderee', 65:'Pluie forte',
    71:'Neige legere', 73:'Neige moderee', 75:'Neige forte', 77:'Grains de neige',
    80:'Averses legeres', 81:'Averses moderees', 82:'Averses violentes',
    85:'Averses de neige', 86:'Averses de neige fortes',
    95:'Orage', 96:'Orage avec grele', 99:'Orage avec forte grele'
};
function _wxIcon(code) {
    if (code === 0)  return { i:'fa-sun',                 c:'#fbbf24' };
    if (code <= 2)   return { i:'fa-cloud-sun',           c:'#f59e0b' };
    if (code <= 3)   return { i:'fa-cloud',               c:'#94a3b8' };
    if (code <= 48)  return { i:'fa-smog',                c:'#64748b' };
    if (code <= 67)  return { i:'fa-cloud-rain',          c:'#60a5fa' };
    if (code <= 77)  return { i:'fa-snowflake',           c:'#bae6fd' };
    if (code <= 82)  return { i:'fa-cloud-showers-heavy', c:'#2563eb' };
    return                  { i:'fa-bolt',                c:'#ef4444' };
}
function _wxDir(deg) {
    return ['N','NE','E','SE','S','SO','O','NO'][Math.round((deg ?? 0) / 45) % 8];
}
function _uvLabel(uv) {
    if (uv <= 2) return { label:'Faible',     color:'#22c55e' };
    if (uv <= 5) return { label:'Modere',     color:'#f59e0b' };
    if (uv <= 7) return { label:'Eleve',      color:'#f97316' };
    return              { label:'Tres eleve', color:'#ef4444' };
}

async function updateWeather() {
    const widget = document.getElementById('weatherWidget');
    const card   = document.getElementById('weatherCard');
    if (!widget) return;
    widget.classList.add('updating');
    try {
        const res = await fetch(
            'https://api.open-meteo.com/v1/forecast' +
            '?latitude=36.7525&longitude=3.04197' +
            '&current=temperature_2m,apparent_temperature,relative_humidity_2m,' +
            'weather_code,wind_speed_10m,wind_direction_10m,uv_index,cloud_cover' +
            '&timezone=Africa%2FAlgiers'
        );
        const d = await res.json();
        const c = d.current;
        const temp  = Math.round(c.temperature_2m);
        const feels = Math.round(c.apparent_temperature);
        const code  = c.weather_code;
        const { i: icon, c: color } = _wxIcon(code);
        const desc   = WMO_FR[code] || 'Alger';
        const dir    = _wxDir(c.wind_direction_10m);
        const wind   = Math.round(c.wind_speed_10m);
        const cloud  = c.cloud_cover != null ? Math.round(c.cloud_cover) : null;
        const uv     = c.uv_index   != null ? Math.round(c.uv_index)    : null;
        const uvInfo = uv != null ? _uvLabel(uv) : null;
        const now    = new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });

        // Topbar
        widget.innerHTML = '<i class="fas ' + icon + '" style="color:' + color + ';margin-right:4px;"></i><b>' + temp + '&#176;C</b>';

        // Grand popup
        if (card) {
            const uvRow = uvInfo ? (
                '<div class="wc-item">' +
                    '<i class="fas fa-sun" style="color:' + uvInfo.color + '"></i>' +
                    '<span>Indice UV</span>' +
                    '<b style="color:' + uvInfo.color + '">' + uv + '</b>' +
                '</div>' +
                '<div class="wc-item">' +
                    '<i class="fas fa-circle" style="color:' + uvInfo.color + ';font-size:.5rem"></i>' +
                    '<span>Niveau</span>' +
                    '<b style="color:' + uvInfo.color + '">' + uvInfo.label + '</b>' +
                '</div>'
            ) : '';
            const cloudRow = cloud != null ? (
                '<div class="wc-item">' +
                    '<i class="fas fa-cloud"></i>' +
                    '<span>Nuages</span>' +
                    '<b>' + cloud + '%</b>' +
                '</div>'
            ) : '';

            card.innerHTML =
                '<div class="wc-header">' +
                    '<span><i class="fas fa-map-marker-alt"></i>&nbsp;Alger, Algerie</span>' +
                    '<span class="wc-time">&#8635;&nbsp;' + now + '</span>' +
                '</div>' +
                '<div class="wc-body">' +
                    '<div class="wc-main">' +
                        '<i class="fas ' + icon + ' wc-main-icon" style="color:' + color + '"></i>' +
                        '<div class="wc-main-temp">' + temp + '<span class="wc-unit">&#176;C</span></div>' +
                        '<div class="wc-desc">' + desc + '</div>' +
                    '</div>' +
                    '<div class="wc-grid">' +
                        '<div class="wc-item">' +
                            '<i class="fas fa-thermometer-half"></i>' +
                            '<span>Ressenti</span>' +
                            '<b>' + feels + '&#176;C</b>' +
                        '</div>' +
                        '<div class="wc-item">' +
                            '<i class="fas fa-tint"></i>' +
                            '<span>Humidite</span>' +
                            '<b>' + c.relative_humidity_2m + '%</b>' +
                        '</div>' +
                        cloudRow +
                        '<div class="wc-item">' +
                            '<i class="fas fa-wind"></i>' +
                            '<span>Vent ' + dir + '</span>' +
                            '<b>' + wind + ' km/h</b>' +
                        '</div>' +
                        uvRow +
                    '</div>' +
                    '<a href="https://www.meteo.dz/" target="_blank" rel="noopener" class="wc-link">' +
                        'Meteo complete &mdash; meteo.dz &#8594;' +
                    '</a>' +
                '</div>';
        }
    } catch(e) {
        widget.innerHTML = '<i class="fas fa-sun" style="color:#fbbf24;margin-right:4px;"></i><b>--&#176;C</b>';
        if (card) card.innerHTML = '<div class="wc-header" style="justify-content:center"><i class="fas fa-exclamation-triangle" style="color:#ef4444;margin-right:6px"></i>Meteo indisponible</div>';
    } finally {
        widget.classList.remove('updating');
    }
}

// Rafraichissement automatique toutes les 10 minutes
setInterval(updateWeather, 10 * 60 * 1000);
'''

js_new_bytes = JS_NEW.encode('utf-8').replace(b'\n', b'\r\n')
js_new_content = js[:68582] + js_new_bytes + js[73937:]

with open('E:/algeria-tech/script.js', 'wb') as f:
    f.write(js_new_content)

print('[JS] OK — section:', len(js_new_bytes), 'bytes | file:', len(js_new_content), 'bytes')

# ─── 2. style.css ────────────────────────────────────────────────────────────
with open('E:/algeria-tech/style.css', 'rb') as f:
    css = f.read()

CSS_WEATHER_START = css.find(b'/* ===== M')   # cherche le commentaire METEO
CSS_WEATHER_END   = css.find(b'\r\n.weather-trigger.updating', CSS_WEATHER_START)
CSS_WEATHER_END  += len(b'\r\n.weather-trigger.updating { animation: weatherPulse 0.4s ease forwards; }')

print('[CSS] block bytes:', CSS_WEATHER_START, '-', CSS_WEATHER_END)

CSS_NEW = u'''/* ===== METEO WIDGET ===== */
.weather-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
}
.weather-trigger {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
    color: inherit;
    font-size: 0.8rem;
}
.weather-trigger:hover,
.weather-wrap:hover .weather-trigger {
    background: rgba(255,255,255,0.18);
}

/* ── Carte popup ── */
.weather-card {
    position: absolute;
    top: calc(100% + 14px);
    left: 50%;
    transform: translateX(-50%) translateY(-8px);
    width: 310px;
    background: var(--bg-white);
    border: 1px solid var(--border);
    border-radius: 18px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.22);
    overflow: hidden;
    z-index: 9999;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease, transform 0.25s ease;
    color: var(--text-dark);
}
.weather-wrap:hover .weather-card {
    opacity: 1;
    pointer-events: auto;
    transform: translateX(-50%) translateY(0);
}
/* Caret */
.weather-card::before {
    content: '';
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%);
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 8px solid #006233;
    z-index: 1;
}

/* Header gradient */
.wc-header {
    background: linear-gradient(135deg, #004d28, #006233, #00843f);
    color: #fff;
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.02em;
}
.wc-header i { margin-right: 4px; color: #D21034; }
.wc-time { background: rgba(255,255,255,0.18); padding: 2px 8px; border-radius: 20px; font-size: 0.7rem; }

/* Body */
.wc-body { padding: 16px; }

/* Zone principale icon + temp */
.wc-main {
    text-align: center;
    padding: 8px 0 16px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 14px;
}
.wc-main-icon {
    font-size: 3.6rem;
    display: block;
    margin-bottom: 6px;
    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.15));
}
.wc-main-temp {
    font-size: 3rem;
    font-weight: 900;
    line-height: 1;
    color: var(--text-dark);
    letter-spacing: -0.03em;
}
.wc-unit { font-size: 1.4rem; font-weight: 600; vertical-align: super; }
.wc-desc {
    font-size: 0.82rem;
    color: #777;
    margin-top: 6px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

/* Grille 3 colonnes */
.wc-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin-bottom: 14px;
}
.wc-item {
    background: rgba(0,98,51,0.07);
    border-radius: 10px;
    padding: 9px 6px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    text-align: center;
    transition: background 0.2s;
}
.wc-item:hover { background: rgba(0,98,51,0.14); }
body.dark-mode .wc-item { background: rgba(255,255,255,0.06); }
body.dark-mode .wc-item:hover { background: rgba(255,255,255,0.11); }
.wc-item i { color: var(--primary); font-size: 0.9rem; }
.wc-item span { font-size: 0.62rem; color: #888; text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.2; }
.wc-item b { font-size: 0.9rem; color: var(--text-dark); font-weight: 700; }

/* Bouton lien */
.wc-link {
    display: block;
    text-align: center;
    font-size: 0.74rem;
    color: #fff;
    text-decoration: none;
    font-weight: 700;
    padding: 9px 10px;
    border-radius: 10px;
    background: linear-gradient(90deg, #006233, #00a855);
    transition: opacity 0.2s, transform 0.15s;
    letter-spacing: 0.03em;
    box-shadow: 0 2px 8px rgba(0,98,51,0.3);
}
.wc-link:hover { opacity: 0.88; transform: translateY(-1px); }

@keyframes weatherPulse {
    0%   { opacity: 0.5; transform: scale(0.95); }
    100% { opacity: 1;   transform: scale(1); }
}
.weather-trigger.updating { animation: weatherPulse 0.4s ease forwards; }'''

css_new_bytes = CSS_NEW.encode('utf-8').replace(b'\n', b'\r\n')
css_new_content = css[:CSS_WEATHER_START] + css_new_bytes + css[CSS_WEATHER_END:]

with open('E:/algeria-tech/style.css', 'wb') as f:
    f.write(css_new_content)

print('[CSS] OK — section:', len(css_new_bytes), 'bytes | file:', len(css_new_content), 'bytes')
print('ALL DONE')
