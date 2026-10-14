"use strict";
/* ================= Utilidades ================= */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const store={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
const fmt=n=>n.toLocaleString("en-US");
const money=n=>"RD$"+fmt(n);
const costTxt=s=>s.c?`RD$${fmt(s.c[0])} – ${fmt(s.c[1])}`:"Cuota litis";
const costSub=s=>s.c?(s.x||""):(s.x||"").replace(/^Cuota litis:\s*/,"");
const first=t=>{const m=t.match(/^.*?[.!?](\s|$)/);return m?m[0].trim():t};

/* Índices */
const SRV={},AREA={}; let TOTAL=0;
const areaMin=a=>{const v=a.s.filter(s=>s.c).map(s=>+s.c[0]);return v.length?Math.min(...v):0};
const areaMax=a=>{const v=a.s.filter(s=>s.c).map(s=>+s.c[1]);return v.length?Math.max(...v):0};
const rich=t=>esc(t).replace(/\*([^*]+)\*/g,"<em>$1</em>").replace(/\{areas\}/g,AREAS.length).replace(/\{servicios\}/g,TOTAL);

/* ================= Íconos ================= */
const IC={
 family:'<circle cx="8" cy="7" r="3"/><circle cx="17" cy="8" r="2.5"/><path d="M2.5 20c.6-3.6 2.8-6 5.5-6s4.9 2.4 5.5 6M13.5 15.5c.9-1.3 2.1-2 3.5-2 2.3 0 4 1.9 4.5 5"/>',
 scroll:'<path d="M7 3h11a2 2 0 0 1 2 2v2h-4"/><path d="M16 7v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2h10"/><path d="M7 3a2 2 0 0 0-2 2v12M9 8h4M9 12h4"/>',
 house:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
 contract:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
 coins:'<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 15v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.6-2.3-2.8-5.4-3"/>',
 briefcase:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
 gavel:'<path d="M14 4l6 6M11 7l6 6M12.5 5.5l-4 4M17.5 10.5l-4 4M10.5 11.5L4 18l2 2 6.5-6.5M3 21h9"/>',
 building:'<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
 receipt:'<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
 passport:'<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3.2"/><path d="M8.8 10h6.4M9 17h6"/>',
 bulb:'<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
 landmark:'<path d="M3 21h18M4 10h16M12 3l9 5H3z"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/>',
 card:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
 car:'<path d="M5 16v-5l2-5h10l2 5v5M3 16h18v3H3zM5 11h14"/><circle cx="7.5" cy="13.5" r=".8"/><circle cx="16.5" cy="13.5" r=".8"/>',
 stamp:'<path d="M9 13V9a3 3 0 1 1 6 0v4"/><path d="M5 13h14v4H5zM6 21h12"/>',
 column:'<path d="M4 21h16M5 18h14M6 6h12M12 3l7 3H5z"/><path d="M8 6v12M12 6v12M16 6v12"/>',
 chip:'<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/><rect x="9.5" y="9.5" width="5" height="5"/>',
 handshake:'<path d="M11 17l2 2a1.4 1.4 0 0 0 2-2M13 15l2.5 2.5a1.4 1.4 0 0 0 2-2L14 12"/><path d="M3 12l4-4 4 1 3-2 7 5-3 3M3 12l6 6a1.4 1.4 0 0 0 2-2l-1-1"/>',
 pulse:'<path d="M3 12h4l2-5 4 10 2-5h6"/>',
 leaf:'<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15M5 19c3-4 6-6 10-8"/>',
 chart:'<path d="M4 4v16h16M7 8l4 4 3-2 5 6"/>',
 home:'<path d="M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 tag:'<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
 route:'<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16"/>',
 scale:'<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z"/>',
 chat:'<path d="M21 12a8 8 0 0 1-11.8 7L4 20.5l1.5-5A8 8 0 1 1 21 12z"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 moon:'<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
 menu:'<path d="M4 7h16M4 12h10M4 17h16"/>',
 x:'<path d="M6 6l12 12M18 6L6 18"/>',
 arr:'<path d="M5 12h14M13 6l6 6-6 6"/>',
 arrl:'<path d="M19 12H5M11 6l-6 6 6 6"/>',
 ne:'<path d="M7 17L17 7M8 7h9v9"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 doc:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
 check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
 minus:'<path d="M6 6l12 12M18 6L6 18"/>',
 phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
 pin:'<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
 wa:'<path d="M21 12a8 8 0 0 1-11.8 7L4 20.5l1.5-5A8 8 0 1 1 21 12z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2z"/>',
 video:'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
 office:'<path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5M9 11h.01M15 11h.01"/>',
 cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
 alert:'<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5h.01"/>',
 shield:'<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
 eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 steps:'<path d="M4 20h4v-4h4v-4h4V8h4"/>',
 pen:'<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
 percent:'<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
 layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
 repeat:'<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
 book:'<path d="M4 4h6a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h7z"/>',
 key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>',
 users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.7-3.7 3.3-6 6.5-6s5.8 2.3 6.5 6"/><path d="M16 4.5a3.2 3.2 0 0 1 0 6.3M18.5 14.5c1.7.8 2.8 2.7 3 5.5"/>',
 dots:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
 inbox:'<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
 bed:'<path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.6"/>',
 bath:'<path d="M4 12h17v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2"/>',
 park:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3"/>',
 ruler:'<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
 camera:'<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
 trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
 edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
 badge:'<path d="M12 3l2.4 1.8 3-.1.9 2.9 2.4 1.8-1 2.8 1 2.8-2.4 1.8-.9 2.9-3-.1L12 21l-2.4-1.8-3 .1-.9-2.9L3.3 14.6l1-2.8-1-2.8 2.4-1.8.9-2.9 3 .1z"/><path d="M8.5 12l2.4 2.4 4.6-4.8"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 cap:'<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c2 2 10 2 12 0v-5M22 9v6"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
 copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'
};
const ic=(n,c="")=>`<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]||""}</svg>`;

/* ================= Sello / logo ================= */
let sealN=0;
function seal(full=true,opts={}){
  const id="sp"+(sealN++);
  const ring=full?`<defs><path id="${id}" d="M60,60 m-47,0 a47,47 0 1,1 94,0 a47,47 0 1,1 -94,0"/></defs>
   <g class="ring-t"><text><textPath href="#${id}" startOffset="0">SALVADOR LÓPEZ DE LA ROSA · ABOGADOS · CONSULTORÍA ·</textPath></text></g>`:"";
  const inner=full?39:52;
  return `<svg class="seal" viewBox="0 0 120 120" aria-hidden="true">
   <circle cx="60" cy="60" r="58" fill="${opts.fill||"var(--surface)"}" stroke="var(--brass)" stroke-width="1.4"/>
   ${full?`<circle cx="60" cy="60" r="${inner}" fill="none" stroke="var(--brass)" stroke-width=".8"/>`:`<circle cx="60" cy="60" r="${inner}" fill="none" stroke="var(--brass)" stroke-width=".7" stroke-dasharray="1.5 3"/>`}
   ${ring}
   <g class="sl-g">
    <text x="51" y="${full?72:74}" text-anchor="middle" font-size="${full?40:52}" font-style="italic" font-weight="500" fill="${opts.ink||"var(--ink)"}">S</text>
    <text x="${full?71:74}" y="${full?72:74}" text-anchor="middle" font-size="${full?40:52}" font-weight="600" fill="var(--brass)">L</text>
    <path d="M${full?38:32} ${full?80:84}h${full?44:56}" stroke="${opts.ink||"var(--ink)"}" stroke-width="1"/>
    <path d="M60 ${full?77:81}l3 3-3 3-3-3z" fill="var(--brass)"/>
   </g></svg>`;
}
function stampSvg(txt1="RECIBIDO",txt2=""){
  const id="st"+(sealN++);
  return `<svg class="seal" viewBox="0 0 120 120" aria-hidden="true">
   <defs><path id="${id}" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0"/></defs>
   <circle cx="60" cy="60" r="56" fill="none" stroke="var(--brass)" stroke-width="2.4"/>
   <circle cx="60" cy="60" r="36" fill="none" stroke="var(--brass)" stroke-width="1.2"/>
   <text font-family="IBM Plex Mono,monospace" font-size="8.2" letter-spacing="2.4" fill="var(--brass)"><textPath href="#${id}">SL ABOGADOS · ${txt1} · ${txt2} ·</textPath></text>
   <text x="60" y="70" text-anchor="middle" font-family="Bodoni Moda,Georgia,serif" font-size="30" font-style="italic" fill="var(--brass)">SL</text>
  </svg>`;
}

/* ================= Shell ================= */
const NAV=[["inicio","Inicio","home"],["areas","Áreas","grid"],["inmuebles","Inmuebles","key"],["abogados","Abogados","users"],["honorarios","Honorarios","tag"],["proceso","Proceso","route"],["despacho","Despacho","scale"],["contacto","Contacto","chat"]];
const BNAV=[["inicio","Inicio","home"],["areas","Áreas","grid"],["inmuebles","Inmuebles","key"],["abogados","Abogados","users"],["contacto","Contacto","chat"]];
function paintDrAreas(){const b=$("#drAreas");if(b)b.innerHTML=AREAS.map((a,i)=>`<a class="dr-a" href="#area.${a.id}" data-area="${a.id}" style="--i:${i+9}">${ic(a.ic)}${esc(a.n)}<span class="ct">${a.s.length}</span></a>`).join("")}
function paintDrFoot(){$("#drFoot").innerHTML=`<b style="color:var(--ink)">Salvador López de la Rosa</b><span>${esc(CONTACT.tel)} · ${esc(CONTACT.email)}</span><span>${esc(CONTACT.horario[0][0])}: ${esc(CONTACT.horario[0][1])}</span>`}
function shell(){
  $("#logoHead").innerHTML=seal(false)+`<span class="wm"><b>SL <i>Abogados</i></b><small>Consultoría jurídica</small></span>`;
  $("#bnav").innerHTML=`<span class="bn-ind" id="bnInd"></span>`+BNAV.map(([id,l,i])=>`<a class="bn" href="#${id}" data-nav="${id}" aria-label="${l}">${ic(i)}<span>${l}</span></a>`).join("")+`<button class="bn" data-more data-nav="mas" aria-label="Más secciones">${ic("dots")}<span>Más</span></button>`;
  $("#drLogo").innerHTML=seal(false)+`<span class="wm"><b>SL <i>Abogados</i></b><small>Salvador López de la Rosa</small></span>`;
  let k=0;
  $("#drBody").innerHTML=`<div class="dr-sec">Navegación</div>`+
   NAV.map(([id,l,i])=>`<a class="dr-a" href="#${id}" data-nav="${id}" style="--i:${k++}">${ic(i)}${l}</a>`).join("")+`<a class="dr-a" href="#panel" data-nav="panel" id="drPanel" style="--i:${k++}">${ic("lock")}<span id="drPanelLb">Acceso del equipo</span><span class="ct" id="drPanelCt"></span></a>`+
   `<div class="dr-sec">Áreas de práctica</div><div id="drAreas"></div>`+
   `<div class="dr-sec">Apariencia</div><div class="seg" id="themeSeg"><button data-t="light">Claro</button><button data-t="dark">Oscuro</button><button data-t="system">Sistema</button></div>`;
  paintDrFoot();paintDrAreas();
  $("#splashSeal").innerHTML=seal(true);
}

/* ================= Tema ================= */
function isDark(){const a=document.documentElement.dataset.theme;return a?a==="dark":matchMedia("(prefers-color-scheme: dark)").matches}
function paintTheme(){
  $("#themeBtn").innerHTML=ic(isDark()?"sun":"moon");
  const cur=document.documentElement.dataset.theme||"system";
  $$("#themeSeg button").forEach(b=>b.classList.toggle("on",b.dataset.t===cur));
}
function setTheme(t,ev){
  const apply=()=>{if(t==="system"){delete document.documentElement.dataset.theme;store.del("sl-theme")}else{document.documentElement.dataset.theme=t;store.set("sl-theme",t)}paintTheme()};
  if(document.startViewTransition&&!reduce&&ev){
    const x=ev.clientX||innerWidth-40,y=ev.clientY||40,r=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
    const tr=document.startViewTransition(apply);
    tr.ready.then(()=>document.documentElement.animate({clipPath:[`circle(0 at ${x}px ${y}px)`,`circle(${r}px at ${x}px ${y}px)`]},{duration:650,easing:"cubic-bezier(.2,.7,.2,1)",pseudoElement:"::view-transition-new(root)"})).catch(()=>{});
  }else apply();
}
const savedTheme=store.get("sl-theme"); if(savedTheme)document.documentElement.dataset.theme=savedTheme;

/* ================= Router ================= */
let route="", timers=[];
const view=()=>$("#view");
function parse(h){h=(h||"").replace(/^#/,"");if(!h)return"inicio";return h}
function navKey(r){if(r.startsWith("area.")||r.startsWith("srv."))return"areas";if(r.startsWith("inm.")||r==="publicar")return"inmuebles";if(r.startsWith("abg."))return"abogados";if(["honorarios","proceso","despacho","panel","login"].includes(r))return"mas";return r}
function valid(r){if(NAV.some(n=>n[0]===r)||r==="publicar"||r==="panel"||r==="login")return true;if(/^(inm|abg)\.[\w-]+$/.test(r))return true;if(r.startsWith("area."))return!!AREA[r.slice(5)];if(r.startsWith("srv."))return!!SRV[r.slice(4)];return false}
function go(r,push=true){
  if(!valid(r))r="inicio";
  closeDrawer();if(CV.sel)closeSheet();
  if(r===route){window.scrollTo({top:0,behavior:reduce?"auto":"smooth"});return}
  const first=!route;
  timers.forEach(clearInterval);timers=[];
  const bar=$("#routeBar");bar.classList.remove("go");void bar.offsetWidth;bar.classList.add("go");
  const swap=()=>{
    route=r;render();window.scrollTo(0,0);
    view().classList.remove("out");
    $$(".rv",view()).forEach((el,i)=>el.style.setProperty("--i",Math.min(i,12)));
    markNav();showNav();renderFab();
    if(push){try{history.pushState({r},"","#"+r)}catch(e){}}
  };
  if(first||reduce)swap();else{view().classList.add("out");setTimeout(swap,240)}
}
function markNav(){
  const k=navKey(route);
  $$(".bn").forEach(b=>{const on=b.dataset.nav===k;b.classList.toggle("on",on);if(on)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
  $$(".dr-a").forEach(a=>a.classList.toggle("on",a.dataset.nav===route||(a.dataset.nav===k&&k!=="mas")||(route==="area."+a.dataset.area)||(route.startsWith("srv.")&&SRV[route.slice(4)]&&SRV[route.slice(4)].area.id===a.dataset.area)));
  moveInd();
  const t={inicio:"Inicio",areas:"Áreas de práctica",honorarios:"Honorarios",proceso:"Cómo trabajamos",despacho:"El despacho",contacto:"Agendar consulta",inmuebles:"Inmuebles",publicar:"Publicar propiedad",abogados:"Abogados",panel:"CRM del despacho",login:"Acceso del equipo"}[route]||(route.startsWith("area.")?AREA[route.slice(5)].n:route.startsWith("srv.")?SRV[route.slice(4)].n:route.startsWith("inm.")?"Inmueble":route.startsWith("abg.")?"Perfil de abogado":"");
  document.title=t+" · SL Abogados";
}
function moveInd(){const a=$(".bn.on"),ind=$("#bnInd");if(!a||!ind)return;ind.style.left=a.offsetLeft+"px";ind.style.width=a.offsetWidth+"px"}

/* ================= Vistas ================= */
function render(){
  const v=view();
  if(route==="inicio")v.innerHTML=vHome();
  else if(route==="areas")v.innerHTML=vAreas();
  else if(route.startsWith("area."))v.innerHTML=vArea(AREA[route.slice(5)]);
  else if(route.startsWith("srv."))v.innerHTML=vSrv(SRV[route.slice(4)]);
  else if(route==="honorarios")v.innerHTML=vFees();
  else if(route==="proceso")v.innerHTML=vProc();
  else if(route==="despacho")v.innerHTML=vDesp();
  else if(route==="contacto")v.innerHTML=vContact();
  else if(route==="inmuebles")v.innerHTML=vInm();
  else if(route.startsWith("inm."))v.innerHTML=vInmDet(route.slice(4));
  else if(route==="publicar")v.innerHTML=vPub();
  else if(route==="abogados")v.innerHTML=vAbg();
  else if(route.startsWith("abg."))v.innerHTML=vAbgDet(route.slice(4));
  else if(route==="panel")v.innerHTML=vPanel();
  else if(route==="login")v.innerHTML=vLogin();
  v.innerHTML+=footer();
  after();
}
function after(){
  if(route==="inicio"){startFichas();startTyping()}
  if(route==="areas"){bindAreaFilter()}
  if(route==="honorarios"){bindFees()}
  if(route==="proceso"){bindGloss()}
  if(route==="contacto"){drawWizard()}
  if(route.startsWith("srv."))bindDocs();
  extAfter();
}
const crumbs=items=>`<nav class="crumbs rv" aria-label="Ruta">${items.map((it,i)=>i<items.length-1?`<a href="#${it[1]}">${esc(it[0])}</a><span class="sep">/</span>`:`<span aria-current="page">${esc(it[0])}</span>`).join("")}</nav>`;
const areaCard=a=>`<a class="acard rv" href="#area.${a.id}"><span class="arr">${ic("ne")}</span><span class="ic">${ic(a.ic)}</span><h3>${esc(a.n)}</h3><p>${esc(a.sh)}</p><div class="meta"><span>${a.s.length} servicios</span><b>${areaMin(a)?"desde "+money(areaMin(a)):"Consultar"}</b></div></a>`;
function footer(){return `<footer class="ft"><p><b style="color:var(--ink)">SL Abogados · Salvador López de la Rosa.</b> La información de este sitio es orientativa y no sustituye una consulta legal. Honorarios referenciales en pesos dominicanos; no incluyen ITBIS (18 %), impuestos, tasas ni gastos del proceso. © 2026.</p><div class="fr"><a href="#areas">Áreas</a><a href="#honorarios">Honorarios</a><a href="#proceso">Preguntas frecuentes</a><a href="#despacho">Despacho</a><a href="#contacto">Agendar consulta</a><a href="#login">${ic("lock").replace('class="i "','class="i " style="width:14px;height:14px;vertical-align:-2px;margin-right:4px"')}Acceso del equipo</a></div></footer>`}

/* ---------- Inicio ---------- */
const FEATURED=["familia","sucesiones","inmobiliario","laboral","penal","empresas","migratorio","cobros"];
const FICHAS=["divorcio-mutuo","compraventa","despido","constitucion","residencia-temporal","determinacion-herederos"];
function featuredIds(){return [...new Set(FEATURED.filter(id=>AREA[id]).concat(AREAS.map(a=>a.id)))].slice(0,8)}
function fichaIds(){return [...new Set(FICHAS.filter(id=>SRV[id]&&SRV[id].c).concat(Object.values(SRV).filter(s=>s.c).map(s=>s.id)))].slice(0,6)}
function vHome(){
  return `
  <section class="hero">
   <div>
    <span class="eyebrow rv">${rich(TEXTOS.heroEyebrow)}</span>
    <h1 class="reveal-h">${rich(TEXTOS.heroTitulo)}</h1>
    <p class="lead rv">${rich(TEXTOS.heroLead)}</p>
    <div class="ctas rv"><a class="btn pri" href="#contacto">${ic("cal")}Agendar consulta</a><a class="btn" href="#areas">Ver las ${AREAS.length} áreas${ic("arr","arr")}</a></div>
    <button class="qsearch rv" data-pal>${ic("search")}<span class="ph-t">¿Qué necesita resolver? <b id="typed">divorcio</b></span><span class="go">${ic("arr")}</span></button>
   </div>
   <div class="fichas rv" id="fichas" aria-label="Ejemplos de servicios">
    ${fichaIds().map((id,i)=>{const s=SRV[id];return `<a class="ficha" href="#srv.${id}" data-p="${i<3?i:"x"}" aria-label="${esc(s.n)}">
      <div class="fh"><span>Expediente · ${esc(s.area.n.split(" ")[0])}</span><span>N.º ${String(i+1).padStart(3,"0")}</span></div>
      <h3>${esc(s.n)}</h3>
      <dl><div><dt>Honorarios</dt><dd class="num">${costTxt(s)}</dd></div><div><dt>Duración</dt><dd>${esc(s.t)}</dd></div><div><dt>Etapas</dt><dd>${s.p.length} pasos</dd></div></dl>
      <span class="fl">Consulta inicial desde ${money(CONSULTA.llamada)}</span>
      <div class="steps-mini">${s.p.map((_,k)=>`<i class="${k<2?"f":""}"></i>`).join("")}</div>
      <span class="stamp">${stampSvg("TARIFA CLARA","RD")}</span></a>`}).join("")}
   </div>
  </section>
  <div id="bkSlot">${bookingCard()}</div>
  <div class="stats rv">
   <div class="stat"><b>${AREAS.length}</b><span>áreas del derecho</span></div>
   <div class="stat"><b>${TOTAL}</b><span>servicios con precio y plazo publicados</span></div>
   <div class="stat"><b><em>24</em> h</b><span>tiempo máximo de respuesta laborable</span></div>
   <div class="stat"><b class="num"><small style="font-size:.45em">RD$</small>${fmt(CONSULTA.virtual)}</b><span>consulta inicial por videollamada</span></div>
  </div>
  <section class="sec">
   <div class="sec-hd rv"><div><span class="eyebrow">Áreas más consultadas</span><h2 class="h2" style="margin-top:10px">¿En qué le <em>podemos</em> ayudar?</h2></div><a class="link" href="#areas">Ver todas ${ic("arr")}</a></div>
   <div class="agrid">${featuredIds().map(id=>areaCard(AREA[id])).join("")}</div>
  </section>
  <section class="sec">
   <div class="sec-hd rv"><div><span class="eyebrow">Cómo funciona</span><h2 class="h2" style="margin-top:10px">De la consulta a la solución, <em>en cuatro pasos</em>.</h2></div><a class="link" href="#proceso">El proceso completo ${ic("arr")}</a></div>
   <div class="howto">
    <div class="hw rv"><h4>Agende su consulta</h4><p>Elija el tema, la modalidad y la hora. Presencial, por videollamada o por teléfono.</p></div>
    <div class="hw rv"><h4>Cuéntenos su caso</h4><p>Revisamos sus documentos y le explicamos sus opciones reales, con sus riesgos.</p></div>
    <div class="hw rv"><h4>Propuesta por escrito</h4><p>Recibe el monto exacto, la forma de pago y el calendario estimado antes de firmar.</p></div>
    <div class="hw rv"><h4>Seguimiento constante</h4><p>Le informamos en cada etapa y recibe copia de cada escrito y decisión.</p></div>
   </div>
  </section>
  <section class="sec">
   <div class="princ">
    <div class="pr card rv">${ic("tag")}<h4>Precio claro desde el inicio</h4><p>Publicamos honorarios de referencia de cada servicio. Sin sorpresas ni cobros que no se hablaron.</p></div>
    <div class="pr card rv">${ic("steps")}<h4>Cada paso explicado</h4><p>Sabrá qué se hace, quién lo hace y cuánto tarda cada etapa, en palabras sencillas.</p></div>
    <div class="pr card rv">${ic("lock")}<h4>Secreto profesional</h4><p>Todo lo que nos cuente queda protegido, aunque decida no contratar el servicio.</p></div>
   </div>
  </section>
  ${homeTeasers()}
  <section class="band rv">
   <div><h2>${rich(TEXTOS.bandaTitulo)}</h2><p>${rich(TEXTOS.bandaTexto)}</p><div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn" href="#contacto">${ic("cal")}Agendar consulta</a></div></div>
   <div class="bseal">${seal(true,{fill:"transparent",ink:"var(--on-green)"})}</div>
  </section>`;
}
let fichaK=0;
function startFichas(){
  const box=$("#fichas");if(!box||reduce)return;
  const cards=$$(".ficha",box),N=cards.length;
  const paint=()=>cards.forEach((c,i)=>{const p=(i-fichaK+N)%N;c.dataset.p=p<3?p:"x"});
  fichaK=0;paint();
  let paused=false;box.addEventListener("pointerenter",()=>paused=true);box.addEventListener("pointerleave",()=>paused=false);
  timers.push(setInterval(()=>{if(paused||document.hidden)return;const cur=cards[fichaK%N];cur.dataset.p="out";fichaK=(fichaK+1)%N;setTimeout(paint,420)},4600));
}
function startTyping(){
  const el=$("#typed");if(!el)return;
  const words=["divorcio","herencia","despido","comprar una casa","residencia","constituir empresa","cheque sin fondos","pensión alimentaria"];
  if(reduce){el.textContent=words[0];return}
  let w=0,i=words[0].length,del=true,wait=12;
  timers.push(setInterval(()=>{
    if(wait>0){wait--;return}
    const word=words[w];
    if(del){i--;if(i<=0){del=false;w=(w+1)%words.length}}
    else{i++;if(i>=words[w].length){del=true;wait=22}}
    el.textContent=words[w].slice(0,Math.max(i,0))||" ";
  },70));
}

/* ---------- Reserva guardada ---------- */
let bk=store.get("sl-cita");
const DN=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"],MN=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const MODES={presencial:["En la oficina","office"],virtual:["Videollamada","video"],llamada:["Llamada telefónica","phone"]};
function bkTopic(b){if(!b)return"";if(b.srv&&SRV[b.srv])return SRV[b.srv].n;if(b.area&&AREA[b.area])return AREA[b.area].n;return"Orientación general"}
function bkDate(b){const d=new Date(b.date+"T12:00:00");return{d,txt:`${DN[d.getDay()]} ${d.getDate()} ${MN[d.getMonth()]}`}}
function waText(b){const dd=bkDate(b).txt;return `Hola, soy ${b.name}. Solicité una consulta en SL Abogados sobre: ${bkTopic(b)}. Modalidad: ${MODES[b.mode][0]}. Fecha: ${dd}, ${b.time}.${b.abg&&lawyerById(b.abg)?" Abogado de preferencia: "+lawyerById(b.abg).nombre+".":""}${b.urgent?" Es urgente.":""}${b.msg?" Detalle: "+b.msg:""}`}
const waLink=t=>`https://wa.me/${CONTACT.wa}?text=${encodeURIComponent(t)}`;
function bookingCard(){
  if(!bk)return"";
  const {d}=bkDate(bk);
  return `<div class="bk card rv" id="bkCard"><div class="cal"><small>${MN[d.getMonth()]}</small><b>${d.getDate()}</b><span>${DN[d.getDay()]} · ${esc(bk.time)}</span></div>
   <div style="min-width:0"><span class="eyebrow">Su consulta solicitada</span><h3 style="margin-top:6px">${esc(bkTopic(bk))}</h3>
   <dl><div><dt>Modalidad:</dt><dd>${MODES[bk.mode][0]}</dd></div><div><dt>Costo:</dt><dd>${money(CONSULTA[bk.mode])}</dd></div><div><dt>A nombre de:</dt><dd>${esc(bk.name)}</dd></div>${bk.urgent?`<div><span class="badge-u">Urgente</span></div>`:""}</dl></div>
   <div class="acts" id="bkActs"><a class="btn pri sm" href="${waLink(waText(bk))}" target="_blank" rel="noopener">${ic("wa")}Confirmar por WhatsApp</a><a class="btn sm" href="#contacto" data-edit>Modificar</a><button class="btn sm ghost" data-cancel>Cancelar</button></div></div>`;
}
function renderFab(){
  const r=$("#fabRoot");
  if(!bk||route==="inicio"||route==="contacto"||route==="panel"){r.innerHTML="";return}
  r.innerHTML=`<a class="fab" href="#inicio" data-fab><span class="d">${ic("cal")}</span><span class="t">Mi consulta · ${bkDate(bk).txt}</span></a>`;
}

/* ---------- Áreas ---------- */
let aQ="",aG="todas";
function vAreas(){
  return `<header class="ph"><span class="eyebrow rv">Áreas de práctica</span><h1 class="reveal-h">Todo el derecho, <em>ordenado</em> por lo que usted necesita.</h1><p class="rv">${AREAS.length} áreas y ${TOTAL} servicios. Cada uno con su descripción, honorarios de referencia, duración estimada, proceso paso a paso y documentos necesarios.</p></header>
  <div class="toolbar rv"><label class="field-s">${ic("search")}<input id="aq" type="search" placeholder="Buscar área o servicio: divorcio, marca, despido…" value="${esc(aQ)}" autocomplete="off"></label>
   <div class="segf" id="ag"><span class="k"></span>${[["todas","Todas"],["personas","Personas"],["empresas","Empresas"]].map(([k,l])=>`<button data-g="${k}" class="${aG===k?"on":""}">${l}</button>`).join("")}</div></div>
  <div class="agrid" id="agrid"></div>`;
}
function bindAreaFilter(){
  const draw=()=>{
    const q=norm(aQ);
    const list=AREAS.filter(a=>(aG==="todas"||a.g===aG||a.g==="ambos")&&(!q||norm(a.n+" "+a.sh+" "+a.s.map(s=>s.n).join(" ")).includes(q)));
    $("#agrid").innerHTML=list.length?list.map(areaCard).join(""):`<div class="empty" style="grid-column:1/-1">No encontramos áreas con “${esc(aQ)}”. Pruebe con otra palabra o <a class="link" href="#contacto">agende una consulta</a> y le orientamos.</div>`;
    $$("#agrid .rv").forEach((el,i)=>el.style.setProperty("--i",Math.min(i,10)));
  };
  const seg=()=>{const on=$("#ag button.on"),k=$("#ag .k");if(on){k.style.left=on.offsetLeft+"px";k.style.width=on.offsetWidth+"px"}};
  $("#aq").addEventListener("input",e=>{aQ=e.target.value;draw()});
  $("#ag").addEventListener("click",e=>{const b=e.target.closest("[data-g]");if(!b)return;aG=b.dataset.g;$$("#ag button").forEach(x=>x.classList.toggle("on",x===b));seg();draw()});
  draw();requestAnimationFrame(seg);
}

/* ---------- Área ---------- */
function aIndex(cur){return `<nav class="aindex" aria-label="Áreas"><div class="lbl">Áreas de práctica</div>${AREAS.map(a=>`<a href="#area.${a.id}" class="${a.id===cur?"on":""}">${ic(a.ic)}${esc(a.n)}</a>`).join("")}</nav>`}
function vArea(a){
  const i=AREAS.indexOf(a),pv=AREAS[(i-1+AREAS.length)%AREAS.length],nx=AREAS[(i+1)%AREAS.length];
  const times=a.s.map(s=>s.t);
  return `<div class="with-index">${aIndex(a.id)}<div style="min-width:0">
   ${crumbs([["Áreas","areas"],[a.n]])}
   <header class="ahead"><span class="bigic">${ic(a.ic)}</span><div><span class="eyebrow rv">Área de práctica · ${a.g==="empresas"?"Empresas":a.g==="personas"?"Personas y familias":"Personas y empresas"}</span><h1 class="reveal-h" style="margin-top:10px">${esc(a.n)}</h1><p class="rv">${esc(a.d)}</p>
    <div class="laws rv">${a.law.map(l=>`<span class="chip law">${esc(l)}</span>`).join("")}</div></div></header>
   <div class="asum rv"><div><small>Servicios</small><b>${a.s.length}</b></div><div><small>Honorarios desde</small><b class="num">${money(areaMin(a))}</b></div><div><small>Plazo más corto</small><b>${esc(shortest(times))}</b></div></div>
   <div class="slist">${a.s.map(s=>`<a class="srow rv" href="#srv.${s.id}"><div class="txt" style="min-width:0"><h3>${esc(s.n)}${s.u?`<span class="badge-u">Urgente</span>`:""}</h3><p>${esc(first(s.d))}</p></div>
     <div class="cost"><b class="num">${costTxt(s)}</b><span>${ic("clock")}${esc(s.t)}</span></div><span class="chev">${ic("arr")}</span></a>`).join("")}</div>
   <div class="pn rv"><a href="#area.${pv.id}"><small>${ic("arrl")}Área anterior</small><b>${esc(pv.n)}</b></a><a class="nx" href="#area.${nx.id}"><small>Área siguiente${ic("arr")}</small><b>${esc(nx.n)}</b></a></div>
  </div></div>`;
}
function shortest(ts){
  const score=t=>{const n=norm(t);const m=n.match(/(\d+)/);let v=m?+m[1]:1;if(n.startsWith("mismo")||n.startsWith("inmediato")||n.startsWith("horas"))return 0;if(n.includes("dia"))return v;if(n.includes("semana"))return v*7;if(n.includes("mes"))return v*30;if(n.includes("ano"))return v*365;return 9999};
  return [...ts].sort((a,b)=>score(a)-score(b))[0].split(" · ")[0];
}

/* ---------- Servicio ---------- */
const INCL=["Estudio del caso y de sus documentos","Redacción de escritos, contratos o instancias","Representación ante tribunales e instituciones","Reportes de avance en cada etapa","Copia de cada escrito y decisión"];
const EXCL=["ITBIS (18 %) sobre los honorarios","Impuestos y tasas (DGII, Registro, Migración, ONAPI…)","Actos de alguacil, publicaciones y certificaciones","Peritos, agrimensores, tasadores y traductores","Traslados fuera de Santo Domingo"];
let docState={};
function vSrv(s){
  const a=s.area,idx=a.s.indexOf(s),pv=a.s[idx-1],nx=a.s[idx+1];
  const docs=s.doc||a.doc;
  const rel=a.s.filter(x=>x!==s).slice(0,4);
  return `<div class="svc"><div style="min-width:0">
   ${crumbs([["Áreas","areas"],[a.n,"area."+a.id],[s.n]])}
   <header class="svc-h"><span class="eyebrow rv">${esc(a.n)}</span>${s.u?` <span class="badge-u rv" style="margin-left:8px">Atención urgente</span>`:""}
    <h1 class="reveal-h">${esc(s.n)}</h1><p class="lead rv">${esc(s.d)}</p></header>
   <div class="facts">
    <div class="fact rv">${ic("tag")}<small>Honorarios</small><b class="num">${costTxt(s)}</b>${costSub(s)?`<em>${esc(costSub(s))}</em>`:""}</div>
    <div class="fact rv">${ic("clock")}<small>Duración estimada</small><b>${esc(s.t)}</b></div>
    <div class="fact rv">${ic("steps")}<small>Etapas</small><b>${s.p.length} pasos</b></div>
    <div class="fact rv">${ic("video")}<small>Atención</small><b>Presencial o virtual</b></div>
   </div>
   <section class="blk"><h2 class="rv">Proceso paso a paso <small>${s.p.length} etapas</small></h2>
    <ol class="tl">${s.p.map((p,i)=>`<li class="rv"><span class="n">${i+1}</span><div class="tx"><small>${i===0?"Inicio":i===s.p.length-1?"Cierre":"Etapa "+(i+1)}</small>${esc(p)}</div></li>`).join("")}</ol></section>
   <section class="blk"><h2 class="rv">Documentos que debe reunir <small>marque los que ya tiene</small></h2>
    <div class="dprog rv"><span id="dCount">0 de ${docs.length} listos</span><span class="bar"><i id="dBar" style="width:0"></i></span></div>
    <div class="docs" id="docs">${docs.map((d,i)=>`<button class="doc rv" data-doc="${i}"><span class="bx">${ic("check")}</span><span>${esc(d)}</span></button>`).join("")}</div></section>
   <section class="blk"><h2 class="rv">Qué incluyen los honorarios</h2>
    <div class="incl rv"><div class="y"><h4>${ic("check")}Incluye</h4><ul>${INCL.map(x=>`<li>${ic("check")}${x}</li>`).join("")}</ul></div><div class="n"><h4>${ic("minus")}Se paga aparte</h4><ul>${EXCL.map(x=>`<li>${ic("minus")}${x}</li>`).join("")}</ul></div></div></section>
   <section class="blk"><h2 class="rv">Base legal</h2><div class="laws rv">${a.law.map(l=>`<span class="chip law">${esc(l)}</span>`).join("")}</div></section>
   ${rel.length?`<section class="blk"><h2 class="rv">Otros servicios de ${esc(a.n.toLowerCase())}</h2><div class="rel">${rel.map(r=>`<a class="rv" href="#srv.${r.id}"><b>${esc(r.n)}</b><span>${costTxt(r)} · ${esc(r.t)}</span></a>`).join("")}</div></section>`:""}
   <div class="pn rv">${pv?`<a href="#srv.${pv.id}"><small>${ic("arrl")}Servicio anterior</small><b>${esc(pv.n)}</b></a>`:`<a href="#area.${a.id}"><small>${ic("arrl")}Volver al área</small><b>${esc(a.n)}</b></a>`}${nx?`<a class="nx" href="#srv.${nx.id}"><small>Siguiente servicio${ic("arr")}</small><b>${esc(nx.n)}</b></a>`:`<a class="nx" href="#areas"><small>Ver todas${ic("arr")}</small><b>Áreas de práctica</b></a>`}</div>
  </div>
  <aside class="aside"><div class="quote rv"><small>Honorarios de referencia</small><div class="amt ${s.c?"":"sm"} num">${costTxt(s)}</div>${costSub(s)?`<div class="nt">${esc(costSub(s))}</div>`:""}
    <div class="row"><span>Duración</span><b>${esc(s.t)}</b></div><div class="row"><span>Consulta inicial</span><b class="num">desde ${money(CONSULTA.llamada)}</b></div>
    <a class="btn pri block" href="#contacto" data-pre="${s.id}">${ic("cal")}Agendar consulta</a>
    <a class="btn block" href="${waLink("Hola, quisiera información sobre: "+s.n)}" target="_blank" rel="noopener">${ic("wa")}Preguntar por WhatsApp</a>
    <p class="fine">El monto final se fija por escrito tras revisar su caso. No incluye ITBIS, impuestos ni gastos. <a class="link" href="#honorarios" style="font-size:12px">Cómo cobramos</a></p></div></aside></div>`;
}
function bindDocs(){
  const id=route.slice(4),st=docState[id]||(docState[id]=new Set());
  const total=$$("#docs .doc").length;
  const upd=()=>{$$("#docs .doc").forEach(b=>b.classList.toggle("ck",st.has(+b.dataset.doc)));$("#dCount").textContent=`${st.size} de ${total} listos`;$("#dBar").style.width=(st.size/total*100)+"%"};
  $("#docs").addEventListener("click",e=>{const b=e.target.closest("[data-doc]");if(!b)return;const k=+b.dataset.doc;st.has(k)?st.delete(k):st.add(k);upd()});
  upd();
}

/* ---------- Honorarios ---------- */
let fQ="",fA="",fS="area";
function vFees(){
  return `<header class="ph"><span class="eyebrow rv">Honorarios</span><h1 class="reveal-h">Lo que cuesta, <em>dicho</em> antes de empezar.</h1><p class="rv">Publicamos honorarios de referencia de todos nuestros servicios. Tras la consulta inicial recibe por escrito el monto exacto de su caso, la forma de pago y lo que incluye.</p></header>
  <section><div class="sec-hd rv"><div><span class="eyebrow">Consulta inicial</span><h2 class="h2" style="margin-top:10px">El primer paso</h2></div><p>Si contrata el servicio, el costo de la consulta se descuenta de los honorarios.</p></div>
   <div class="cgrid">
    <div class="cc rv">${ic("office")}<h4>En la oficina</h4><b class="num">${money(CONSULTA.presencial)}</b><p>45–60 minutos con revisión de documentos.</p></div>
    <div class="cc rv">${ic("video")}<h4>Videollamada</h4><b class="num">${money(CONSULTA.virtual)}</b><p>Desde cualquier lugar del país o del exterior.</p></div>
    <div class="cc rv">${ic("phone")}<h4>Llamada telefónica</h4><b class="num">${money(CONSULTA.llamada)}</b><p>Orientación rápida de 20–30 minutos.</p></div>
    <div class="cc rv">${ic("pen")}<h4>Opinión legal escrita</h4><b class="num">RD$10,000 – 25,000</b><p>Informe firmado sobre su caso, en 3–7 días.</p></div>
   </div></section>
  <section class="sec"><div class="sec-hd rv"><div><span class="eyebrow">Formas de pago</span><h2 class="h2" style="margin-top:10px">Elija la que <em>le convenga</em></h2></div></div>
   <div class="pay rv">
    <div><span class="tag">Monto fijo</span><h4>Pago por servicio</h4><p>Un precio cerrado por todo el trámite. Ideal para contratos, constituciones, traspasos y trámites con plazo definido.</p></div>
    <div><span class="tag">Por etapas</span><h4>Pago escalonado</h4><p>Paga al iniciar cada fase del proceso: demanda, audiencias, sentencia. Se usa en litigios largos.</p></div>
    <div><span class="tag">% del resultado</span><h4>Cuota litis</h4><p>Un porcentaje de lo que se obtenga, usualmente sin pago inicial. Para casos laborales, cobros e indemnizaciones.</p></div>
    <div><span class="tag">Mensual</span><h4>Iguala para empresas</h4><p>Una tarifa fija al mes con asesoría continua, revisión de contratos y asambleas incluidas.</p></div>
   </div></section>
  <section class="sec"><div class="sec-hd rv"><div><span class="eyebrow">Tarifario completo</span><h2 class="h2" style="margin-top:10px">${TOTAL} servicios, <em>un solo lugar</em></h2></div></div>
   <div class="toolbar rv"><label class="field-s">${ic("search")}<input id="fq" type="search" placeholder="Buscar servicio…" value="${esc(fQ)}" autocomplete="off"></label>
    <select class="sel" id="fa" aria-label="Filtrar por área"><option value="">Todas las áreas</option>${AREAS.map(a=>`<option value="${a.id}" ${fA===a.id?"selected":""}>${esc(a.n)}</option>`).join("")}</select>
    <select class="sel" id="fs" aria-label="Ordenar"><option value="area" ${fS==="area"?"selected":""}>Ordenar por área</option><option value="asc" ${fS==="asc"?"selected":""}>Menor costo primero</option><option value="desc" ${fS==="desc"?"selected":""}>Mayor costo primero</option><option value="az" ${fS==="az"?"selected":""}>Nombre A–Z</option></select></div>
   <p class="tcount" id="fcount"></p>
   <div class="tarifa rv" id="tarifa"></div>
   <div class="notes rv"><h4>${ic("alert")}Antes de contratar, tenga en cuenta</h4><ul>
    <li>Los montos son referenciales y se ajustan según la complejidad, el valor en juego y la urgencia del caso.</li>
    <li>A los honorarios se suma el ITBIS (18 %). Los impuestos, tasas y gastos del proceso se pagan aparte, con sus recibos.</li>
    <li>Todo acuerdo de honorarios se firma por escrito, conforme a la Ley 302 sobre Honorarios de Abogados.</li>
    <li>Aceptamos transferencia bancaria, depósito, tarjeta y efectivo, con factura con comprobante fiscal.</li></ul></div></section>`;
}
function bindFees(){
  const draw=()=>{
    const q=norm(fQ);
    let list=Object.values(SRV).filter(s=>(!fA||s.area.id===fA)&&(!q||norm(s.n+" "+s.area.n).includes(q)));
    const mn=s=>s.c?s.c[0]:0;
    if(fS==="asc")list.sort((a,b)=>mn(a)-mn(b));else if(fS==="desc")list.sort((a,b)=>mn(b)-mn(a));else if(fS==="az")list.sort((a,b)=>a.n.localeCompare(b.n,"es"));
    $("#fcount").textContent=`${list.length} ${list.length===1?"servicio":"servicios"}`;
    $("#tarifa").innerHTML=`<div class="tr th"><span>Servicio</span><span>Área</span><span>Honorarios</span><span>Duración</span><span></span></div>`+(list.length?list.map(s=>`<a class="tr" href="#srv.${s.id}"><span class="nm">${esc(s.n)}</span><span class="ar">${esc(s.area.n)}</span><span class="co num">${costTxt(s)}${costSub(s)?`<small>${esc(costSub(s))}</small>`:""}</span><span class="du">${esc(s.t)}</span>${ic("arr")}</a>`).join(""):`<div class="empty" style="border:0">Ningún servicio coincide con la búsqueda.</div>`);
  };
  $("#fq").addEventListener("input",e=>{fQ=e.target.value;draw()});
  $("#fa").addEventListener("change",e=>{fA=e.target.value;draw()});
  $("#fs").addEventListener("change",e=>{fS=e.target.value;draw()});
  draw();
}

/* ---------- Proceso ---------- */
let gQ="",gL="";
function vProc(){
  const steps=[
   ["Primer contacto","Nos escribe o agenda en línea. Le confirmamos la cita y le decimos qué documentos traer.","Mismo día"],
   ["Consulta inicial","Escuchamos su caso, revisamos los documentos y le explicamos sus opciones, riesgos y probabilidades reales.","45–60 min"],
   ["Propuesta por escrito","Recibe el plan de trabajo, el monto exacto de honorarios, la forma de pago y el calendario estimado.","1–2 días"],
   ["Contrato y documentos","Firmamos el contrato de servicios o de cuota litis y, si hace falta, un poder para actuar en su nombre.","1–3 días"],
   ["Ejecución del caso","Redactamos, depositamos, asistimos a audiencias y gestionamos ante cada institución. Le informamos en cada etapa.","Según el servicio"],
   ["Cierre y entrega","Le entregamos la sentencia, el título, el certificado o el acuerdo, con un informe final y copia de todo el expediente.","Al finalizar"]];
  const letters=[...new Set(GLOSARIO.map(g=>norm(g[0])[0].toUpperCase()))];
  return `<header class="ph"><span class="eyebrow rv">Cómo trabajamos</span><h1 class="reveal-h">Un proceso <em>sin sorpresas</em>, de principio a fin.</h1><p class="rv">Así es trabajar con nosotros, desde el primer mensaje hasta que su caso queda cerrado. Al final encontrará respuestas a las dudas más comunes y un glosario de términos legales.</p></header>
  <section class="big-tl">${steps.map((s,i)=>`<div class="bt rv"><span class="k">${["I","II","III","IV","V","VI"][i]}</span><div><h3>${s[0]}</h3><p>${s[1]}</p><span class="tg">${ic("clock").replace('class="i "','class="i " style="width:13px;height:13px;margin-right:6px"')}${s[2]}</span></div></div>`).join("")}</section>
  <section class="sec"><div class="sec-hd rv"><div><span class="eyebrow">Modalidades</span><h2 class="h2" style="margin-top:10px">Atención donde <em>usted esté</em></h2></div></div>
   <div class="mods">
    <div class="cc rv">${ic("office")}<h4>En la oficina</h4><b class="num">${money(CONSULTA.presencial)}</b><p>${esc(CONTACT.dir)}. Traiga sus documentos originales.</p></div>
    <div class="cc rv">${ic("video")}<h4>Videollamada</h4><b class="num">${money(CONSULTA.virtual)}</b><p>Le enviamos el enlace por WhatsApp o correo. Ideal para dominicanos en el exterior.</p></div>
    <div class="cc rv">${ic("phone")}<h4>Llamada</h4><b class="num">${money(CONSULTA.llamada)}</b><p>Para orientación rápida o dar seguimiento a un caso.</p></div>
   </div></section>
  <section class="sec"><div class="sec-hd rv"><div><span class="eyebrow">Qué llevar</span><h2 class="h2" style="margin-top:10px">Para aprovechar la consulta</h2></div></div>
   <div class="bring">${["Su cédula o pasaporte","Contratos, títulos, actas o sentencias relacionadas","Notificaciones o citaciones que haya recibido","Fotos, mensajes, correos y datos de testigos","Una lista de fechas importantes del caso","Sus preguntas, anotadas para no olvidarlas"].map(x=>`<div class="doc rv" style="cursor:default"><span class="bx" style="background:var(--green);border-color:var(--green)">${ic("check").replace('class="i "','class="i " style="transform:scale(1)"')}</span><span>${x}</span></div>`).join("")}</div></section>
  <section class="sec"><div class="sec-hd rv"><div><span class="eyebrow">Preguntas frecuentes</span><h2 class="h2" style="margin-top:10px">Lo que más nos <em>preguntan</em></h2></div></div>
   <div class="acc" id="faq">${FAQ.map((f,i)=>`<div class="qa rv${i===0?" open":""}"><button aria-expanded="${i===0}">${esc(f[0])}<span class="pm">${ic("x").replace(IC.x,'<path d="M12 5v14M5 12h14"/>')}</span></button><div class="ans"><div><p>${esc(f[1])}</p></div></div></div>`).join("")}</div></section>
  <section class="sec"><div class="sec-hd rv"><div><span class="eyebrow">Glosario</span><h2 class="h2" style="margin-top:10px">Términos legales, <em>en claro</em></h2></div></div>
   <div class="toolbar rv"><label class="field-s">${ic("search")}<input id="gq" type="search" placeholder="Buscar término…" autocomplete="off"></label></div>
   <div class="letters rv" id="gl"><button data-l="" class="on" style="width:auto;padding:0 12px;font-family:var(--f-body);font-size:13px;font-weight:600">Todas</button>${"ABCDEFGHIJLMNOPQRS".split("").map(l=>`<button data-l="${l}" ${letters.includes(l)?"":"disabled"}>${l}</button>`).join("")}</div>
   <div class="gloss" id="gloss"></div></section>`;
}
function bindGloss(){
  const draw=()=>{const q=norm(gQ);const list=GLOSARIO.filter(g=>(!gL||norm(g[0])[0].toUpperCase()===gL)&&(!q||norm(g[0]+" "+g[1]).includes(q)));
   $("#gloss").innerHTML=list.length?list.map(g=>`<div class="gt"><b>${esc(g[0])}</b><p>${esc(g[1])}</p></div>`).join(""):`<div class="empty" style="grid-column:1/-1">Sin resultados.</div>`};
  $("#gq").addEventListener("input",e=>{gQ=e.target.value;draw()});
  $("#gl").addEventListener("click",e=>{const b=e.target.closest("[data-l]");if(!b||b.disabled)return;gL=b.dataset.l;$$("#gl button").forEach(x=>x.classList.toggle("on",x===b));draw()});
  $("#faq").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const q=b.parentElement;const o=!q.classList.contains("open");q.classList.toggle("open",o);b.setAttribute("aria-expanded",o)});
  gQ="";gL="";draw();
}

/* ---------- Despacho ---------- */
function vDesp(){
  return `<section class="dsp"><div>
   <span class="eyebrow rv">El despacho</span>
   <h1 class="reveal-h" style="font-family:var(--f-display);font-size:clamp(40px,6vw,78px);line-height:1;font-weight:500;letter-spacing:-.015em;margin:14px 0 22px">Salvador <em style="color:var(--brass)">López</em> de la Rosa</h1>
   <div class="prose rv">${[TEXTOS.despacho1,TEXTOS.despacho2,TEXTOS.despacho3].filter(Boolean).map(p=>`<p>${rich(p)}</p>`).join("")}</div>
   <div class="ctas rv" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:26px"><a class="btn pri" href="#contacto">${ic("cal")}Agendar consulta</a><a class="btn" href="#areas">Áreas de práctica${ic("arr","arr")}</a></div>
  </div><div class="big-seal rv">${seal(true)}</div></section>
  <section class="sec"><div class="sec-hd rv"><div><span class="eyebrow">Principios</span><h2 class="h2" style="margin-top:10px">Cómo entendemos <em>el ejercicio</em></h2></div></div>
   <div class="vals">
    <div class="pr card rv">${ic("eye")}<h4>Claridad</h4><p>Le hablamos en lenguaje sencillo y le decimos la verdad sobre su caso, también cuando no es lo que quiere oír.</p></div>
    <div class="pr card rv">${ic("lock")}<h4>Confidencialidad</h4><p>El secreto profesional protege todo lo que nos confía, desde la primera conversación.</p></div>
    <div class="pr card rv">${ic("clock")}<h4>Puntualidad</h4><p>Cumplimos los plazos procesales y respondemos sus mensajes en menos de 24 horas laborables.</p></div>
    <div class="pr card rv">${ic("shield")}<h4>Compromiso</h4><p>Cada caso recibe la atención directa del abogado responsable, de principio a fin.</p></div>
   </div></section>
  <section class="sec"><div class="sec-hd rv"><div><span class="eyebrow">Identidad</span><h2 class="h2" style="margin-top:10px">El sello <em>SL</em></h2></div></div>
   <div class="logo-ex card rv">${seal(true)}<dl>
    <div><dt>Las iniciales</dt><dd>La S en cursiva y la L recta: el trato cercano y el rigor de la ley en una sola firma.</dd></div>
    <div><dt>El sello circular</dt><dd>Inspirado en el sello notarial que da fe pública a los documentos. Lleva el nombre completo del abogado alrededor.</dd></div>
    <div><dt>La línea y el rombo</dt><dd>El fiel de la balanza: equilibrio entre las partes y decisiones bien pesadas.</dd></div>
    <div><dt>Verde toga y latón</dt><dd>El verde de la tradición jurídica y el latón de los sellos y placas de los despachos.</dd></div></dl></div></section>
  <section class="sec"><div class="princ" style="grid-template-columns:repeat(2,minmax(0,1fr))">
   <div class="card rv" style="padding:26px"><span class="eyebrow">Horario de atención</span><div class="hours" style="margin-top:12px">${CONTACT.horario.map(h=>`<div><span>${esc(h[0])}</span><b>${esc(h[1])}</b></div>`).join("")}</div></div>
   <div class="card rv" style="padding:26px;display:grid;gap:12px;align-content:start"><span class="eyebrow">Cobertura</span><p style="font-size:17px">Oficina en ${esc(CONTACT.dir)}. Atención en todo el territorio nacional y a dominicanos en el exterior por videollamada.</p><a class="link" href="#contacto">Ver datos de contacto ${ic("arr")}</a></div>
  </div></section>`;
}

/* ---------- Contacto / agenda ---------- */
let wz={step:0,dir:1,abg:"",area:"",srv:"",mode:"presencial",date:"",time:"",name:"",phone:"",email:"",msg:"",urgent:false,err:"",done:false};
function vContact(){
  return `<header class="ph"><span class="eyebrow rv">Contacto</span><h1 class="reveal-h">Agende su <em>consulta</em> en un minuto.</h1><p class="rv">Elija el tema, la modalidad y la hora que le convengan. Le confirmamos por WhatsApp o correo en menos de 24 horas laborables.</p></header>
  <div class="ct"><div class="card wz rv" id="wz"></div>
   <aside style="display:grid;gap:14px;min-width:0">
    <div class="card cinfo rv"><span class="eyebrow">Datos del despacho</span>
     <div class="cl"><span class="ic">${ic("phone")}</span><div><small>Teléfono</small><b>${esc(CONTACT.tel)}</b></div><button class="cp" data-copy="${esc(CONTACT.tel)}">Copiar</button></div>
     <div class="cl"><span class="ic">${ic("wa")}</span><div><small>WhatsApp</small><b>${esc(CONTACT.tel)}</b></div><a class="cp" style="display:grid;place-items:center;text-decoration:none" href="https://wa.me/${CONTACT.wa}" target="_blank" rel="noopener">Abrir</a></div>
     <div class="cl"><span class="ic">${ic("mail")}</span><div><small>Correo</small><b>${esc(CONTACT.email)}</b></div><button class="cp" data-copy="${esc(CONTACT.email)}">Copiar</button></div>
     <div class="cl"><span class="ic">${ic("pin")}</span><div><small>Oficina</small><b>${esc(CONTACT.dir)}</b></div></div></div>
    <div class="card cinfo rv"><span class="eyebrow">Horario</span><div class="hours">${CONTACT.horario.map(h=>`<div><span>${esc(h[0])}</span><b>${esc(h[1])}</b></div>`).join("")}</div></div>
    <div class="urg rv"><b>${ic("alert")}Urgencias</b>Arrestos, medidas de coerción, hábeas corpus y violencia intrafamiliar: llame directamente al ${esc(CONTACT.tel)}, cualquier día.</div>
   </aside></div>`;
}
function days(){const out=[];const d=new Date();d.setHours(12,0,0,0);while(out.length<12){d.setDate(d.getDate()+1);if(d.getDay()!==0)out.push(new Date(d))}return out}
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function slots(date){if(!date)return[];const d=new Date(date+"T12:00:00");return d.getDay()===6?["9:00","10:00","11:00","12:00"]:["8:30","9:30","10:30","11:30","2:00","3:00","4:00","5:00"]}
const ampm=t=>{const h=+t.split(":")[0];return t+(h>=8&&h<=11?" a. m.":" p. m.")};
const WSTEPS=["Tema","Modalidad y fecha","Sus datos","Confirmar"];
function drawWizard(){
  const box=$("#wz");if(!box)return;
  if(wz.done){
    box.innerHTML=`<div class="done"><span class="stampbig">${stampSvg("RECIBIDO",bkDate(bk).txt.toUpperCase())}</span><h3>Solicitud recibida</h3><p>Guardamos su solicitud. Confírmela por WhatsApp para reservar el horario; le responderemos en menos de 24 horas laborables.</p>${sumry(bk)}<div class="acts"><a class="btn pri" href="${waLink(waText(bk))}" target="_blank" rel="noopener">${ic("wa")}Confirmar por WhatsApp</a><a class="btn" href="#inicio" data-home>Volver al inicio</a></div></div>`;return;
  }
  let body="";
  if(wz.step===0){
    const a=AREA[wz.area];
    body=`<h3>¿Sobre qué es su consulta?</h3><p class="hint">Elija el área. Si no está seguro, marque “Orientación general”.</p>
     <div class="opts">${AREAS.map(x=>`<button class="opt ${wz.area===x.id?"on":""}" data-area="${x.id}">${ic(x.ic)}<span>${esc(x.n)}</span></button>`).join("")}<button class="opt ${wz.area==="general"?"on":""}" data-area="general">${ic("chat")}<span>Orientación general</span></button></div>
     ${a?`<h3 style="margin-top:8px">¿Cuál servicio? <small style="font-family:var(--f-body);font-size:13px;color:var(--muted)">opcional</small></h3><div class="opts">${a.s.map(s=>`<button class="opt ${wz.srv===s.id?"on":""}" data-srv="${s.id}"><span>${esc(s.n)}</span></button>`).join("")}<button class="opt ${!wz.srv?"on":""}" data-srv=""><span>Aún no lo sé</span></button></div>`:""}`;
  }
  if(wz.step===1){
    const ds=days();
    body=`<h3>¿Cómo prefiere la consulta?</h3>
     <div class="opts s3">${Object.entries(MODES).map(([k,[l,i]])=>`<button class="opt big ${wz.mode===k?"on":""}" data-mode="${k}">${ic(i)}<b>${l}</b><em>${money(CONSULTA[k])}</em></button>`).join("")}</div>
     <h3 style="margin-top:6px">Elija el día</h3><div class="days">${ds.map(d=>{const k=iso(d);return `<button class="day ${wz.date===k?"on":""}" data-date="${k}"><small>${DN[d.getDay()]}</small><b>${d.getDate()}</b><small>${MN[d.getMonth()]}</small></button>`}).join("")}</div>
     ${wz.date?`<h3 style="margin-top:6px">Elija la hora</h3><div class="times">${slots(wz.date).map(t=>`<button class="tm ${wz.time===t?"on":""}" data-time="${t}">${ampm(t)}</button>`).join("")}</div>`:""}`;
  }
  if(wz.step===2){
    body=`<h3>¿A quién le confirmamos?</h3>
     <div class="two"><div class="fl ${wz.err&&!wz.name.trim()?"bad":""}"><label for="w-name">Nombre completo</label><input id="w-name" value="${esc(wz.name)}" autocomplete="name"></div>
     <div class="fl ${wz.err&&!wz.phone.trim()?"bad":""}"><label for="w-phone">Teléfono o WhatsApp</label><input id="w-phone" inputmode="tel" value="${esc(wz.phone)}" autocomplete="tel"></div></div>
     <div class="fl"><label for="w-email">Correo (opcional)</label><input id="w-email" type="email" value="${esc(wz.email)}" autocomplete="email"></div>
     <div class="fl"><label for="w-msg">Cuéntenos brevemente su caso (opcional)</label><textarea id="w-msg">${esc(wz.msg)}</textarea></div>
     <div class="fl"><label for="w-abg">Abogado de preferencia (opcional)</label><select class="sel" id="w-abg" style="width:100%"><option value="">Cualquiera del despacho</option>${lawyers().map(l=>`<option value="${esc(l.id)}" ${wz.abg===l.id?"selected":""}>${esc(l.nombre)}</option>`).join("")}</select></div>
     <label class="chk"><input type="checkbox" id="w-urg" ${wz.urgent?"checked":""}>Es urgente (hay un plazo, audiencia o detención en curso)</label>`;
  }
  if(wz.step===3){body=`<h3>Revise su solicitud</h3>${sumry(wz)}<p class="hint" style="margin-top:0">Su información está protegida por el secreto profesional.</p>`}
  const last=wz.step===3;
  box.innerHTML=`<div class="wz-h"><span class="eyebrow">Agendar consulta</span><div class="wz-steps">${WSTEPS.map((_,i)=>`<i class="${i<=wz.step?"d":""}"></i>`).join("")}</div><div class="wz-lbl">PASO ${wz.step+1} DE ${WSTEPS.length} · ${WSTEPS[wz.step].toUpperCase()}</div></div>
   <div class="wz-b"><div class="wz-pane ${wz.dir<0?"back":""}">${body}${wz.err?`<p class="err">${esc(wz.err)}</p>`:""}</div></div>
   <div class="wz-f"><div class="fee">Consulta inicial<b class="num">${money(CONSULTA[wz.mode])}</b></div><div class="bb">${wz.step>0?`<button class="btn sm" data-wz="back">${ic("arrl")}Atrás</button>`:""}<button class="btn pri sm" data-wz="next">${last?"Confirmar solicitud":"Continuar"}${last?"":ic("arr","arr")}</button></div></div>`;
}
function sumry(b){
  const dd=b.date?bkDate(b).txt+", "+ampm(b.time):"—";
  return `<div class="sumry"><div><span>Tema</span><span>${esc(bkTopic(b))}</span></div><div><span>Modalidad</span><span>${MODES[b.mode][0]}</span></div><div><span>Fecha y hora</span><span>${esc(dd)}</span></div><div><span>Nombre</span><span>${esc(b.name)}</span></div><div><span>Contacto</span><span>${esc(b.phone)}${b.email?"<br>"+esc(b.email):""}</span></div>${b.abg&&lawyerById(b.abg)?`<div><span>Abogado</span><span>${esc(lawyerById(b.abg).nombre)}</span></div>`:""}${b.urgent?`<div><span>Prioridad</span><span>Urgente</span></div>`:""}<div><span>Consulta inicial</span><span class="num">${money(CONSULTA[b.mode])}</span></div></div>`;
}
function wzSave(){[["name","w-name"],["phone","w-phone"],["email","w-email"],["msg","w-msg"]].forEach(([k,id])=>{const el=document.getElementById(id);if(el)wz[k]=el.value});const u=$("#w-urg");if(u)wz.urgent=u.checked;const ab=$("#w-abg");if(ab)wz.abg=ab.value}
function wzClick(e){
  const t=e.target.closest("[data-area],[data-srv],[data-mode],[data-date],[data-time],[data-wz]");if(!t||!$("#wz")||!$("#wz").contains(t))return;
  e.preventDefault();
  if(t.dataset.area!==undefined&&!t.classList.contains("dr-a")){wz.area=t.dataset.area;wz.srv="";wz.err=""}
  else if(t.dataset.srv!==undefined)wz.srv=t.dataset.srv;
  else if(t.dataset.mode)wz.mode=t.dataset.mode;
  else if(t.dataset.date){wz.date=t.dataset.date;wz.time="";wz.err=""}
  else if(t.dataset.time){wz.time=t.dataset.time;wz.err=""}
  else if(t.dataset.wz==="back"){wzSave();wz.step--;wz.dir=-1;wz.err=""}
  else if(t.dataset.wz==="next"){
    wzSave();
    if(wz.step===0&&!wz.area){wz.err="Elija un área o “Orientación general” para continuar.";return drawWizard()}
    if(wz.step===1&&(!wz.date||!wz.time)){wz.err="Elija el día y la hora de la consulta.";return drawWizard()}
    if(wz.step===2&&(!wz.name.trim()||!wz.phone.trim())){wz.err="Escriba su nombre y un teléfono para poder confirmarle.";return drawWizard()}
    wz.err="";
    if(wz.step===3){bk={id:"c"+Date.now().toString(36),area:wz.area,srv:wz.srv,abg:wz.abg||"",mode:wz.mode,date:wz.date,time:wz.time,name:wz.name.trim(),phone:wz.phone.trim(),email:wz.email.trim(),msg:wz.msg.trim(),urgent:wz.urgent,estado:"nueva",at:new Date().toISOString()};store.set("sl-cita",bk);saveCita(bk);wz.done=true;drawWizard();return}
    wz.step++;wz.dir=1;
  }
  const keepY=scrollY;drawWizard();
  if(t.dataset.wz){const top=$("#wz").getBoundingClientRect().top+scrollY-80;if(scrollY>top)window.scrollTo({top,behavior:reduce?"auto":"smooth"})}else window.scrollTo(0,keepY);
}
function prefill(id){const s=SRV[id];if(!s)return;wz={...wz,step:1,dir:1,area:s.area.id,srv:s.id,err:"",done:false}}

/* ================= Buscador (paleta) ================= */
let palSel=0,palItems=[];
const PAGES=[["inicio","Inicio","home"],["areas","Todas las áreas","grid"],["honorarios","Honorarios y tarifario","tag"],["proceso","Cómo trabajamos · Preguntas frecuentes · Glosario","route"],["despacho","El despacho","scale"],["contacto","Agendar consulta","cal"]];
function openPal(q=""){
  closeDrawer();
  const root=$("#palRoot");
  root.innerHTML=`<div class="pal-o" id="palO"><div class="pal" role="dialog" aria-modal="true" aria-label="Buscar"><div class="pal-in">${ic("search")}<input id="palQ" placeholder="Buscar servicios, áreas o páginas…" value="${esc(q)}" autocomplete="off" aria-label="Buscar"><kbd>Esc</kbd></div><div class="pal-r" id="palR"></div></div></div>`;
  const inp=$("#palQ");inp.focus();inp.setSelectionRange(q.length,q.length);
  inp.addEventListener("input",()=>{palSel=0;palDraw()});
  inp.addEventListener("keydown",e=>{
    if(e.key==="ArrowDown"){e.preventDefault();palSel=Math.min(palSel+1,palItems.length-1);palMark()}
    else if(e.key==="ArrowUp"){e.preventDefault();palSel=Math.max(palSel-1,0);palMark()}
    else if(e.key==="Enter"){e.preventDefault();const it=palItems[palSel];if(it){closePal();go(it)}}
  });
  $("#palO").addEventListener("click",e=>{if(e.target.id==="palO")closePal()});
  palSel=0;palDraw();document.body.style.overflow="hidden";
}
function closePal(){$("#palRoot").innerHTML="";document.body.style.overflow=""}
function palDraw(){
  const q=norm($("#palQ").value.trim());const R=$("#palR");palItems=[];
  if(!q){
    palItems=PAGES.map(p=>p[0]);
    R.innerHTML=`<div class="pal-g">Sugerencias</div><div class="pal-sug">${["divorcio","herencia","despido","marca","residencia","alquiler","cheque","amparo"].map(s=>`<button data-sug="${s}">${s}</button>`).join("")}</div><div class="pal-g">Páginas</div>`+PAGES.map((p,i)=>`<a class="pal-it" href="#${p[0]}" data-i="${i}"><span class="ic">${ic(p[2])}</span><div><b>${p[1]}</b></div></a>`).join("");
    palMark();return;
  }
  const words=q.split(/\s+/);
  const score=(txt,main)=>{const n=norm(txt),m=norm(main);let s=0;for(const w of words){if(m.includes(w))s+=m.startsWith(w)?4:3;else if(n.includes(w))s+=1;else return 0}return s};
  const areas=AREAS.map(a=>({a,s:score(a.n+" "+a.sh+" "+a.d,a.n)})).filter(x=>x.s).sort((x,y)=>y.s-x.s).slice(0,4);
  const srvs=Object.values(SRV).map(s=>({x:s,s:score(s.n+" "+s.d+" "+s.area.n,s.n)})).filter(x=>x.s).sort((x,y)=>y.s-x.s).slice(0,8);
  const glos=GLOSARIO.filter(g=>words.every(w=>norm(g[0]).includes(w))).slice(0,3);
  let h="",i=0;
  if(srvs.length){h+=`<div class="pal-g">Servicios</div>`+srvs.map(({x})=>{palItems.push("srv."+x.id);return `<a class="pal-it" href="#srv.${x.id}" data-i="${i++}"><span class="ic">${ic(x.area.ic)}</span><div><b>${esc(x.n)}</b><small>${esc(x.area.n)} · ${costTxt(x)} · ${esc(x.t)}</small></div></a>`}).join("")}
  if(areas.length){h+=`<div class="pal-g">Áreas</div>`+areas.map(({a})=>{palItems.push("area."+a.id);return `<a class="pal-it" href="#area.${a.id}" data-i="${i++}"><span class="ic">${ic(a.ic)}</span><div><b>${esc(a.n)}</b><small>${a.s.length} servicios · ${esc(a.sh)}</small></div></a>`}).join("")}
  if(glos.length){h+=`<div class="pal-g">Glosario</div>`+glos.map(g=>{palItems.push("proceso");return `<a class="pal-it" href="#proceso" data-i="${i++}"><span class="ic">${ic("book")}</span><div><b>${esc(g[0])}</b><small>${esc(g[1])}</small></div></a>`}).join("")}
  R.innerHTML=h||`<div class="pal-empty">No encontramos “${esc($("#palQ").value)}”.<br><a class="link" href="#contacto" style="margin-top:10px">Agende una consulta y le orientamos ${ic("arr")}</a></div>`;
  palMark();
}
function palMark(){$$(".pal-it").forEach(el=>el.classList.toggle("sel",+el.dataset.i===palSel));const s=$(".pal-it.sel");if(s)s.scrollIntoView({block:"nearest"})}

/* ================= Drawer ================= */
function openDrawer(){$("#drawer").classList.add("on");$("#scrim").classList.add("on");$("#drawer").setAttribute("aria-hidden","false");document.body.style.overflow="hidden";setTimeout(()=>{const on=$(".dr-a.on");on&&on.scrollIntoView({block:"center"})},50)}
function closeDrawer(){const d=$("#drawer");if(!d||!d.classList.contains("on"))return;d.classList.remove("on");$("#scrim").classList.remove("on");d.setAttribute("aria-hidden","true");document.body.style.overflow=""}

/* ================= Navbar: ocultar al bajar ================= */
let lastY=0;
function showNav(){$("#bnav").classList.remove("hide")}
addEventListener("scroll",()=>{
  const y=scrollY;$("#top").classList.toggle("scrolled",y>8);
  const nearEnd=innerHeight+y>=document.documentElement.scrollHeight-40;
  if(y>lastY+6&&y>160&&!nearEnd)$("#bnav").classList.add("hide");else if(y<lastY-6||nearEnd)showNav();
  lastY=y;
},{passive:true});

/* ================= Toast ================= */
function toast(t){const r=$("#toastRoot");r.innerHTML=`<div class="toast">${esc(t)}</div>`;clearTimeout(toast.t);toast.t=setTimeout(()=>r.innerHTML="",2700)}

/* ================= Eventos globales ================= */
document.addEventListener("click",e=>{
  if(e.target.closest("[data-more]")){openDrawer();return}
  if(extClick(e))return;
  if(route==="contacto"&&$("#wz")&&$("#wz").contains(e.target)&&e.target.closest("[data-area],[data-srv],[data-mode],[data-date],[data-time],[data-wz]")){wzClick(e);return}
  const sug=e.target.closest("[data-sug]");if(sug){const q=$("#palQ");q.value=sug.dataset.sug;q.focus();palSel=0;palDraw();return}
  if(e.target.closest("[data-pal]")){e.preventDefault();openPal();return}
  if(e.target.closest("[data-cancel]")){const acts=$("#bkActs");acts.innerHTML=`<span class="inline-confirm">¿Cancelar la consulta? <button class="btn sm pri" data-cancel-yes>Sí, cancelar</button><button class="btn sm" data-cancel-no>No</button></span>`;return}
  if(e.target.closest("[data-cancel-yes]")){bk=null;store.del("sl-cita");wz={...wz,done:false,step:0};const c=$("#bkCard");if(c){c.style.transition="opacity .4s, transform .4s";c.style.opacity="0";c.style.transform="scale(.97)";setTimeout(()=>{$("#bkSlot").innerHTML=""},400)}toast("Consulta cancelada");renderFab();return}
  if(e.target.closest("[data-cancel-no]")){$("#bkSlot").innerHTML=bookingCard();return}
  const cp=e.target.closest("[data-copy]");if(cp&&cp.hasAttribute("data-copyfree")){try{navigator.clipboard.writeText(cp.dataset.copy).then(()=>toast("Copiado: "+cp.dataset.copy),()=>toast(cp.dataset.copy))}catch(err){toast(cp.dataset.copy)}return}if(cp){const txt=cp.dataset.copy;const ok=()=>{cp.textContent="Copiado";cp.classList.add("ok");setTimeout(()=>{cp.textContent="Copiar";cp.classList.remove("ok")},1600)};
    try{navigator.clipboard.writeText(txt).then(ok,()=>{selText(cp);toast("Seleccionado: cópielo con Ctrl+C")})}catch(err){selText(cp)}return}
  const a=e.target.closest("a[href^='#']:not([data-noroute])");
  if(a){
    e.preventDefault();const r=a.getAttribute("href").slice(1);
    if(a.dataset.pre)prefill(a.dataset.pre);
    if(a.hasAttribute("data-edit")&&bk){wz={...wz,...bk,step:0,dir:1,done:false,err:""}}
    if(a.hasAttribute("data-home")){wz={step:0,dir:1,area:"",srv:"",mode:"presencial",date:"",time:"",name:"",phone:"",email:"",msg:"",urgent:false,err:"",done:false}}
    if($("#palRoot").innerHTML)closePal();
    if(r==="contacto"&&!a.dataset.pre&&!a.hasAttribute("data-edit")&&wz.done)wz={...wz,done:false,step:0};
    go(r);
    if(a.hasAttribute("data-home")||a.hasAttribute("data-fab"))setTimeout(()=>{const s=$("#bkCard");s&&s.scrollIntoView({behavior:reduce?"auto":"smooth",block:"center"})},700);
    return;
  }
});
function selText(btn){const b=btn.parentElement.querySelector("b");const r=document.createRange();r.selectNodeContents(b);const s=getSelection();s.removeAllRanges();s.addRange(r)}
addEventListener("popstate",e=>go((e.state&&e.state.r)||parse(location.hash),false));
addEventListener("keydown",e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#palRoot").innerHTML?closePal():openPal()}
  else if(e.key==="Escape"){if($("#palRoot").innerHTML)closePal();else if(CV.sel)closeSheet();else closeDrawer()}
  else if(e.key==="/"&&!/input|textarea|select/i.test(document.activeElement.tagName)){e.preventDefault();openPal()}
});
addEventListener("resize",()=>{moveInd();$$(".segf").forEach(segKnob);const on=$("#ag button.on"),k=$("#ag .k");if(on&&k){k.style.left=on.offsetLeft+"px";k.style.width=on.offsetWidth+"px"}});

