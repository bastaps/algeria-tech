'use strict';
/* ══════════════════════════════════════════════════════════════
   COMPARATEUR v3 — Algeria Tech "Flash Edition"
   Battle View · Mode Duel · Score Ring · Profils Usage
   Données officielles — Juin 2026
══════════════════════════════════════════════════════════════ */

/* ── CSS injection ─────────────────────────────────────────── */
(function(){
  if(document.getElementById('cv3-css'))return;
  var s=document.createElement('style');s.id='cv3-css';
  s.textContent=`
.cv3{background:#080810;color:#e2e8f0;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;min-height:100vh}
.cv3 *{box-sizing:border-box;margin:0;padding:0}
/* HERO */
.cv3-hero{position:relative;padding:20px 24px 24px;text-align:center;overflow:hidden;background:linear-gradient(180deg,#08080f 0%,#0f0f22 100%)}
.cv3-hbg{position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 15% 50%,rgba(41,121,255,.22) 0%,transparent 65%),radial-gradient(ellipse 70% 60% at 85% 50%,rgba(170,0,255,.22) 0%,transparent 65%),radial-gradient(ellipse 50% 50% at 50% 100%,rgba(255,23,68,.18) 0%,transparent 65%);animation:cv3-pulse 6s ease-in-out infinite}
@keyframes cv3-pulse{0%,100%{opacity:.7}50%{opacity:1}}
.cv3-hcontent{position:relative;z-index:1}
.cv3-htitle{font-size:clamp(1.05rem,2.5vw,1.6rem);font-weight:900;letter-spacing:-0.5px;background:linear-gradient(90deg,#60a5fa,#c084fc,#f87171,#60a5fa);background-size:300%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:cv3-shimmer 4s linear infinite;margin-bottom:3px}
@keyframes cv3-shimmer{0%{background-position:0%}100%{background-position:300%}}
.cv3-hsub{color:rgba(255,255,255,.5);font-size:.78rem;margin-bottom:13px}
.cv3-logos{display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap}
.cv3-logowrap{display:flex;flex-direction:column;align-items:center;gap:6px;animation:cv3-float 3s ease-in-out infinite;cursor:pointer;transition:filter .3s,opacity .3s}
.cv3-logowrap:nth-child(3){animation-delay:.8s}
.cv3-logowrap:nth-child(5){animation-delay:1.6s}
@keyframes cv3-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.cv3-logowrap:hover .cv3-opball{transform:scale(1.12);box-shadow:0 0 40px var(--oc),0 0 80px rgba(var(--oc-rgb),.4)}
.cv3-logowrap.solo .cv3-opball{box-shadow:0 0 50px var(--oc),0 0 100px rgba(var(--oc-rgb),.5),0 0 0 3px rgba(255,255,255,.6)!important;transform:scale(1.15)}
.cv3-logowrap.solo .cv3-opball-name{font-weight:900;opacity:1}
.cv3-logowrap.dimmed{opacity:.3;filter:grayscale(.8)}
.cv3-opball{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.78rem;color:#fff;background:var(--oc);position:relative;box-shadow:0 0 22px var(--oc),0 0 44px rgba(0,0,0,.5);transition:transform .25s,box-shadow .25s}
.cv3-opball::after{content:'';position:absolute;inset:-4px;border-radius:50%;border:2px solid var(--oc);opacity:.5;animation:cv3-ring 2s ease-in-out infinite}
@keyframes cv3-ring{0%,100%{transform:scale(1);opacity:.4}50%{transform:scale(1.1);opacity:.9}}
.cv3-opball-name{font-size:.65rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--oc)}
.cv3-vs{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-weight:900;font-size:.95rem;display:flex;align-items:center;justify-content:center;box-shadow:0 0 18px rgba(255,200,0,.6);animation:cv3-vs 1.5s ease-in-out infinite;flex-shrink:0}
@keyframes cv3-vs{0%,100%{transform:scale(1);box-shadow:0 0 18px rgba(255,200,0,.5)}50%{transform:scale(1.18);box-shadow:0 0 36px rgba(255,200,0,.9)}}
.cv3-strip{display:flex;justify-content:center;gap:24px;margin-top:13px;flex-wrap:wrap}
.cv3-snum{font-size:1.35rem;font-weight:900;color:#60a5fa;line-height:1}
.cv3-slbl{font-size:.6rem;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.3);margin-top:2px}
/* PROFILES */
.cv3-profiles{background:#0c0c1a;border-bottom:1px solid rgba(255,255,255,.07);padding:15px 24px;display:flex;gap:9px;overflow-x:auto;scrollbar-width:none;align-items:center}
.cv3-profiles::-webkit-scrollbar{display:none}
.cv3-plbl{font-size:.62rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.28);white-space:nowrap;flex-shrink:0}
.cv3-profile{padding:8px 16px;border-radius:40px;border:1.5px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:rgba(255,255,255,.6);font-size:.8rem;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:all .25s;display:flex;align-items:center;gap:6px}
.cv3-profile:hover{border-color:#60a5fa;background:rgba(96,165,250,.12);color:#60a5fa;transform:translateY(-2px)}
.cv3-profile.active{border-color:#60a5fa;background:rgba(96,165,250,.18);color:#60a5fa;box-shadow:0 0 18px rgba(96,165,250,.2)}
/* LAYOUT */
.cv3-layout{display:grid;grid-template-columns:256px 1fr;min-height:60vh}
@media(max-width:900px){.cv3-layout{grid-template-columns:1fr}}
/* SIDEBAR */
.cv3-sidebar{background:#0a0a16;border-right:1px solid rgba(255,255,255,.06);padding:22px 16px;position:sticky;top:0;height:100vh;overflow-y:auto;scrollbar-width:thin}
.cv3-sidebar::-webkit-scrollbar{width:3px}
.cv3-sidebar::-webkit-scrollbar-thumb{background:rgba(255,255,255,.09);border-radius:2px}
.cv3-ssec{margin-bottom:24px}
.cv3-slab{font-size:.62rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.28);margin-bottom:9px;display:flex;align-items:center;gap:5px}
.cv3-vtoggle{display:flex;background:rgba(255,255,255,.05);border-radius:10px;padding:3px;gap:3px}
.cv3-vbtn{flex:1;padding:8px 6px;border-radius:7px;border:none;background:transparent;color:rgba(255,255,255,.38);font-size:.73rem;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:4px}
.cv3-vbtn.on{background:rgba(96,165,250,.18);color:#60a5fa}
.cv3-oplist{display:flex;flex-direction:column;gap:6px}
.cv3-opchk{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:10px;border:1px solid rgba(255,255,255,.08);cursor:pointer;transition:all .2s;background:rgba(255,255,255,.02)}
.cv3-opchk:hover{background:rgba(255,255,255,.05)}
.cv3-opchk.on{border-color:var(--oc);background:rgba(var(--oc-rgb),.1)}
.cv3-opdot{width:8px;height:8px;border-radius:50%;background:var(--oc);box-shadow:0 0 5px var(--oc);flex-shrink:0}
.cv3-opchk-name{flex:1;font-size:.82rem;font-weight:600}
.cv3-opchk-n{font-size:.68rem;color:rgba(255,255,255,.35);background:rgba(255,255,255,.07);padding:2px 7px;border-radius:10px}
.cv3-pills{display:flex;flex-direction:column;gap:5px}
.cv3-pill{padding:8px 11px;border-radius:9px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);color:rgba(255,255,255,.48);font-size:.78rem;cursor:pointer;text-align:left;transition:all .2s;display:flex;justify-content:space-between;align-items:center}
.cv3-pill:hover{border-color:rgba(96,165,250,.3);color:rgba(255,255,255,.8)}
.cv3-pill.on{border-color:#60a5fa;background:rgba(96,165,250,.12);color:#60a5fa;font-weight:600}
.cv3-pdot{width:5px;height:5px;border-radius:50%;background:#60a5fa;display:none}
.cv3-pill.on .cv3-pdot{display:block}
.cv3-sort{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:9px;color:rgba(255,255,255,.65);padding:9px 11px;font-size:.78rem;cursor:pointer;appearance:none;outline:none}
.cv3-lstats{background:rgba(255,255,255,.03);border-radius:11px;padding:13px}
.cv3-lsrow{display:flex;justify-content:space-between;font-size:.73rem;color:rgba(255,255,255,.38);padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.cv3-lsrow:last-child{border-bottom:none}
.cv3-lsval{color:#60a5fa;font-weight:700}
.cv3-updated{font-size:.67rem;color:rgba(255,255,255,.18);text-align:center;margin-top:18px}
.cv3-updated em{color:#4ade80;font-style:normal}
/* MAIN */
.cv3-main{background:#080810;padding:20px}
.cv3-modebar{display:flex;gap:8px;margin-bottom:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:13px;padding:5px}
.cv3-modebtn{flex:1;padding:11px 14px;border-radius:9px;border:none;background:transparent;color:rgba(255,255,255,.5);font-size:.86rem;font-weight:700;cursor:pointer;transition:all .2s;letter-spacing:.2px}
.cv3-modebtn:hover{color:rgba(255,255,255,.85)}
.cv3-modebtn.on{background:linear-gradient(135deg,#2979ff,#7b2ff7);color:#fff;box-shadow:0 4px 18px rgba(41,121,255,.35)}
.cv3.cv3-day .cv3-modebar{background:rgba(0,0,0,.04);border-color:rgba(0,0,0,.1)}
.cv3.cv3-day .cv3-modebtn{color:rgba(0,0,0,.5)}
.cv3-rhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:10px;flex-wrap:wrap}
.cv3-cnt{font-size:.8rem;color:rgba(255,255,255,.38)}
.cv3-cnt strong{color:#fff;font-size:1.3rem;margin-right:4px}
/* GRID */
.cv3-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(288px,1fr));gap:17px}
/* BATTLE */
.cv3-battle{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;align-items:start}
@media(max-width:860px){.cv3-battle{grid-template-columns:1fr}}
.cv3-bcol{border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.07)}
.cv3-bcolhead{padding:15px 17px;display:flex;align-items:center;gap:9px;background:var(--oc)}
.cv3-bcoldot{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.5)}
.cv3-bcolname{font-weight:900;font-size:1rem;color:#fff}
.cv3-bcolct{font-size:.7rem;color:rgba(255,255,255,.55);margin-left:auto;background:rgba(0,0,0,.25);padding:2px 8px;border-radius:10px}
.cv3-bcolbody{padding:10px;background:rgba(0,0,0,.4);display:flex;flex-direction:column;gap:10px}
/* CARD */
.cv3-card{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden;position:relative;transition:transform .3s cubic-bezier(.4,0,.2,1),box-shadow .3s,border-color .3s;animation:cv3-cin .4s ease both}
.cv3-card:hover{transform:translateY(-4px);border-color:var(--oc);box-shadow:0 16px 48px rgba(0,0,0,.6),0 0 0 1px var(--oc),0 0 32px rgba(var(--oc-rgb),.15)}
.cv3-card.sel{border-color:#ffd700 !important;box-shadow:0 0 0 2px #ffd700,0 0 28px rgba(255,215,0,.25) !important}
@keyframes cv3-cin{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.cv3-cglow{position:absolute;top:0;left:0;right:0;height:110px;background:radial-gradient(ellipse at 50% 0%,rgba(var(--oc-rgb),.1) 0%,transparent 70%);pointer-events:none}
.cv3-cbar{height:3px;background:var(--oc)}
/* Card head */
.cv3-ch{padding:13px 13px 9px;display:flex;align-items:flex-start;justify-content:space-between;position:relative}
.cv3-chopname{font-size:.65rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--oc);display:flex;align-items:center;gap:6px}
.cv3-chdot{width:6px;height:6px;border-radius:50%;background:var(--oc);box-shadow:0 0 5px var(--oc)}
.cv3-badges{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.cv3-b{padding:3px 8px;border-radius:20px;font-size:.62rem;font-weight:700;letter-spacing:.5px;white-space:nowrap}
.cv3-b-star{background:linear-gradient(90deg,#ffd700,#ff8c00);color:#000}
.cv3-b-pop{background:rgba(96,165,250,.15);color:#60a5fa;border:1px solid rgba(96,165,250,.25)}
.cv3-b-val{background:rgba(74,222,128,.15);color:#4ade80;border:1px solid rgba(74,222,128,.25)}
.cv3-b-sel{background:rgba(255,215,0,.15);color:#ffd700;border:1px solid rgba(255,215,0,.3)}
.cv3-cname{padding:0 13px 4px;font-size:.93rem;font-weight:700;color:rgba(255,255,255,.9)}
.cv3-cpricerow{padding:2px 13px 9px;display:flex;align-items:baseline;gap:4px}
.cv3-cprice{font-size:2rem;font-weight:900;color:var(--oc);line-height:1}
.cv3-ccur{font-size:.83rem;font-weight:700;color:var(--oc);opacity:.8}
.cv3-cvalid{font-size:.68rem;color:rgba(255,255,255,.28);margin-left:auto}
/* PPG */
.cv3-ppg{margin:0 13px 9px;padding:6px 10px;background:rgba(255,255,255,.04);border-radius:8px;display:flex;justify-content:space-between;align-items:center}
.cv3-ppg-l{font-size:.7rem;color:rgba(255,255,255,.32)}
.cv3-ppg-v{font-size:.83rem;font-weight:700}
/* Data bar */
.cv3-dbwrap{padding:0 13px 9px}
.cv3-dbrow{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
.cv3-dbdata{font-size:1.35rem;font-weight:900;color:#fff}
.cv3-dbunit{font-size:.72rem;color:rgba(255,255,255,.35);margin-left:3px}
.cv3-dblbl{font-size:.68rem;color:rgba(255,255,255,.3)}
.cv3-db{height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden}
.cv3-dbfill{height:100%;background:var(--oc);border-radius:3px;transition:width .85s cubic-bezier(.4,0,.2,1);width:0}
/* Specs */
.cv3-specs{padding:0 13px 9px;display:flex;flex-direction:column;gap:5px}
.cv3-spec{display:flex;align-items:flex-start;gap:6px;font-size:.77rem;line-height:1.35}
.cv3-spec-i{color:var(--oc);opacity:.7;flex-shrink:0;margin-top:1px}
.cv3-spec-v{color:rgba(255,255,255,.65)}
/* Extras */
.cv3-extras{padding:0 13px 11px;display:flex;flex-wrap:wrap;gap:5px}
.cv3-etag{padding:3px 7px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:6px;font-size:.64rem;color:rgba(255,255,255,.42)}
/* Score */
.cv3-score{padding:9px 13px;border-top:1px solid rgba(255,255,255,.05);display:flex;align-items:center;gap:9px}
.cv3-sring{position:relative;width:40px;height:40px;flex-shrink:0}
.cv3-sring svg{transform:rotate(-90deg)}
.cv3-srnum{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:.58rem;font-weight:900;color:var(--oc)}
.cv3-sinfo{flex:1;min-width:0}
.cv3-slbl2{font-size:.66rem;color:rgba(255,255,255,.32);margin-bottom:3px}
.cv3-sbar{height:4px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden}
.cv3-sbarfill{height:100%;border-radius:2px;background:var(--oc);transition:width .9s cubic-bezier(.4,0,.2,1);width:0}
/* Actions */
.cv3-actions{padding:0 13px 13px;display:flex;gap:7px}
.cv3-btncta{flex:1;padding:10px;border-radius:9px;border:none;background:var(--oc);color:#fff;font-weight:700;font-size:.77rem;cursor:pointer;text-decoration:none;text-align:center;transition:opacity .2s,transform .15s;display:flex;align-items:center;justify-content:center;gap:4px}
.cv3-btncta:hover{opacity:.82;transform:translateY(-1px)}
.cv3-btnduel{padding:10px 11px;border-radius:9px;border:1.5px solid rgba(255,255,255,.11);background:transparent;color:rgba(255,255,255,.42);font-size:.7rem;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap}
.cv3-btnduel:hover,.cv3-btnduel.on{border-color:#ffd700;color:#ffd700;background:rgba(255,215,0,.07)}
/* TRAY */
.cv3-tray{position:fixed;bottom:0;left:0;right:0;background:rgba(6,6,18,.97);backdrop-filter:blur(20px);border-top:1px solid rgba(255,215,0,.22);padding:11px 22px;display:flex;align-items:center;gap:13px;z-index:999;transform:translateY(100%);transition:transform .35s cubic-bezier(.4,0,.2,1)}
.cv3-tray.show{transform:translateY(0)}
.cv3-traylbl{font-size:.76rem;color:rgba(255,255,255,.45);flex-shrink:0;white-space:nowrap}
.cv3-trayslots{display:flex;gap:7px;flex:1;overflow:hidden}
.cv3-trayslot{padding:5px 13px;border-radius:20px;font-size:.73rem;font-weight:600;white-space:nowrap;border:1px solid rgba(255,215,0,.3);background:rgba(255,215,0,.07);color:#ffd700}
.cv3-trayempty{padding:5px 13px;border-radius:20px;font-size:.73rem;color:rgba(255,255,255,.2);border:1px dashed rgba(255,255,255,.1)}
.cv3-traybtn{padding:9px 20px;border-radius:9px;border:none;background:linear-gradient(90deg,#ffd700,#ff8c00);color:#000;font-weight:900;font-size:.8rem;cursor:pointer;flex-shrink:0;transition:all .2s}
.cv3-traybtn:hover{opacity:.84;transform:translateY(-1px)}
.cv3-traybtn:disabled{opacity:.35;cursor:not-allowed;transform:none}
.cv3-trayclear{background:none;border:none;color:rgba(255,255,255,.22);cursor:pointer;font-size:.76rem;flex-shrink:0}
.cv3-trayclear:hover{color:rgba(255,255,255,.5)}
/* MODAL */
.cv3-overlay{position:fixed;inset:0;background:rgba(0,0,0,.88);backdrop-filter:blur(12px);z-index:2000;display:flex;align-items:center;justify-content:center;padding:18px;animation:cv3-fin .3s ease}
@keyframes cv3-fin{from{opacity:0}to{opacity:1}}
.cv3-modal{background:#111120;border:1px solid rgba(255,255,255,.1);border-radius:22px;max-width:840px;width:100%;max-height:88vh;overflow-y:auto;animation:cv3-sup .3s ease}
@keyframes cv3-sup{from{transform:translateY(22px);opacity:0}to{transform:translateY(0);opacity:1}}
.cv3-mhead{padding:20px 24px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#111120;z-index:1}
.cv3-mtitle{font-size:1.1rem;font-weight:900;background:linear-gradient(90deg,#ffd700,#ff8c00);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.cv3-mclose{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.07);border:none;color:rgba(255,255,255,.5);font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}
.cv3-mclose:hover{background:rgba(255,255,255,.14);color:#fff}
.cv3-winner{margin:18px 24px;padding:16px 18px;border-radius:14px;background:linear-gradient(135deg,rgba(255,215,0,.07),rgba(255,140,0,.07));border:1px solid rgba(255,215,0,.22);display:flex;align-items:center;gap:14px}
.cv3-wcrown{font-size:2.2rem;animation:cv3-bounce 1s ease-in-out infinite;flex-shrink:0}
@keyframes cv3-bounce{0%,100%{transform:translateY(0) rotate(-8deg)}50%{transform:translateY(-8px) rotate(8deg)}}
.cv3-wh{font-size:.98rem;font-weight:900;color:#ffd700;margin-bottom:4px}
.cv3-wp{font-size:.76rem;color:rgba(255,255,255,.42)}
.cv3-ctable{padding:0 24px 24px}
.cv3-crow{display:grid;gap:9px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.cv3-crow-lbl{font-size:.73rem;color:rgba(255,255,255,.33);display:flex;align-items:center;gap:5px}
.cv3-ccell{text-align:center;padding:8px 6px;border-radius:8px;font-size:.8rem;color:rgba(255,255,255,.65)}
.cv3-ccell.w{background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.2);color:#4ade80;font-weight:700}
.cv3-ccell.l{opacity:.4}
.cv3-colhead{text-align:center;padding:13px 8px;border-radius:11px}
.cv3-colopname{font-weight:900;font-size:.85rem;color:#fff}
.cv3-colplan{font-size:.68rem;color:rgba(255,255,255,.45);margin-top:2px}
.cv3-colprice{font-size:1.35rem;font-weight:900;margin-top:5px}
/* EMPTY */
.cv3-empty{text-align:center;padding:64px 20px;color:rgba(255,255,255,.22)}
.cv3-emico{font-size:2.8rem;margin-bottom:14px}
/* DISCLAIMER */
.cv3-disc{padding:16px 22px;font-size:.67rem;color:rgba(255,255,255,.17);border-top:1px solid rgba(255,255,255,.05);line-height:1.7}
/* TITRE CLIQUABLE */
.cv3-htitle{cursor:pointer}
.cv3-htitle:hover{opacity:.75}
/* BALLE OPÉRATEUR — dégradé de marque */
.cv3-opball{background:var(--oc-grad,var(--oc))}
/* BADGE NOUVEAU */
.cv3-b-new{background:linear-gradient(90deg,#00BCD4,#00E5FF);color:#003;animation:cv3-newpulse 2s ease-in-out infinite}
@keyframes cv3-newpulse{0%,100%{box-shadow:0 0 0 0 rgba(0,229,255,.5)}60%{box-shadow:0 0 0 7px rgba(0,229,255,0)}}
/* BANNIÈRE NOUVEAUTÉS */
.cv3-newbanner{margin-bottom:16px;padding:12px 18px;border-radius:13px;background:linear-gradient(90deg,rgba(0,188,212,.08),rgba(0,229,255,.04));border:1px solid rgba(0,229,255,.18);display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.cv3-newbanner-ico{font-size:1.5rem;flex-shrink:0;animation:cv3-newpulse 2s ease-in-out infinite}
.cv3-newbanner-txt{flex:1}
.cv3-newbanner-h{font-size:.85rem;font-weight:700;color:#00E5FF;margin-bottom:3px}
.cv3-newbanner-ops{display:flex;gap:7px;flex-wrap:wrap}
.cv3-newbanner-op{padding:3px 10px;border-radius:20px;font-size:.68rem;font-weight:600;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05)}
.cv3-newbanner-btn{padding:7px 15px;border-radius:8px;border:none;background:rgba(0,229,255,.15);color:#00E5FF;font-size:.75rem;font-weight:700;cursor:pointer;border:1px solid rgba(0,229,255,.25);transition:all .2s;flex-shrink:0}
.cv3-newbanner-btn:hover{background:rgba(0,229,255,.28)}
/* SOLO MODE */
.cv3-solo{animation:cv3-cin .35s ease both}
.cv3-solo-banner{padding:22px 24px;border-radius:16px;margin-bottom:18px;position:relative;overflow:hidden;display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.cv3-solo-shimmer{position:absolute;top:-60%;left:-30%;width:160%;height:220%;background:conic-gradient(from 180deg,transparent 70%,rgba(255,255,255,.07) 80%,transparent 90%);animation:cv3-spin 6s linear infinite;pointer-events:none}
@keyframes cv3-spin{to{transform:rotate(360deg)}}
.cv3-solo-sigle{width:78px;height:78px;border-radius:50%;border:3px solid rgba(255,255,255,.4);background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 24px rgba(0,0,0,.4)}
.cv3-solo-info{flex:1;min-width:200px}
.cv3-solo-name{font-size:1.8rem;font-weight:900;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.4)}
.cv3-solo-sub{font-size:.78rem;color:rgba(255,255,255,.55);margin-top:3px}
.cv3-solo-kpis{display:flex;gap:14px;margin-top:13px;flex-wrap:wrap}
.cv3-solo-kpi{background:rgba(0,0,0,.3);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.12);padding:9px 16px;border-radius:12px;text-align:center;min-width:80px}
.cv3-solo-kpi-v{font-size:1.3rem;font-weight:900;color:#fff}
.cv3-solo-kpi-l{font-size:.58rem;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.45);margin-top:2px}
.cv3-solo-back{padding:9px 18px;border-radius:10px;border:1.5px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;font-size:.78rem;font-weight:700;cursor:pointer;transition:all .22s;flex-shrink:0;align-self:flex-start}
.cv3-solo-back:hover{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.6)}
.cv3-solo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:17px}
@media(max-width:860px){.cv3-layout{grid-template-columns:1fr}.cv3-sidebar{position:static;height:auto}.cv3-battle{grid-template-columns:1fr}}
.cv3-daybtn{position:absolute;top:14px;right:16px;z-index:10;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:40px;padding:6px 14px;color:rgba(255,255,255,.85);font-size:.8rem;font-weight:600;cursor:pointer;transition:all .2s;backdrop-filter:blur(8px);display:flex;align-items:center;gap:5px}
.cv3-daybtn:hover{background:rgba(255,255,255,.22);color:#fff}
.cv3.cv3-day{background:#f0f2f5;color:#1a1a2e}
.cv3.cv3-day .cv3-hero{background:linear-gradient(180deg,#e4eaf8 0%,#eef1ff 100%)}
.cv3.cv3-day .cv3-hbg{background:radial-gradient(ellipse 70% 60% at 15% 50%,rgba(41,121,255,.1) 0%,transparent 65%),radial-gradient(ellipse 70% 60% at 85% 50%,rgba(170,0,255,.1) 0%,transparent 65%)}
.cv3.cv3-day .cv3-hsub{color:rgba(0,0,0,.55)}
.cv3.cv3-day .cv3-snum{color:#1565C0}
.cv3.cv3-day .cv3-slbl{color:rgba(0,0,0,.42)}
.cv3.cv3-day .cv3-daybtn{background:rgba(0,0,0,.08);border-color:rgba(0,0,0,.15);color:rgba(0,0,0,.7)}
.cv3.cv3-day .cv3-daybtn:hover{background:rgba(0,0,0,.14);color:#1a1a2e}
.cv3.cv3-day .cv3-profiles{background:#e8ecf5;border-bottom-color:rgba(0,0,0,.07)}
.cv3.cv3-day .cv3-plbl{color:rgba(0,0,0,.4)}
.cv3.cv3-day .cv3-profile{border-color:rgba(0,0,0,.12);background:rgba(255,255,255,.8);color:#555}
.cv3.cv3-day .cv3-profile:hover{border-color:#1565C0;background:rgba(21,101,192,.08);color:#1565C0}
.cv3.cv3-day .cv3-sidebar{background:#f5f7fb;border-right-color:rgba(0,0,0,.08)}
.cv3.cv3-day .cv3-slab{color:rgba(0,0,0,.42)}
.cv3.cv3-day .cv3-vtoggle{background:rgba(0,0,0,.06)}
.cv3.cv3-day .cv3-vbtn{color:rgba(0,0,0,.4)}
.cv3.cv3-day .cv3-vbtn.on{background:rgba(21,101,192,.12);color:#1565C0}
.cv3.cv3-day .cv3-opchk{border-color:rgba(0,0,0,.1);background:rgba(255,255,255,.8)}
.cv3.cv3-day .cv3-opchk:hover{background:#fff}
.cv3.cv3-day .cv3-opchk-name{color:#1a1a2e}
.cv3.cv3-day .cv3-opchk-n{color:rgba(0,0,0,.42);background:rgba(0,0,0,.06)}
.cv3.cv3-day .cv3-pill{border-color:rgba(0,0,0,.1);background:rgba(255,255,255,.8);color:rgba(0,0,0,.55)}
.cv3.cv3-day .cv3-pill:hover{border-color:rgba(21,101,192,.4);color:#1a1a2e}
.cv3.cv3-day .cv3-pill.on{border-color:#1565C0;background:rgba(21,101,192,.1);color:#1565C0}
.cv3.cv3-day .cv3-sort{background:rgba(255,255,255,.9);border-color:rgba(0,0,0,.12);color:#1a1a2e}
.cv3.cv3-day .cv3-lstats{background:rgba(0,0,0,.04)}
.cv3.cv3-day .cv3-lsrow{color:rgba(0,0,0,.42);border-bottom-color:rgba(0,0,0,.05)}
.cv3.cv3-day .cv3-lsval{color:#1565C0}
.cv3.cv3-day .cv3-updated{color:rgba(0,0,0,.28)}
.cv3.cv3-day .cv3-main{background:#f0f2f5}
.cv3.cv3-day .cv3-cnt{color:rgba(0,0,0,.45)}
.cv3.cv3-day .cv3-cnt strong{color:#1a1a2e}
.cv3.cv3-day .cv3-card{background:#fff;border-color:rgba(0,0,0,.09);box-shadow:0 3px 14px rgba(0,0,0,.08)}
.cv3.cv3-day .cv3-card:hover{box-shadow:0 10px 32px rgba(0,0,0,.14);border-color:var(--oc)}
.cv3.cv3-day .cv3-cname{color:#1a1a2e}
.cv3.cv3-day .cv3-cvalid{color:rgba(0,0,0,.38)}
.cv3.cv3-day .cv3-ppg{background:rgba(0,0,0,.04)}
.cv3.cv3-day .cv3-ppg-l{color:rgba(0,0,0,.42)}
.cv3.cv3-day .cv3-db{background:rgba(0,0,0,.1)}
.cv3.cv3-day .cv3-dbdata{color:#1a1a2e}
.cv3.cv3-day .cv3-dbunit,.cv3.cv3-day .cv3-dblbl{color:rgba(0,0,0,.38)}
.cv3.cv3-day .cv3-spec-v{color:rgba(0,0,0,.72)}
.cv3.cv3-day .cv3-etag{background:rgba(0,0,0,.05);border-color:rgba(0,0,0,.1);color:rgba(0,0,0,.48)}
.cv3.cv3-day .cv3-score{border-top-color:rgba(0,0,0,.07)}
.cv3.cv3-day .cv3-slbl2{color:rgba(0,0,0,.38)}
.cv3.cv3-day .cv3-sbar{background:rgba(0,0,0,.1)}
.cv3.cv3-day .cv3-btnduel{border-color:rgba(0,0,0,.15);color:rgba(0,0,0,.48)}
.cv3.cv3-day .cv3-btnduel:hover,.cv3.cv3-day .cv3-btnduel.on{border-color:#c8a600;color:#856b00;background:rgba(200,166,0,.07)}
.cv3.cv3-day .cv3-bcol{border-color:rgba(0,0,0,.1)}
.cv3.cv3-day .cv3-bcolbody{background:rgba(0,0,0,.03)}
.cv3.cv3-day .cv3-disc{color:rgba(0,0,0,.35);border-top-color:rgba(0,0,0,.08)}
.cv3.cv3-day .cv3-empty{color:rgba(0,0,0,.3)}
.cv3.cv3-day .cv3-b-pop{background:rgba(21,101,192,.12);color:#1565C0;border-color:rgba(21,101,192,.22)}
.cv3.cv3-day .cv3-b-val{background:rgba(34,139,34,.12);color:#1a7a1a;border-color:rgba(34,139,34,.22)}
/* ADMIN — Ajouter une offre */
.cv3-addbtn{padding:9px 16px;border-radius:9px;border:1px solid rgba(255,215,0,.3);background:rgba(255,215,0,.08);color:#ffd700;font-size:.8rem;font-weight:700;cursor:pointer;transition:all .2s;white-space:nowrap}
.cv3-addbtn:hover{background:rgba(255,215,0,.16);transform:translateY(-1px)}
.cv3-ad-tabs{display:flex;gap:7px;margin:0 24px 14px}
.cv3-ad-tab{flex:1;padding:9px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:rgba(255,255,255,.55);font-size:.76rem;font-weight:600;cursor:pointer;transition:all .2s}
.cv3-ad-tab.on{border-color:#60a5fa;background:rgba(96,165,250,.14);color:#60a5fa}
.cv3-ad-src{margin:0 24px 14px}
.cv3-ad-src input,.cv3-ad-src textarea,.cv3-ad-grid input,.cv3-ad-grid select,.cv3-ad-grid textarea{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:9px;color:#e2e8f0;padding:9px 11px;font-size:.83rem;font-family:inherit;outline:none}
.cv3-ad-src input:focus,.cv3-ad-grid input:focus,.cv3-ad-grid select:focus,.cv3-ad-grid textarea:focus{border-color:#60a5fa}
.cv3-ad-src textarea{min-height:90px;resize:vertical}
.cv3-ad-analyzebtn{margin-top:9px;padding:9px 16px;border-radius:9px;border:none;background:linear-gradient(135deg,#2979ff,#7b2ff7);color:#fff;font-weight:700;font-size:.8rem;cursor:pointer}
.cv3-ad-analyzebtn:disabled{opacity:.5;cursor:wait}
.cv3-ad-status{font-size:.74rem;color:rgba(255,255,255,.45);margin-top:8px;min-height:1.2em}
.cv3-ad-ops{display:flex;gap:8px;margin:0 24px 12px}
.cv3-ad-opbtn{flex:1;padding:9px;border-radius:9px;border:1.5px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);color:rgba(255,255,255,.6);font-weight:700;font-size:.78rem;cursor:pointer;transition:all .2s}
.cv3-ad-opbtn.on{border-color:var(--oc);background:rgba(var(--oc-rgb),.16);color:var(--oc)}
.cv3-ad-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 24px 14px}
.cv3-ad-grid label{display:block;font-size:.68rem;color:rgba(255,255,255,.4);margin-bottom:4px}
.cv3-ad-full{grid-column:1/-1}
.cv3-ad-check{display:flex;align-items:center;gap:7px;font-size:.78rem;color:rgba(255,255,255,.6);cursor:pointer}
.cv3-ad-submitbtn{margin:4px 24px 22px;padding:11px;border-radius:9px;border:none;background:linear-gradient(90deg,#ffd700,#ff8c00);color:#000;font-weight:900;font-size:.85rem;cursor:pointer;width:calc(100% - 48px)}
.cv3-ad-submitbtn:disabled{opacity:.5;cursor:wait}
.cv3-ad-draft{margin:0 24px 12px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.02);overflow:hidden}
.cv3-ad-draft.off{opacity:.42}
.cv3-ad-dsum{display:flex;align-items:center;gap:9px;padding:10px 13px;cursor:pointer;list-style:none;font-size:.8rem;color:#e2e8f0}
.cv3-ad-dsum::-webkit-details-marker{display:none}
.cv3-ad-dsum:hover{background:rgba(255,255,255,.04)}
.cv3-ad-dnum{font-size:.66rem;font-weight:800;color:rgba(255,255,255,.35);letter-spacing:.05em}
.cv3-ad-dttl{flex:1;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cv3-ad-dop{font-size:.64rem;font-weight:800;padding:2px 7px;border-radius:6px;background:rgba(var(--oc-rgb),.16);color:var(--oc)}
.cv3-ad-ddel{border:none;background:none;color:rgba(255,255,255,.35);cursor:pointer;font-size:.9rem;padding:2px 4px}
.cv3-ad-ddel:hover{color:#f87171}
.cv3-ad-draft .cv3-ad-grid{margin:0 13px 13px}
.cv3-ad-bar{display:flex;gap:8px;margin:0 24px 12px}
.cv3-ad-minibtn{flex:1;padding:8px;border-radius:9px;border:1px dashed rgba(255,255,255,.18);background:rgba(255,255,255,.02);color:rgba(255,255,255,.55);font-size:.75rem;font-weight:700;cursor:pointer}
.cv3-ad-minibtn:hover{border-color:#60a5fa;color:#60a5fa}
.cv3-ad-report{margin:0 24px 12px;font-size:.72rem;line-height:1.55;color:rgba(255,255,255,.5)}
.cv3-ad-report b{color:#4ade80}
.cv3-ad-report .ko{color:#facc15}
.cv3.cv3-day .cv3-ad-draft{background:rgba(255,255,255,.6);border-color:rgba(0,0,0,.1)}
.cv3.cv3-day .cv3-ad-dsum{color:#1a1a2e}
.cv3.cv3-day .cv3-ad-minibtn{color:rgba(0,0,0,.55)}
.cv3.cv3-day .cv3-ad-tab,.cv3.cv3-day .cv3-ad-opbtn{background:rgba(255,255,255,.7);border-color:rgba(0,0,0,.12);color:rgba(0,0,0,.6)}
.cv3.cv3-day .cv3-ad-src input,.cv3.cv3-day .cv3-ad-src textarea,.cv3.cv3-day .cv3-ad-grid input,.cv3.cv3-day .cv3-ad-grid select,.cv3.cv3-day .cv3-ad-grid textarea{background:#fff;border-color:rgba(0,0,0,.15);color:#1a1a2e}
.cv3.cv3-day .cv3-ad-grid label,.cv3.cv3-day .cv3-ad-status,.cv3.cv3-day .cv3-ad-check{color:rgba(0,0,0,.5)}
  `;
  document.head.appendChild(s);
})();

/* ══ Opérateurs ══════════════════════════════════════════════ */
const COMP_OPS = {
  mobilis:{
    name:'Mobilis', color:'#2E7D32', rgb:'46,125,50',
    grad:'linear-gradient(135deg,#1B5E20 0%,#388E3C 100%)',
    ballHTML:'<img src="images/logo-mobilis.png" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">',
    soloHTML:'<img src="images/logo-mobilis.png" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">',
    site:'https://www.mobilis.dz'
  },
  djezzy:{
    name:'Djezzy', color:'#D32F2F', rgb:'211,47,47',
    grad:'linear-gradient(135deg,#B71C1C 0%,#E53935 100%)',
    ballHTML:'<img src="images/logo-djezzy.png" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">',
    soloHTML:'<img src="images/logo-djezzy.png" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">',
    site:'https://www.djezzy.dz'
  },
  ooredoo:{
    name:'Ooredoo', color:'#CC0000', rgb:'204,0,0',
    grad:'linear-gradient(135deg,#8B0000 0%,#CC0000 100%)',
    ballHTML:'<img src="images/logo-ooredoo.png" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">',
    soloHTML:'<img src="images/logo-ooredoo.png" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">',
    site:'https://www.ooredoo.dz'
  },
};

/* ══ Offres ══════════════════════════════════════════════════ */
/*
 * Les offres vivent dans comparateur_offers.json (fetch au chargement,
 * voir initComparateur). Ajout manuel : éditer ce fichier directement,
 * en respectant le schéma : id, op, name, price, data, validity, calls,
 * sms, extras, link, dateAdded:'YYYY-MM-DD', badge:'Populaire'|'Meilleur rapport'|null.
 * Ajout assisté (PDF/URL/texte → IA → prévisualisation) : bouton ➕ admin
 * dans l'en-tête des résultats (visible si isAdminUnlocked()).
 * Le badge 🆕 Nouveau est attribué automatiquement si dateAdded
 * est dans les 30 derniers jours.
 */
let COMP_OFFERS = [];
async function _cv3LoadOffers(){
  if(COMP_OFFERS.length) return COMP_OFFERS;
  try{
    var res = await fetch('/comparateur_offers.json');
    COMP_OFFERS = await res.json();
  }catch(e){ console.error('Chargement comparateur_offers.json échoué', e); COMP_OFFERS = []; }
  return COMP_OFFERS;
}

/* ══ Profils usage ════════════════════════════════════════════ */
const CV3_PROFILES = [
  { id:'budget',  ico:'💰', label:'Budget serré',      budget:1500, data:0   },
  { id:'bigdata', ico:'📶', label:'Gros consommateur', budget:9999, data:50  },
  { id:'appels',  ico:'📞', label:'Je téléphone tout', budget:9999, data:0,  allNets:true },
  { id:'stream',  ico:'🎮', label:'Streaming / Gaming',budget:9999, data:100 },
  { id:'best',    ico:'⚡', label:'Meilleur rapport',  budget:9999, data:0,  sort:'score' },
  { id:'new',     ico:'🆕', label:'Nouveautés',        budget:9999, data:0,  sort:'new'   },
];

/* ══ État ════════════════════════════════════════════════════ */
let _C = {
  budget:9999, data:0, type:'any',
  ops: new Set(['mobilis','djezzy','ooredoo']),
  view:'battle', sort:'score',
  duel:[], profile:null
};

/* ══ Algorithme ══════════════════════════════════════════════ */
function _score(o){
  var n = o.price*(30/(o.validity||30));
  return (o.data/n)*100 + o.extras.length*0.15 + (o.intl?0.5:0);
}
function _ppg(o){
  if(!o.data) return Infinity;       // offres sans data (options, recharges) : pas de coût/Go
  return Math.round(o.price*(30/(o.validity||30))/o.data);
}
function _ppgTxt(o){ var v=_ppg(o); return isFinite(v) ? v+' DA/Go' : '—'; }
function _isNew(o){
  if(!o.dateAdded) return false;
  var diff = (new Date() - new Date(o.dateAdded)) / 86400000;
  return diff >= 0 && diff <= 30;
}
function _fmtDate(iso){
  var d=new Date(iso);
  return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
}
function _filter(){
  var cat = _C.cat||'mobile';
  return COMP_OFFERS.filter(function(o){
    if((o.cat||'mobile') !== cat)     return false;
    if(!_C.ops.has(o.op))             return false;
    if(_C.budget < 9999 && o.price > _C.budget) return false;
    if(o.data  < _C.data)             return false;
    return true;
  });
}
function _sorted(list){
  return list.slice().sort(function(a,b){
    if(_C.sort==='price') return a.price-b.price;
    if(_C.sort==='data')  return b.data-a.data;
    if(_C.sort==='ppg'){ var pa=_ppg(a), pb=_ppg(b); return pa===pb ? 0 : pa-pb; }
    if(_C.sort==='new'){
      var da=a.dateAdded||'2000-01-01', db=b.dateAdded||'2000-01-01';
      return db.localeCompare(da);
    }
    return _score(b)-_score(a);
  });
}

/* ══ Card builder ════════════════════════════════════════════ */
function _card(o, isTop, maxScore, maxData, opInHeader){
  var op   = COMP_OPS[o.op];
  var sc   = _score(o);
  var ppgv = _ppg(o);
  var pct  = maxScore>0 ? Math.round((sc/maxScore)*100) : 0;
  var dpct = maxData>0  ? Math.round((o.data/maxData)*100) : 0;
  var sel  = _C.duel.includes(o.id);

  var ppgColor = !isFinite(ppgv)?'rgba(255,255,255,.45)':ppgv<=25?'#4ade80':ppgv<=40?'#facc15':'#f87171';
  var ppgTxt   = _ppgTxt(o);

  /* Badges */
  var isNewOffer=_isNew(o);
  var badges='';
  if(isNewOffer)               badges+='<span class="cv3-b cv3-b-new">🆕 Nouveau</span>';
  if(isTop)                    badges+='<span class="cv3-b cv3-b-star">★ Notre #1</span>';
  if(o.badge==='Populaire')    badges+='<span class="cv3-b cv3-b-pop">🔥 Populaire</span>';
  if(o.badge==='Meilleur rapport') badges+='<span class="cv3-b cv3-b-val">👍 Meilleur rapport</span>';
  if(sel)                      badges+='<span class="cv3-b cv3-b-sel">⚔ Sélectionné</span>';

  /* SVG ring */
  var r=16, circ=+(2*Math.PI*r).toFixed(2), dash=+((circ*pct/100)).toFixed(2);
  var ring='<svg width="40" height="40" viewBox="0 0 40 40">'
    +'<circle cx="20" cy="20" r="'+r+'" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="3.5"/>'
    +'<circle cx="20" cy="20" r="'+r+'" fill="none" stroke="'+op.color+'" stroke-width="3.5"'
    +' stroke-dasharray="'+dash+' '+(circ-dash)+'" stroke-linecap="round"'
    +' class="cv3-arc" data-dash="'+dash+'" data-circ="'+circ+'"/>'
    +'</svg>';

  var isNet = (o.cat||'mobile')==='internet';
  var validStr = o.validity<30 ? o.validity+'j ⚠️' : o.validity<=31 ? '30 jours' : Math.round(o.validity/30)+' mois';

  return '<div class="cv3-card'+(sel?' sel':'')+'" style="--oc:'+op.color+';--oc-rgb:'+op.rgb+'" data-id="'+o.id+'">'
    +'<div class="cv3-cglow"></div>'
    +'<div class="cv3-cbar"></div>'
    /* Head */
    +'<div class="cv3-ch">'
      +(opInHeader
        ? '<span class="cv3-chopname"><span class="cv3-chdot"></span>'+op.name+'</span>'
        : '<span></span>')
      +'<div class="cv3-badges">'+badges+'</div>'
    +'</div>'
    +'<div class="cv3-cname">'+o.name+'</div>'
    /* Price */
    +'<div class="cv3-cpricerow">'
      +'<span class="cv3-cprice">'+o.price.toLocaleString('fr-FR')+'</span>'
      +'<span class="cv3-ccur"> DA</span>'
      +'<span class="cv3-cvalid">/'+validStr+'</span>'
    +'</div>'
    /* PPG */
    +'<div class="cv3-ppg">'
      +'<span class="cv3-ppg-l">💡 Coût / Go</span>'
      +'<span class="cv3-ppg-v" style="color:'+ppgColor+'">'+ppgTxt+'</span>'
    +'</div>'
    /* Data bar */
    +'<div class="cv3-dbwrap">'
      +'<div class="cv3-dbrow">'
        +'<span class="cv3-dbdata">'+o.data+'<span class="cv3-dbunit">Go</span></span>'
        +'<span class="cv3-dblbl">'+(isNet?'Internet 4G':'data 4G/5G')+'</span>'
      +'</div>'
      +'<div class="cv3-db"><div class="cv3-dbfill" data-pct="'+dpct+'"></div></div>'
    +'</div>'
    /* Specs */
    +'<div class="cv3-specs">'
      +'<div class="cv3-spec"><span class="cv3-spec-i">'+(isNet?'🌐':'📞')+'</span><span class="cv3-spec-v">'+o.calls+'</span></div>'
      +(o.sms?'<div class="cv3-spec"><span class="cv3-spec-i">💬</span><span class="cv3-spec-v">'+o.sms+'</span></div>':'')
    +'</div>'
    /* Extras */
    +'<div class="cv3-extras">'
      +o.extras.map(function(e){return'<span class="cv3-etag">'+e+'</span>';}).join('')
    +'</div>'
    /* Score ring */
    +'<div class="cv3-score">'
      +'<div class="cv3-sring">'+ring+'<div class="cv3-srnum">'+pct+'%</div></div>'
      +'<div class="cv3-sinfo">'
        +'<div class="cv3-slbl2">Rapport qualité-prix</div>'
        +'<div class="cv3-sbar"><div class="cv3-sbarfill" data-pct="'+pct+'"></div></div>'
      +'</div>'
    +'</div>'
    /* Date ajout */
    +(o.dateAdded?'<div style="padding:0 13px 6px;font-size:.62rem;color:rgba(255,255,255,.22)">📅 Depuis le '+_fmtDate(o.dateAdded)+'</div>':'')
    /* Actions */
    +'<div class="cv3-actions">'
      +'<a href="'+o.link+'" target="_blank" rel="noopener" class="cv3-btncta">'
        +'↗ Voir sur '+op.name
      +'</a>'
      +'<button class="cv3-btnduel'+(sel?' on':'')+'" onclick="window._cv3Duel(\''+o.id+'\')">'
        +(sel?'✓ Ajouté':'⚔ Duel')
      +'</button>'
    +'</div>'
  +'</div>';
}

/* ══ Views ═══════════════════════════════════════════════════ */
function _gridView(items, maxScore, maxData){
  if(!items.length) return '<div class="cv3-empty"><div class="cv3-emico">🔍</div><p>Aucune offre ne correspond à vos critères.</p></div>';
  var byScore = items.slice().sort(function(a,b){return _score(b)-_score(a);});
  var top = byScore[0];
  return '<div class="cv3-grid">'
    +items.map(function(o){ return _card(o, o===top, maxScore, maxData, true); }).join('')
    +'</div>';
}

function _battleView(items, maxScore, maxData){
  var active=['mobilis','djezzy','ooredoo'].filter(function(k){return _C.ops.has(k);});
  if(active.length===1) return _soloView(active[0], items, maxScore, maxData);

  var cols='';
  ['mobilis','djezzy','ooredoo'].forEach(function(k){
    if(!_C.ops.has(k)) return;
    var op = COMP_OPS[k];
    var sub = items.filter(function(o){return o.op===k;});
    var bySc = sub.slice().sort(function(a,b){return _score(b)-_score(a);});
    var top = bySc[0];
    cols += '<div class="cv3-bcol" style="--oc:'+op.color+';--oc-rgb:'+op.rgb+'">'
      +'<div class="cv3-bcolhead" style="background:'+op.grad+'">'
        +'<div class="cv3-bcoldot"></div>'
        +'<span class="cv3-bcolname">'+op.name+'</span>'
        +'<span class="cv3-bcolct">'+sub.length+' offre'+(sub.length>1?'s':'')+'</span>'
      +'</div>'
      +'<div class="cv3-bcolbody">'
      +(sub.length
        ? sub.map(function(o){return _card(o, o===top, maxScore, maxData, false);}).join('')
        : '<div style="text-align:center;padding:28px 0;color:rgba(255,255,255,.2);font-size:.8rem">Aucune offre selon les filtres</div>')
      +'</div>'
    +'</div>';
  });
  return '<div class="cv3-battle">'+cols+'</div>';
}

function _soloView(k, items, maxScore, maxData){
  var op   = COMP_OPS[k];
  var newN = items.filter(_isNew).length;
  var minPPG = items.reduce(function(m,o){return _ppg(o)<m?_ppg(o):m;}, Infinity);
  var maxGo  = items.reduce(function(m,o){return o.data>m?o.data:m;}, 0);
  var sorted = items.slice().sort(function(a,b){return _score(b)-_score(a);});
  var top    = sorted[0];

  var banner = '<div class="cv3-solo-banner" style="background:'+op.grad+'">'
    +'<div class="cv3-solo-shimmer"></div>'
    +'<div class="cv3-solo-sigle">'+op.soloHTML+'</div>'
    +'<div class="cv3-solo-info">'
      +'<div class="cv3-solo-name">'+op.name+'</div>'
      +'<div class="cv3-solo-sub">'+items.length+' offre'+(items.length>1?'s':'')+' disponible'+(items.length>1?'s':'')+' · Données officielles juin 2026</div>'
      +'<div class="cv3-solo-kpis">'
        +'<div class="cv3-solo-kpi"><div class="cv3-solo-kpi-v">'+(isFinite(minPPG)?minPPG:'—')+'<span style="font-size:.8rem"> DA</span></div><div class="cv3-solo-kpi-l">Meilleur prix/Go</div></div>'
        +'<div class="cv3-solo-kpi"><div class="cv3-solo-kpi-v">'+maxGo+'<span style="font-size:.8rem"> Go</span></div><div class="cv3-solo-kpi-l">Plus de data</div></div>'
        +(newN?'<div class="cv3-solo-kpi" style="border-color:rgba(0,229,255,.3)"><div class="cv3-solo-kpi-v" style="color:#00E5FF">'+newN+'</div><div class="cv3-solo-kpi-l">Nouvelles offres</div></div>':'')
      +'</div>'
    +'</div>'
    +'<button class="cv3-solo-back" onclick="window._cv3FilterOp(\''+k+'\')">← Voir les 3 opérateurs</button>'
  +'</div>';

  return '<div class="cv3-solo">'
    +banner
    +'<div class="cv3-solo-grid">'
    +sorted.map(function(o){return _card(o, o===top, maxScore, maxData, false);}).join('')
    +'</div>'
  +'</div>';
}

/* ══ Duel modal ══════════════════════════════════════════════ */
function _openDuel(){
  if(_C.duel.length<2) return;
  var offers = _C.duel.map(function(id){return COMP_OFFERS.find(function(o){return o.id===id;});}).filter(Boolean);
  if(offers.length<2) return;
  var nc = offers.length;

  function best(arr, lower){
    var b = lower ? Math.min.apply(null,arr) : Math.max.apply(null,arr);
    return arr.map(function(v){return v===b?'w':'l';});
  }

  var normPrices = offers.map(function(o){return Math.round(o.price*(30/(o.validity||30)));});
  var datas   = offers.map(function(o){return o.data;});
  var ppgs    = offers.map(function(o){return _ppg(o);});
  var scores  = offers.map(function(o){return _score(o);});
  var nextra  = offers.map(function(o){return o.extras.length;});

  var winnerIdx = scores.indexOf(Math.max.apply(null,scores));
  var winner = offers[winnerIdx];
  var wop = COMP_OPS[winner.op];

  var cols = 130+nc;
  var gridCols = '130px repeat('+nc+',1fr)';

  function row(label, vals, cls){
    return '<div class="cv3-crow" style="grid-template-columns:'+gridCols+'">'
      +'<div class="cv3-crow-lbl">'+label+'</div>'
      +vals.map(function(v,i){return'<div class="cv3-ccell '+cls[i]+'">'+v+'</div>';}).join('')
    +'</div>';
  }

  var heads = '<div class="cv3-crow" style="grid-template-columns:'+gridCols+';margin-bottom:6px">'
    +'<div></div>'
    +offers.map(function(o){
       var op=COMP_OPS[o.op];
       return '<div class="cv3-colhead" style="background:linear-gradient(135deg,'+op.color+',rgba(0,0,0,.5))">'
         +'<div class="cv3-colopname">'+op.name+'</div>'
         +'<div class="cv3-colplan">'+o.name+'</div>'
         +'<div class="cv3-colprice" style="color:'+op.color+'">'+o.price.toLocaleString('fr-FR')+' DA</div>'
       +'</div>';
     }).join('')
  +'</div>';

  var table = heads
    +row('📶 Data (mensuel)',  datas.map(function(v){return v+' Go';}),                   best(datas,false))
    +row('💰 Prix / mois',    normPrices.map(function(v){return v+' DA';}),               best(normPrices,true))
    +row('💡 Coût par Go',    offers.map(_ppgTxt),                                        best(ppgs,true))
    +row('⭐ Score Q/P',      scores.map(function(v){return(Math.round(v*10)/10)+' pts';}),best(scores,false))
    +row('🎁 Avantages',      nextra.map(function(v){return v+' extra'+(v>1?'s':'');}),   best(nextra,false))
    +row('📞 Appels',         offers.map(function(o){return o.calls;}),                    offers.map(function(){return'';}))
    +row('💬 SMS',            offers.map(function(o){return o.sms||'—';}),                offers.map(function(){return'';}))
    +row('📅 Validité',       offers.map(function(o){return o.validity+' jours';}),        offers.map(function(){return'';}));

  var html = '<div class="cv3-overlay" id="cv3modal" onclick="if(event.target===this)window._cv3Close()">'
    +'<div class="cv3-modal">'
    +'<div class="cv3-mhead">'
      +'<span class="cv3-mtitle">⚔️ Duel — '+nc+' offres comparées</span>'
      +'<button class="cv3-mclose" onclick="window._cv3Close()">✕</button>'
    +'</div>'
    +'<div class="cv3-winner">'
      +'<div class="cv3-wcrown">👑</div>'
      +'<div>'
        +'<div class="cv3-wh">'+wop.name+' · '+winner.name+' remporte le duel !</div>'
        +'<div class="cv3-wp">'+winner.data+' Go · '+_ppg(winner)+' DA/Go · Score '+Math.round(_score(winner)*10)/10+' pts — Données juin 2026</div>'
      +'</div>'
    +'</div>'
    +'<div class="cv3-ctable">'+table+'</div>'
    +'</div></div>';

  var old=document.getElementById('cv3modal');
  if(old) old.remove();
  document.body.insertAdjacentHTML('beforeend', html);
}

/* ══ Tray ════════════════════════════════════════════════════ */
function _tray(){
  var t=document.getElementById('cv3-tray');
  var sl=document.getElementById('cv3-trayslots');
  var btn=document.getElementById('cv3-traybtn');
  if(!t||!sl) return;
  t.classList.toggle('show', _C.duel.length>0);
  var h='';
  _C.duel.forEach(function(id){
    var o=COMP_OFFERS.find(function(x){return x.id===id;});
    if(o) h+='<div class="cv3-trayslot">'+COMP_OPS[o.op].name+' · '+o.name+'</div>';
  });
  for(var i=_C.duel.length;i<3;i++) h+='<div class="cv3-trayempty">+ Offre '+(i+1)+'</div>';
  sl.innerHTML=h;
  if(btn) btn.disabled=_C.duel.length<2;
}

/* ══ Render ══════════════════════════════════════════════════ */
function _render(){
  var res=document.getElementById('cv3-results');
  if(!res) return;

  var filtered=_sorted(_filter());
  var allScores=filtered.map(function(o){return _score(o);});
  var maxScore=allScores.length ? Math.max.apply(null,allScores) : 1;
  var maxData =filtered.length ? Math.max.apply(null,filtered.map(function(o){return o.data;})) : 1;

  /* Count */
  var cnt=document.getElementById('cv3-cnt');
  if(cnt) cnt.innerHTML='<strong>'+filtered.length+'</strong> offre'+(filtered.length!==1?'s':'')+' affichée'+(filtered.length!==1?'s':'');

  /* Live stats */
  var ls=document.getElementById('cv3-lstats');
  if(ls&&filtered.length){
    var bestPPG=filtered.reduce(function(b,o){return _ppg(o)<_ppg(b)?o:b;});
    var bestPPGTxt=_ppgTxt(bestPPG).replace(' DA/Go',' DA');
    var mostDt =filtered.reduce(function(b,o){return o.data>b.data?o:b;});
    var cheapst=filtered.reduce(function(b,o){return o.price<b.price?o:b;});
    ls.innerHTML=
      '<div class="cv3-lsrow"><span>Meilleur prix/Go</span><span class="cv3-lsval">'+bestPPGTxt+'</span></div>'
     +'<div class="cv3-lsrow"><span>Plus de data</span><span class="cv3-lsval">'+mostDt.data+' Go</span></div>'
     +'<div class="cv3-lsrow"><span>Moins cher</span><span class="cv3-lsval">'+cheapst.price.toLocaleString('fr-FR')+' DA</span></div>'
     +'<div class="cv3-lsrow"><span>Offres filtrées</span><span class="cv3-lsval">'+filtered.length+'/'+COMP_OFFERS.length+'</span></div>';
  }else if(ls){
    ls.innerHTML='<div class="cv3-lsrow"><span style="color:rgba(255,255,255,.2)">Aucune offre</span></div>';
  }

  /* Bannière nouveautés */
  var allNew = COMP_OFFERS.filter(_isNew);
  var newBanner='';
  if(allNew.length && _C.sort!=='new'){
    var byOp={};
    allNew.forEach(function(o){byOp[o.op]=(byOp[o.op]||0)+1;});
    var opTags=Object.keys(byOp).map(function(k){
      return '<span class="cv3-newbanner-op" style="color:'+COMP_OPS[k].color+'">'+COMP_OPS[k].name+' +'+byOp[k]+'</span>';
    }).join('');
    newBanner='<div class="cv3-newbanner">'
      +'<div class="cv3-newbanner-ico">🆕</div>'
      +'<div class="cv3-newbanner-txt">'
        +'<div class="cv3-newbanner-h">'+allNew.length+' nouvelles offres ajoutées ces 30 derniers jours</div>'
        +'<div class="cv3-newbanner-ops">'+opTags+'</div>'
      +'</div>'
      +'<button class="cv3-newbanner-btn" onclick="window._cv3Profile(\'new\')">Voir les nouveautés →</button>'
    +'</div>';
  }

  /* Results */
  res.innerHTML = newBanner + ((_C.view==='battle' && (_C.cat||'mobile')!=='internet')
    ? _battleView(filtered, maxScore, maxData)
    : _gridView(filtered, maxScore, maxData));

  /* Animate */
  requestAnimationFrame(function(){
    res.querySelectorAll('.cv3-dbfill').forEach(function(el){el.style.width=el.dataset.pct+'%';});
    res.querySelectorAll('.cv3-sbarfill').forEach(function(el){el.style.width=el.dataset.pct+'%';});
  });

  _updateHeroBalls();
}

function _updateHeroBalls(){
  ['mobilis','djezzy','ooredoo'].forEach(function(k){
    var el=document.getElementById('cv3-hero-'+k);
    if(!el) return;
    var solo=_C.ops.size===1 && _C.ops.has(k);
    var dimmed=!_C.ops.has(k);
    el.classList.toggle('solo',solo);
    el.classList.toggle('dimmed',dimmed);
  });
}

/* ══ HTML template ═══════════════════════════════════════════ */
function _buildHTML(){
  var prices=COMP_OFFERS.map(function(o){return o.price;});
  var minP=Math.min.apply(null,prices);
  var maxD=Math.max.apply(null,COMP_OFFERS.map(function(o){return o.data;}));

  return '<div class="cv3">'
    /* HERO */
    +'<div class="cv3-hero">'
      +'<div class="cv3-hbg"></div>'
      
      +'<button class="cv3-daybtn" id="cv3-daybtn" onclick="window._cv3ToggleDay()" title="Mode jour / nuit">&#9728; Jour</button>'
      +'<div class="cv3-hcontent">'
        +'<h1 class="cv3-htitle" onclick="window._cv3Reset()" title="Cliquer pour afficher les 3 opérateurs">⚡ Comparateur d\'offres mobiles</h1>'
        +'<p class="cv3-hsub">Comparez les forfaits <strong>Mobilis Revolution</strong>, <strong>Djezzy LEGEND</strong> et <strong>Ooredoo Dima</strong> — données officielles juin 2026</p>'
        +'<div class="cv3-logos">'
          +'<div class="cv3-logowrap" id="cv3-hero-mobilis" style="--oc:#2E7D32;--oc-rgb:46,125,50;--oc-grad:linear-gradient(135deg,#1B5E20,#388E3C)" onclick="window._cv3FilterOp(\'mobilis\')" title="Filtrer Mobilis">'
            +'<div class="cv3-opball">'+COMP_OPS.mobilis.ballHTML+'</div>'
            +'<span class="cv3-opball-name">Mobilis</span>'
          +'</div>'
          +'<div class="cv3-vs">VS</div>'
          +'<div class="cv3-logowrap" id="cv3-hero-djezzy" style="--oc:#D32F2F;--oc-rgb:211,47,47;--oc-grad:linear-gradient(135deg,#B71C1C,#E53935)" onclick="window._cv3FilterOp(\'djezzy\')" title="Filtrer Djezzy">'
            +'<div class="cv3-opball">'+COMP_OPS.djezzy.ballHTML+'</div>'
            +'<span class="cv3-opball-name">Djezzy</span>'
          +'</div>'
          +'<div class="cv3-vs">VS</div>'
          +'<div class="cv3-logowrap" id="cv3-hero-ooredoo" style="--oc:#CC0000;--oc-rgb:204,0,0;--oc-grad:linear-gradient(135deg,#8B0000,#CC0000)" onclick="window._cv3FilterOp(\'ooredoo\')" title="Filtrer Ooredoo">'
            +'<div class="cv3-opball">'+COMP_OPS.ooredoo.ballHTML+'</div>'
            +'<span class="cv3-opball-name">Ooredoo</span>'
          +'</div>'
        +'</div>'
        +'<div class="cv3-strip">'
          +'<div><div class="cv3-snum">'+COMP_OFFERS.length+'</div><div class="cv3-slbl">Offres analysées</div></div>'
          +'<div><div class="cv3-snum">3</div><div class="cv3-slbl">Opérateurs</div></div>'
          +'<div><div class="cv3-snum">'+minP.toLocaleString('fr-FR')+'<span style="font-size:1rem;font-weight:400"> DA</span></div><div class="cv3-slbl">Dès</div></div>'
          +'<div><div class="cv3-snum">'+maxD+'<span style="font-size:1rem;font-weight:400"> Go</span></div><div class="cv3-slbl">Jusqu\'à</div></div>'
        +'</div>'
      +'</div>'
    +'</div>'

    /* PROFILES */
    +'<div class="cv3-profiles" id="cv3-profiles">'
      +'<span class="cv3-plbl">🎯 Mon profil</span>'
      +CV3_PROFILES.map(function(p){
         return '<button class="cv3-profile" data-pid="'+p.id+'" onclick="window._cv3Profile(\''+p.id+'\')">'+p.ico+' '+p.label+'</button>';
       }).join('')
      +'<button class="cv3-profile" onclick="window._cv3Reset()" style="opacity:.45">↺ Tout reset</button>'
    +'</div>'

    /* LAYOUT */
    +'<div class="cv3-layout">'

      /* SIDEBAR */
      +'<aside class="cv3-sidebar">'
        +'<div class="cv3-ssec">'
          +'<div class="cv3-slab">📐 Vue</div>'
          +'<div class="cv3-vtoggle">'
            +'<button class="cv3-vbtn on" onclick="window._cv3View(\'battle\',this)">⚔️ Bataille</button>'
            +'<button class="cv3-vbtn" onclick="window._cv3View(\'grid\',this)">🗂️ Grille</button>'
          +'</div>'
        +'</div>'

        +'<div class="cv3-ssec">'
          +'<div class="cv3-slab">🏢 Opérateurs</div>'
          +'<div class="cv3-oplist" id="cv3-oplist">'
            +['mobilis','djezzy','ooredoo'].map(function(k){
               var op=COMP_OPS[k];
               var n=COMP_OFFERS.filter(function(o){return o.op===k && (o.cat||'mobile')==='mobile';}).length;
               return '<div class="cv3-opchk on" data-op="'+k+'" style="--oc:'+op.color+';--oc-rgb:'+op.rgb+'" onclick="window._cv3ToggleOp(\''+k+'\',this)">'
                 +'<div class="cv3-opdot"></div>'
                 +'<span class="cv3-opchk-name">'+op.name+'</span>'
                 +'<span class="cv3-opchk-n">'+n+'</span>'
               +'</div>';
             }).join('')
          +'</div>'
        +'</div>'

        +'<div class="cv3-ssec">'
          +'<div class="cv3-slab">💸 Budget max</div>'
          +'<div class="cv3-pills" id="cv3-budget">'
            +[{v:1000,l:'≤ 1 000 DA'},{v:1500,l:'≤ 1 500 DA'},{v:2000,l:'≤ 2 000 DA'},{v:2500,l:'≤ 2 500 DA'},{v:9999,l:'Peu importe',a:true}]
            .map(function(p){
              return '<button class="cv3-pill'+(p.a?' on':'')+'" data-v="'+p.v+'" onclick="window._cv3Filter(\'budget\','+p.v+',this)">'+p.l+'<span class="cv3-pdot"></span></button>';
            }).join('')
          +'</div>'
        +'</div>'

        +'<div class="cv3-ssec">'
          +'<div class="cv3-slab">📶 Data minimum</div>'
          +'<div class="cv3-pills" id="cv3-data">'
            +[{v:0,l:'Peu importe',a:true},{v:10,l:'≥ 10 Go'},{v:30,l:'≥ 30 Go'},{v:50,l:'≥ 50 Go'},{v:100,l:'≥ 100 Go'}]
            .map(function(p){
              return '<button class="cv3-pill'+(p.a?' on':'')+'" data-v="'+p.v+'" onclick="window._cv3Filter(\'data\','+p.v+',this)">'+p.l+'<span class="cv3-pdot"></span></button>';
            }).join('')
          +'</div>'
        +'</div>'

        +'<div class="cv3-ssec">'
          +'<div class="cv3-slab">↕ Trier par</div>'
          +'<select class="cv3-sort" onchange="window._cv3Sort(this.value)">'
            +'<option value="score">⭐ Meilleur rapport Q/P</option>'
            +'<option value="price">💰 Prix croissant</option>'
            +'<option value="data">📶 Data décroissante</option>'
            +'<option value="ppg">💡 Moins cher par Go</option>'
            +'<option value="new">🆕 Dernières ajoutées</option>'
          +'</select>'
        +'</div>'

        +'<div class="cv3-ssec">'
          +'<div class="cv3-slab">📊 En temps réel</div>'
          +'<div class="cv3-lstats" id="cv3-lstats"></div>'
        +'</div>'

        +'<div class="cv3-updated">🔄 Données officielles <em>Juin 2026</em></div>'
      +'</aside>'

      /* MAIN */
      +'<main class="cv3-main">'
        +'<div class="cv3-modebar">'
          +'<button class="cv3-modebtn on" id="cv3-mode-mobile" onclick="window._cv3Mode(\'mobile\',this)">📱 Forfaits Mobile</button>'
          +'<button class="cv3-modebtn" id="cv3-mode-internet" onclick="window._cv3Mode(\'internet\',this)">🌐 Internet &amp; Box</button>'
        +'</div>'
        +'<div class="cv3-rhead">'
          +'<div class="cv3-cnt" id="cv3-cnt"></div>'
          +((typeof isAdminUnlocked==='function' && isAdminUnlocked())
            ? '<button class="cv3-addbtn" onclick="window._cv3OpenAdd()" title="Ajouter une offre (PDF / URL / texte)">➕ Ajouter une offre</button>'
            : '')
        +'</div>'
        +'<div id="cv3-results"></div>'
      +'</main>'

    +'</div>'

    /* DISCLAIMER */
    +'<div class="cv3-disc">'
      +'⚠️ Données issues des sites officiels des opérateurs (juin 2026). '
      +'Vérifiez toujours sur le site de l\'opérateur avant souscription. '
      +'Score = Go/DA normalisé 30 jours + bonus extras. '
      +'Mobilis Revolution : les Go indiqués correspondent au maximum si tous les Mobilis Units sont utilisés pour internet. '
      +'Le mode Duel vous permet de comparer jusqu\'à 3 offres côte à côte.'
    +'</div>'

    /* DUEL TRAY */
    +'<div class="cv3-tray" id="cv3-tray">'
      +'<span class="cv3-traylbl">⚔️ Duel :</span>'
      +'<div class="cv3-trayslots" id="cv3-trayslots"></div>'
      +'<button class="cv3-traybtn" id="cv3-traybtn" onclick="window._cv3OpenDuel()" disabled>Comparer maintenant</button>'
      +'<button class="cv3-trayclear" onclick="window._cv3ClearDuel()">✕ Effacer</button>'
    +'</div>'

  +'</div>';
}

/* ══ Public API ══════════════════════════════════════════════ */
window._cv3Filter = function(key, val, btn){
  _C[key] = isNaN(val)?val:parseInt(val,10);
  var grp = btn&&btn.closest('.cv3-pills');
  if(grp){ grp.querySelectorAll('.cv3-pill').forEach(function(b){b.classList.remove('on');}); btn.classList.add('on'); }
  _C.profile=null;
  document.querySelectorAll('.cv3-profile').forEach(function(b){b.classList.remove('active');});
  _render();
};

window._cv3ToggleOp = function(op, el){
  if(_C.ops.has(op)){
    if(_C.ops.size<=1) return;
    _C.ops.delete(op); el.classList.remove('on');
  } else {
    _C.ops.add(op); el.classList.add('on');
  }
  _render();
};

window._cv3View = function(v, btn){
  _C.view=v;
  document.querySelectorAll('.cv3-vbtn').forEach(function(b){b.classList.remove('on');});
  btn.classList.add('on');
  _render();
};

window._cv3Sort = function(v){ _C.sort=v; _render(); };

window._cv3Profile = function(pid){
  var p=CV3_PROFILES.find(function(x){return x.id===pid;});
  if(!p) return;
  _C.budget = p.budget||9999;
  _C.data   = p.data||0;
  if(p.sort) _C.sort = p.sort;

  /* Refresh pills */
  var bp=document.querySelector('#cv3-budget .cv3-pill[data-v="'+_C.budget+'"]');
  document.querySelectorAll('#cv3-budget .cv3-pill').forEach(function(b){b.classList.remove('on');});
  if(bp) bp.classList.add('on');

  var dp=document.querySelector('#cv3-data .cv3-pill[data-v="'+_C.data+'"]');
  document.querySelectorAll('#cv3-data .cv3-pill').forEach(function(b){b.classList.remove('on');});
  if(dp) dp.classList.add('on');

  var sel=document.querySelector('.cv3-sort');
  if(sel&&p.sort) sel.value=p.sort;

  document.querySelectorAll('.cv3-profile').forEach(function(b){b.classList.remove('active');});
  var pb=document.querySelector('.cv3-profile[data-pid="'+pid+'"]');
  if(pb) pb.classList.add('active');
  _C.profile=pid;
  _render();
};

window._cv3FilterOp = function(op){
  if(_C.ops.size===1 && _C.ops.has(op)){
    /* Déjà solo → remettre les 3 */
    _C.ops=new Set(['mobilis','djezzy','ooredoo']);
    document.querySelectorAll('.cv3-opchk').forEach(function(el){el.classList.add('on');});
  } else {
    /* Filtrer sur cet opérateur uniquement */
    _C.ops=new Set([op]);
    document.querySelectorAll('.cv3-opchk').forEach(function(el){
      el.classList.toggle('on',el.dataset.op===op);
    });
  }
  _C.profile=null;
  document.querySelectorAll('.cv3-profile').forEach(function(b){b.classList.remove('active');});
  _updateHeroBalls();
  _render();
};

window._cv3Mode = function(cat, btn){
  _C.cat = cat;
  /* reset des filtres incompatibles entre catégories (budget mobile ≠ prix box) */
  _C.budget = 9999; _C.data = 0; _C.profile = null;
  /* vue grille pour l'internet (pas de bataille par opérateur), bataille pour le mobile */
  _C.view = (cat==='internet') ? 'grid' : 'battle';
  document.querySelectorAll('.cv3-vbtn').forEach(function(b){
    b.classList.toggle('on', _C.view==='grid' ? /Grille/.test(b.textContent) : /Bataille/.test(b.textContent));
  });
  /* boutons de mode */
  document.querySelectorAll('.cv3-modebtn').forEach(function(b){b.classList.remove('on');});
  if(btn) btn.classList.add('on');
  /* réinitialiser l'UI des pills budget/data */
  document.querySelectorAll('#cv3-budget .cv3-pill').forEach(function(b){b.classList.toggle('on', b.dataset.v==='9999');});
  document.querySelectorAll('#cv3-data .cv3-pill').forEach(function(b){b.classList.toggle('on', b.dataset.v==='0');});
  document.querySelectorAll('.cv3-profile').forEach(function(b){b.classList.remove('active');});
  /* réactiver tous les opérateurs */
  _C.ops = new Set(['mobilis','djezzy','ooredoo']);
  document.querySelectorAll('.cv3-opchk').forEach(function(b){b.classList.add('on');});
  _updateHeroBalls();
  _render();
};
window._cv3Reset = function(){
  _C = { budget:9999, data:0, type:'any', cat:'mobile', ops:new Set(['mobilis','djezzy','ooredoo']), view:'battle', sort:'score', duel:[], profile:null };
  document.querySelectorAll('.cv3-modebtn').forEach(function(b){b.classList.toggle('on', b.id==='cv3-mode-mobile');});
  document.querySelectorAll('.cv3-pill').forEach(function(b){b.classList.remove('on');});
  var b9=document.querySelector('#cv3-budget .cv3-pill[data-v="9999"]');
  var d0=document.querySelector('#cv3-data .cv3-pill[data-v="0"]');
  if(b9)b9.classList.add('on'); if(d0)d0.classList.add('on');
  document.querySelectorAll('.cv3-opchk').forEach(function(b){b.classList.add('on');});
  document.querySelectorAll('.cv3-profile').forEach(function(b){b.classList.remove('active');});
  var sel=document.querySelector('.cv3-sort'); if(sel) sel.value='score';
  _tray(); _render();
  // Restore day/night preference
  if (localStorage.getItem('cv3-theme') === 'day') {
    var _cv3el = sec.querySelector('.cv3');
    if (_cv3el) {
      _cv3el.classList.add('cv3-day');
      var _cv3btn = document.getElementById('cv3-daybtn');
      if (_cv3btn) _cv3btn.innerHTML = '&#127769; Nuit';
    }
  }
};
window._cv3ToggleDay = function() {
  var cv3 = document.querySelector('.cv3');
  if (!cv3) return;
  var isDay = cv3.classList.toggle('cv3-day');
  localStorage.setItem('cv3-theme', isDay ? 'day' : 'night');
  var btn = document.getElementById('cv3-daybtn');
  if (btn) btn.innerHTML = isDay ? '&#127769; Nuit' : '&#9728; Jour';
};

window._cv3Duel = function(id){
  var idx=_C.duel.indexOf(id);
  if(idx>=0){ _C.duel.splice(idx,1); }
  else { if(_C.duel.length>=3) _C.duel.shift(); _C.duel.push(id); }
  _tray(); _render();
  // Restore day/night preference
  if (localStorage.getItem('cv3-theme') === 'day') {
    var _cv3el = sec.querySelector('.cv3');
    if (_cv3el) {
      _cv3el.classList.add('cv3-day');
      var _cv3btn = document.getElementById('cv3-daybtn');
      if (_cv3btn) _cv3btn.innerHTML = '&#127769; Nuit';
    }
  }
};
window._cv3ToggleDay = function() {
  var cv3 = document.querySelector('.cv3');
  if (!cv3) return;
  var isDay = cv3.classList.toggle('cv3-day');
  localStorage.setItem('cv3-theme', isDay ? 'day' : 'night');
  var btn = document.getElementById('cv3-daybtn');
  if (btn) btn.innerHTML = isDay ? '&#127769; Nuit' : '&#9728; Jour';
};

window._cv3OpenDuel  = function(){ _openDuel(); };
window._cv3ClearDuel = function(){ _C.duel=[]; _tray(); _render(); };
window._cv3Close     = function(){ var m=document.getElementById('cv3modal'); if(m)m.remove(); };

/* Compat avec l'ancienne API */
window._compSetFilter = function(key,val,btn){ window._cv3Filter(key,val,btn); };

/* ══ Ajout assisté d'offre (admin) ═══════════════════════════════
   PDF/image → /api/extract-communique · URL → /api/fetch-url
   texte collé → direct · puis /api/comparateur/structure (IA)
   → formulaire éditable → /api/comparateur/offer (insertion). ══ */
/* ══ ADMIN — Ajout d'offres (multi-offres) ═══════════════════
 * Un « brouillon » = une offre en cours de saisie. L'analyse IA
 * peut en produire plusieurs d'un coup (grille tarifaire, PDF
 * multi-paliers) ; chacun reste éditable et décochable avant envoi.
 * ═══════════════════════════════════════════════════════════ */
var _cv3Drafts = [];
var _cv3DraftSeq = 0;

function _cv3BlankDraft(op){
  return { _k:++_cv3DraftSeq, on:true, op:op||'', name:'', type:'prepaid',
           price:'', data:'', validity:30, calls:'', sms:'', intl:false, extras:[], link:'' };
}
function _cv3Draft(k){
  for(var i=0;i<_cv3Drafts.length;i++){ if(_cv3Drafts[i]._k===k) return _cv3Drafts[i]; }
  return null;
}
function _esc(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function _cv3DraftHTML(d, idx, open){
  var op = COMP_OPS[d.op];
  var opts = ['mobilis','djezzy','ooredoo'].map(function(k){
    return '<option value="'+k+'"'+(d.op===k?' selected':'')+'>'+COMP_OPS[k].name+'</option>';
  }).join('');
  var st = op ? '--oc:'+op.color+';--oc-rgb:'+op.rgb : '--oc:#94a3b8;--oc-rgb:148,163,184';
  var types = ['prepaid','postpaid','internet'];
  var labels = ['Prépayé','Postpayé','Internet'];
  return '<details class="cv3-ad-draft'+(d.on?'':' off')+'" data-k="'+d._k+'" style="'+st+'"'+(open?' open':'')+'>'
    +'<summary class="cv3-ad-dsum">'
      +'<input type="checkbox" '+(d.on?'checked':'')+' onclick="event.stopPropagation()" onchange="window._cv3AdToggle('+d._k+',this.checked)">'
      +'<span class="cv3-ad-dnum">#'+(idx+1)+'</span>'
      +'<span class="cv3-ad-dttl" id="cv3adT'+d._k+'">'+(_esc(d.name)||'Sans nom')+'</span>'
      +'<span class="cv3-ad-dop" id="cv3adO'+d._k+'">'+(op?op.name:'?')+'</span>'
      +'<span style="font-size:.7rem;opacity:.5" id="cv3adP'+d._k+'">'+(d.price?d.price+' DA':'')+'</span>'
      +'<button type="button" class="cv3-ad-ddel" title="Supprimer" onclick="event.preventDefault();event.stopPropagation();window._cv3AdDel('+d._k+')">🗑</button>'
    +'</summary>'
    +'<div class="cv3-ad-grid">'
      +'<div><label>Opérateur</label><select onchange="window._cv3AdSet('+d._k+',&quot;op&quot;,this.value)"><option value="">— choisir —</option>'+opts+'</select></div>'
      +'<div><label>Type</label><select onchange="window._cv3AdSet('+d._k+',&quot;type&quot;,this.value)">'
        +types.map(function(t,i){ return '<option value="'+t+'"'+(d.type===t?' selected':'')+'>'+labels[i]+'</option>'; }).join('')
      +'</select></div>'
      +'<div class="cv3-ad-full"><label>Nom de l\'offre</label><input type="text" value="'+_esc(d.name)+'" placeholder="Ex : Revolution 2000" oninput="window._cv3AdSet('+d._k+',&quot;name&quot;,this.value)"></div>'
      +'<div><label>Prix (DA)</label><input type="number" min="0" value="'+_esc(d.price)+'" oninput="window._cv3AdSet('+d._k+',&quot;price&quot;,this.value)"></div>'
      +'<div><label>Data (Go) — 0 si option sans data</label><input type="number" min="0" value="'+_esc(d.data)+'" oninput="window._cv3AdSet('+d._k+',&quot;data&quot;,this.value)"></div>'
      +'<div><label>Validité (jours)</label><input type="number" min="1" value="'+_esc(d.validity)+'" oninput="window._cv3AdSet('+d._k+',&quot;validity&quot;,this.value)"></div>'
      +'<div><label class="cv3-ad-check" style="margin-top:22px"><input type="checkbox" '+(d.intl?'checked':'')+' onchange="window._cv3AdSet('+d._k+',&quot;intl&quot;,this.checked)"> International inclus</label></div>'
      +'<div class="cv3-ad-full"><label>Appels</label><input type="text" value="'+_esc(d.calls)+'" placeholder="Ex : Illimités vers Mobilis" oninput="window._cv3AdSet('+d._k+',&quot;calls&quot;,this.value)"></div>'
      +'<div class="cv3-ad-full"><label>SMS</label><input type="text" value="'+_esc(d.sms)+'" placeholder="Ex : 50 SMS tous réseaux" oninput="window._cv3AdSet('+d._k+',&quot;sms&quot;,this.value)"></div>'
      +'<div class="cv3-ad-full"><label>Avantages (un par ligne)</label><textarea style="min-height:60px" oninput="window._cv3AdSet('+d._k+',&quot;extras&quot;,this.value)">'+_esc((d.extras||[]).join('\n'))+'</textarea></div>'
      +'<div class="cv3-ad-full"><label>Lien officiel</label><input type="url" value="'+_esc(d.link)+'" placeholder="https://..." oninput="window._cv3AdSet('+d._k+',&quot;link&quot;,this.value)"></div>'
    +'</div>'
  +'</details>';
}

function _cv3SubmitLabel(){
  var n = _cv3Drafts.filter(function(d){return d.on;}).length;
  var btn = document.getElementById('cv3adSubmitBtn');
  if(!btn) return;
  btn.disabled = !n;
  btn.textContent = n>1 ? '✅ Ajouter les '+n+' offres au comparateur'
     : n===1 ? '✅ Confirmer et ajouter au comparateur' : '✅ Aucune offre sélectionnée';
}

function _cv3RenderDrafts(){
  var box = document.getElementById('cv3adDrafts');
  if(!box) return;
  var open = _cv3Drafts.length <= 3;
  box.innerHTML = _cv3Drafts.map(function(d,i){ return _cv3DraftHTML(d,i,open); }).join('')
    || '<div class="cv3-ad-report">Aucun brouillon. Analysez une source ou ajoutez une offre manuellement.</div>';
  _cv3SubmitLabel();
}

function _buildAddModal(){
  return '<div class="cv3-overlay" id="cv3admodal" onclick="if(event.target===this)window._cv3AdClose()">'
    +'<div class="cv3-modal">'
      +'<div class="cv3-mhead">'
        +'<span class="cv3-mtitle">➕ Ajouter des offres</span>'
        +'<button class="cv3-mclose" onclick="window._cv3AdClose()">✕</button>'
      +'</div>'
      +'<div class="cv3-ad-tabs">'
        +'<button type="button" class="cv3-ad-tab on" data-src="file" onclick="window._cv3AdSrcTab(\'file\',this)">📄 Fichier (PDF/Image)</button>'
        +'<button type="button" class="cv3-ad-tab" data-src="url" onclick="window._cv3AdSrcTab(\'url\',this)">🔗 URL</button>'
        +'<button type="button" class="cv3-ad-tab" data-src="text" onclick="window._cv3AdSrcTab(\'text\',this)">📋 Texte collé</button>'
      +'</div>'
      +'<div class="cv3-ad-src">'
        +'<input type="file" id="cv3adFile" accept=".pdf,.jpg,.jpeg,.png">'
        +'<input type="url" id="cv3adUrl" placeholder="https://... communiqué ou grille tarifaire" style="display:none">'
        +'<textarea id="cv3adText" placeholder="Coller ici le texte du communiqué ou de la grille tarifaire (une ou plusieurs offres)..." style="display:none"></textarea>'
        +'<button type="button" class="cv3-ad-analyzebtn" id="cv3adAnalyzeBtn" onclick="window._cv3AdAnalyze()">🔍 Analyser</button>'
        +'<div class="cv3-ad-status" id="cv3adStatus">Une grille tarifaire complète est acceptée : toutes les offres détectées seront proposées.</div>'
      +'</div>'
      +'<div id="cv3adDrafts"></div>'
      +'<div class="cv3-ad-bar">'
        +'<button type="button" class="cv3-ad-minibtn" id="cv3adVeilleBtn" onclick="window._cv3AdVeille()">🔔 Veille auto</button>'
        +'<button type="button" class="cv3-ad-minibtn" onclick="window._cv3AdAdd()">➕ Offre vide</button>'
        +'<button type="button" class="cv3-ad-minibtn" onclick="window._cv3AdAll(true)">☑ Tout cocher</button>'
        +'<button type="button" class="cv3-ad-minibtn" onclick="window._cv3AdAll(false)">☐ Tout décocher</button>'
      +'</div>'
      +'<button type="button" class="cv3-ad-submitbtn" id="cv3adSubmitBtn" onclick="window._cv3AdSubmit()">✅ Confirmer et ajouter au comparateur</button>'
    +'</div></div>';
}

window._cv3OpenAdd = function(){
  var old=document.getElementById('cv3admodal');
  if(old) old.remove();
  _cv3Drafts = [_cv3BlankDraft('')];
  document.body.insertAdjacentHTML('beforeend', _buildAddModal());
  _cv3RenderDrafts();
  _cv3PendingCount();
};

// Nombre de nouveautés repérées par la veille (scrape-offres.js)
async function _cv3PendingCount(){
  try{
    var r = await fetch('/api/comparateur/pending');
    if(!r.ok) return;
    var j = await r.json();
    var n = (j.detected||[]).length, c = (j.changed||[]).length;
    var b = document.getElementById('cv3adVeilleBtn');
    if(b && (n||c)) b.innerHTML = '🔔 Veille auto ('+n+(c?' + '+c+' ⚠':'')+')';
    if((n||c) && b) b.style.borderColor = '#ffd700', b.style.color = '#ffd700';
  }catch(e){}
}
window._cv3AdClose = function(){ var m=document.getElementById('cv3admodal'); if(m) m.remove(); _cv3Drafts=[]; };

window._cv3AdSrcTab = function(mode, btn){
  document.querySelectorAll('.cv3-ad-tab').forEach(function(b){b.classList.remove('on');});
  btn.classList.add('on');
  document.getElementById('cv3adFile').style.display = mode==='file' ? 'block' : 'none';
  document.getElementById('cv3adUrl').style.display  = mode==='url'  ? 'block' : 'none';
  document.getElementById('cv3adText').style.display = mode==='text' ? 'block' : 'none';
};

window._cv3AdSet = function(k, field, val){
  var d=_cv3Draft(k); if(!d) return;
  if(field==='extras') d.extras = val.split('\n').map(function(s){return s.trim();}).filter(Boolean);
  else d[field] = val;
  if(field==='name'){ var t=document.getElementById('cv3adT'+k); if(t) t.textContent = val || 'Sans nom'; }
  if(field==='price'){ var pz=document.getElementById('cv3adP'+k); if(pz) pz.textContent = val ? val+' DA' : ''; }
  if(field==='op'){
    var o=document.getElementById('cv3adO'+k), op=COMP_OPS[val];
    if(o) o.textContent = op?op.name:'?';
    var box=document.querySelector('.cv3-ad-draft[data-k="'+k+'"]');
    if(box && op) box.style.cssText='--oc:'+op.color+';--oc-rgb:'+op.rgb;
  }
};
window._cv3AdToggle = function(k, on){
  var d=_cv3Draft(k); if(!d) return;
  d.on = on;
  var box=document.querySelector('.cv3-ad-draft[data-k="'+k+'"]');
  if(box) box.classList.toggle('off', !on);
  _cv3SubmitLabel();
};
window._cv3AdAll = function(on){ _cv3Drafts.forEach(function(d){d.on=on;}); _cv3RenderDrafts(); };
window._cv3AdDel = function(k){ _cv3Drafts=_cv3Drafts.filter(function(d){return d._k!==k;}); _cv3RenderDrafts(); };
window._cv3AdAdd = function(){
  var last=_cv3Drafts[_cv3Drafts.length-1];
  _cv3Drafts.push(_cv3BlankDraft(last?last.op:''));
  _cv3RenderDrafts();
};

window._cv3AdVeille = async function(){
  var statusEl = document.getElementById('cv3adStatus');
  statusEl.textContent = '⏳ Lecture de la file de veille...';
  try{
    var r = await fetch('/api/comparateur/pending');
    var j = await r.json();
    if(!r.ok) throw new Error(j.error||'Veille indisponible');
    var det = j.detected||[], chg = j.changed||[];
    if(!det.length && !chg.length){
      statusEl.textContent = 'ℹ️ Aucune nouveauté en attente. Dernier passage : '
        + (j.generatedAt ? new Date(j.generatedAt).toLocaleString('fr-FR') : 'jamais')
        + '. Lancer : node scrape-offres.js';
      return;
    }
    _cv3Drafts = _cv3Drafts.filter(function(d){ return d.name || d.price; });
    det.forEach(function(o){
      var d = _cv3BlankDraft(o.op||'');
      d.name=o.name||''; d.type=o.type||'prepaid'; d.price=o.price||''; d.data=(o.data===0||o.data)?o.data:'';
      d.validity=o.validity||30; d.calls=o.calls||''; d.sms=o.sms||'';
      d.intl=!!o.intl; d.extras=Array.isArray(o.extras)?o.extras:[]; d.link=o.link||'';
      _cv3Drafts.push(d);
    });
    _cv3RenderDrafts();
    var msg = '🔔 <b>'+det.length+'</b> nouveauté(s) détectée(s) automatiquement';
    if(chg.length){
      msg += ' · <span class="ko">'+chg.length+' tarif(s) modifié(s) : '
        + chg.map(function(c){return _esc(c.name)+' '+c.was.price+'→'+c.now.price+' DA';}).join(', ')
        + ' (à corriger à la main)</span>';
    }
    statusEl.innerHTML = msg + ' — vérifiez avant publication.';
  }catch(e){
    statusEl.textContent = '❌ '+e.message;
  }
};

window._cv3AdAnalyze = async function(){
  var statusEl = document.getElementById('cv3adStatus');
  var btn = document.getElementById('cv3adAnalyzeBtn');
  var activeTab = document.querySelector('.cv3-ad-tab.on');
  var mode = activeTab ? activeTab.dataset.src : 'file';
  btn.disabled = true;
  statusEl.textContent = '⏳ Extraction en cours...';
  try{
    var text = '';
    if(mode==='file'){
      var f = document.getElementById('cv3adFile').files[0];
      if(!f) throw new Error('Choisissez un fichier');
      var fd = new FormData(); fd.append('file', f);
      var r = await fetch('/api/extract-communique', { method:'POST', body: fd });
      var j = await r.json();
      if(!r.ok) throw new Error(j.error||'Extraction échouée');
      text = j.rawText;
    } else if(mode==='url'){
      var url = document.getElementById('cv3adUrl').value.trim();
      if(!url) throw new Error('Collez une URL');
      var r2 = await fetch('/api/fetch-url', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({url:url}) });
      var j2 = await r2.json();
      if(!r2.ok) throw new Error(j2.error||'Extraction échouée');
      text = j2.text;
    } else {
      text = document.getElementById('cv3adText').value.trim();
      if(!text) throw new Error('Collez le texte du communiqué');
    }

    statusEl.textContent = '🤖 Analyse IA en cours...';
    var r3 = await fetch('/api/comparateur/structure', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({rawText:text}) });
    var res = await r3.json();
    if(!r3.ok) throw new Error(res.error||'Analyse échouée');

    var found = Array.isArray(res.offers) ? res.offers : ((res.name || res.price) ? [res] : []);
    if(!found.length) throw new Error('Aucune offre détectée dans cette source');

    // Les brouillons vides sont remplacés, ceux déjà remplis sont conservés
    _cv3Drafts = _cv3Drafts.filter(function(d){ return d.name || d.price; });
    found.forEach(function(o){
      var d = _cv3BlankDraft(o.op||'');
      d.name = o.name||'';
      d.type = ['prepaid','postpaid','internet'].indexOf(o.type)>=0 ? o.type : 'prepaid';
      d.price = o.price||'';
      d.data = (o.data===0||o.data) ? o.data : '';
      d.validity = o.validity||30; d.calls = o.calls||''; d.sms = o.sms||'';
      d.intl = !!o.intl; d.extras = Array.isArray(o.extras)?o.extras:[]; d.link = o.link||'';
      _cv3Drafts.push(d);
    });
    _cv3RenderDrafts();
    statusEl.innerHTML = '✅ <b>'+found.length+'</b> offre'+(found.length>1?'s':'')+' détectée'+(found.length>1?'s':'')
      +' — vérifiez chaque bloc, décochez celles à écarter, puis confirmez.';
  }catch(e){
    statusEl.textContent = '❌ '+e.message;
  }finally{
    btn.disabled = false;
  }
};

window._cv3AdSubmit = async function(){
  var btn = document.getElementById('cv3adSubmitBtn');
  var statusEl = document.getElementById('cv3adStatus');
  var sel = _cv3Drafts.filter(function(d){return d.on;});
  if(!sel.length){ statusEl.textContent = '❌ Aucune offre sélectionnée.'; return; }

  var bad = sel.filter(function(d){ return !d.op || !String(d.name).trim() || !(parseFloat(d.price)>0); });
  if(bad.length){
    statusEl.textContent = '❌ '+bad.length+' offre(s) incomplète(s) : opérateur, nom et prix sont requis.';
    return;
  }

  var payload = sel.map(function(d){
    return { op:d.op, name:String(d.name).trim(), type:d.type,
             price:parseFloat(d.price), data:parseFloat(d.data)||0,
             validity:parseFloat(d.validity)||30, calls:d.calls, sms:d.sms,
             intl:!!d.intl, extras:d.extras, link:d.link };
  });

  btn.disabled = true;
  statusEl.textContent = '⏳ Ajout de '+payload.length+' offre(s)...';
  try{
    var r = await fetch('/api/comparateur/offers', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({offers:payload}) });
    var j = await r.json();
    if(!r.ok) throw new Error(j.error||"Échec de l'ajout");
    (j.added||[]).forEach(function(o){ COMP_OFFERS.push(o); });
    _render();
    if((j.added||[]).length){
      fetch('/api/comparateur/pending/clear', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ names: j.added.map(function(o){return o.name;}) }) }).catch(function(){});
    }
    if((j.skipped||[]).length){
      _cv3Drafts = [];
      _cv3RenderDrafts();
      statusEl.innerHTML = '<b>'+(j.added||[]).length+' ajoutée(s)</b> · <span class="ko">'
        + j.skipped.map(function(s){return _esc(s.name)+' ('+_esc(s.reason)+')';}).join(', ')+'</span>';
      btn.disabled = false;
    } else {
      window._cv3AdClose();
      if(typeof showToast==='function') showToast('✅ '+(j.added||[]).length+' offre(s) ajoutée(s)');
    }
  }catch(e){
    statusEl.textContent = '❌ '+e.message;
    btn.disabled = false;
  }
};

/* ══ Entry point ═════════════════════════════════════════════ */
window.initComparateur = async function(){
  var sec=document.getElementById('comparateurSection');
  if(!sec) return;
  if(!sec.querySelector('.cv3')){
    await _cv3LoadOffers();
    sec.innerHTML=_buildHTML();
  }
  _C = { budget:9999, data:0, type:'any', ops:new Set(['mobilis','djezzy','ooredoo']), view:'battle', sort:'score', duel:[], profile:null };
  _tray(); _render();
  // Restore day/night preference
  if (localStorage.getItem('cv3-theme') === 'day') {
    var _cv3el = sec.querySelector('.cv3');
    if (_cv3el) {
      _cv3el.classList.add('cv3-day');
      var _cv3btn = document.getElementById('cv3-daybtn');
      if (_cv3btn) _cv3btn.innerHTML = '&#127769; Nuit';
    }
  }
};
window._cv3ToggleDay = function() {
  var cv3 = document.querySelector('.cv3');
  if (!cv3) return;
  var isDay = cv3.classList.toggle('cv3-day');
  localStorage.setItem('cv3-theme', isDay ? 'day' : 'night');
  var btn = document.getElementById('cv3-daybtn');
  if (btn) btn.innerHTML = isDay ? '&#127769; Nuit' : '&#9728; Jour';
};
