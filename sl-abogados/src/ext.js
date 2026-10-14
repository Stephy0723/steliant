
/* =====================================================================
   DATOS COMPARTIDOS — inmuebles, abogados, citas y datos del despacho
   Modo "db": base de datos compartida del artifact (todos ven lo mismo).
   Modo "local": sin base de datos (por ejemplo en un VPS): se guarda en
   este navegador. Para producción real, conectar a un backend propio.
   ===================================================================== */
const ST={mode:"local",inViewer:false,db:null,user:null,assets:null,uid:null,admin:false,ready:false,
  inm:[],abg:null,mine:[],envAll:[],citasAll:[],cfg:null,contactos:{}};
const contactOf=x=>x.contacto||((ST.contactos[x.id]||{}).contacto)||null;
const LS={inm:"sl-inm",env:"sl-env",abg:"sl-abg",cfg:"sl-cfg",citas:"sl-citas"};
const uidLocal="local";
const newId=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const imgSrc=f=>!f?"":(f.startsWith("data:")?f:"/_blob/"+f);
const digits=s=>String(s||"").replace(/\D/g,"");
const waNum=s=>{const d=digits(s);return d.length===10?"1"+d:d};

function lawyers(all=false){return (ST.abg&&ST.abg.length?ST.abg:LAWYERS).filter(l=>all||l.publicado!==false).slice().sort((a,b)=>(+a.orden||99)-(+b.orden||99)||String(a.nombre).localeCompare(b.nombre))}
function lawyerById(id){return lawyers(true).find(l=>l.id===id)}
function inmById(id){return ST.inm.find(x=>x.id===id)}
function published(){return ST.inm.filter(x=>x.estado!=="borrador").sort((a,b)=>String(b.creado||"").localeCompare(String(a.creado||"")))}

function applyCfg(c){
  if(!c)return;ST.cfg=c;
  ["tel","wa","email","dir"].forEach(k=>{if(c[k])CONTACT[k]=c[k]});
  if(Array.isArray(c.horario)&&c.horario.length)CONTACT.horario=c.horario.map(h=>Array.isArray(h)?h:[h.d,h.h]).filter(h=>h&&h[0]);
  ["presencial","virtual","llamada"].forEach(k=>{if(+c[k])CONSULTA[k]=+c[k]});
  paintDrFoot();
}
function loadLocal(){
  ST.inm=store.get(LS.inm)||[];ST.mine=store.get(LS.env)||[];
  const ab=store.get(LS.abg);if(ab)ST.abg=ab;
  applyCfg(store.get(LS.cfg));
  ST.envAll=ST.mine.map(x=>({...x,autor:uidLocal}));
  ST.citasAll=(store.get(LS.citas)||[]).map(x=>({...x,autor:uidLocal}));
}
let pendingRender=false;
function changed(){
  paintPanelLink();
  if(route==="publicar"||!route)return;
  const ae=document.activeElement;
  if(ae&&$("#view").contains(ae)&&/input|textarea|select/i.test(ae.tagName)){pendingRender=true;return}
  softRender();
}
function softRender(){
  if(route==="contacto"){if(!$("#wz input:focus,#wz textarea:focus"))drawWizard();return}
  timers.forEach(clearInterval);timers=[];
  const y=scrollY;const v=$("#view");v.classList.add("static");render();window.scrollTo(0,y);
  requestAnimationFrame(()=>requestAnimationFrame(()=>v.classList.remove("static")));
}
document.addEventListener("focusout",()=>{if(pendingRender){setTimeout(()=>{const ae=document.activeElement;if(!(ae&&/input|textarea|select/i.test(ae.tagName))){pendingRender=false;softRender()}},120)}});
const dbErr=e=>{if(e&&e.code==="revoked")return;console.warn("db",e&&e.code)};
async function initData(){
  loadLocal();loadLocalContent();
  ST.inViewer=!!(window.claude&&typeof window.claude.use==="function");
  if(!ST.inViewer){ST.admin=true;ST.ready=true;changed();return}
  let db=null,user=null;
  try{[db,user]=await Promise.all([window.claude.use("db"),window.claude.use("user")])}catch(e){}
  ST.user=user;
  if(!db){ST.ready=true;changed();return}
  ST.db=db;ST.mode="db";ST.inm=[];ST.mine=[];ST.envAll=[];ST.citasAll=[];ST.abg=null;CRM=[];DBAREAS={};applyContenido({});rebuildIndex();
  subscribeContent();
  try{ST.uid=user?await user.id():null}catch(e){}
  try{ST.admin=user?await user.canEdit():false}catch(e){}
  window.claude.use("assets").then(a=>{ST.assets=a;if(route==="publicar")paintPhotos()}).catch(()=>{});
  db.collection("inmuebles").onSnapshot(s=>{ST.inm=s.docs.map(d=>({...d.data(),id:d.id}));changed()},dbErr);
  db.collection("abogados").onSnapshot(s=>{ST.abg=s.docs.map(d=>({...d.data(),id:d.id}));changed()},dbErr);
  db.doc("config/despacho").onSnapshot(s=>{if(s.exists){applyCfg(s.data());changed()}},dbErr);
  if(ST.uid)db.doc("envios/"+ST.uid).onSnapshot(s=>{ST.mine=s.exists?(s.data().items||[]):[];changed()},dbErr);
  if(ST.admin){
    subscribeCrm();
    db.collection("envios").onSnapshot(s=>{const all=[];s.docs.forEach(d=>(d.data().items||[]).forEach(it=>all.push({...it,autor:d.id})));ST.envAll=all;changed()},dbErr);
    db.collection("contactos").onSnapshot(s=>{ST.contactos=Object.fromEntries(s.docs.map(d=>[d.id,d.data()]));changed()},dbErr);
    db.collection("citas").onSnapshot(s=>{const all=[];s.docs.forEach(d=>(d.data().items||[]).forEach(it=>all.push({...it,autor:d.id})));ST.citasAll=all;changed()},dbErr);
  }
  ST.ready=true;changed();
}
function writeErr(e){
  const c=e&&e.code;
  toast(c==="quota_exceeded"?"El espacio de datos está lleno. Elimine publicaciones antiguas.":c==="invalid_argument"?"Su cuenta no tiene permiso para guardar aquí.":"No se pudo guardar. Intente de nuevo.");
  throw e;
}
const strip=o=>JSON.parse(JSON.stringify(o,(k,v)=>k==="autor"&&false?undefined:v));
async function saveMine(items){
  ST.mine=items;
  if(ST.mode==="db"){if(!ST.uid)throw{code:"invalid_argument"};await ST.db.doc("envios/"+ST.uid).set({items:strip(items)}).catch(writeErr)}
  else{store.set(LS.env,items);ST.envAll=items.map(x=>({...x,autor:uidLocal}))}
}
async function patchEnvio(autor,id,patch){
  if(!autor)return;
  if(ST.mode!=="db"||autor===uidLocal){const items=(store.get(LS.env)||[]).map(x=>x.id===id?{...x,...patch}:x);store.set(LS.env,items);ST.mine=items;ST.envAll=items.map(x=>({...x,autor:uidLocal}));return}
  const ref=ST.db.doc("envios/"+autor);const s=await ref.get();if(!s.exists)return;
  const items=(s.data().items||[]).map(x=>x.id===id?{...x,...patch}:x);
  await ref.set({items}).catch(writeErr);
}
async function putInm(item){
  const body={...item};
  if(ST.mode==="db"){const c=body.contacto;delete body.contacto;await ST.db.doc("inmuebles/"+item.id).set(strip(body)).catch(writeErr);if(c)await ST.db.doc("contactos/"+item.id).set({contacto:c}).catch(writeErr)}
  else{const l=(store.get(LS.inm)||[]).filter(x=>x.id!==item.id);l.push(body);store.set(LS.inm,l);ST.inm=l}
}
async function delInm(id){
  if(ST.mode==="db"){await ST.db.doc("inmuebles/"+id).delete().catch(writeErr);ST.db.doc("contactos/"+id).delete().catch(()=>{})}
  else{const l=(store.get(LS.inm)||[]).filter(x=>x.id!==id);store.set(LS.inm,l);ST.inm=l}
}
async function putAbg(l){
  if(ST.mode==="db")await ST.db.doc("abogados/"+l.id).set(strip(l)).catch(writeErr);
  else{const base=ST.abg&&ST.abg.length?ST.abg:LAWYERS.slice();const n=base.filter(x=>x.id!==l.id);n.push(l);ST.abg=n;store.set(LS.abg,n)}
}
async function delAbg(id){
  if(ST.mode==="db"){
    if(!(ST.abg||[]).some(x=>x.id===id)){await ST.db.doc("abogados/"+id).set({...strip(lawyerById(id)),publicado:false,eliminado:true}).catch(writeErr);return}
    await ST.db.doc("abogados/"+id).delete().catch(writeErr);
  }else{const base=ST.abg&&ST.abg.length?ST.abg:LAWYERS.slice();ST.abg=base.filter(x=>x.id!==id);if(!ST.abg.length)ST.abg=[{...LAWYERS[0],publicado:false,eliminado:true}];store.set(LS.abg,ST.abg)}
}
async function putCfg(c){
  if(ST.mode==="db")await ST.db.doc("config/despacho").set(c).catch(writeErr);
  else store.set(LS.cfg,c);
  applyCfg(c);
}
async function saveCita(b){
  try{
    if(ST.mode==="db"&&ST.uid){const ref=ST.db.doc("citas/"+ST.uid);const s=await ref.get();const items=s.exists?(s.data().items||[]):[];items.push(b);await ref.set({items:items.slice(-40)})}
    else if(ST.mode!=="db"){const l=store.get(LS.citas)||[];l.push(b);store.set(LS.citas,l.slice(-200));ST.citasAll=l.map(x=>({...x,autor:uidLocal}))}
  }catch(e){}
}
async function patchCita(autor,id,patch){
  if(ST.mode!=="db"||autor===uidLocal){const l=(store.get(LS.citas)||[]).map(x=>x.id===id?{...x,...patch}:x);store.set(LS.citas,l);ST.citasAll=l.map(x=>({...x,autor:uidLocal}));return}
  const ref=ST.db.doc("citas/"+autor);const s=await ref.get();if(!s.exists)return;
  await ref.set({items:(s.data().items||[]).map(x=>x.id===id?{...x,...patch}:x)}).catch(writeErr);
}
function paintPanelLink(){
  const a=$("#drPanel");if(!a)return;a.hidden=!ST.admin;
  const n=ST.envAll.filter(x=>x.estado==="pendiente").length+ST.citasAll.filter(x=>x.estado==="nueva").length+(typeof clientes==="function"?clientes().filter(c=>c.virtual).length:0);
  $("#drPanelCt").textContent=n?n+" nuevas":"";
}

/* ================= Helpers de presentación ================= */
const TIPO=Object.fromEntries(TIPOS);
const priceTxt=x=>{if(!+x.precio)return"Precio a consultar";const p=(x.moneda||"RD$")+fmt(+x.precio);return x.op==="alquiler"?p+"/mes":p};
const refTxt=x=>"INM-"+String(x.id).slice(-5).toUpperCase();
const ESTADO_INM={publicado:["Disponible","ok"],reservado:["Reservado","warn"],cerrado:["Cerrado","mute"],pendiente:["En revisión","warn"],rechazado:["No publicado","bad"]};
const pill=(e)=>{const [t,c]=ESTADO_INM[e]||[e,"mute"];return `<span class="pill ${c}">${t}</span>`};
function illo(tipo){
  const g={
   apartamento:'<rect x="70" y="40" width="100" height="110" rx="3"/><path d="M70 62h100M70 84h100M70 106h100M70 128h100M103 40v110M137 40v110"/>',
   casa:'<path d="M50 95l70-52 70 52"/><rect x="66" y="88" width="108" height="62"/><rect x="108" y="112" width="24" height="38"/><rect x="78" y="102" width="20" height="18"/><rect x="142" y="102" width="20" height="18"/>',
   villa:'<path d="M40 100l50-35 50 35M120 86l40-28 40 28"/><rect x="52" y="96" width="76" height="54"/><rect x="132" y="84" width="58" height="66"/><path d="M30 150h180"/><rect x="146" y="102" width="30" height="20"/>',
   penthouse:'<rect x="76" y="30" width="88" height="120"/><path d="M68 30h104M76 54h88M76 78h88M76 102h88M76 126h88"/><path d="M92 30V18h56v12"/>',
   local:'<rect x="56" y="62" width="128" height="88"/><path d="M50 62l10-22h120l10 22M56 62c0 10 16 10 16 0 0 10 16 10 16 0 0 10 16 10 16 0 0 10 16 10 16 0 0 10 16 10 16 0 0 10 16 10 16 0 0 10 16 10 16 0 0 10 16 10 16 0"/><rect x="70" y="92" width="50" height="58"/><rect x="132" y="92" width="38" height="30"/>',
   oficina:'<rect x="84" y="24" width="72" height="126"/><path d="M84 44h72M84 64h72M84 84h72M84 104h72M84 124h72M108 24v126M132 24v126"/>',
   solar:'<path d="M30 140h180"/><path d="M40 140l30-40h100l30 40"/><path d="M60 140v-14M90 140v-14M120 140v-14M150 140v-14M180 140v-14M60 128h120"/><circle cx="170" cy="56" r="14"/>',
   finca:'<path d="M30 150c30-30 60-30 90-10s60 10 90-10"/><path d="M60 120V88M50 98l10-12 10 12M150 110V70M136 86l14-18 14 18"/><path d="M90 112l20-16 20 16v20H90z"/>',
   nave:'<path d="M40 150V84l80-34 80 34v66z"/><path d="M40 84h160M84 150v-40h72v40M84 124h72"/>',
   edificio:'<rect x="60" y="34" width="56" height="116"/><rect x="122" y="64" width="58" height="86"/><path d="M60 56h56M60 78h56M60 100h56M60 122h56M122 86h58M122 108h58M122 130h58"/>'
  }[tipo]||'';
  return `<svg class="illo" viewBox="0 0 240 170" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${g}</g></svg>`;
}
function inmMedia(x,cls=""){
  const f=(x.fotos||[])[0];
  return `<div class="im ${cls}" data-tipo="${esc(x.tipo)}">${f?`<img src="${esc(imgSrc(f))}" alt="" loading="lazy" onerror="this.remove()">`:""}${illo(x.tipo)}</div>`;
}
function inmCard(x){
  return `<a class="icard rv" href="#inm.${esc(x.id)}">${inmMedia(x)}
   <div class="ib-tags"><span class="op ${x.op}">${x.op==="venta"?"Venta":"Alquiler"}</span>${x.estado!=="publicado"?pill(x.estado):""}${x.verificado?`<span class="vf" title="Título revisado por el despacho">${ic("badge")}Verificado</span>`:""}</div>
   <div class="ic-b"><b class="pr num">${esc(priceTxt(x))}</b><h3>${esc(x.titulo||TIPO[x.tipo]||"Inmueble")}</h3><p>${ic("pin")}${esc([x.sector,x.provincia].filter(Boolean).join(", "))}</p>
   <div class="specs">${+x.hab?`<span>${ic("bed")}${+x.hab}</span>`:""}${+x.banos?`<span>${ic("bath")}${+x.banos}</span>`:""}${+x.parq?`<span>${ic("park")}${+x.parq}</span>`:""}${+x.m2c||+x.m2s?`<span>${ic("ruler")}${fmt(+x.m2c||+x.m2s)} m²</span>`:""}</div></div></a>`;
}
function segKnob(seg){const on=seg.querySelector("button.on"),k=seg.querySelector(".k");if(on&&k){k.style.left=on.offsetLeft+"px";k.style.width=on.offsetWidth+"px"}}
function modeNote(){
  if(ST.mode==="db")return"";
  if(ST.inViewer)return `<p class="mnote">${ic("alert")}Para publicar en el catálogo compartido debe iniciar sesión. Mientras tanto puede enviar su propiedad por WhatsApp.</p>`;
  return `<p class="mnote">${ic("alert")}Modo local: las publicaciones se guardan solo en este navegador. Para recibir publicaciones reales, este sitio necesita un servidor con base de datos.</p>`;
}

/* ================= Inicio: avances ================= */
function homeTeasers(){
  const list=published().filter(x=>x.estado==="publicado").slice(0,3);
  const team=lawyers().slice(0,3);
  return `<section class="sec"><div class="sec-hd rv"><div><span class="eyebrow">Inmuebles</span><h2 class="h2" style="margin-top:10px">Alquile o venda <em>con respaldo legal</em></h2></div><a class="link" href="#inmuebles">Ver inmuebles ${ic("arr")}</a></div>
   ${list.length?`<div class="igrid">${list.map(inmCard).join("")}</div>`:`<div class="inm-cta card rv"><div><h3>¿Quiere alquilar o vender una propiedad?</h3><p>Publíquela aquí. Revisamos el título, la mostramos a interesados y preparamos el contrato cuando cierre el negocio.</p></div><div class="ctas" style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn pri" href="#publicar">${ic("plus")}Publicar propiedad</a><a class="btn" href="#inmuebles">Ver catálogo</a></div></div>`}</section>
  <section class="sec"><div class="sec-hd rv"><div><span class="eyebrow">Equipo</span><h2 class="h2" style="margin-top:10px">Quién lleva <em>su caso</em></h2></div><a class="link" href="#abogados">Catálogo de abogados ${ic("arr")}</a></div>
   <div class="lgrid">${team.map(lCard).join("")}</div></section>`;
}

/* ================= INMUEBLES: catálogo ================= */
let IF={op:"todos",tipo:"",prov:"",max:"",hab:"",sort:"rec",q:""};
function vInm(){
  const mine=ST.mine;
  return `<header class="ph"><span class="eyebrow rv">Inmuebles</span><h1 class="reveal-h">${rich(TEXTOS.inmTitulo)}</h1>
   <p class="rv">${rich(TEXTOS.inmIntro)}</p>
   <div class="ctas rv" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px"><a class="btn pri" href="#publicar">${ic("plus")}Publicar mi propiedad</a><a class="btn" href="#srv.debida-diligencia">Revisar un inmueble antes de comprar${ic("arr","arr")}</a></div></header>
  <div class="isteps rv"><div><b>1</b><span><strong>Envíe los datos</strong>Fotos, precio y estado del título.</span></div><div><b>2</b><span><strong>Revisamos</strong>Validamos la información en 24–48 horas.</span></div><div><b>3</b><span><strong>Publicamos</strong>Su propiedad aparece en el catálogo.</span></div><div><b>4</b><span><strong>Cerramos seguro</strong>Contrato, depósito o transferencia de título.</span></div></div>
  ${mine.length?`<section class="sec" style="padding-top:28px"><div class="sec-hd rv"><div><span class="eyebrow">Mis publicaciones</span></div></div><div class="mine">${mine.map(mineRow).join("")}</div></section>`:""}
  <section class="sec" style="padding-top:30px">
   <div class="toolbar rv">
    <div class="segf" id="iop"><span class="k"></span>${[["todos","Todos"],["alquiler","Alquiler"],["venta","Venta"]].map(([k,l])=>`<button data-op="${k}" class="${IF.op===k?"on":""}">${l}</button>`).join("")}</div>
    <label class="field-s">${ic("search")}<input id="iq" type="search" placeholder="Sector, ciudad o palabra clave…" value="${esc(IF.q)}" autocomplete="off"></label>
   </div>
   <div class="toolbar rv fil">
    <select class="sel" id="itipo" aria-label="Tipo"><option value="">Todos los tipos</option>${TIPOS.map(([k,l])=>`<option value="${k}" ${IF.tipo===k?"selected":""}>${l}</option>`).join("")}</select>
    <select class="sel" id="iprov" aria-label="Provincia"><option value="">Todas las provincias</option>${PROVINCIAS.map(p=>`<option ${IF.prov===p?"selected":""}>${p}</option>`).join("")}</select>
    <select class="sel" id="ihab" aria-label="Habitaciones"><option value="">Habitaciones</option>${[1,2,3,4].map(n=>`<option value="${n}" ${IF.hab==n?"selected":""}>${n}+ hab.</option>`).join("")}</select>
    <label class="field-s sm"><span class="mono" style="color:var(--muted);font-size:12px">Máx.</span><input id="imax" inputmode="numeric" placeholder="Precio máximo" value="${esc(IF.max)}"></label>
    <select class="sel" id="isort" aria-label="Ordenar"><option value="rec" ${IF.sort==="rec"?"selected":""}>Más recientes</option><option value="asc" ${IF.sort==="asc"?"selected":""}>Menor precio</option><option value="desc" ${IF.sort==="desc"?"selected":""}>Mayor precio</option></select>
   </div>
   <p class="tcount" id="icount"></p>
   <div class="igrid" id="igrid"></div>
   ${modeNote()}
  </section>`;
}
function mineRow(x){
  const live=inmById(x.id);const est=live?live.estado:x.estado;
  return `<div class="mrow rv">${inmMedia(x,"sm")}<div style="min-width:0"><b>${esc(x.titulo||TIPO[x.tipo])}</b><small>${esc(refTxt(x))} · ${esc(priceTxt(x))}</small>${x.nota&&est==="rechazado"?`<small class="bad-t">Nota del despacho: ${esc(x.nota)}</small>`:""}</div>${pill(est)}
   <div class="mra">${live?`<a class="btn sm" href="#inm.${esc(x.id)}">Ver</a>`:""}<button class="btn sm ghost" data-withdraw="${esc(x.id)}">Retirar</button></div></div>`;
}
function bindInm(){
  const draw=()=>{
    const q=norm(IF.q),max=+digits(IF.max);
    let l=published().filter(x=>x.estado!=="pendiente"&&x.estado!=="rechazado")
     .filter(x=>(IF.op==="todos"||x.op===IF.op)&&(!IF.tipo||x.tipo===IF.tipo)&&(!IF.prov||x.provincia===IF.prov)&&(!IF.hab||+x.hab>=+IF.hab)&&(!max||+x.precio<=max)&&(!q||norm([x.titulo,x.sector,x.provincia,x.desc,TIPO[x.tipo]].join(" ")).includes(q)));
    if(IF.sort==="asc")l.sort((a,b)=>(+a.precio||1e15)-(+b.precio||1e15));else if(IF.sort==="desc")l.sort((a,b)=>(+b.precio||0)-(+a.precio||0));
    l.sort((a,b)=>(a.estado==="cerrado")-(b.estado==="cerrado"));
    $("#icount").textContent=ST.ready||ST.mode!=="db"?`${l.length} ${l.length===1?"inmueble":"inmuebles"}`:"Cargando inmuebles…";
    const total=published().filter(x=>x.estado!=="pendiente"&&x.estado!=="rechazado").length;
    $("#igrid").innerHTML=l.length?l.map(inmCard).join(""):`<div class="empty ie" style="grid-column:1/-1">${illo("casa")}<b>${total?"Ningún inmueble coincide con los filtros.":"Aún no hay inmuebles publicados."}</b><p>${total?"Pruebe con otros filtros o vea todas las propiedades.":"Sea el primero: publique su casa, apartamento, local o terreno y le ayudamos a alquilarlo o venderlo con seguridad."}</p><a class="btn pri sm" href="#publicar">${ic("plus")}Publicar propiedad</a></div>`;
    $$("#igrid .rv").forEach((el,i)=>el.style.setProperty("--i",Math.min(i,10)));
  };
  const seg=$("#iop");
  seg.addEventListener("click",e=>{const b=e.target.closest("[data-op]");if(!b)return;IF.op=b.dataset.op;$$("button",seg).forEach(x=>x.classList.toggle("on",x===b));segKnob(seg);draw()});
  $("#iq").addEventListener("input",e=>{IF.q=e.target.value;draw()});
  $("#imax").addEventListener("input",e=>{IF.max=e.target.value;draw()});
  [["itipo","tipo"],["iprov","prov"],["ihab","hab"],["isort","sort"]].forEach(([id,k])=>$("#"+id).addEventListener("change",e=>{IF[k]=e.target.value;draw()}));
  draw();requestAnimationFrame(()=>segKnob(seg));
}

/* ================= INMUEBLE: ficha ================= */
let galI=0;
function vInmDet(id){
  const x=inmById(id);
  if(!x)return `<div class="empty" style="margin-top:40px">${ST.ready||ST.mode!=="db"?`Este inmueble ya no está disponible. <a class="link" href="#inmuebles">Ver el catálogo</a>`:"Cargando inmueble…"}</div>`;
  const fotos=x.fotos||[];galI=0;
  const t=TITULO_ESTADOS.find(e=>e[0]===x.tituloEstado);
  const srv=x.op==="venta"?["debida-diligencia","compraventa","hipotecas","deslinde"]:["alquiler","debida-diligencia","desalojo"];
  const msg=`Hola, me interesa el inmueble ${refTxt(x)} (${x.titulo||TIPO[x.tipo]}, ${priceTxt(x)}) publicado en la web de SL Abogados. Quisiera coordinar una visita.`;
  return `<div class="svc"><div style="min-width:0">
   ${crumbs([["Inmuebles","inmuebles"],[x.titulo||TIPO[x.tipo]]])}
   <div class="gal rv">${fotos.length?`<div class="gal-main" id="galMain"><img src="${esc(imgSrc(fotos[0]))}" alt="Foto 1 de ${fotos.length}" onerror="this.style.display='none'">${illo(x.tipo)}${fotos.length>1?`<button class="gnav p" data-gal="-1" aria-label="Anterior">${ic("arrl")}</button><button class="gnav n" data-gal="1" aria-label="Siguiente">${ic("arr")}</button><span class="gcount" id="gcount">1 / ${fotos.length}</span>`:""}</div>${fotos.length>1?`<div class="thumbs">${fotos.map((f,i)=>`<button data-thumb="${i}" class="${i?"":"on"}"><img src="${esc(imgSrc(f))}" alt="" loading="lazy"></button>`).join("")}</div>`:""}`:`<div class="gal-main ill">${illo(x.tipo)}<span class="nofoto">Sin fotos todavía</span></div>`}</div>
   <header class="svc-h"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center" class="rv"><span class="op ${x.op}">${x.op==="venta"?"En venta":"En alquiler"}</span>${pill(x.estado)}${x.verificado?`<span class="vf">${ic("badge")}Título verificado</span>`:""}<span class="mono" style="font-size:12px;color:var(--muted)">${esc(refTxt(x))}</span></div>
    <h1 class="reveal-h">${esc(x.titulo||TIPO[x.tipo])}</h1><p class="lead rv" style="display:flex;gap:8px;align-items:center">${ic("pin")}${esc([x.sector,x.provincia].filter(Boolean).join(", "))}</p></header>
   <div class="facts">
    <div class="fact rv">${ic("bed")}<small>Habitaciones</small><b>${+x.hab||"—"}</b></div>
    <div class="fact rv">${ic("bath")}<small>Baños</small><b>${+x.banos||"—"}</b></div>
    <div class="fact rv">${ic("park")}<small>Parqueos</small><b>${+x.parq||"—"}</b></div>
    <div class="fact rv">${ic("ruler")}<small>Superficie</small><b>${+x.m2c?fmt(+x.m2c)+" m² const.":""}${+x.m2c&&+x.m2s?"<br>":""}${+x.m2s?fmt(+x.m2s)+" m² solar":""}${!+x.m2c&&!+x.m2s?"—":""}</b></div>
   </div>
   ${x.desc?`<section class="blk"><h2 class="rv">Descripción</h2><p class="rv" style="white-space:pre-line;font-size:16.5px;color:var(--ink-2);max-width:70ch">${esc(x.desc)}</p></section>`:""}
   ${(x.extras||[]).length||x.amueblado?`<section class="blk"><h2 class="rv">Comodidades</h2><div class="laws rv">${x.amueblado?`<span class="chip">${ic("check")}Amueblado</span>`:""}${(x.extras||[]).map(e=>`<span class="chip">${ic("check")}${esc(e)}</span>`).join("")}</div></section>`:""}
   <section class="blk"><h2 class="rv">Situación legal</h2>
    <div class="legal rv"><div class="lg-h">${ic(x.verificado?"badge":"doc")}<div><b>${esc(t?t[1]:"Estado del título no indicado")}</b><small>${x.verificado?"El despacho revisó el certificado de título y el estado jurídico del inmueble.":"Declarado por el propietario. Recomendamos una debida diligencia antes de pagar cualquier monto."}</small></div></div>
    ${t&&t[2]?`<p>${esc(t[2])}</p>`:""}</div></section>
   <section class="blk"><h2 class="rv">Servicios legales para esta operación</h2><div class="rel">${srv.map(id=>SRV[id]).filter(Boolean).map(s=>`<a class="rv" href="#srv.${s.id}"><b>${esc(s.n)}</b><span>${costTxt(s)} · ${esc(s.t)}</span></a>`).join("")}</div></section>
  </div>
  <aside class="aside"><div class="quote rv"><small>${x.op==="venta"?"Precio de venta":"Alquiler mensual"}</small><div class="amt num">${esc(priceTxt(x))}</div>
   ${x.op==="alquiler"&&+x.deposito?`<div class="row"><span>Depósito</span><b>${+x.deposito} ${+x.deposito===1?"mes":"meses"}</b></div>`:""}
   ${+x.mant?`<div class="row"><span>Mantenimiento</span><b class="num">${esc((x.moneda||"RD$")+fmt(+x.mant))}/mes</b></div>`:""}
   <div class="row"><span>Tipo</span><b>${esc(TIPO[x.tipo]||"—")}</b></div><div class="row"><span>Referencia</span><b class="mono">${esc(refTxt(x))}</b></div>
   ${x.estado==="cerrado"?`<p class="fine" style="font-size:14px">Este inmueble ya fue ${x.op==="venta"?"vendido":"alquilado"}.</p>`:`<a class="btn pri block" href="${waLink(msg)}" target="_blank" rel="noopener">${ic("wa")}Coordinar visita</a><a class="btn block" href="#contacto" data-pre="${x.op==="venta"?"compraventa":"alquiler"}">${ic("cal")}Consulta legal sobre este inmueble</a>`}
   <p class="fine">El despacho coordina la visita con el propietario. Nunca entregue dinero sin un contrato revisado.</p></div>
   ${ST.admin?`<div class="card" style="padding:16px;display:grid;gap:8px"><small class="mono" style="color:var(--muted)">ADMINISTRACIÓN</small><a class="btn sm" href="#publicar" data-editinm="${esc(x.id)}">${ic("edit")}Editar</a><a class="btn sm" href="#panel" data-ptab="inm">Gestionar en el panel</a></div>`:""}
  </aside></div>`;
}
function galGo(i){const x=inmById(route.slice(4));if(!x)return;const f=x.fotos||[];if(!f.length)return;galI=(i+f.length)%f.length;const img=$("#galMain img");if(img){img.style.display="";img.src=imgSrc(f[galI]);img.alt=`Foto ${galI+1} de ${f.length}`;img.animate&&img.animate([{opacity:.3},{opacity:1}],{duration:350})}const c=$("#gcount");if(c)c.textContent=`${galI+1} / ${f.length}`;$$("[data-thumb]").forEach(b=>b.classList.toggle("on",+b.dataset.thumb===galI))}

/* ================= PUBLICAR ================= */
let pf=null;
function blankPF(){return{id:newId("i"),op:"alquiler",tipo:"apartamento",titulo:"",provincia:"Distrito Nacional",sector:"",precio:"",moneda:"RD$",mant:"",deposito:"2",m2c:"",m2s:"",hab:"",banos:"",parq:"",amueblado:false,extras:[],desc:"",tituloEstado:"deslindado",fotos:[],servicios:[],nombre:"",tel:"",email:"",rol:"propietario",acepto:false}}
function vPub(){
  if(!pf)pf=blankPF();
  const ed=!!pf._edit;
  const st=(k,l,i)=>`<div class="fl"><label for="p-${k}">${l}</label><div class="stp"><button type="button" data-step="${k}" data-d="-1" aria-label="Menos">−</button><input id="p-${k}" data-k="${k}" inputmode="numeric" value="${esc(pf[k])}" placeholder="0"><button type="button" data-step="${k}" data-d="1" aria-label="Más">+</button></div></div>`;
  return `${crumbs([["Inmuebles","inmuebles"],[ed?"Editar publicación":"Publicar propiedad"]])}
  <header class="ph" style="padding-bottom:20px"><span class="eyebrow rv">${ed?"Editar publicación":"Publicar propiedad"}</span><h1 class="reveal-h">${ed?"Actualice los <em>datos</em> del inmueble.":"Ofrezca su propiedad <em>con respaldo legal</em>."}</h1><p class="rv">${ST.admin?"Como administrador, su publicación aparece en el catálogo al guardar.":"Complete el formulario. El despacho revisa la información en 24–48 horas y la publica en el catálogo."}</p></header>
  <form class="pform" id="pform" novalidate data-op="${pf.op}">
   <section class="pfs card rv"><h3><span>01</span>Operación y tipo</h3>
    <div class="opts s2">${[["alquiler","Quiero alquilar","Busco inquilino para mi propiedad","key"],["venta","Quiero vender","Busco comprador para mi propiedad","tag"]].map(([k,l,s,i])=>`<button type="button" class="opt big ${pf.op===k?"on":""}" data-pop="${k}">${ic(i)}<b>${l}</b><small>${s}</small></button>`).join("")}</div>
    <div class="opts" id="ptipo">${TIPOS.map(([k,l])=>`<button type="button" class="opt ${pf.tipo===k?"on":""}" data-ptipo="${k}"><span>${l}</span></button>`).join("")}</div>
    <div class="fl"><label for="p-titulo">Título del anuncio</label><input id="p-titulo" data-k="titulo" maxlength="80" value="${esc(pf.titulo)}" placeholder="Ej.: Apartamento de 3 habitaciones con vista al mar"></div></section>
   <section class="pfs card rv"><h3><span>02</span>Ubicación</h3>
    <div class="two"><div class="fl"><label for="p-provincia">Provincia</label><select class="sel" id="p-provincia" data-k="provincia">${PROVINCIAS.map(p=>`<option ${pf.provincia===p?"selected":""}>${p}</option>`).join("")}</select></div>
    <div class="fl" data-req="sector"><label for="p-sector">Sector o ciudad</label><input id="p-sector" data-k="sector" value="${esc(pf.sector)}" placeholder="Ej.: Naco, Piantini, Bávaro"></div></div>
    <p class="hint">Por seguridad no publicamos la dirección exacta. La compartimos solo con interesados confirmados.</p></section>
   <section class="pfs card rv"><h3><span>03</span>Precio</h3>
    <div class="two"><div class="fl" data-req="precio"><label for="p-precio"><span class="only-alq">Alquiler mensual</span><span class="only-ven">Precio de venta</span></label><div class="money"><select id="p-moneda" data-k="moneda" aria-label="Moneda">${["RD$","US$"].map(m=>`<option ${pf.moneda===m?"selected":""}>${m}</option>`).join("")}</select><input id="p-precio" data-k="precio" inputmode="numeric" value="${esc(pf.precio?fmt(+pf.precio):"")}" placeholder="0"></div></div>
    <div class="fl"><label for="p-mant">Mantenimiento mensual (opcional)</label><input id="p-mant" data-k="mant" inputmode="numeric" value="${esc(pf.mant?fmt(+pf.mant):"")}" placeholder="0"></div></div>
    <div class="fl only-alq"><label for="p-deposito">Depósito (meses)</label><select class="sel" id="p-deposito" data-k="deposito">${["1","2","3"].map(n=>`<option ${String(pf.deposito)===n?"selected":""}>${n}</option>`).join("")}</select></div></section>
   <section class="pfs card rv"><h3><span>04</span>Características</h3>
    <div class="grid3">${st("hab","Habitaciones")}${st("banos","Baños")}${st("parq","Parqueos")}</div>
    <div class="two"><div class="fl"><label for="p-m2c">Construcción (m²)</label><input id="p-m2c" data-k="m2c" inputmode="numeric" value="${esc(pf.m2c)}" placeholder="0"></div><div class="fl"><label for="p-m2s">Solar o terreno (m²)</label><input id="p-m2s" data-k="m2s" inputmode="numeric" value="${esc(pf.m2s)}" placeholder="0"></div></div>
    <label class="chk"><input type="checkbox" id="p-amueblado" data-k="amueblado" ${pf.amueblado?"checked":""}>Se entrega amueblado</label>
    <div class="fl"><label>Comodidades</label><div class="chips" id="pextras">${EXTRAS_INM.map(e=>`<button type="button" class="chipb ${pf.extras.includes(e)?"on":""}" data-pex="${esc(e)}">${esc(e)}</button>`).join("")}</div></div>
    <div class="fl"><label for="p-desc">Descripción</label><textarea id="p-desc" data-k="desc" maxlength="1500" placeholder="Distribución, estado, cercanía a colegios, plazas, transporte…">${esc(pf.desc)}</textarea></div></section>
   <section class="pfs card rv"><h3><span>05</span>Fotos</h3>
    <div class="drop" id="pdrop"><input type="file" id="pfile" accept="image/*" multiple hidden><div class="dz">${ic("camera")}<b>Agregue hasta 8 fotos</b><small>Arrástrelas aquí o toque para elegir. La primera será la portada.</small></div></div>
    <div class="pthumbs" id="pthumbs"></div><p class="hint" id="pnote"></p></section>
   <section class="pfs card rv"><h3><span>06</span>Situación legal del inmueble</h3>
    <div class="opts s2" id="ptit">${TITULO_ESTADOS.map(([k,l,s])=>`<button type="button" class="opt big ${pf.tituloEstado===k?"on":""}" data-ptit="${k}"><b>${l}</b><small>${s}</small></button>`).join("")}</div>
    <div class="fl"><label>¿Qué servicios legales le interesan?</label><div class="chips" id="psrv">${["debida-diligencia","compraventa","alquiler","deslinde","desalojo","hipotecas"].map(id=>`<button type="button" class="chipb ${pf.servicios.includes(id)?"on":""}" data-psrv="${id}">${esc(SRV[id].n)}</button>`).join("")}</div></div></section>
   <section class="pfs card rv"><h3><span>07</span>Sus datos de contacto</h3>
    <div class="two"><div class="fl" data-req="nombre"><label for="p-nombre">Nombre completo</label><input id="p-nombre" data-k="nombre" autocomplete="name" value="${esc(pf.nombre)}"></div><div class="fl" data-req="tel"><label for="p-tel">Teléfono o WhatsApp</label><input id="p-tel" data-k="tel" inputmode="tel" autocomplete="tel" value="${esc(pf.tel)}"></div></div>
    <div class="two"><div class="fl"><label for="p-email">Correo (opcional)</label><input id="p-email" data-k="email" type="email" autocomplete="email" value="${esc(pf.email)}"></div><div class="fl"><label for="p-rol">Usted es</label><select class="sel" id="p-rol" data-k="rol"><option value="propietario" ${pf.rol==="propietario"?"selected":""}>Propietario</option><option value="familiar" ${pf.rol==="familiar"?"selected":""}>Familiar autorizado</option><option value="agente" ${pf.rol==="agente"?"selected":""}>Agente inmobiliario</option></select></div></div>
    <p class="hint">Sus datos no se muestran en el anuncio. Los interesados contactan al despacho.</p>
    <label class="chk" data-req="acepto"><input type="checkbox" id="p-acepto" data-k="acepto" ${pf.acepto?"checked":""}>Declaro que soy el propietario o estoy autorizado a ofrecer este inmueble, y que la información es correcta.</label></section>
   <div class="perr" id="perr" hidden></div>
   <div class="pbar rv"><a class="btn ghost" href="#inmuebles">Cancelar</a><div style="display:flex;gap:8px;flex-wrap:wrap">${!ST.admin?`<button type="button" class="btn" data-pwa>${ic("wa")}Enviar por WhatsApp</button>`:""}<button type="submit" class="btn pri" id="psub">${ed?"Guardar cambios":ST.admin?"Publicar en el catálogo":"Enviar para revisión"}${ic("arr","arr")}</button></div></div>
   ${modeNote()}
  </form>`;
}
function pfRead(){
  $$("#pform [data-k]").forEach(el=>{const k=el.dataset.k;if(el.type==="checkbox")pf[k]=el.checked;else if(["precio","mant","m2c","m2s","hab","banos","parq"].includes(k))pf[k]=digits(el.value);else pf[k]=el.value.trim()});
}
function paintPhotos(){
  const box=$("#pthumbs");if(!box)return;
  box.innerHTML=pf.fotos.map((f,i)=>`<div class="pth">${i===0?`<span class="cov">Portada</span>`:""}<img src="${esc(imgSrc(f))}" alt="Foto ${i+1}"><div class="pta">${i>0?`<button type="button" data-pcover="${i}" title="Usar como portada">${ic("arrl")}</button>`:""}<button type="button" data-pdel="${i}" title="Quitar">${ic("x")}</button></div></div>`).join("")+(pf._up?`<div class="pth up"><span class="spin"></span></div>`:"");
  const n=$("#pnote");
  if(n)n.textContent=ST.mode==="db"&&!ST.assets?"Su cuenta no permite subir fotos aquí. Puede enviarlas por WhatsApp al despacho y las agregamos.":ST.mode!=="db"?"En modo local las fotos se guardan reducidas en este navegador (máximo 4).":"";
}
function compress(file,max,q){return new Promise((res,rej)=>{const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{const s=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement("canvas");c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);res(c)};img.onerror=()=>{URL.revokeObjectURL(url);rej()};img.src=url})}
async function addPhotos(files){
  files=[...files].filter(f=>/^image\//.test(f.type));
  const cap=ST.mode==="db"?8:4;
  for(const f of files){
    if(pf.fotos.length>=cap){toast(`Máximo ${cap} fotos`);break}
    try{
      if(ST.mode==="db"){
        if(!ST.assets){toast("No puede subir fotos con esta cuenta");break}
        pf._up=true;paintPhotos();
        const c=await compress(f,1600,.84);const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",.84));
        const r=await ST.assets.upload(blob,{type:"image/jpeg"});pf.fotos.push(r.id);
      }else{const c=await compress(f,900,.7);pf.fotos.push(c.toDataURL("image/jpeg",.7))}
    }catch(e){toast(e&&e.code==="too_large"?"Una foto es demasiado grande":e&&e.code==="quota_or_state"?"No hay espacio para más fotos":"No se pudo cargar una foto")}
    pf._up=false;paintPhotos();
  }
}
function bindPub(){
  const form=$("#pform");
  paintPhotos();
  const drop=$("#pdrop"),file=$("#pfile");
  drop.addEventListener("click",()=>file.click());
  file.addEventListener("change",()=>{addPhotos(file.files);file.value=""});
  ["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("over")}));
  ["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("over")}));
  drop.addEventListener("drop",e=>addPhotos(e.dataTransfer.files));
  form.addEventListener("input",e=>{const el=e.target;if(["p-precio","p-mant"].includes(el.id)){const d=digits(el.value);el.value=d?fmt(+d):""}});
  form.addEventListener("click",e=>{
    const t=e.target.closest("[data-pop],[data-ptipo],[data-ptit],[data-pex],[data-psrv],[data-step],[data-pdel],[data-pcover],[data-pwa]");if(!t)return;
    if(t.dataset.pop){pf.op=t.dataset.pop;form.dataset.op=pf.op;$$("[data-pop]").forEach(b=>b.classList.toggle("on",b===t))}
    else if(t.dataset.ptipo){pf.tipo=t.dataset.ptipo;$$("[data-ptipo]").forEach(b=>b.classList.toggle("on",b===t))}
    else if(t.dataset.ptit){pf.tituloEstado=t.dataset.ptit;$$("[data-ptit]").forEach(b=>b.classList.toggle("on",b===t))}
    else if(t.dataset.pex){const v=t.dataset.pex;pf.extras=pf.extras.includes(v)?pf.extras.filter(x=>x!==v):[...pf.extras,v];t.classList.toggle("on")}
    else if(t.dataset.psrv){const v=t.dataset.psrv;pf.servicios=pf.servicios.includes(v)?pf.servicios.filter(x=>x!==v):[...pf.servicios,v];t.classList.toggle("on")}
    else if(t.dataset.step){const inp=$("#p-"+t.dataset.step);inp.value=Math.max(0,(+digits(inp.value)||0)+(+t.dataset.d))}
    else if(t.dataset.pdel!==undefined){pf.fotos.splice(+t.dataset.pdel,1);paintPhotos()}
    else if(t.dataset.pcover!==undefined){const i=+t.dataset.pcover;pf.fotos.unshift(pf.fotos.splice(i,1)[0]);paintPhotos()}
    else if(t.hasAttribute("data-pwa")){pfRead();if(!pfValid(true))return;window.open(waLink(pubWaText()),"_blank","noopener")||toast("Abra WhatsApp: "+CONTACT.tel)}
  });
  form.addEventListener("submit",async e=>{
    e.preventDefault();pfRead();if(!pfValid())return;if(pf._up){toast("Espere a que terminen de subir las fotos");return}
    const btn=$("#psub");btn.disabled=true;btn.textContent="Guardando…";
    const now=new Date().toISOString();
    const item={id:pf.id,op:pf.op,tipo:pf.tipo,titulo:pf.titulo||`${TIPO[pf.tipo]} en ${pf.sector}`,provincia:pf.provincia,sector:pf.sector,precio:+pf.precio||0,moneda:pf.moneda,mant:+pf.mant||0,deposito:pf.op==="alquiler"?+pf.deposito:0,m2c:+pf.m2c||0,m2s:+pf.m2s||0,hab:+pf.hab||0,banos:+pf.banos||0,parq:+pf.parq||0,amueblado:!!pf.amueblado,extras:pf.extras,desc:pf.desc,tituloEstado:pf.tituloEstado,fotos:pf.fotos,servicios:pf.servicios,
      contacto:{nombre:pf.nombre,tel:pf.tel,email:pf.email,rol:pf.rol},creado:pf._edit?(pf.creado||now):now,actualizado:now};
    try{
      if(ST.admin){
        const prev=inmById(item.id);
        await putInm({...item,estado:prev?prev.estado:"publicado",verificado:prev?!!prev.verificado:false,autor:prev?prev.autor||"":pf._autor||""});
        if(pf._autor&&pf._autor!==uidLocal)await patchEnvio(pf._autor,item.id,{estado:"publicado"});
        toast(pf._edit?"Cambios guardados":"Publicado en el catálogo");const id=item.id;pf=null;go("inm."+id);
      }else{
        if(ST.mode==="db"&&!ST.uid){toast("Inicie sesión para publicar, o envíelo por WhatsApp");btn.disabled=false;btn.textContent="Enviar para revisión";return}
        const items=ST.mine.filter(x=>x.id!==item.id);items.push({...item,estado:"pendiente"});await saveMine(items);
        pf=null;showPubDone(item);
      }
    }catch(err){btn.disabled=false;btn.textContent=ST.admin?"Publicar en el catálogo":"Enviar para revisión"}
  });
}
function pfValid(quiet){
  const miss=[];
  if(!pf.sector)miss.push(["sector","el sector o ciudad"]);
  if(!+pf.precio)miss.push(["precio","el precio"]);
  if(!pf.nombre)miss.push(["nombre","su nombre"]);
  if(!pf.tel)miss.push(["tel","un teléfono"]);
  if(!pf.acepto&&!quiet)miss.push(["acepto","la declaración de propiedad"]);
  $$("#pform [data-req]").forEach(el=>el.classList.toggle("bad",miss.some(m=>m[0]===el.dataset.req)));
  const box=$("#perr");
  if(!miss.length){box.hidden=true;return true}
  box.hidden=false;box.innerHTML=`${ic("alert")}<span>Falta completar: ${miss.map(m=>m[1]).join(", ")}.</span>`;
  const first=$(`#pform [data-req="${miss[0][0]}"]`);first&&first.scrollIntoView({behavior:reduce?"auto":"smooth",block:"center"});
  return false;
}
function pubWaText(){return `Hola, quiero ${pf.op==="venta"?"vender":"alquilar"} mi inmueble: ${TIPO[pf.tipo]}${pf.titulo?" — "+pf.titulo:""}. Ubicación: ${pf.sector}, ${pf.provincia}. Precio: ${pf.moneda}${fmt(+pf.precio||0)}${pf.op==="alquiler"?"/mes":""}. ${+pf.hab?pf.hab+" hab., ":""}${+pf.banos?pf.banos+" baños, ":""}${+pf.m2c?pf.m2c+" m² const., ":""}${+pf.m2s?pf.m2s+" m² solar. ":""}Título: ${(TITULO_ESTADOS.find(t=>t[0]===pf.tituloEstado)||[])[1]||""}. Soy ${pf.nombre} (${pf.rol}), tel. ${pf.tel}.`}
function showPubDone(item){
  $("#view").innerHTML=`<div class="card done" style="max-width:640px;margin:40px auto 0"><span class="stampbig">${stampSvg("EN REVISIÓN",refTxt(item))}</span><h3>Recibimos su propiedad</h3><p>La revisaremos en 24–48 horas laborables. Puede ver el estado en “Mis publicaciones”. Si quiere acelerar el proceso, envíenos las fotos y el certificado de título por WhatsApp.</p>
  <div class="sumry" style="width:100%;text-align:left"><div><span>Referencia</span><span class="mono">${esc(refTxt(item))}</span></div><div><span>Inmueble</span><span>${esc(item.titulo)}</span></div><div><span>Precio</span><span>${esc(priceTxt(item))}</span></div><div><span>Estado</span><span>En revisión</span></div></div>
  <div class="acts"><a class="btn pri" href="${waLink("Hola, envié la propiedad "+refTxt(item)+" para publicar en la web de SL Abogados.")}" target="_blank" rel="noopener">${ic("wa")}Enviar documentos por WhatsApp</a><a class="btn" href="#inmuebles">Ver mis publicaciones</a></div></div>`+footer();
  window.scrollTo(0,0);
}

/* ================= ABOGADOS ================= */
let AF={q:"",area:"",idioma:"",notario:false};
const initials=n=>String(n||"").split(/\s+/).filter(w=>w.length>2||/^[A-ZÁÉÍÓÚ]/.test(w)).slice(0,2).map(w=>w[0]).join("").toUpperCase()||"SL";
const EST={disponible:["Disponible","ok"],audiencia:["En audiencia","warn"],ausente:["Fuera de oficina","mute"]};
function avatar(l,cls=""){return `<span class="av ${cls}">${l.foto?`<img src="${esc(imgSrc(l.foto))}" alt="" onerror="this.remove()">`:""}<i>${esc(initials(l.nombre))}</i></span>`}
const yearsOf=l=>{const y=+String(l.exequaturFecha||"").slice(0,4);return y>1950?new Date().getFullYear()-y:null};
const pend=v=>v?esc(v):`<em class="tbd">Por confirmar</em>`;
function lCard(l){
  const e=EST[l.estado]||EST.disponible;
  return `<a class="lcard rv" href="#abg.${esc(l.id)}">${avatar(l)}<div class="lc-b"><div class="lc-t"><span class="dot ${e[1]}"></span>${e[0]}${l.verificado?`<span class="vf">${ic("badge")}Verificado</span>`:""}</div>
   <h3>${esc(l.nombre)}</h3><p class="cargo">${esc(l.cargo||"Abogado")}${l.notario?" · Notario público":""}</p>
   <div class="lc-c mono"><span>CARD ${l.card?esc(l.card):"—"}</span><span>Exequátur ${l.exequatur?esc(l.exequatur):"—"}</span></div>
   <div class="laws">${(l.areas||[]).slice(0,3).map(a=>AREA[a]?`<span class="chip">${esc(AREA[a].n.split(" y ")[0])}</span>`:"").join("")}${(l.areas||[]).length>3?`<span class="chip">+${l.areas.length-3}</span>`:""}</div></div></a>`;
}
function vAbg(){
  const L=lawyers();
  return `<header class="ph"><span class="eyebrow rv">Abogados</span><h1 class="reveal-h">El equipo, con sus <em>credenciales</em> a la vista.</h1><p class="rv">Cada perfil muestra la matrícula del Colegio de Abogados (CARD), el exequátur, la habilitación notarial, la formación y las áreas en que ejerce.</p></header>
  <div class="toolbar rv"><label class="field-s">${ic("search")}<input id="lq" type="search" placeholder="Buscar por nombre…" value="${esc(AF.q)}" autocomplete="off"></label>
   <select class="sel" id="larea" aria-label="Área"><option value="">Todas las áreas</option>${AREAS.map(a=>`<option value="${a.id}" ${AF.area===a.id?"selected":""}>${esc(a.n)}</option>`).join("")}</select>
   <select class="sel" id="lidi" aria-label="Idioma"><option value="">Cualquier idioma</option>${IDIOMAS.map(i=>`<option ${AF.idioma===i?"selected":""}>${i}</option>`).join("")}</select>
   <label class="chk tgl"><input type="checkbox" id="lnot" ${AF.notario?"checked":""}>Solo notarios</label></div>
  <p class="tcount" id="lcount"></p>
  <div class="lgrid" id="lgrid"></div>
  <div class="notes rv" style="margin-top:28px"><h4>${ic("shield")}Cómo verificar a un abogado</h4><ul>
   <li>Todo abogado en ejercicio debe estar inscrito en el Colegio de Abogados de la República Dominicana (CARD) y tener su exequátur, otorgado por el Poder Ejecutivo.</li>
   <li>Los notarios son designados por la Suprema Corte de Justicia y deben estar inscritos en el Colegio Dominicano de Notarios (Ley 140-15).</li>
   <li>El sello “Verificado” indica que el despacho revisó los documentos originales de ese profesional.</li></ul></div>
  ${ST.admin?`<div style="margin-top:18px"><a class="btn" href="#panel" data-ptab="abg">${ic("edit")}Administrar abogados</a></div>`:""}`;
}
function bindAbg(){
  const draw=()=>{const q=norm(AF.q);const l=lawyers().filter(x=>(!q||norm(x.nombre+" "+x.cargo).includes(q))&&(!AF.area||(x.areas||[]).includes(AF.area))&&(!AF.idioma||(x.idiomas||[]).includes(AF.idioma))&&(!AF.notario||x.notario));
   $("#lcount").textContent=`${l.length} ${l.length===1?"profesional":"profesionales"}`;
   $("#lgrid").innerHTML=l.length?l.map(lCard).join(""):`<div class="empty" style="grid-column:1/-1">Ningún abogado coincide con los filtros.</div>`;
   $$("#lgrid .rv").forEach((el,i)=>el.style.setProperty("--i",Math.min(i,10)))};
  $("#lq").addEventListener("input",e=>{AF.q=e.target.value;draw()});
  $("#larea").addEventListener("change",e=>{AF.area=e.target.value;draw()});
  $("#lidi").addEventListener("change",e=>{AF.idioma=e.target.value;draw()});
  $("#lnot").addEventListener("change",e=>{AF.notario=e.target.checked;draw()});
  draw();
}
function vAbgDet(id){
  const l=lawyerById(id);
  if(!l||(l.publicado===false&&!ST.admin))return `<div class="empty" style="margin-top:40px">Este perfil no está disponible. <a class="link" href="#abogados">Ver el equipo</a></div>`;
  const e=EST[l.estado]||EST.disponible,yrs=yearsOf(l);
  const fdate=s=>{if(!s)return"";const d=new Date(s+"T12:00:00");return isNaN(d)?s:`${d.getDate()} ${MN[d.getMonth()]} ${d.getFullYear()}`};
  return `${crumbs([["Abogados","abogados"],[l.nombre]])}
  <header class="lhead">${avatar(l,"xl")}<div style="min-width:0"><div class="lc-t rv"><span class="dot ${e[1]}"></span>${e[0]}${l.verificado?`<span class="vf">${ic("badge")}Credenciales verificadas</span>`:""}${l.publicado===false?`<span class="pill mute">Oculto</span>`:""}</div>
   <h1 class="reveal-h">${esc(l.nombre)}</h1><p class="cargo rv">${esc(l.cargo||"Abogado")}${l.notario?" · Notario público":""}${yrs?` · ${yrs} años de ejercicio`:""}</p>
   <div class="ctas rv" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px"><a class="btn pri" href="#contacto" data-preabg="${esc(l.id)}">${ic("cal")}Agendar con ${esc(l.nombre.split(" ")[0])}</a>${l.tel?`<a class="btn" href="https://wa.me/${waNum(l.tel)}" target="_blank" rel="noopener">${ic("wa")}WhatsApp</a>`:""}${l.email?`<button class="btn" data-copy="${esc(l.email)}" data-copyfree>${ic("mail")}${esc(l.email)}</button>`:""}${ST.admin?`<a class="btn ghost" href="#panel" data-editabg="${esc(l.id)}">${ic("edit")}Editar</a>`:""}</div></div></header>
  <div class="lprof">
   <section class="card ficha-p rv"><h2>Ficha profesional</h2><dl>
    <div><dt>Matrícula CARD</dt><dd class="mono">${pend(l.card)}</dd></div>
    <div><dt>Exequátur</dt><dd>${l.exequatur?`<span class="mono">${esc(l.exequatur)}</span>${l.exequaturFecha?` · ${esc(fdate(l.exequaturFecha))}`:""}`:pend("")}</dd></div>
    <div><dt>Años de ejercicio</dt><dd>${yrs!=null?yrs:pend("")}</dd></div>
    <div><dt>Notario público</dt><dd>${l.notario?`Sí${l.notarioMatricula?` · matrícula <span class="mono">${esc(l.notarioMatricula)}</span>`:""}${l.notarioJurisdiccion?` · ${esc(l.notarioJurisdiccion)}`:""}`:"No"}</dd></div>
    <div><dt>Tribunales</dt><dd>${pend(l.tribunales)}</dd></div>
    <div><dt>Idiomas</dt><dd>${(l.idiomas||[]).length?esc(l.idiomas.join(", ")):pend("")}</dd></div>
    <div><dt>Membresías</dt><dd>${(l.membresias||[]).length?esc(l.membresias.join(" · ")):pend("")}</dd></div>
   </dl></section>
   <section class="card rv" style="padding:24px"><h2 class="lh2">Formación</h2><ol class="edu-tl">
    <li><b>${pend(l.titulo)}</b><span>${pend(l.universidad)}${l.anioGrad?` · ${esc(l.anioGrad)}`:""}</span></li>
    ${(l.postgrados||[]).map(p=>`<li><b>${esc(p)}</b></li>`).join("")}</ol></section>
  </div>
  ${l.bio?`<section class="blk"><h2 class="rv">Perfil</h2><p class="rv" style="font-size:17px;color:var(--ink-2);max-width:70ch;white-space:pre-line">${esc(l.bio)}</p></section>`:""}
  <section class="blk"><h2 class="rv">Áreas de práctica</h2><div class="agrid">${(l.areas||[]).map(a=>AREA[a]).filter(Boolean).map(areaCard).join("")||`<p class="tbd">Por confirmar</p>`}</div></section>
  <p class="fine rv" style="margin-top:24px">Los datos de licencia los publica el propio despacho. Puede confirmarlos directamente con el Colegio de Abogados de la República Dominicana.</p>`;
}

/* ================= Hooks ================= */
function extAfter(){
  if(route==="inmuebles")bindInm();
  if(route==="publicar")bindPub();
  if(route==="abogados")bindAbg();
  if(route==="panel")bindPanel();
}
function extClick(e){
  const t=e.target;
  if(crmClick(e))return true;
  const g=t.closest("[data-gal]");if(g){galGo(galI+(+g.dataset.gal));return true}
  const th=t.closest("[data-thumb]");if(th){galGo(+th.dataset.thumb);return true}
  const pt=t.closest("[data-ptab]");if(pt){CV.mod=PTMAP[pt.dataset.ptab]||"resumen";if(pt.dataset.ptab==="sol")CV.isub="sol";if(pt.dataset.ptab==="inm")CV.isub="cat";abgEdit=null;confirmDel="";if(route==="panel"){e.preventDefault();softRender();return true}}
  if(t.closest("[data-newinm]")){pf=blankPF();return false}
  const ei=t.closest("[data-editinm]");if(ei){const x=inmById(ei.dataset.editinm);if(x){const co=contactOf(x);pf={...blankPF(),...x,...(co?{nombre:co.nombre,tel:co.tel,email:co.email,rol:co.rol}:{}),acepto:true,_edit:true,_autor:x.autor||""};pf.fotos=(x.fotos||[]).slice();pf.extras=(x.extras||[]).slice();pf.servicios=(x.servicios||[]).slice()}return false}
  const ee=t.closest("[data-editenv]");if(ee){const x=ST.envAll.find(y=>y.id===ee.dataset.editenv);if(x){pf={...blankPF(),...x,...(x.contacto?{nombre:x.contacto.nombre,tel:x.contacto.tel,email:x.contacto.email,rol:x.contacto.rol}:{}),acepto:true,_edit:true,_autor:ee.dataset.autor};pf.fotos=(x.fotos||[]).slice();pf.extras=(x.extras||[]).slice();pf.servicios=(x.servicios||[]).slice()}return false}
  if(t.closest('a[href="#publicar"]')&&!t.closest("[data-editinm],[data-editenv]")&&pf&&pf._edit){pf=null}
  const ap=t.closest("[data-approve]");if(ap){(async()=>{const x=ST.envAll.find(y=>y.id===ap.dataset.approve);if(!x)return;ap.disabled=true;try{const {autor,...rest}=x;await putInm({...rest,estado:"publicado",verificado:false,autor:ap.dataset.autor});await patchEnvio(ap.dataset.autor,x.id,{estado:"publicado"});toast("Publicado en el catálogo")}catch(err){ap.disabled=false}})();return true}
  const rj=t.closest("[data-reject]");if(rj){const b=$("#rej-"+CSS.escape(rj.dataset.reject));if(b){b.hidden=!b.hidden;b.querySelector("input").focus()}return true}
  const ro=t.closest("[data-rejok]");if(ro){(async()=>{const n=($("#rejn-"+CSS.escape(ro.dataset.rejok))||{}).value||"";try{await patchEnvio(ro.dataset.autor,ro.dataset.rejok,{estado:"rechazado",nota:n});toast("Solicitud rechazada")}catch(err){}})();return true}
  const ad=t.closest("[data-askdel]");if(ad){confirmDel=ad.dataset.askdel;softRender();return true}
  if(t.closest("[data-nodel]")){confirmDel="";softRender();return true}
  const di=t.closest("[data-delinm]");if(di){(async()=>{const x=inmById(di.dataset.delinm);try{await delInm(di.dataset.delinm);if(x&&x.autor)await patchEnvio(x.autor,x.id,{estado:"cerrado"});confirmDel="";toast("Inmueble eliminado")}catch(err){}})();return true}
  const da=t.closest("[data-delabg]");if(da){(async()=>{try{await delAbg(da.dataset.delabg);confirmDel="";toast("Abogado eliminado");softRender()}catch(err){}})();return true}
  if(t.closest("[data-newabg]")){abgEdit={_new:true,nombre:"",cargo:"Abogado asociado",estado:"disponible",areas:[],idiomas:["Español"],postgrados:[],membresias:[],publicado:true,orden:lawyers(true).length+1};softRender();return true}
  const ea=t.closest("[data-editabg2]");if(ea){const l=lawyerById(ea.dataset.editabg2);abgEdit=JSON.parse(JSON.stringify(l));softRender();return true}
  const ea2=t.closest("[data-editabg]");if(ea2){const l=lawyerById(ea2.dataset.editabg);CV.mod="abogados";abgEdit=JSON.parse(JSON.stringify(l));return false}
  const pa=t.closest("[data-preabg]");if(pa){wz={...wz,abg:pa.dataset.preabg,done:false,step:0};return false}
  const wd=t.closest("[data-withdraw]");if(wd){(async()=>{try{await saveMine(ST.mine.filter(x=>x.id!==wd.dataset.withdraw));toast("Publicación retirada de su lista");softRender()}catch(err){}})();return true}
  return false;
}
