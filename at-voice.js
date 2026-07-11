/* ══════════════════════════════════════════════════════════════════════
   ALGERIA TECH — VOICE MEGA ASSISTANT v1.0  (at-voice.js)
   Scope C : ~130 commandes · feedback TTS · wake-word « ok tech »
   · visualizer audio · panneau d'aide vocal.
   Reconnaissance : Web Speech API native (aucun CDN → OK connexions lentes).
   Remplace voice-control.js. Actions câblées sur les VRAIES fonctions du site.
   API : window.AT_VOICE
   ══════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
// Détection mobile : sur téléphone, le visualizer (getUserMedia) monopolise le micro
// et empêche la reconnaissance vocale d'entendre → on le désactive sur mobile.
var IS_MOBILE = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent) ||
                (navigator.maxTouchPoints > 1 && window.matchMedia && window.matchMedia('(pointer:coarse)').matches);

/* ─── State ─── */
var state = {
  listening: false,
  wakeEnabled: false,
  muted: (localStorage.getItem('atv-muted') === '1'),
  lang: 'fr-FR',
  lastCmd: null,
  audioCtx: null, analyser: null, micStream: null, rafId: null,
};

/* ─── Petites aides ─── */
function $(id){ return document.getElementById(id); }
function has(fn){ return typeof window[fn] === 'function'; }
function call(fn){ if (has(fn)) { try { window[fn].apply(null, [].slice.call(arguments,1)); return true; } catch(e){} } return false; }
function AP(){ return window.AT_PERSONNALISATION; }
var norm = function(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); };

/* ─── TTS feedback ─── */
function speak(text, priority){
  if (state.muted || !window.speechSynthesis || !text) return;
  var u = new SpeechSynthesisUtterance(text);
  u.lang = state.lang; u.rate = 1.05;
  var voices = speechSynthesis.getVoices();
  var v = voices.find(function(x){ return x.lang && x.lang.indexOf(state.lang.slice(0,2))===0; });
  if (v) u.voice = v;
  if (priority) speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

/* ─── Toast (visuel + vocal) ─── */
var toastTimer = null;
function toast(title, sub, kind){
  var t = $('atvToast');
  t.className = 'atv-toast show' + (kind ? ' atv-'+kind : '');
  t.querySelector('.atv-toast-title').textContent = title;
  var s = t.querySelector('.atv-toast-sub'); s.textContent = sub||''; s.style.display = sub?'block':'none';
  speak(title + (sub? '. '+sub : ''), true);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 3600);
}

/* ─── Statut + transcript ─── */
function setStatus(text, mode){
  var led = $('atvLed'), st = $('atvStatus');
  if (st) st.textContent = text;
  if (led) led.className = 'atv-led' + (mode==='on'?' on':'') + (mode==='wake'?' wake':'');
}
function showTranscript(text){
  var b = $('atvTranscript');
  b.querySelector('.atv-tr-text').textContent = text;
  b.classList.add('visible');
}
function hideTranscript(delay){
  clearTimeout(state._trTimer);
  state._trTimer = setTimeout(function(){ $('atvTranscript').classList.remove('visible'); }, delay==null?2400:delay);
}

/* ─── Visualizer ─── */
function startViz(){
  try{
    if (!state.audioCtx) state.audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    if (state.micStream) return;
    navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
      state.micStream = stream;
      var src = state.audioCtx.createMediaStreamSource(stream);
      state.analyser = state.audioCtx.createAnalyser();
      state.analyser.fftSize = 128;
      src.connect(state.analyser);
      drawViz();
    }).catch(function(){});
  }catch(e){}
}
function stopViz(){
  if (state.rafId) cancelAnimationFrame(state.rafId);
  if (state.micStream){ state.micStream.getTracks().forEach(function(t){t.stop();}); state.micStream=null; }
  var c=$('atvViz'); if(c){ c.getContext('2d').clearRect(0,0,c.width,c.height); }
}
function drawViz(){
  var c=$('atvViz'); if(!c||!state.analyser) return;
  var ctx=c.getContext('2d'), data=new Uint8Array(state.analyser.frequencyBinCount);
  state.analyser.getByteFrequencyData(data);
  var w=c.width, h=c.height, cx=w/2, cy=h/2, rBase=26, bars=42, step=(Math.PI*2)/bars;
  ctx.clearRect(0,0,w,h);
  for (var i=0;i<bars;i++){
    var val=data[i%data.length]/255, r=rBase+val*16, a=i*step-Math.PI/2;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*rBase, cy+Math.sin(a)*rBase);
    ctx.lineTo(cx+Math.cos(a)*r,     cy+Math.sin(a)*r);
    ctx.strokeStyle = state.listening ? 'rgba(16,185,129,'+(0.35+val*0.65)+')' : 'rgba(56,189,248,'+(0.25+val*0.6)+')';
    ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.stroke();
  }
  state.rafId=requestAnimationFrame(drawViz);
}

/* ─── Reconnaissance principale ─── */
var recog = null;
function startListening(){
  if (!SR){ toast('Reconnaissance vocale non supportée', 'Utilisez Chrome ou Edge', 'danger'); return; }
  if (state.listening) return;
  recog = new SR();
  recog.lang = state.lang; recog.interimResults = true; recog.continuous = false; recog.maxAlternatives = 1;
  recog.onresult = function(e){
    var txt = Array.prototype.map.call(e.results, function(r){ return r[0].transcript; }).join('');
    showTranscript('« ' + txt + ' »');
    if (e.results[e.results.length-1].isFinal){ processCommand(txt); }
  };
  recog.onerror = function(ev){ if (ev.error==='not-allowed'||ev.error==='service-not-allowed'){ toast('Micro refusé', 'Autorisez le microphone', 'danger'); } };
  recog.onend = function(){ if (state.listening && !state._stopping){ try{ recog.start(); }catch(e){} } };
  try{ recog.start(); }catch(e){}
  state.listening = true; state._stopping = false;
  $('atvBtn').classList.add('listening');
  setStatus("J'écoute…", 'on');
  showTranscript('Parlez maintenant…');
  if (!IS_MOBILE) startViz(); // sur mobile : pas de getUserMedia (sinon le micro est bloqué pour la reconnaissance)
}
function stopListening(){
  state._stopping = true; state.listening = false;
  if (recog){ try{ recog.abort(); }catch(e){} }
  $('atvBtn').classList.remove('listening','wake');
  setStatus('Micro inactif');
  hideTranscript(0);
  stopViz();
}
function toggleMic(){ state.listening ? stopListening() : startListening(); }

/* ─── Wake-word « ok tech » ─── */
var wakeRecog = null;
function startWake(){
  if (!SR) return;
  wakeRecog = new SR();
  wakeRecog.continuous = true; wakeRecog.interimResults = true; wakeRecog.lang = state.lang;
  wakeRecog.onresult = function(e){
    var t = norm(Array.prototype.map.call(e.results, function(r){ return r[0].transcript; }).join(''));
    if (/ok tech|ok tek|oktech|ok tec/.test(t) && !state.listening){ wakeDetected(); }
  };
  wakeRecog.onerror = function(){ if (state.wakeEnabled) setTimeout(startWake, 700); };
  wakeRecog.onend = function(){ if (state.wakeEnabled && !state.listening) setTimeout(startWake, 350); };
  try{ wakeRecog.start(); }catch(e){}
}
function stopWake(){ if (wakeRecog){ try{ wakeRecog.stop(); }catch(e){} wakeRecog=null; } }
function wakeDetected(){
  $('atvBtn').classList.add('wake');
  showTranscript('« ok tech » détecté — votre commande ?');
  speak('Oui ?', true);
  setTimeout(function(){ startListening(); }, 900);
}
function toggleWake(){
  state.wakeEnabled = !state.wakeEnabled;
  var el = $('atvWakeToggle'); if (el) el.classList.toggle('active', state.wakeEnabled);
  if (state.wakeEnabled){ toast('Wake-word activé', 'Dites « ok tech » puis parlez'); startWake(); }
  else { stopWake(); toast('Wake-word désactivé'); }
}
function toggleMute(){
  state.muted = !state.muted;
  localStorage.setItem('atv-muted', state.muted?'1':'0');
  var el=$('atvMuteToggle'); if(el) el.classList.toggle('active', state.muted);
  toast(state.muted ? 'Voix off' : 'Voix on');
}

/* ═══════════════════ CÂBLAGE DES ACTIONS (vraies fonctions) ═══════════════════ */

var CAT_MAP = {
  'algerie':'Algérie','telecom':'Télécoms','telecoms':'Télécoms','mobile':'Mobile','smartphone':'Mobile',
  'startup':'Startups','startups':'Startups','ia':'IA','intelligence artificielle':'IA','fintech':'Fintech',
  'innovation':'Innovation','internationale':'Internationale','international':'Internationale','monde':'Internationale',
  'entreprise':'Entreprises','entreprises':'Entreprises','video':'Vidéo','vidéo':'Vidéo'
};

function goHome(){ if(!call('goHome')) location.href='/'; }
function goCategory(name){ if(!call('filterByCategory', name)) location.href='/?cat='+encodeURIComponent(name); }
function doSearch(q){
  q=(q||'').trim(); if(!q) return;
  // Recherche plein-texte (corps + brèves) via la fonction dédiée du site
  if (typeof window.atVoiceSearch === 'function'){
    Promise.resolve(window.atVoiceSearch(q)).then(function(n){
      if (n>0) toast('Recherche : '+q, n+' article'+(n>1?'s':'')+' trouvé'+(n>1?'s':''));
      else toast('Aucun résultat', 'Rien pour « '+q+' »', 'warning');
    });
    return;
  }
  // Fallback : barre de recherche du site (titres/extraits/tags)
  var bar=$('atSearch'), input=$('searchInput'), toggle=$('searchToggle');
  if (bar && !bar.classList.contains('open')){ bar.classList.add('open'); if(toggle) toggle.setAttribute('aria-expanded','true'); }
  call('goHome');
  setTimeout(function(){ if(input){ input.value=q; input.dispatchEvent(new Event('input',{bubbles:true})); input.focus(); } }, 320);
  toast('Recherche : '+q);
}
function openSocial(kw){
  var a = document.querySelector('a[href*="'+kw+'.com"]');
  var url = a ? a.href : ('https://www.'+kw+'.com/');
  window.open(url, '_blank', 'noopener');
}
function clickArticleAt(idx){
  var cards = document.querySelectorAll('#homePage [onclick^="openArticle"], .news-card[onclick], [onclick^="openArticle"]');
  if (cards.length && cards[idx]){ cards[idx].click(); return true; }
  return false;
}
function setFontScale(delta){
  var p=AP(); if(!p) return false;
  var v=Math.min(1.4, Math.max(0.85, (p.get('fontScale')||1)+delta));
  p.set('fontScale', v); return true;
}

/* ═══════════════════ PROCESSEUR DE COMMANDES ═══════════════════ */
function processCommand(raw){
  var txt = norm(raw).trim(); if(!txt) return;
  state.lastCmd = txt;

  /* Aide / version */
  if (/\b(aide|commandes|que peux[- ]tu faire|quelles sont mes commandes)\b/.test(txt)){ openHelp(); toast('Aide ouverte', 'Toutes les commandes'); return; }
  if (/\bversion\b/.test(txt)){ toast('Algeria Tech Voice v1.0'); return; }

  /* Stop / pause / reprise */
  if (/\b(stop|arrete|coupe|silence)\b/.test(txt)){ speechSynthesis.cancel(); if(has('premiumTogglePlayPause')&&window.premiumState&&window.premiumState.isPlaying) window.premiumTogglePlayPause(); stopListening(); toast('Arrêt'); return; }
  if (/\b(pause|pause article|pause lecture)\b/.test(txt)){ try{speechSynthesis.pause();}catch(e){} toast('Pause'); return; }
  if (/\b(reprend|reprends|continue|play)\b/.test(txt)){ try{speechSynthesis.resume();}catch(e){} toast('Reprise'); return; }
  if (/\b(mute|coupe le son|couper le son|voix off)\b/.test(txt)){ if(!state.muted) toggleMute(); return; }
  if (/\b(remets le son|voix on|active la voix)\b/.test(txt)){ if(state.muted) toggleMute(); return; }

  /* Accueil / marque */
  if (/\b(accueil|algeria tech|retour accueil|home|page d accueil)\b/.test(txt)){ goHome(); toast('Accueil'); return; }

  /* Catégories */
  var mCat = txt.match(/categorie ([a-z ]+)/);
  if (mCat){ var key=mCat[1].trim(); var name=CAT_MAP[key]||CAT_MAP[key.split(' ')[0]]; if(name){ goCategory(name); toast('Catégorie : '+name); return; } }
  for (var k in CAT_MAP){ if (new RegExp('\\b'+k+'\\b').test(txt)){ goCategory(CAT_MAP[k]); toast('Catégorie : '+CAT_MAP[k]); return; } }

  /* Recherche (sauf si la phrase vise un outil/cible spéciale « ouvre les … ») */
  var mS = txt.match(/\b(ouvre|cherche|trouve|voir|article sur|tous les articles)\s+(.+)/);
  if (mS && !/(preference|parametre|reglage|\bhub\b|menu explorer|recherche|studio|premier article|dernier article)/.test(txt)){ doSearch(mS[2]); return; }

  /* Sections */
  if (/\b(revue de presse|revue)\b/.test(txt)){ toast('Revue de presse'); call('showRevue')||(location.href='/revue-de-presse'); return; }
  if (/\bveille\b/.test(txt)){ toast('Veille'); call('showVeille')||(location.href='/veille'); return; }
  if (/\b(breves?|breve|actus rapides|fil info)\b/.test(txt)){ if(typeof window.atShowBreves==='function'){ var nb=window.atShowBreves(); toast('Brèves', nb+' brève'+(nb>1?'s':'')); } else { toast('Brèves'); } return; }
  if (/\b(operateurs?|hub operateurs|comparateur operateurs|algerie telecom)\b/.test(txt)){ toast('Opérateurs'); location.href='/operateurs'; return; }
  if (/\b(barometre|barometre reseau)\b/.test(txt)){ toast('Baromètre'); location.href='/barometre'; return; }
  if (/\bwiki\b/.test(txt)){ toast('Wiki'); location.href='/wiki'; return; }
  if (/\b(comparateur mobile|comparateur smartphones|comparateur)\b/.test(txt)){ toast('Comparateur mobile'); call('showComparateur')||(location.href='/comparateur'); return; }
  if (/\binfographies?\b/.test(txt)){ toast('Infographies'); location.href='/infographies/index.html'; return; }
  if (/\b(ae tech|auto entrepreneur|guide auto entrepreneur)\b/.test(txt)){ toast('Guide Auto-Entrepreneur'); location.href='/guide-auto-entrepreneur'; return; }
  if (/\b(cv tech|genere un cv|generer un cv)\b/.test(txt)){ toast('CV Tech'); location.href='/cv-tech'; return; }
  if (/\b(actualites tic|reseaux sociaux)\b/.test(txt)){ toast('Actualités TIC'); location.href='/actualites-tic'; return; }
  if (/\b(studio)\b/.test(txt)){ toast('Studio'); location.href='/studio'; return; }
  if (/\b(simulateur fiscal|simulateur)\b/.test(txt)){ toast('Simulateur fiscal'); location.href='/simulateur-fiscal'; return; }
  if (/\b(lexique|glossaire|jargon)\b/.test(txt)){ toast('Lexique'); location.href='/lexique'; return; }
  if (/\bhub|menu explorer\b/.test(txt)){ toast('Hub'); location.href='/hub'; return; }

  /* Langue */
  if (/\b(francais|mode francais)\b/.test(txt)){ state.lang='fr-FR'; if(window.AT_LANG) AT_LANG.set('fr'); toast('Langue : français'); return; }
  if (/\b(anglais|english|mode anglais)\b/.test(txt)){ state.lang='en-US'; if(window.AT_LANG) AT_LANG.set('en'); toast('Langue : anglais'); return; }
  if (/\b(arabe|mode arabe)\b/.test(txt)){ state.lang='ar-SA'; if(window.AT_LANG) AT_LANG.set('ar'); toast('Langue : arabe'); return; }

  /* Thème + accessibilité (via panneau de personnalisation) */
  if (/\b(mode nuit|nuit|sombre|dark)\b/.test(txt)){ AP()?AP().set('theme','dark'):call('toggleTheme'); toast('Mode nuit'); return; }
  if (/\b(mode jour|jour|clair|light)\b/.test(txt)){ AP()?AP().set('theme','light'):call('toggleTheme'); toast('Mode jour'); return; }
  if (/\b(sepia|mode sepia|lecture chaude)\b/.test(txt)){ if(AP()) AP().set('colorTemp',0.5); toast('Lecture chaude (sépia)'); return; }
  if (/\b(contraste|contraste eleve)\b/.test(txt)){ if(AP()) AP().set('contrast', !AP().get('contrast')); toast('Contraste basculé'); return; }
  if (/\bdyslexie\b/.test(txt)){ if(AP()){ AP().applyPreset('dyslexia'); toast('Preset dyslexie'); } else toast('Indisponible'); return; }
  if (/\b(accessibilite)\b/.test(txt)){ if(AP()) AP().applyPreset('a11y'); toast('Mode accessibilité'); return; }
  if (/\b(economie data|masquer images|images off|cache les images)\b/.test(txt)){ if(AP()) AP().set('hideImages',true); toast('Images masquées'); return; }
  if (/\b(montre les images|affiche les images|images on)\b/.test(txt)){ if(AP()) AP().set('hideImages',false); toast('Images affichées'); return; }
  if (/\b(police plus|police \+|agrandis|plus grand|texte plus grand|augmente la police|grossis)\b/.test(txt)){ setFontScale(0.1); toast('Police +'); return; }
  if (/\b(police moins|police -|reduis le texte|reduis la police|plus petit|texte plus petit|diminue la police)\b/.test(txt)){ setFontScale(-0.1); toast('Police -'); return; }
  if (/\b(interligne|aere)\b/.test(txt)){ if(AP()){ var lh=Math.min(2.2,(AP().get('lineHeight')||1.75)+0.15); AP().set('lineHeight',lh); } toast('Interligne +'); return; }
  if (/\b(reduis les animations|arrete le mouvement|moins d animations)\b/.test(txt)){ if(AP()) AP().set('motion',true); toast('Animations réduites'); return; }
  if (/\b(mode focus|focus|mode lecture)\b/.test(txt)){ if(AP()) AP().set('focus', !AP().get('focus')); toast('Mode focus basculé'); return; }
  if (/\b(ouvre les preferences|parametres|preferences|reglages)\b/.test(txt)){ if(AP()) AP().open(); toast('Préférences ouvertes'); return; }
  if (/\breinitialiser\b/.test(txt)){ if(AP()) AP().reset(); toast('Réinitialisation'); return; }
  if (/\b(plein ecran|fullscreen)\b/.test(txt)){ try{ document.documentElement.requestFullscreen(); }catch(e){} toast('Plein écran'); return; }

  /* Actions article */
  if (/\b(ecoute article|lis l article|lecture article|ecoute l article)\b/.test(txt)){ call('premiumTogglePlayer'); toast('Lecture de l\'article'); return; }
  if (/\b(arrete ecoute|stop lecture|arrete la lecture)\b/.test(txt)){ speechSynthesis.cancel(); if(has('premiumTogglePlayPause')&&window.premiumState&&window.premiumState.isPlaying) window.premiumTogglePlayPause(); toast('Lecture arrêtée'); return; }
  if (/\b(plus vite|accelere|plus rapide)\b/.test(txt)){ if(window.premiumState) call('premiumSetSpeed', Math.min(2,(window.premiumState.currentSpeed||1)+0.25)); toast('Vitesse +'); return; }
  if (/\b(mollo|ralentis|ralentir|moins vite)\b/.test(txt)){ if(window.premiumState) call('premiumSetSpeed', Math.max(0.5,(window.premiumState.currentSpeed||1)-0.25)); toast('Vitesse -'); return; }
  if (/\b(synthese|resume l article)\b/.test(txt)){ call('loadSynthese'); toast('Synthèse IA'); return; }
  if (/\b(debattre|debat|debatte)\b/.test(txt)){ call('openDebat'); toast('Débat IA'); return; }
  if (/\b(version legere|lite|version lite)\b/.test(txt)){ var l=document.querySelector('.meta-lite-btn'); if(l){ location.href=l.getAttribute('href'); } toast('Version légère'); return; }
  if (/\bimprimer\b/.test(txt)){ window.print(); toast('Impression'); return; }
  if (/\b(partage|partager)\b/.test(txt)){ var m=txt.match(/\b(facebook|twitter|whatsapp|linkedin)\b/); call('share', m?m[1]:'facebook'); toast('Partage'); return; }
  if (/\b(ouvre le premier article|premier article)\b/.test(txt)){ clickArticleAt(0)?toast('Premier article'):toast('Aucun article'); return; }
  if (/\b(ouvre le dernier article|dernier article)\b/.test(txt)){ var c=document.querySelectorAll('[onclick^="openArticle"]'); clickArticleAt(c.length-1)?toast('Dernier article'):toast('Aucun article'); return; }
  var mN = txt.match(/article numero (\d+)/);
  if (mN){ clickArticleAt(parseInt(mN[1],10)-1)?toast('Article '+mN[1]):toast('Introuvable'); return; }

  /* Réseaux sociaux */
  if (/\bfacebook\b/.test(txt)){ openSocial('facebook'); toast('Facebook'); return; }
  if (/\byoutube\b/.test(txt)){ openSocial('youtube'); toast('YouTube'); return; }
  if (/\blinkedin\b/.test(txt)){ openSocial('linkedin'); toast('LinkedIn'); return; }
  if (/\b(twitter|^x$| x )\b/.test(txt)){ openSocial('twitter'); toast('X / Twitter'); return; }
  if (/\binstagram\b/.test(txt)){ openSocial('instagram'); toast('Instagram'); return; }
  if (/\bwhatsapp\b/.test(txt)){ var w=$('at-wa-fab'); if(w){ w.click(); } toast('WhatsApp'); return; }

  /* Marques / entreprises → recherche */
  var brands = ['ooredoo','mobilis','djezzy','huawei','samsung','apple','nvidia','amd','starlink','meta','google','microsoft','xiaomi','condor'];
  for (var i=0;i<brands.length;i++){ if (txt.indexOf(brands[i])>-1){ doSearch(brands[i]); return; } }

  /* Navigation / scroll */
  if (/\b(haut de page|remonte|tout en haut|top)\b/.test(txt)){ window.scrollTo({top:0,behavior:'smooth'}); toast('Haut de page'); return; }
  if (/\b(bas de page|descends|tout en bas|bottom)\b/.test(txt)){ window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'}); toast('Bas de page'); return; }
  if (/\bscrolle? vers le haut\b/.test(txt)){ window.scrollBy({top:-500,behavior:'smooth'}); return; }
  if (/\bscrolle? vers le bas\b/.test(txt)){ window.scrollBy({top:500,behavior:'smooth'}); return; }
  if (/\b(recharge|rafraichis|actualise)\b/.test(txt)){ toast('Actualisation'); setTimeout(function(){location.reload();},600); return; }
  if (/\bretour\b/.test(txt)){ history.back(); toast('Retour'); return; }
  if (/\b(ferme|ferme le panneau|ferme la modale)\b/.test(txt)){ closeHelp(); if(AP()) AP().close(); toast('Fermé'); return; }

  /* Avancées */
  if (/\brepete\b/.test(txt)){ toast('Rien à répéter'); return; }

  /* Fallback : tout mot/phrase non reconnu → RECHERCHE (comme la barre de recherche).
     Ainsi un visiteur peut dire n'importe quoi (« Ramadan », « 5G », « startup fintech »…). */
  var q = raw.trim();
  if (q.length < 2){ toast('Je n\'ai pas compris', 'Réessayez', 'warning'); return; }
  doSearch(q);
}

/* ═══════════════════ MARKUP + STYLES INJECTÉS ═══════════════════ */
function injectStyles(){
  var css = document.createElement('style');
  css.id='atv-styles';
  css.textContent = ''+
  '#atv-wrap{position:fixed;bottom:158px;right:6px;z-index:9997;width:80px;height:80px;font-family:Inter,system-ui,sans-serif}'+
  '#atvViz{position:absolute;inset:0;width:80px;height:80px;pointer-events:none}'+
  '.atv-btn{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:54px;height:54px;border-radius:50%;border:none;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.3rem;background:linear-gradient(135deg,#ef4444,#b91c1c);box-shadow:0 4px 18px rgba(239,68,68,.5);transition:transform .15s,background .3s}'+
  '.atv-btn:hover{transform:translate(-50%,-50%) scale(1.08)}'+
  '.atv-btn.listening{background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 4px 22px rgba(16,185,129,.6);animation:atvPulse 1.4s infinite}'+
  '.atv-btn.wake{background:linear-gradient(135deg,#38bdf8,#0284c7)}'+
  '@keyframes atvPulse{0%,100%{box-shadow:0 4px 22px rgba(16,185,129,.6)}50%{box-shadow:0 4px 30px rgba(16,185,129,.95)}}'+
  '.atv-status{position:fixed;bottom:242px;right:14px;z-index:9997;background:rgba(12,12,12,.85);color:#fff;font-size:12px;font-weight:600;padding:5px 12px;border-radius:20px;display:flex;align-items:center;gap:7px;backdrop-filter:blur(8px);box-shadow:0 4px 16px rgba(0,0,0,.3)}'+
  '.atv-led{width:9px;height:9px;border-radius:50%;background:#6b7280}'+
  '.atv-led.on{background:#10b981;box-shadow:0 0 8px #10b981}'+
  '.atv-led.wake{background:#38bdf8;box-shadow:0 0 8px #38bdf8}'+
  '.atv-transcript{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(160%);z-index:10004;background:rgba(15,23,42,.95);color:#fff;padding:12px 22px;border-radius:14px;font-size:.95rem;max-width:min(560px,90vw);text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.4);transition:transform .35s cubic-bezier(.34,1.56,.64,1);border:1px solid rgba(56,189,248,.4)}'+
  '.atv-transcript.visible{transform:translateX(-50%) translateY(0)}'+
  '.atv-toast{position:fixed;bottom:302px;right:14px;z-index:10006;background:#11161f;color:#e6e9ef;border-left:4px solid #10b981;padding:11px 16px;border-radius:12px;min-width:180px;max-width:min(300px,86vw);box-shadow:0 8px 30px rgba(0,0,0,.4);transform:translateX(130%);transition:transform .4s cubic-bezier(.34,1.56,.64,1)}'+
  '.atv-toast.show{transform:translateX(0)}'+
  '.atv-toast.atv-danger{border-left-color:#ef4444}.atv-toast.atv-warning{border-left-color:#f59e0b}'+
  '.atv-toast-title{font-weight:700;font-size:.9rem}.atv-toast-sub{font-size:.76rem;color:#9aa3b2;margin-top:2px}'+
  '.atv-help{position:fixed;inset:0;z-index:10010;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;padding:20px;font-family:Inter,system-ui,sans-serif}'+
  '.atv-help.open{display:flex}'+
  '.atv-help-card{background:#0f141c;color:#e6e9ef;border:1px solid rgba(255,255,255,.1);border-radius:18px;width:min(860px,100%);max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5)}'+
  '.atv-help-head{display:flex;align-items:center;gap:12px;padding:18px 22px;border-bottom:1px solid rgba(255,255,255,.08)}'+
  '.atv-help-head h2{margin:0;font-size:1.15rem;flex:1}'+
  '.atv-help-head .ic{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#10b981,#38bdf8);display:grid;place-items:center;font-size:1.1rem}'+
  '.atv-help-close{background:rgba(255,255,255,.06);border:none;color:#e6e9ef;width:34px;height:34px;border-radius:9px;font-size:1.2rem;cursor:pointer}'+
  '.atv-help-body{padding:16px 22px 22px;overflow-y:auto}'+
  '.atv-help-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}'+
  '.atv-help-sec{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:13px 15px}'+
  '.atv-help-sec h3{margin:0 0 8px;font-size:.78rem;color:#34d399;text-transform:uppercase;letter-spacing:.5px}'+
  '.atv-help-sec ul{margin:0;padding-left:16px}.atv-help-sec li{font-size:.82rem;color:#9aa3b2;margin-bottom:3px}'+
  '.atv-help-foot{display:flex;gap:10px;flex-wrap:wrap;padding:14px 22px;border-top:1px solid rgba(255,255,255,.08)}'+
  '.atv-tog{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:8px 12px;font-size:.82rem;cursor:pointer;color:#9aa3b2}'+
  '.atv-tog.active{color:#e6e9ef;border-color:#10b981}'+
  '.atv-tog .box{width:16px;height:16px;border-radius:4px;border:2px solid #6b7280;display:grid;place-items:center;font-size:11px}'+
  '.atv-tog.active .box{background:#10b981;border-color:#10b981;color:#04120b}'+
  '@media(max-width:480px){#atv-wrap{bottom:150px;right:2px}.atv-status{bottom:232px}.atv-toast{bottom:290px}}';
  document.head.appendChild(css);
}

function injectMarkup(){
  var wrap=document.createElement('div');
  wrap.innerHTML =
    '<div id="atv-wrap"><canvas id="atvViz" width="80" height="80"></canvas>'+
    '<button class="atv-btn" id="atvBtn" title="Assistant vocal (Ctrl+Espace)" aria-label="Assistant vocal"><i class="fas fa-microphone"></i></button></div>'+
    '<div class="atv-status"><span class="atv-led" id="atvLed"></span><span id="atvStatus">Micro inactif</span></div>'+
    '<div class="atv-transcript" id="atvTranscript"><span class="atv-tr-text"></span></div>'+
    '<div class="atv-toast" id="atvToast"><div class="atv-toast-title"></div><div class="atv-toast-sub"></div></div>'+
    '<div class="atv-help" id="atvHelp"><div class="atv-help-card">'+
      '<div class="atv-help-head"><span class="ic">🎙️</span><h2>Commandes vocales</h2><button class="atv-help-close" id="atvHelpClose">×</button></div>'+
      '<div class="atv-help-body"><div class="atv-help-grid" id="atvHelpGrid"></div></div>'+
      '<div class="atv-help-foot">'+
        '<div class="atv-tog active" id="atvMuteToggle"><span class="box">✓</span> Voix de confirmation</div>'+
        '<div class="atv-tog" id="atvWakeToggle"><span class="box">✓</span> Wake-word « ok tech »</div>'+
      '</div>'+
    '</div></div>';
  while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
}

/* ─── Panneau d'aide ─── */
function openHelp(){ renderHelp(); $('atvHelp').classList.add('open'); }
function closeHelp(){ $('atvHelp').classList.remove('open'); }
function renderHelp(){
  var sec=[
    {t:'Navigation',i:['Accueil','Catégorie [Algérie, Mobile, IA…]','Revue de presse','Veille','Opérateurs','Baromètre','Wiki']},
    {t:'Recherche',i:['Cherche [terme]','Ouvre [terme]','Article sur [terme]','Ooredoo, Mobilis, Djezzy…','Samsung, Apple, Huawei…']},
    {t:'Article ouvert',i:['Écoute article','Pause / Reprends','Plus vite / Ralentis','Synthèse','Débattre','Version légère','Imprimer','Partage']},
    {t:'Accessibilité',i:['Mode focus','Police + / Police -','Interligne','Contraste','Dyslexie','Masquer images','Réduis les animations','Préférences']},
    {t:'Pages',i:['Comparateur mobile','Infographies','AE Tech','CV Tech','Actualités TIC','Simulateur','Lexique']},
    {t:'Réseaux',i:['Facebook','YouTube','LinkedIn','X / Twitter','Instagram','WhatsApp']},
    {t:'Scroll',i:['Haut de page','Bas de page','Scrolle vers le haut/bas','Recharge','Retour','Ferme']},
    {t:'Langue & Thème',i:['Français / Anglais / Arabe','Mode nuit / jour','Sépia']},
    {t:'Assistant',i:['Aide','Wake-word « ok tech »','Voix off / on','Article numéro N','Premier / dernier article']},
  ];
  $('atvHelpGrid').innerHTML = sec.map(function(s){
    return '<div class="atv-help-sec"><h3>'+s.t+'</h3><ul>'+s.i.map(function(x){return '<li>'+x+'</li>';}).join('')+'</ul></div>';
  }).join('');
}

/* ─── Init ─── */
function init(){
  injectStyles();
  injectMarkup();
  $('atvBtn').addEventListener('click', toggleMic);
  $('atvHelpClose').addEventListener('click', closeHelp);
  $('atvHelp').addEventListener('click', function(e){ if(e.target===$('atvHelp')) closeHelp(); });
  $('atvMuteToggle').addEventListener('click', toggleMute);
  $('atvWakeToggle').addEventListener('click', toggleWake);
  if (state.muted) $('atvMuteToggle').classList.remove('active');
  document.addEventListener('keydown', function(e){
    if (e.code==='Space' && e.ctrlKey){ e.preventDefault(); toggleMic(); }
    if (e.key==='Escape'){ closeHelp(); }
  });
  if (window.AT_LANG){ var c=(typeof AT_LANG.current==='function')?AT_LANG.current():AT_LANG.current; if(c==='ar') state.lang='ar-SA'; else if(c==='en') state.lang='en-US'; }
  speechSynthesis && speechSynthesis.getVoices();
  window.AT_VOICE = { processCommand:processCommand, start:startListening, stop:stopListening, toggleMic:toggleMic, openHelp:openHelp, toggleWake:toggleWake, toggleMute:toggleMute, state:state };
  console.log('%c🎙️ AT Voice Mega v1.0 chargé (~130 commandes)', 'color:#10b981;font-weight:bold');
}

if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
