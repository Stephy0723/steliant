
/* =====================================================================
   CRM DEL DESPACHO — clientes, pipeline y editor de todo el contenido
   ===================================================================== */
var DBAREAS={}, ALLAREAS=[], CRM=[];
var abgEdit=null, confirmDel="";
const CV={mod:"resumen",view:"kanban",q:"",etapa:"",abg:"",sel:null,draft:null,isub:"sol",csub:"areas",areaEdit:null,faqDraft:null,glosDraft:null,txtDraft:null,imp:null,exportTxt:""};
const PTMAP={sol:"inmuebles",inm:"inmuebles",abg:"abogados",cit:"citas",cfg:"despacho"};
const AREA_ICONS=["family","scroll","house","contract","coins","briefcase","gavel","building","receipt","passport","bulb","landmark","card","car","stamp","column","chip","handshake","pulse","leaf","chart","scale","shield","users","key","globe","book"];
const today=()=>iso(new Date());
const clone=o=>JSON.parse(JSON.stringify(o,(k,v)=>k==="area"||k==="hist"?undefined:v));
const slug=t=>norm(t).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"item";
const lines=t=>String(t||"").split("\n").map(s=>s.trim()).filter(Boolean);

/* ---------- Contenido dinámico ---------- */
function mergedAreas(){
  const out=DEF_AREAS.map((a,i)=>DBAREAS[a.id]?{...clone(DBAREAS[a.id]),_mod:true}:{...clone(a),orden:i});
  Object.values(DBAREAS).forEach(d=>{if(!DEF_AREAS.some(a=>a.id===d.id))out.push({...clone(d),_nueva:true})});
  return out.filter(a=>!a.eliminada).sort((a,b)=>(a.orden??99)-(b.orden??99));
}
function rebuildIndex(){
  ALLAREAS=mergedAreas();
  AREAS.length=0;
  ALLAREAS.filter(a=>!a.oculta).forEach(a=>{const c={...a,s:(a.s||[]).filter(s=>!s.oculto).map(s=>({...s}))};delete c._mod;delete c._nueva;AREAS.push(c)});
  Object.keys(SRV).forEach(k=>delete SRV[k]);Object.keys(AREA).forEach(k=>delete AREA[k]);TOTAL=0;
  AREAS.forEach(a=>{AREA[a.id]=a;a.s.forEach(s=>{s.area=a;SRV[s.id]=s;TOTAL++})});
}
function applyList(target,src){target.length=0;src.forEach(x=>target.push(x))}
function applyContenido(m){
  applyList(FAQ,m.faq&&Array.isArray(m.faq.items)?m.faq.items.map(x=>[x.q,x.a]):DEF_FAQ);
  applyList(GLOSARIO,m.glosario&&Array.isArray(m.glosario.items)?m.glosario.items.map(x=>[x.t,x.d]):DEF_GLOS);
  Object.keys(TEXTOS).forEach(k=>TEXTOS[k]=DEF_TEXTOS[k]);Object.assign(TEXTOS,(m.textos&&m.textos.t)||{});
}
function contentChanged(){rebuildIndex();paintDrAreas();changed()}
function subscribeContent(){
  ST.db.collection("areas").onSnapshot(s=>{DBAREAS={};s.docs.forEach(d=>DBAREAS[d.id]={...d.data(),id:d.id});contentChanged()},dbErr);
  ST.db.collection("contenido").onSnapshot(s=>{applyContenido(Object.fromEntries(s.docs.map(d=>[d.id,d.data()])));contentChanged()},dbErr);
}
function subscribeCrm(){ST.db.collection("crm").onSnapshot(s=>{CRM=s.docs.map(d=>({...d.data(),id:d.id}));changed()},dbErr)}
function loadLocalContent(){DBAREAS=store.get("sl-areas")||{};applyContenido(store.get("sl-contenido")||{});CRM=store.get("sl-crm")||[];rebuildIndex()}
async function putArea(a){
  const doc=clone(a);delete doc._mod;delete doc._nueva;
  if(ST.mode==="db")await ST.db.doc("areas/"+a.id).set(doc).catch(writeErr);
  else{DBAREAS[a.id]=doc;store.set("sl-areas",DBAREAS)}
  DBAREAS[a.id]=doc;contentChanged();
}
async function resetArea(id){
  if(ST.mode==="db")await ST.db.doc("areas/"+id).delete().catch(writeErr);
  delete DBAREAS[id];if(ST.mode!=="db")store.set("sl-areas",DBAREAS);contentChanged();
}
async function putContenido(id,data){
  if(ST.mode==="db")await ST.db.doc("contenido/"+id).set(data).catch(writeErr);
  else{const c=store.get("sl-contenido")||{};c[id]=data;store.set("sl-contenido",c);applyContenido(c)}
  contentChanged();
}
async function delContenido(id){
  if(ST.mode==="db")await ST.db.doc("contenido/"+id).delete().catch(writeErr);
  else{const c=store.get("sl-contenido")||{};delete c[id];store.set("sl-contenido",c);applyContenido(c)}
  contentChanged();
}
async function putCliente(c){
  const doc=clone(c);delete doc.virtual;doc.actualizado=new Date().toISOString();
  if(ST.mode==="db")await ST.db.doc("crm/"+c.id).set(doc).catch(writeErr);
  else{CRM=CRM.filter(x=>x.id!==c.id).concat([{...doc,id:c.id}]);store.set("sl-crm",CRM);changed()}
}
async function delCliente(id){
  if(ST.mode==="db")await ST.db.doc("crm/"+id).delete().catch(writeErr);
  else{CRM=CRM.filter(x=>x.id!==id);store.set("sl-crm",CRM);changed()}
}

/* ---------- Clientes: reales + leads de la web ---------- */
const keyOf=(tel,email)=>{const d=digits(tel).slice(-10);return d.length>=7?"t"+d:(email?"e"+String(email).toLowerCase().trim():"")};
function webLeads(){
  const L=[];
  ST.citasAll.forEach(c=>L.push({tipo:"cita",key:keyOf(c.phone,c.email),nombre:c.name,tel:c.phone,email:c.email,area:c.area&&c.area!=="general"?c.area:"",srv:c.srv||"",abg:c.abg||"",fecha:c.at||c.date,ref:c}));
  ST.envAll.forEach(x=>{const co=x.contacto||{};L.push({tipo:"inmueble",key:keyOf(co.tel,co.email),nombre:co.nombre,tel:co.tel,email:co.email,area:"inmobiliario",srv:x.op==="venta"?"compraventa":"alquiler",abg:"",fecha:x.creado,ref:x})});
  return L.filter(l=>l.key);
}
function clientes(){
  const real=CRM.map(c=>({...c,hist:[]}));const by={};
  real.forEach(c=>{const k=keyOf(c.tel,c.email);if(k)by[k]=c});
  const virt={};
  webLeads().forEach(l=>{const c=by[l.key];if(c){c.hist.push(l);return}
    if(!virt[l.key])virt[l.key]={id:"v-"+l.key,virtual:true,nombre:l.nombre||"Sin nombre",tel:l.tel||"",email:l.email||"",origen:l.tipo==="cita"?"web-cita":"web-inmueble",etapa:"nuevo",area:l.area,srv:l.srv,abg:l.abg,valor:0,notas:[],creado:l.fecha,hist:[]};
    virt[l.key].hist.push(l)});
  return real.concat(Object.values(virt));
}
const cliById=id=>clientes().find(c=>c.id===id);
const ET=Object.fromEntries(ETAPAS);
const etPill=e=>`<span class="pill et-${e}">${esc(ET[e]||e)}</span>`;
const fdate=s=>{if(!s)return"";const d=new Date(String(s).length===10?s+"T12:00:00":s);return isNaN(d)?String(s):`${d.getDate()} ${MN[d.getMonth()]} ${d.getFullYear()}`};
const overdue=c=>c.proxima&&c.proxima<today()&&!["cerrado","perdido"].includes(c.etapa);

/* ---------- Vista principal ---------- */
const MODS=[["resumen","Resumen","chart"],["clientes","Clientes","users"],["citas","Citas","cal"],["inmuebles","Inmuebles","key"],["abogados","Abogados","scale"],["contenido","Contenido del sitio","book"],["despacho","Datos del despacho","office"],["respaldo","Respaldo","layers"]];
function syncDrafts(){
  if($("#aform")&&abgEdit)abgRead();
  if($("#areaForm")&&CV.areaEdit)readAreaForm();
  if($("#faqForm")&&CV.faqDraft)CV.faqDraft=readPairs("faqForm");
  if($("#glosForm")&&CV.glosDraft)CV.glosDraft=readPairs("glosForm");
  if($("#txtForm")&&CV.txtDraft)readTxt();
  if($("#cliForm")&&CV.draft)readCli();
}
function vPanel(){
  if(!ST.admin)return `<header class="ph"><span class="eyebrow">CRM del despacho</span><h1>Acceso <em>restringido</em></h1><p>Esta sección es solo para el equipo del despacho. Si quiere publicar una propiedad, use <a class="link" href="#publicar">Publicar propiedad</a>.</p></header>`;
  syncDrafts();
  const C=clientes();
  const cnt={clientes:C.filter(c=>c.etapa==="nuevo").length,citas:ST.citasAll.filter(c=>c.estado==="nueva").length,inmuebles:ST.envAll.filter(x=>x.estado==="pendiente").length};
  const m=MODS.find(x=>x[0]===CV.mod)||MODS[0];
  const body={resumen:mResumen,clientes:mClientes,citas:mCitas,inmuebles:mInm,abogados:mAbg,contenido:mContenido,despacho:()=>cfgForm(),respaldo:mRespaldo}[m[0]](C);
  return `<div class="crm">
   <aside class="crm-nav rv"><div class="crm-brand">${seal(false)}<div><b>CRM</b><small>SL Abogados</small></div></div>
    ${MODS.map(([k,l,i])=>`<button class="cn ${CV.mod===k?"on":""}" data-mod="${k}">${ic(i)}<span>${l}</span>${cnt[k]?`<em>${cnt[k]}</em>`:""}</button>`).join("")}
    <div class="crm-mode">${ST.mode==="db"?`${ic("shield")}Datos compartidos`:`${ic("alert")}Modo local`}</div></aside>
   <section class="crm-main"><header class="crm-h rv"><div><span class="eyebrow">CRM del despacho</span><h1>${m[1]}</h1></div>${crmActions(m[0])}</header>
    <div class="crm-b rv">${body}</div></section></div>`;
}
function crmActions(k){
  if(k==="clientes")return `<button class="btn pri sm" data-newcli>${ic("plus")}Nuevo cliente</button>`;
  if(k==="abogados"&&!abgEdit)return `<button class="btn pri sm" data-newabg>${ic("plus")}Agregar abogado</button>`;
  if(k==="inmuebles")return `<a class="btn pri sm" href="#publicar" data-newinm>${ic("plus")}Agregar inmueble</a>`;
  return "";
}

/* ---------- Resumen ---------- */
function mResumen(C){
  const act=C.filter(c=>c.etapa==="activo").length,nuevos=C.filter(c=>c.etapa==="nuevo").length;
  const t=today(),in7=iso(new Date(Date.now()+7*864e5));
  const prox=ST.citasAll.filter(c=>c.date>=t&&c.estado!=="cancelada").sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const cart=C.filter(c=>["propuesta","activo"].includes(c.etapa)).reduce((s,c)=>s+(+c.valor||0),0);
  const seg=C.filter(c=>c.proxima&&!["cerrado","perdido"].includes(c.etapa)).sort((a,b)=>a.proxima.localeCompare(b.proxima)).slice(0,6);
  const tot=C.length||1;
  const act2=[];
  CRM.forEach(c=>(c.notas||[]).forEach(n=>act2.push({t:n.t,txt:n.txt,who:c.nombre,id:c.id})));
  ST.citasAll.forEach(c=>act2.push({t:c.at,txt:`Agendó consulta: ${bkTopic(c)}`,who:c.name,id:"v-"+keyOf(c.phone,c.email),cita:1}));
  ST.envAll.forEach(x=>act2.push({t:x.creado,txt:`Envió inmueble: ${x.titulo}`,who:(x.contacto||{}).nombre,id:"v-"+keyOf((x.contacto||{}).tel,(x.contacto||{}).email)}));
  act2.sort((a,b)=>String(b.t||"").localeCompare(String(a.t||"")));
  return `<div class="kpis">
   <button class="kpi" data-mod="clientes" data-fet="nuevo"><small>Leads nuevos</small><b>${nuevos}</b><span>Por contactar</span></button>
   <button class="kpi" data-mod="clientes" data-fet="activo"><small>Clientes activos</small><b>${act}</b><span>Casos en curso</span></button>
   <button class="kpi" data-mod="citas"><small>Citas próximas</small><b>${prox.filter(c=>c.date<=in7).length}</b><span>En los próximos 7 días</span></button>
   <button class="kpi" data-mod="inmuebles"><small>Inmuebles por revisar</small><b>${ST.envAll.filter(x=>x.estado==="pendiente").length}</b><span>${ST.inm.filter(x=>x.estado==="publicado").length} publicados</span></button>
   <div class="kpi wide"><small>Cartera en honorarios</small><b class="num">${money(cart)}</b><span>Propuestas y clientes activos</span></div></div>
  <div class="card pipe"><div class="pipe-h"><b>Embudo de clientes</b><small>${C.length} en total</small></div>
   <div class="pbar-s">${ETAPAS.map(([k])=>{const n=C.filter(c=>c.etapa===k).length;return n?`<i class="et-bg-${k}" style="flex:${n}" title="${ET[k]}: ${n}"></i>`:""}).join("")||`<i style="flex:1;background:var(--line)"></i>`}</div>
   <div class="pipe-l">${ETAPAS.map(([k,l])=>`<button data-mod="clientes" data-fet="${k}"><i class="et-bg-${k}"></i>${l}<b>${C.filter(c=>c.etapa===k).length}</b></button>`).join("")}</div></div>
  <div class="two-c">
   <div class="card lst"><h3>${ic("clock")}Seguimientos</h3>${seg.length?seg.map(c=>`<button class="li" data-cli="${esc(c.id)}"><span class="av sm"><i>${esc(initials(c.nombre))}</i></span><div><b>${esc(c.nombre)}</b><small>${esc(c.accion||"Dar seguimiento")}</small></div><span class="${overdue(c)?"late":"when"}">${overdue(c)?"Vencido · ":""}${esc(fdate(c.proxima))}</span></button>`).join(""):`<p class="muted-s">Sin seguimientos programados. Agregue una fecha de próxima acción en la ficha de cada cliente.</p>`}</div>
   <div class="card lst"><h3>${ic("cal")}Próximas citas</h3>${prox.slice(0,6).map(c=>{const d=bkDate(c);return `<div class="li"><div class="cal-s"><small>${MN[d.d.getMonth()]}</small><b>${d.d.getDate()}</b></div><div><b>${esc(c.name)}</b><small>${esc(ampm(c.time))} · ${esc((MODES[c.mode]||[""])[0])} · ${esc(bkTopic(c))}</small></div>${pillCita(c.estado)}</div>`}).join("")||`<p class="muted-s">No hay citas próximas.</p>`}</div>
  </div>
  <div class="card lst"><h3>${ic("route")}Actividad reciente</h3>${act2.slice(0,8).map(a=>`<button class="li" data-cli="${esc(a.id)}"><span class="dotl"></span><div><b>${esc(a.who||"—")}</b><small>${esc(a.txt)}</small></div><span class="when">${esc(fdate(a.t))}</span></button>`).join("")||`<p class="muted-s">Todavía no hay actividad. Las citas y propiedades que lleguen por la web aparecerán aquí.</p>`}</div>`;
}
const pillCita=e=>`<span class="pill ${e==="nueva"?"warn":e==="confirmada"?"ok":e==="cancelada"?"bad":"mute"}">${{nueva:"Nueva",confirmada:"Confirmada",atendida:"Atendida",cancelada:"Cancelada"}[e]||"Nueva"}</span>`;

/* ---------- Clientes ---------- */
function filtCli(C){const q=norm(CV.q);return C.filter(c=>(!q||norm([c.nombre,c.tel,c.email,c.cedula,(AREA[c.area]||{}).n].join(" ")).includes(q))&&(!CV.etapa||c.etapa===CV.etapa)&&(!CV.abg||c.abg===CV.abg))}
function kcard(c){
  const s=SRV[c.srv],a=AREA[c.area],l=lawyerById(c.abg);
  return `<div class="kc" draggable="true" data-cid="${esc(c.id)}" tabindex="0" role="button" aria-label="${esc(c.nombre)}">
   <div class="kc-t"><b>${esc(c.nombre)}</b>${l?`<span class="av xs" title="${esc(l.nombre)}"><i>${esc(initials(l.nombre))}</i></span>`:""}</div>
   <small>${esc(s?s.n:a?a.n:"Sin área asignada")}</small>
   <div class="kc-m">${+c.valor?`<span class="num">${money(+c.valor)}</span>`:""}${c.proxima?`<span class="${overdue(c)?"late":""}">${ic("clock")}${esc(fdate(c.proxima))}</span>`:""}${c.virtual?`<span class="web">Web</span>`:""}</div></div>`;
}
function mClientes(C){
  const L=filtCli(C);
  const tb=`<div class="toolbar"><label class="field-s">${ic("search")}<input id="cq" type="search" placeholder="Buscar nombre, teléfono, cédula…" value="${esc(CV.q)}" autocomplete="off"></label>
   <select class="sel" id="cet" aria-label="Etapa"><option value="">Todas las etapas</option>${ETAPAS.map(([k,l])=>`<option value="${k}" ${CV.etapa===k?"selected":""}>${l}</option>`).join("")}</select>
   <select class="sel" id="cab" aria-label="Abogado"><option value="">Todos los abogados</option>${lawyers(true).map(l=>`<option value="${esc(l.id)}" ${CV.abg===l.id?"selected":""}>${esc(l.nombre)}</option>`).join("")}</select>
   <div class="segf" id="cvw"><span class="k"></span><button data-vw="kanban" class="${CV.view==="kanban"?"on":""}">Tablero</button><button data-vw="lista" class="${CV.view==="lista"?"on":""}">Lista</button></div></div>`;
  if(!C.length)return tb+`<div class="empty ie">${ic("users")}<b>Aún no hay clientes.</b><p>Las personas que agenden una consulta o envíen un inmueble aparecen aquí automáticamente. También puede agregar clientes a mano.</p><button class="btn pri sm" data-newcli>${ic("plus")}Nuevo cliente</button></div>`;
  if(CV.view==="lista")return tb+`<div class="tarifa ctab"><div class="tr th"><span>Cliente</span><span>Etapa</span><span>Área / servicio</span><span>Valor</span><span>Próxima acción</span></div>${L.map(c=>`<button class="tr" data-cli="${esc(c.id)}"><span class="nm">${esc(c.nombre)}<small style="display:block;font-weight:400;color:var(--muted);font-size:12.5px">${esc(c.tel||c.email||"")}</small></span><span>${etPill(c.etapa)}</span><span class="ar">${esc((SRV[c.srv]||AREA[c.area]||{n:"—"}).n)}</span><span class="co num">${+c.valor?money(+c.valor):"—"}</span><span class="du ${overdue(c)?"late":""}">${c.proxima?esc(fdate(c.proxima)):"—"}</span></button>`).join("")||`<div class="empty" style="border:0">Sin resultados.</div>`}</div>`;
  return tb+`<div class="kb">${ETAPAS.map(([k,l])=>{const col=L.filter(c=>c.etapa===k);const v=col.reduce((s,c)=>s+(+c.valor||0),0);return `<div class="kcol" data-drop="${k}"><div class="kcol-h"><i class="et-bg-${k}"></i><b>${l}</b><em>${col.length}</em></div>${v?`<small class="kv num">${money(v)}</small>`:""}<div class="kcol-b">${col.map(kcard).join("")||`<p class="kempty">Arrastre aquí</p>`}</div></div>`}).join("")}</div>
   <p class="hint" style="margin-top:10px">Arrastre una tarjeta para cambiar la etapa, o ábrala para ver la ficha completa.</p>`;
}
async function moveStage(id,et){
  const c=cliById(id);if(!c||c.etapa===et)return;
  const base=c.virtual?{...c,id:newId("c"),creado:c.creado||new Date().toISOString()}:{...c};
  base.notas=(base.notas||[]).concat([{t:new Date().toISOString(),txt:`Etapa: ${ET[c.etapa]} → ${ET[et]}`,auto:true}]);
  base.etapa=et;
  try{await putCliente(base);toast(`${c.nombre}: ${ET[et]}`);if(CV.sel===id)CV.sel=base.id}catch(e){}
}

/* ---------- Ficha de cliente (hoja lateral) ---------- */
function openCli(id){const c=cliById(id);if(!c){toast("No se encontró el cliente");return}CV.sel=id;CV.draft=clone(c);CV.draft.hist=c.hist;drawSheet()}
function newCli(){CV.sel="new";CV.draft={id:"",virtual:true,nombre:"",tel:"",email:"",cedula:"",origen:"llamada",etapa:"nuevo",area:"",srv:"",abg:"",valor:"",proxima:"",accion:"",notas:[],hist:[]};drawSheet()}
function closeSheet(){CV.sel=null;CV.draft=null;const r=$("#sheetRoot");if(r){const s=r.querySelector(".sheet");if(s&&!reduce){s.classList.add("out");$(".sheet-o",r).classList.add("out");setTimeout(()=>{r.innerHTML="";document.body.style.overflow=""},320)}else{r.innerHTML="";document.body.style.overflow=""}}}
function drawSheet(){
  let r=$("#sheetRoot");if(!r){r=document.createElement("div");r.id="sheetRoot";document.body.appendChild(r)}
  const c=CV.draft;if(!c){r.innerHTML="";return}
  const a=AREA[c.area];
  const hist=(c.hist||[]).slice().sort((x,y)=>String(y.fecha||"").localeCompare(String(x.fecha||"")));
  const notas=(c.notas||[]).slice().reverse();
  r.innerHTML=`<div class="sheet-o" data-closesheet></div><aside class="sheet" role="dialog" aria-modal="true" aria-label="Ficha de cliente">
   <div class="sh-h"><span class="av"><i>${esc(initials(c.nombre||"N"))}</i></span><div style="min-width:0"><b>${esc(c.nombre||"Nuevo cliente")}</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${etPill(c.etapa)}${c.virtual&&CV.sel!=="new"?`<span class="pill warn">Lead de la web, sin guardar</span>`:""}</div></div><button class="ib" data-closesheet aria-label="Cerrar">${ic("x")}</button></div>
   <div class="sh-b">
    ${c.tel||c.email?`<div class="qa-row">${c.tel?`<a class="btn sm" href="https://wa.me/${waNum(c.tel)}" target="_blank" rel="noopener">${ic("wa")}WhatsApp</a><button class="btn sm" data-copy="${esc(c.tel)}" data-copyfree>${ic("phone")}${esc(c.tel)}</button>`:""}${c.email?`<button class="btn sm" data-copy="${esc(c.email)}" data-copyfree>${ic("mail")}Copiar correo</button>`:""}</div>`:""}
    <form id="cliForm" class="cform" novalidate>
     <div class="two"><div class="fl"><label for="k-nombre">Nombre</label><input id="k-nombre" data-c="nombre" value="${esc(c.nombre)}"></div><div class="fl"><label for="k-cedula">Cédula o RNC</label><input id="k-cedula" data-c="cedula" value="${esc(c.cedula||"")}"></div></div>
     <div class="two"><div class="fl"><label for="k-tel">Teléfono</label><input id="k-tel" data-c="tel" inputmode="tel" value="${esc(c.tel)}"></div><div class="fl"><label for="k-email">Correo</label><input id="k-email" data-c="email" type="email" value="${esc(c.email)}"></div></div>
     <div class="two"><div class="fl"><label for="k-etapa">Etapa</label><select class="sel" id="k-etapa" data-c="etapa">${ETAPAS.map(([k,l])=>`<option value="${k}" ${c.etapa===k?"selected":""}>${l}</option>`).join("")}</select></div><div class="fl"><label for="k-origen">Origen</label><select class="sel" id="k-origen" data-c="origen">${ORIGENES.map(([k,l])=>`<option value="${k}" ${c.origen===k?"selected":""}>${l}</option>`).join("")}</select></div></div>
     <div class="two"><div class="fl"><label for="k-area">Área</label><select class="sel" id="k-area" data-c="area"><option value="">—</option>${AREAS.map(x=>`<option value="${x.id}" ${c.area===x.id?"selected":""}>${esc(x.n)}</option>`).join("")}</select></div><div class="fl"><label for="k-srv">Servicio</label><select class="sel" id="k-srv" data-c="srv"><option value="">—</option>${(a?a.s:[]).map(s=>`<option value="${s.id}" ${c.srv===s.id?"selected":""}>${esc(s.n)}</option>`).join("")}</select></div></div>
     <div class="two"><div class="fl"><label for="k-abg">Abogado responsable</label><select class="sel" id="k-abg" data-c="abg"><option value="">Sin asignar</option>${lawyers(true).map(l=>`<option value="${esc(l.id)}" ${c.abg===l.id?"selected":""}>${esc(l.nombre)}</option>`).join("")}</select></div><div class="fl"><label for="k-valor">Honorarios acordados (RD$)</label><input id="k-valor" data-c="valor" inputmode="numeric" value="${+c.valor?fmt(+c.valor):""}" placeholder="${SRV[c.srv]&&SRV[c.srv].c?"Ref. "+fmt(SRV[c.srv].c[0])+" – "+fmt(SRV[c.srv].c[1]):"0"}"></div></div>
     <div class="two"><div class="fl"><label for="k-proxima">Próximo seguimiento</label><input id="k-proxima" data-c="proxima" type="date" value="${esc(c.proxima||"")}"></div><div class="fl"><label for="k-accion">Acción</label><input id="k-accion" data-c="accion" value="${esc(c.accion||"")}" placeholder="Ej.: Enviar propuesta, llamar"></div></div>
     <div class="perr" id="kerr" hidden></div>
     <div class="pbar"><span>${!c.virtual||CV.sel==="new"?"":`<button type="button" class="btn sm ghost" data-discard>Descartar lead</button>`}${!c.virtual?(confirmDel==="c"+c.id?`<span class="inline-confirm">¿Eliminar cliente? <button type="button" class="btn sm pri" data-delcli>Sí</button><button type="button" class="btn sm" data-nodelc>No</button></span>`:`<button type="button" class="btn sm ghost" data-askdelc>${ic("trash")}Eliminar</button>`):""}</span><button type="submit" class="btn pri sm">${ic("check")}Guardar ficha</button></div>
    </form>
    <section class="sh-sec"><h4>Notas y seguimiento</h4>
     <div class="note-in"><textarea id="k-nota" placeholder="Escriba una nota: llamada, acuerdo, documento recibido…"></textarea><button class="btn sm" data-addnota>${ic("plus")}Agregar nota</button></div>
     <ol class="notes-l">${notas.map(n=>`<li class="${n.auto?"auto":""}"><small>${esc(fdate(n.t))}${n.t&&String(n.t).length>10?" · "+new Date(n.t).toLocaleTimeString("es-DO",{hour:"numeric",minute:"2-digit"}):""}</small><p>${esc(n.txt)}</p></li>`).join("")||`<li class="empty-n">Sin notas todavía.</li>`}</ol></section>
    ${hist.length?`<section class="sh-sec"><h4>Historial desde la web</h4><ol class="notes-l">${hist.map(h=>h.tipo==="cita"?`<li><small>${esc(fdate(h.fecha))} · Cita</small><p>${esc(bkTopic(h.ref))} · ${esc(bkDate(h.ref).txt)}, ${esc(ampm(h.ref.time))} · ${esc((MODES[h.ref.mode]||[""])[0])}${h.ref.msg?` — “${esc(h.ref.msg)}”`:""}</p></li>`:`<li><small>${esc(fdate(h.fecha))} · Inmueble</small><p>${esc(h.ref.titulo)} · ${esc(priceTxt(h.ref))} · ${pill(inmById(h.ref.id)?inmById(h.ref.id).estado:h.ref.estado)}</p></li>`).join("")}</ol></section>`:""}
   </div></aside>`;
  document.body.style.overflow="hidden";
  const f=$("#cliForm");
  f.addEventListener("submit",async e=>{e.preventDefault();readCli();await saveCli()});
  $("#k-area").addEventListener("change",()=>{readCli();CV.draft.srv="";drawSheet()});
  $("#k-srv").addEventListener("change",()=>{readCli();drawSheet()});
  $("#k-valor").addEventListener("input",e=>{const d=digits(e.target.value);e.target.value=d?fmt(+d):""});
}
function readCli(){$$("#cliForm [data-c]").forEach(el=>{const k=el.dataset.c;CV.draft[k]=k==="valor"?(+digits(el.value)||0):el.value.trim()})}
async function saveCli(extraNote){
  const c=CV.draft;
  if(!c.nombre){const b=$("#kerr");if(b){b.hidden=false;b.innerHTML=`${ic("alert")}<span>Escriba el nombre del cliente.</span>`}return false}
  const out={...c};delete out.hist;
  if(c.virtual){out.id=newId("c");out.creado=c.creado||new Date().toISOString();if(CV.sel!=="new")out.notas=(out.notas||[]).concat([{t:new Date().toISOString(),txt:"Lead de la web agregado al CRM",auto:true}])}
  if(extraNote)out.notas=(out.notas||[]).concat([{t:new Date().toISOString(),txt:extraNote}]);
  delete out.virtual;try{await putCliente(out);CV.sel=out.id;CV.draft={...clone(out),hist:c.hist||[]};toast(extraNote?"Nota agregada":"Ficha guardada");drawSheet();return true}catch(e){return false}
}

/* ---------- Citas ---------- */
function mCitas(){
  const citas=ST.citasAll.slice().sort((a,b)=>String(b.date+b.time).localeCompare(String(a.date+a.time)));
  return citas.length?citas.map(c=>{const d=bkDate(c);return `<div class="prow"><div class="cal-s"><small>${MN[d.d.getMonth()]}</small><b>${d.d.getDate()}</b></div><div style="min-width:0"><b>${esc(c.name)} ${c.urgent?`<span class="badge-u">Urgente</span>`:""}</b><small>${esc(d.txt)}, ${esc(ampm(c.time))} · ${esc((MODES[c.mode]||["—"])[0])} · ${esc(bkTopic(c))}</small><small>${esc(c.phone)}${c.email?" · "+esc(c.email):""}${c.abg&&lawyerById(c.abg)?" · Con "+esc(lawyerById(c.abg).nombre):""}</small>${c.msg?`<small>“${esc(c.msg)}”</small>`:""}</div>
   <div class="pact"><select class="sel sm" data-citaest="${esc(c.id)}" data-autor="${esc(c.autor)}" aria-label="Estado de la cita">${[["nueva","Nueva"],["confirmada","Confirmada"],["atendida","Atendida"],["cancelada","Cancelada"]].map(([k,l])=>`<option value="${k}" ${c.estado===k?"selected":""}>${l}</option>`).join("")}</select>${c.phone?`<a class="btn sm" href="https://wa.me/${waNum(c.phone)}?text=${encodeURIComponent("Hola "+c.name+", le escribimos de SL Abogados para confirmar su consulta del "+d.txt+" a las "+ampm(c.time)+".")}" target="_blank" rel="noopener">${ic("wa")}Confirmar</a>`:""}<button class="btn sm ghost" data-clikey="${esc(keyOf(c.phone,c.email))}">${ic("users")}Ficha</button></div></div>`}).join(""):`<div class="empty">Aún no hay citas agendadas desde la web.</div>`;
}

/* ---------- Inmuebles ---------- */
function mInm(){
  const pend=ST.envAll.filter(x=>x.estado==="pendiente");
  const sub=`<div class="segf" id="isub" style="margin-bottom:16px"><span class="k"></span><button data-isub="sol" class="${CV.isub==="sol"?"on":""}">Solicitudes (${pend.length})</button><button data-isub="cat" class="${CV.isub==="cat"?"on":""}">Catálogo (${ST.inm.length})</button></div>`;
  if(CV.isub==="sol")return sub+(pend.length?pend.map(x=>`<div class="prow">${inmMedia(x,"sm")}<div style="min-width:0"><b>${esc(x.titulo)}</b><small>${esc(x.op==="venta"?"Venta":"Alquiler")} · ${esc(TIPO[x.tipo])} · ${esc(priceTxt(x))} · ${esc([x.sector,x.provincia].join(", "))}</small><small>${ic("users")} ${esc(x.contacto&&x.contacto.nombre)} (${esc(x.contacto&&x.contacto.rol)}) · ${esc(x.contacto&&x.contacto.tel)}${x.contacto&&x.contacto.email?" · "+esc(x.contacto.email):""}</small><small>Título: ${esc((TITULO_ESTADOS.find(t=>t[0]===x.tituloEstado)||[])[1]||"—")} · ${(x.fotos||[]).length} fotos${(x.servicios||[]).length?" · Interesado en: "+esc(x.servicios.map(s=>SRV[s]?SRV[s].n:s).join(", ")):""}</small>
     <div class="rej" id="rej-${esc(x.id)}" hidden><input placeholder="Motivo (lo verá el propietario)" id="rejn-${esc(x.id)}"><button class="btn sm" data-rejok="${esc(x.id)}" data-autor="${esc(x.autor)}">Confirmar rechazo</button></div></div>
     <div class="pact"><button class="btn sm pri" data-approve="${esc(x.id)}" data-autor="${esc(x.autor)}">${ic("check")}Publicar</button><a class="btn sm" href="#publicar" data-editenv="${esc(x.id)}" data-autor="${esc(x.autor)}">${ic("edit")}Editar</a>${x.contacto&&x.contacto.tel?`<a class="btn sm ghost" href="https://wa.me/${waNum(x.contacto.tel)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("wa")}</a>`:""}<button class="btn sm ghost" data-reject="${esc(x.id)}">Rechazar</button></div></div>`).join(""):`<div class="empty">No hay solicitudes pendientes. Cuando alguien envíe una propiedad aparecerá aquí.</div>`);
  return sub+(ST.inm.length?published().map(x=>`<div class="prow">${inmMedia(x,"sm")}<div style="min-width:0"><b><a href="#inm.${esc(x.id)}" style="text-decoration:none">${esc(x.titulo)}</a></b><small>${esc(refTxt(x))} · ${esc(priceTxt(x))} · ${esc([x.sector,x.provincia].join(", "))}</small>${contactOf(x)?`<small>${esc(contactOf(x).nombre||"")} · ${esc(contactOf(x).tel||"")}</small>`:""}</div>
     <div class="pact"><select class="sel sm" data-setest="${esc(x.id)}" aria-label="Estado">${["publicado","reservado","cerrado"].map(s=>`<option value="${s}" ${x.estado===s?"selected":""}>${ESTADO_INM[s][0]}</option>`).join("")}</select>
     <label class="chk tgl"><input type="checkbox" data-verif="${esc(x.id)}" ${x.verificado?"checked":""}>Título verificado</label>
     <a class="btn sm" href="#publicar" data-editinm="${esc(x.id)}" aria-label="Editar">${ic("edit")}</a>${confirmDel==="i"+x.id?`<span class="inline-confirm">¿Eliminar? <button class="btn sm pri" data-delinm="${esc(x.id)}">Sí</button><button class="btn sm" data-nodel>No</button></span>`:`<button class="btn sm ghost" data-askdel="i${esc(x.id)}" aria-label="Eliminar">${ic("trash")}</button>`}</div></div>`).join(""):`<div class="empty">Aún no hay inmuebles en el catálogo.</div>`);
}

/* ---------- Abogados ---------- */
function mAbg(){
  if(abgEdit)return abgForm(abgEdit);
  return lawyers(true).filter(l=>!l.eliminado).map(l=>`<div class="prow">${avatar(l,"sm")}<div style="min-width:0"><b>${esc(l.nombre)}</b><small>${esc(l.cargo||"")} · CARD ${esc(l.card||"—")} · Exequátur ${esc(l.exequatur||"—")}${l.notario?" · Notario":""}</small><small>${l.publicado===false?"Oculto en la web":"Visible"} · ${l.verificado?"Verificado":"Sin verificar"} · ${(EST[l.estado]||EST.disponible)[0]} · ${clientes().filter(c=>c.abg===l.id&&c.etapa==="activo").length} clientes activos</small></div>
   <div class="pact"><a class="btn sm ghost" href="#abg.${esc(l.id)}">Ver</a><button class="btn sm" data-editabg2="${esc(l.id)}">${ic("edit")}Editar</button>${confirmDel==="a"+l.id?`<span class="inline-confirm">¿Eliminar? <button class="btn sm pri" data-delabg="${esc(l.id)}">Sí</button><button class="btn sm" data-nodel>No</button></span>`:`<button class="btn sm ghost" data-askdel="a${esc(l.id)}" aria-label="Eliminar">${ic("trash")}</button>`}</div></div>`).join("");
}
function abgForm(l){
  const f=(k,lab,ph="",type="text")=>`<div class="fl"><label for="a-${k}">${lab}</label><input id="a-${k}" data-a="${k}" type="${type}" value="${esc(l[k]||"")}" placeholder="${esc(ph)}"></div>`;
  return `<form class="card aform" id="aform" novalidate><h3>${l._new?"Nuevo abogado":"Editar perfil"}</h3>
   <div class="af-photo">${avatar(l,"lg")}<div style="display:grid;gap:6px"><input type="file" id="afile" accept="image/*" hidden><button type="button" class="btn sm" data-afoto>${ic("camera")}${l.foto?"Cambiar foto":"Subir foto"}</button>${l.foto?`<button type="button" class="btn sm ghost" data-afotodel>Quitar foto</button>`:""}</div></div>
   <div class="two">${f("nombre","Nombre completo","Ej.: María Pérez Gómez")}${f("cargo","Cargo","Socio, Asociado, Notario…")}</div>
   <h4>Licencias</h4>
   <div class="two">${f("card","Matrícula CARD","Ej.: 12345-678-90")}${f("exequatur","Número de exequátur","Ej.: 123-04")}</div>
   <div class="two">${f("exequaturFecha","Fecha del exequátur","","date")}<div class="fl"><label for="a-estado">Disponibilidad</label><select class="sel" id="a-estado" data-a="estado">${Object.entries(EST).map(([k,[t]])=>`<option value="${k}" ${l.estado===k?"selected":""}>${t}</option>`).join("")}</select></div></div>
   <label class="chk"><input type="checkbox" data-a="notario" ${l.notario?"checked":""}>Es notario público</label>
   <div class="two">${f("notarioMatricula","Matrícula de notario","Colegio Dominicano de Notarios")}${f("notarioJurisdiccion","Jurisdicción notarial","Ej.: Distrito Nacional")}</div>
   <h4>Formación</h4>
   <div class="two">${f("titulo","Título","Licenciado en Derecho")}${f("universidad","Universidad","Ej.: UASD, PUCMM, UNIBE…")}</div>
   <div class="two">${f("anioGrad","Año de graduación","Ej.: 2008")}${f("tribunales","Tribunales donde litiga","Ej.: Suprema Corte, Tribunal Constitucional…")}</div>
   <div class="fl"><label for="a-postgrados">Maestrías y postgrados (uno por línea)</label><textarea id="a-postgrados" data-a="postgrados">${esc((l.postgrados||[]).join("\n"))}</textarea></div>
   <div class="fl"><label for="a-membresias">Membresías (una por línea)</label><textarea id="a-membresias" data-a="membresias" style="height:80px">${esc((l.membresias||[]).join("\n"))}</textarea></div>
   <div class="fl"><label>Idiomas</label><div class="chips">${IDIOMAS.map(i=>`<button type="button" class="chipb ${(l.idiomas||[]).includes(i)?"on":""}" data-aidi="${i}">${i}</button>`).join("")}</div></div>
   <div class="fl"><label>Áreas de práctica</label><div class="chips">${AREAS.map(a=>`<button type="button" class="chipb ${(l.areas||[]).includes(a.id)?"on":""}" data-aarea="${a.id}">${esc(a.n)}</button>`).join("")}</div></div>
   <h4>Contacto y perfil</h4>
   <div class="two">${f("tel","Teléfono / WhatsApp")}${f("email","Correo","","email")}</div>
   <div class="fl"><label for="a-bio">Biografía</label><textarea id="a-bio" data-a="bio">${esc(l.bio||"")}</textarea></div>
   <div class="two">${f("orden","Orden en el catálogo","1","number")}<div class="fl" style="align-content:end;gap:10px"><label class="chk"><input type="checkbox" data-a="verificado" ${l.verificado?"checked":""}>Credenciales verificadas por el despacho</label><label class="chk"><input type="checkbox" data-a="publicado" ${l.publicado!==false?"checked":""}>Visible en la web</label></div></div>
   <div class="perr" id="aerr" hidden></div>
   <div class="pbar"><button type="button" class="btn ghost" data-acancel>Cancelar</button><button type="submit" class="btn pri">Guardar perfil</button></div></form>`;
}
function abgRead(){const l=abgEdit;$$("#aform [data-a]").forEach(el=>{const k=el.dataset.a;if(el.type==="checkbox")l[k]=el.checked;else if(k==="postgrados"||k==="membresias")l[k]=lines(el.value);else l[k]=el.value.trim()})}

/* ---------- Datos del despacho ---------- */
function cfgForm(){
  const h=CONTACT.horario.concat([["",""],["",""],["",""]]).slice(0,4);
  return `<form class="card aform" id="cform" novalidate><h3>Datos de contacto</h3><p class="hint" style="margin:0">Se muestran en Contacto, el menú, los botones de WhatsApp y el pie de página.</p>
   <div class="two"><div class="fl"><label for="c-tel">Teléfono</label><input id="c-tel" value="${esc(CONTACT.tel)}"></div><div class="fl"><label for="c-wa">WhatsApp (solo números, con 1 delante)</label><input id="c-wa" inputmode="numeric" value="${esc(CONTACT.wa)}"></div></div>
   <div class="two"><div class="fl"><label for="c-email">Correo</label><input id="c-email" type="email" value="${esc(CONTACT.email)}"></div><div class="fl"><label for="c-dir">Dirección de la oficina</label><input id="c-dir" value="${esc(CONTACT.dir)}"></div></div>
   <h4>Horario</h4>${h.map((r,i)=>`<div class="two"><div class="fl"><label for="c-h${i}a">Días</label><input id="c-h${i}a" value="${esc(r[0])}"></div><div class="fl"><label for="c-h${i}b">Horas</label><input id="c-h${i}b" value="${esc(r[1])}"></div></div>`).join("")}
   <h4>Precio de la consulta inicial (RD$)</h4><div class="grid3">${["presencial","virtual","llamada"].map(k=>`<div class="fl"><label for="c-${k}">${MODES[k][0]}</label><input id="c-${k}" inputmode="numeric" value="${CONSULTA[k]}"></div>`).join("")}</div>
   <div class="pbar"><span></span><button type="submit" class="btn pri">Guardar datos</button></div></form>`;
}

/* ---------- Contenido del sitio ---------- */
function mContenido(){
  const sub=`<div class="segf" id="csub" style="margin-bottom:16px"><span class="k"></span>${[["areas","Áreas y servicios"],["faq","Preguntas"],["glos","Glosario"],["txt","Textos"]].map(([k,l])=>`<button data-csub="${k}" class="${CV.csub===k?"on":""}">${l}</button>`).join("")}</div>`;
  if(CV.csub==="areas")return sub+(CV.areaEdit?areaForm(CV.areaEdit):areaList());
  if(CV.csub==="faq"){if(!CV.faqDraft)CV.faqDraft=FAQ.map(x=>[x[0],x[1]]);return sub+pairsForm("faqForm",CV.faqDraft,"Pregunta","Respuesta","Preguntas frecuentes","Aparecen en la página Proceso.")}
  if(CV.csub==="glos"){if(!CV.glosDraft)CV.glosDraft=GLOSARIO.map(x=>[x[0],x[1]]);return sub+pairsForm("glosForm",CV.glosDraft,"Término","Definición","Glosario legal","Aparece en la página Proceso y en el buscador.")}
  if(!CV.txtDraft)CV.txtDraft={...TEXTOS};
  const T=CV.txtDraft;
  const fld=(k,l,big)=>`<div class="fl"><label for="t-${k}">${l}</label>${big?`<textarea id="t-${k}" data-t="${k}">${esc(T[k])}</textarea>`:`<input id="t-${k}" data-t="${k}" value="${esc(T[k])}">`}</div>`;
  return sub+`<form class="card aform" id="txtForm" novalidate><h3>Textos del sitio</h3><p class="hint" style="margin:0">Escriba entre asteriscos lo que quiere en <em>cursiva dorada</em>: *así*. {areas} se reemplaza por el número de áreas.</p>
   <h4>Portada</h4>${fld("heroEyebrow","Etiqueta superior")}${fld("heroTitulo","Título principal")}${fld("heroLead","Texto de presentación",1)}
   <h4>Banda final de la portada</h4>${fld("bandaTitulo","Título")}${fld("bandaTexto","Texto",1)}
   <h4>Página del despacho</h4>${fld("despacho1","Párrafo 1",1)}${fld("despacho2","Párrafo 2",1)}${fld("despacho3","Párrafo 3",1)}
   <h4>Página de inmuebles</h4>${fld("inmTitulo","Título")}${fld("inmIntro","Texto",1)}
   <div class="pbar">${confirmDel==="txt"?`<span class="inline-confirm">¿Volver a los textos originales? <button type="button" class="btn sm pri" data-resettxt>Sí</button><button type="button" class="btn sm" data-nodel>No</button></span>`:`<button type="button" class="btn sm ghost" data-askdel="txt">Restaurar originales</button>`}<button type="submit" class="btn pri">Guardar textos</button></div></form>`;
}
function readTxt(){$$("#txtForm [data-t]").forEach(el=>CV.txtDraft[el.dataset.t]=el.value.trim())}
function pairsForm(id,list,la,lb,title,hint){
  return `<form class="card aform" id="${id}" novalidate><h3>${title}</h3><p class="hint" style="margin:0">${hint}</p>
   <div class="pairs">${list.map((p,i)=>`<div class="pair"><span class="pn-i mono">${String(i+1).padStart(2,"0")}</span><div class="fl"><label for="${id}-a${i}">${la}</label><input id="${id}-a${i}" data-pa="${i}" value="${esc(p[0])}"></div><div class="fl"><label for="${id}-b${i}">${lb}</label><textarea id="${id}-b${i}" data-pb="${i}">${esc(p[1])}</textarea></div>
    <div class="pair-a"><button type="button" class="ib" data-pmove="${i}" data-d="-1" aria-label="Subir" ${i?"":"disabled"}>${ic("arrl").replace('class="i "','class="i " style="transform:rotate(90deg)"')}</button><button type="button" class="ib" data-pmove="${i}" data-d="1" aria-label="Bajar" ${i<list.length-1?"":"disabled"}>${ic("arr").replace('class="i "','class="i " style="transform:rotate(90deg)"')}</button><button type="button" class="ib" data-pdel2="${i}" aria-label="Eliminar">${ic("trash")}</button></div></div>`).join("")}</div>
   <button type="button" class="btn sm" data-padd>${ic("plus")}Agregar</button>
   <div class="pbar">${confirmDel===id?`<span class="inline-confirm">¿Volver al contenido original? <button type="button" class="btn sm pri" data-resetpairs="${id}">Sí</button><button type="button" class="btn sm" data-nodel>No</button></span>`:`<button type="button" class="btn sm ghost" data-askdel="${id}">Restaurar originales</button>`}<button type="submit" class="btn pri">Guardar cambios</button></div></form>`;
}
function readPairs(id){const n=$$(`#${id} [data-pa]`).length;const out=[];for(let i=0;i<n;i++)out.push([$(`#${id}-a${i}`).value.trim(),$(`#${id}-b${i}`).value.trim()]);return out}
function areaList(){
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"><button class="btn sm pri" data-newarea>${ic("plus")}Nueva área</button>${confirmDel==="allc"?`<span class="inline-confirm">¿Restaurar TODAS las áreas, preguntas, glosario y textos originales? <button class="btn sm pri" data-resetall>Sí, restaurar</button><button class="btn sm" data-nodel>No</button></span>`:`<button class="btn sm ghost" data-askdel="allc">Restaurar todo el contenido original</button>`}</div>
   <div class="alist">${ALLAREAS.map((a,i)=>`<div class="prow ${a.oculta?"dim":""}"><span class="ic-t">${ic(a.ic||"scale")}</span><div style="min-width:0"><b>${esc(a.n)}</b><small>${(a.s||[]).length} servicios${(a.s||[]).filter(s=>s.oculto).length?` · ${(a.s||[]).filter(s=>s.oculto).length} ocultos`:""} · ${a._nueva?`<span class="pill ok">Nueva</span>`:a._mod?`<span class="pill warn">Modificada</span>`:`<span class="pill mute">Original</span>`}${a.oculta?` <span class="pill mute">Oculta</span>`:""}</small></div>
    <div class="pact"><button class="ib" data-amove="${esc(a.id)}" data-d="-1" aria-label="Subir" ${i?"":"disabled"}>${ic("arrl").replace('class="i "','class="i " style="transform:rotate(90deg)"')}</button><button class="ib" data-amove="${esc(a.id)}" data-d="1" aria-label="Bajar" ${i<ALLAREAS.length-1?"":"disabled"}>${ic("arr").replace('class="i "','class="i " style="transform:rotate(90deg)"')}</button>
    <button class="btn sm" data-aedit="${esc(a.id)}">${ic("edit")}Editar</button><button class="btn sm ghost" data-ahide="${esc(a.id)}">${a.oculta?"Mostrar":"Ocultar"}</button>
    ${a._mod&&!a._nueva?(confirmDel==="r"+a.id?`<span class="inline-confirm">¿Restaurar? <button class="btn sm pri" data-areset="${esc(a.id)}">Sí</button><button class="btn sm" data-nodel>No</button></span>`:`<button class="btn sm ghost" data-askdel="r${esc(a.id)}">Restaurar</button>`):""}
    ${confirmDel==="d"+a.id?`<span class="inline-confirm">¿Eliminar el área? <button class="btn sm pri" data-adel="${esc(a.id)}">Sí</button><button class="btn sm" data-nodel>No</button></span>`:`<button class="ib" data-askdel="d${esc(a.id)}" aria-label="Eliminar">${ic("trash")}</button>`}</div></div>`).join("")}</div>`;
}
function areaForm(a){
  const sv=(s,i)=>`<details class="svd" ${s._open?"open":""} data-si="${i}"><summary><span class="mono">${String(i+1).padStart(2,"0")}</span><b>${esc(s.n||"Servicio nuevo")}</b><span class="sum-r">${s.oculto?`<span class="pill mute">Oculto</span>`:""}<span class="mono">${s.c?"RD$"+fmt(+s.c[0])+"–"+fmt(+s.c[1]):"Cuota litis"}</span></span></summary>
   <div class="svd-b">
    <div class="fl"><label>Nombre del servicio</label><input data-sf="n" value="${esc(s.n)}"></div>
    <div class="fl"><label>Descripción</label><textarea data-sf="d">${esc(s.d)}</textarea></div>
    <div class="grid3"><div class="fl"><label>Honorario mínimo (RD$)</label><input data-sf="cmin" inputmode="numeric" value="${s.c?esc(s.c[0]):""}"></div><div class="fl"><label>Honorario máximo (RD$)</label><input data-sf="cmax" inputmode="numeric" value="${s.c?esc(s.c[1]):""}"></div><div class="fl"><label>Duración estimada</label><input data-sf="t" value="${esc(s.t)}" placeholder="Ej.: 2 a 4 meses"></div></div>
    <div class="fl"><label>Nota del honorario (opcional)</label><input data-sf="x" value="${esc(s.x||"")}" placeholder="Ej.: o 20%–30% de lo obtenido · más tasas"></div>
    <div style="display:flex;gap:16px;flex-wrap:wrap"><label class="chk"><input type="checkbox" data-sf="litis" ${s.c?"":"checked"}>Solo cuota litis (sin monto fijo)</label><label class="chk"><input type="checkbox" data-sf="u" ${s.u?"checked":""}>Atención urgente</label><label class="chk"><input type="checkbox" data-sf="oculto" ${s.oculto?"checked":""}>Ocultar en la web</label></div>
    <div class="two"><div class="fl"><label>Proceso paso a paso (un paso por línea)</label><textarea data-sf="p" style="height:150px">${esc((s.p||[]).join("\n"))}</textarea></div><div class="fl"><label>Documentos (uno por línea; vacío = los del área)</label><textarea data-sf="doc" style="height:150px">${esc((s.doc||[]).join("\n"))}</textarea></div></div>
    <div class="svd-a"><button type="button" class="btn sm ghost" data-smove="${i}" data-d="-1" ${i?"":"disabled"}>Subir</button><button type="button" class="btn sm ghost" data-smove="${i}" data-d="1" ${i<a.s.length-1?"":"disabled"}>Bajar</button>${s.id&&SRV[s.id]?`<a class="btn sm ghost" href="#srv.${esc(s.id)}" data-noroute target="_blank" rel="noopener" style="display:none"></a>`:""}${confirmDel==="s"+i?`<span class="inline-confirm">¿Eliminar servicio? <button type="button" class="btn sm pri" data-sdel="${i}">Sí</button><button type="button" class="btn sm" data-nodel>No</button></span>`:`<button type="button" class="btn sm ghost" data-askdel="s${i}">${ic("trash")}Eliminar</button>`}</div></div></details>`;
  return `<form class="card aform" id="areaForm" novalidate><h3>${a._isNew?"Nueva área":"Editar área: "+esc(a.n)}</h3>
   <div class="two"><div class="fl"><label for="ar-n">Nombre del área</label><input id="ar-n" data-af="n" value="${esc(a.n)}"></div><div class="fl"><label for="ar-g">Dirigida a</label><select class="sel" id="ar-g" data-af="g">${[["personas","Personas y familias"],["empresas","Empresas"],["ambos","Personas y empresas"]].map(([k,l])=>`<option value="${k}" ${a.g===k?"selected":""}>${l}</option>`).join("")}</select></div></div>
   <div class="fl"><label>Ícono</label><div class="icpick">${AREA_ICONS.map(n=>`<button type="button" class="${a.ic===n?"on":""}" data-aic="${n}" aria-label="${n}">${ic(n)}</button>`).join("")}</div></div>
   <div class="fl"><label for="ar-sh">Resumen corto (tarjetas)</label><input id="ar-sh" data-af="sh" value="${esc(a.sh)}"></div>
   <div class="fl"><label for="ar-d">Descripción del área</label><textarea id="ar-d" data-af="d">${esc(a.d)}</textarea></div>
   <div class="two"><div class="fl"><label for="ar-law">Base legal (una ley por línea)</label><textarea id="ar-law" data-af="law">${esc((a.law||[]).join("\n"))}</textarea></div><div class="fl"><label for="ar-doc">Documentos generales (uno por línea)</label><textarea id="ar-doc" data-af="doc">${esc((a.doc||[]).join("\n"))}</textarea></div></div>
   <label class="chk"><input type="checkbox" data-af="oculta" ${a.oculta?"checked":""}>Ocultar esta área en la web</label>
   <h4>Servicios (${a.s.length})</h4>
   <div class="svds">${a.s.map(sv).join("")}</div>
   <button type="button" class="btn sm" data-sadd>${ic("plus")}Agregar servicio</button>
   <div class="perr" id="arerr" hidden></div>
   <div class="pbar"><button type="button" class="btn ghost" data-acancel2>Cancelar</button><button type="submit" class="btn pri">Guardar área</button></div></form>`;
}
function readAreaForm(){
  const a=CV.areaEdit;
  $$("#areaForm [data-af]").forEach(el=>{const k=el.dataset.af;if(el.type==="checkbox")a[k]=el.checked;else if(k==="law"||k==="doc")a[k]=lines(el.value);else a[k]=el.value.trim()});
  $$("#areaForm details[data-si]").forEach(d=>{const s=a.s[+d.dataset.si];if(!s)return;s._open=d.open;
    const v=k=>{const el=d.querySelector(`[data-sf="${k}"]`);return el.type==="checkbox"?el.checked:el.value};
    s.n=v("n").trim();s.d=v("d").trim();s.t=v("t").trim();s.x=v("x").trim();s.u=v("u")?1:0;s.oculto=!!v("oculto");
    const mn=+digits(v("cmin")),mx=+digits(v("cmax"));s.c=v("litis")?null:[mn||0,Math.max(mx||mn||0,mn||0)];
    s.p=lines(v("p"));const dl=lines(v("doc"));if(dl.length)s.doc=dl;else delete s.doc;if(!s.x)delete s.x;if(!s.u)delete s.u;if(!s.oculto)delete s.oculto});
}
async function saveAreaForm(){
  readAreaForm();const a=CV.areaEdit;const err=$("#arerr");
  const bad=!a.n?"Escriba el nombre del área.":a.s.some(s=>!s.n)?"Todos los servicios necesitan un nombre.":a.s.some(s=>s.c&&!s.c[0])?"Indique el honorario mínimo de cada servicio, o marque “Solo cuota litis”.":"";
  if(bad){err.hidden=false;err.innerHTML=`${ic("alert")}<span>${bad}</span>`;err.scrollIntoView({block:"center"});return}
  const used=new Set();ALLAREAS.forEach(x=>(x.s||[]).forEach(s=>{if(x.id!==a.id)used.add(s.id)}));
  a.s.forEach(s=>{delete s._open;if(!s.id||used.has(s.id)){let id=slug(s.n),k=2;while(used.has(id))id=slug(s.n)+"-"+k++;s.id=id}used.add(s.id)});
  if(a._isNew){let id=slug(a.n),k=2;while(ALLAREAS.some(x=>x.id===id))id=slug(a.n)+"-"+k++;a.id=id;delete a._isNew}
  try{await putArea(a);CV.areaEdit=null;toast("Área guardada. La web ya muestra los cambios");softRender()}catch(e){}
}
async function moveArea(id,d){
  const L=ALLAREAS.slice();const i=L.findIndex(x=>x.id===id),j=i+d;if(j<0||j>=L.length)return;
  [L[i],L[j]]=[L[j],L[i]];
  try{for(let k=Math.min(i,j);k<=Math.max(i,j);k++){await putArea({...L[k],orden:k})}}catch(e){}
}

/* ---------- Respaldo ---------- */
function mRespaldo(){
  return `<div class="princ" style="grid-template-columns:repeat(2,minmax(0,1fr))">
   <div class="card pr">${ic("layers")}<h4>Exportar respaldo completo</h4><p>Descarga un archivo JSON con áreas, servicios, preguntas, glosario, textos, datos del despacho, abogados, inmuebles, clientes y citas.</p><button class="btn pri sm" data-export>${ic("doc")}Exportar respaldo</button></div>
   <div class="card pr">${ic("users")}<h4>Exportar clientes (CSV)</h4><p>Lista de clientes para abrir en Excel o Google Sheets.</p><button class="btn sm" data-exportcsv>${ic("doc")}Exportar CSV</button></div>
   <div class="card pr" style="grid-column:1/-1">${ic("repeat")}<h4>Importar respaldo</h4><p>Cargue un archivo exportado antes para restaurar el contenido, los datos del despacho, los abogados y los clientes. Los inmuebles y las citas no se reemplazan.</p>
    <input type="file" id="impfile" accept="application/json,.json" hidden><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-impick>${ic("plus")}Elegir archivo</button></div>
    ${CV.imp?`<div class="notes" style="margin-top:6px"><h4>${ic("alert")}Archivo listo para importar</h4><ul><li>${(CV.imp.areas||[]).length} áreas · ${(CV.imp.faq||[]).length} preguntas · ${(CV.imp.glosario||[]).length} términos</li><li>${(CV.imp.abogados||[]).length} abogados · ${(CV.imp.crm||[]).length} clientes</li></ul><span class="inline-confirm">Esto reemplazará el contenido actual. <button class="btn sm pri" data-impgo>Importar ahora</button><button class="btn sm" data-impno>Cancelar</button></span></div>`:""}</div>
  </div>${CV.exportTxt?`<div class="card" style="padding:18px;margin-top:14px"><p class="hint" style="margin-bottom:8px">No se pudo descargar el archivo aquí. Copie este texto y guárdelo como <b>respaldo.json</b>:</p><textarea id="exptxt" readonly style="width:100%;height:200px;font-family:var(--f-mono);font-size:12px;border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--surface-2)">${esc(CV.exportTxt)}</textarea></div>`:""}`;
}
function buildExport(){
  return {app:"SL Abogados",version:3,fecha:new Date().toISOString(),
    areas:ALLAREAS.map(a=>{const c=clone(a);delete c._mod;delete c._nueva;return c}),
    faq:FAQ.map(x=>({q:x[0],a:x[1]})),glosario:GLOSARIO.map(x=>({t:x[0],d:x[1]})),textos:{...TEXTOS},
    config:{tel:CONTACT.tel,wa:CONTACT.wa,email:CONTACT.email,dir:CONTACT.dir,horario:CONTACT.horario.map(h=>({d:h[0],h:h[1]})),...CONSULTA},
    abogados:lawyers(true).map(clone),inmuebles:ST.inm.map(clone),crm:CRM.map(clone),citas:ST.citasAll.map(clone)};
}
async function doExport(csv){
  let data,filename;
  if(csv){
    const rows=[["Nombre","Teléfono","Correo","Cédula/RNC","Etapa","Origen","Área","Servicio","Abogado","Honorarios RD$","Próximo seguimiento","Acción","Creado"]].concat(clientes().map(c=>[c.nombre,c.tel,c.email,c.cedula||"",ET[c.etapa]||c.etapa,(ORIGENES.find(o=>o[0]===c.origen)||["",""])[1],(AREA[c.area]||{}).n||"",(SRV[c.srv]||{}).n||"",(lawyerById(c.abg)||{}).nombre||"",+c.valor||"",c.proxima||"",c.accion||"",(c.creado||"").slice(0,10)]));
    data="﻿"+rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");filename=`clientes-sl-abogados-${today()}.csv`;
  }else{data=JSON.stringify(buildExport(),null,1);filename=`respaldo-sl-abogados-${today()}.json`}
  let dl=null;try{dl=window.claude&&window.claude.use?await window.claude.use("downloads"):null}catch(e){}
  if(dl){try{await dl.save({filename,data});toast("Archivo listo");return}catch(e){if(e&&e.code==="declined")return}}
  if(!ST.inViewer){try{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([data],{type:csv?"text/csv":"application/json"}));a.download=filename;document.body.appendChild(a);a.click();a.remove();return}catch(e){}}
  CV.exportTxt=data;softRender();
}
async function doImport(){
  const d=CV.imp;if(!d)return;
  try{
    if(ST.mode==="db"){
      for(const id of Object.keys(DBAREAS))await ST.db.doc("areas/"+id).delete();
      const defIds=new Set(DEF_AREAS.map(a=>a.id)),incoming=new Set((d.areas||[]).map(a=>a.id));
      for(const [i,a] of (d.areas||[]).entries())await ST.db.doc("areas/"+a.id).set({...a,orden:i});
      for(const id of defIds)if(!incoming.has(id))await ST.db.doc("areas/"+id).set({...clone(DEF_AREAS.find(a=>a.id===id)),eliminada:true});
      if(d.faq)await ST.db.doc("contenido/faq").set({items:d.faq});
      if(d.glosario)await ST.db.doc("contenido/glosario").set({items:d.glosario});
      if(d.textos)await ST.db.doc("contenido/textos").set({t:d.textos});
      if(d.config)await putCfg(d.config);
      for(const l of d.abogados||[])await ST.db.doc("abogados/"+l.id).set(l);
      for(const c of d.crm||[])await ST.db.doc("crm/"+c.id).set(c);
    }else{
      const m={};const defIds=new Set(DEF_AREAS.map(a=>a.id)),incoming=new Set((d.areas||[]).map(a=>a.id));
      (d.areas||[]).forEach((a,i)=>m[a.id]={...a,orden:i});defIds.forEach(id=>{if(!incoming.has(id))m[id]={...clone(DEF_AREAS.find(a=>a.id===id)),eliminada:true}});
      store.set("sl-areas",m);DBAREAS=m;
      const c={};if(d.faq)c.faq={items:d.faq};if(d.glosario)c.glosario={items:d.glosario};if(d.textos)c.textos={t:d.textos};store.set("sl-contenido",c);applyContenido(c);
      if(d.config)await putCfg(d.config);if(d.abogados){ST.abg=d.abogados;store.set(LS.abg,d.abogados)}if(d.crm){CRM=d.crm;store.set("sl-crm",CRM)}
    }
    CV.imp=null;contentChanged();toast("Respaldo importado");
  }catch(e){toast("No se pudo importar el respaldo completo")}
}
async function resetAllContent(){
  try{
    if(ST.mode==="db"){for(const id of Object.keys(DBAREAS))await ST.db.doc("areas/"+id).delete();for(const id of["faq","glosario","textos"])await ST.db.doc("contenido/"+id).delete()}
    else{store.del("sl-areas");store.del("sl-contenido");applyContenido({})}
    DBAREAS={};confirmDel="";contentChanged();toast("Contenido original restaurado");
  }catch(e){toast("No se pudo restaurar")}
}

/* ---------- Eventos del CRM ---------- */
function bindPanel(){
  $$(".crm .segf").forEach(segKnob);
  const af=$("#aform");
  if(af){
    const l=abgEdit;
    af.addEventListener("click",e=>{
      const t=e.target.closest("[data-aidi],[data-aarea],[data-afoto],[data-afotodel],[data-acancel]");if(!t)return;
      if(t.dataset.aidi){const v=t.dataset.aidi;l.idiomas=(l.idiomas||[]).includes(v)?l.idiomas.filter(x=>x!==v):[...(l.idiomas||[]),v];t.classList.toggle("on")}
      else if(t.dataset.aarea){const v=t.dataset.aarea;l.areas=(l.areas||[]).includes(v)?l.areas.filter(x=>x!==v):[...(l.areas||[]),v];t.classList.toggle("on")}
      else if(t.hasAttribute("data-afoto"))$("#afile").click();
      else if(t.hasAttribute("data-afotodel")){abgRead();l.foto="";softRender()}
      else if(t.hasAttribute("data-acancel")){abgEdit=null;softRender()}
    });
    $("#afile").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;abgRead();
      try{if(ST.mode==="db"){if(!ST.assets){toast("No puede subir fotos con esta cuenta");return}const c=await compress(f,700,.86);const b=await new Promise(r=>c.toBlob(r,"image/jpeg",.86));const r=await ST.assets.upload(b,{type:"image/jpeg"});l.foto=r.id}else{const c=await compress(f,400,.8);l.foto=c.toDataURL("image/jpeg",.8)}softRender()}catch(err){toast("No se pudo subir la foto")}});
    af.addEventListener("submit",async e=>{e.preventDefault();abgRead();
      if(!l.nombre){const b=$("#aerr");b.hidden=false;b.innerHTML=`${ic("alert")}<span>Escriba el nombre del abogado.</span>`;return}
      const out={...l};delete out._new;
      if(!out.id||l._new)out.id=slug(l.nombre).slice(0,40)+"-"+Date.now().toString(36).slice(-3);
      try{await putAbg(out);toast("Perfil guardado");abgEdit=null;softRender()}catch(err){}
    });
  }
  const cf=$("#cform");
  if(cf)cf.addEventListener("submit",async e=>{e.preventDefault();const v=id=>($("#"+id).value||"").trim();
    const c={tel:v("c-tel"),wa:digits(v("c-wa")),email:v("c-email"),dir:v("c-dir"),horario:[0,1,2,3].map(i=>({d:v(`c-h${i}a`),h:v(`c-h${i}b`)})).filter(h=>h.d),presencial:+digits(v("c-presencial"))||CONSULTA.presencial,virtual:+digits(v("c-virtual"))||CONSULTA.virtual,llamada:+digits(v("c-llamada"))||CONSULTA.llamada};
    try{await putCfg(c);toast("Datos del despacho guardados")}catch(err){}});
  const tf=$("#txtForm");if(tf)tf.addEventListener("submit",async e=>{e.preventDefault();readTxt();try{await putContenido("textos",{t:CV.txtDraft});CV.txtDraft=null;toast("Textos guardados")}catch(err){}});
  ["faqForm","glosForm"].forEach(id=>{const f=$("#"+id);if(!f)return;const isF=id==="faqForm";
    f.addEventListener("submit",async e=>{e.preventDefault();const list=readPairs(id).filter(p=>p[0]&&p[1]);
      try{await putContenido(isF?"faq":"glosario",{items:list.map(p=>isF?{q:p[0],a:p[1]}:{t:p[0],d:p[1]})});if(isF)CV.faqDraft=null;else CV.glosDraft=null;toast("Guardado")}catch(err){}})});
  const arf=$("#areaForm");if(arf)arf.addEventListener("submit",e=>{e.preventDefault();saveAreaForm()});
  const cq=$("#cq");if(cq){cq.addEventListener("input",e=>{CV.q=e.target.value;const y=scrollY;$(".crm-b").innerHTML=mClientes(clientes());bindCliTools();window.scrollTo(0,y);const n=$("#cq");n.focus();n.setSelectionRange(n.value.length,n.value.length)})}
  bindCliTools();
  $$("[data-setest]").forEach(s=>s.addEventListener("change",async()=>{const x=inmById(s.dataset.setest);if(!x)return;try{await putInm({...x,estado:s.value});if(x.autor)await patchEnvio(x.autor,x.id,{estado:s.value});toast("Estado actualizado")}catch(e){}}));
  $$("[data-verif]").forEach(s=>s.addEventListener("change",async()=>{const x=inmById(s.dataset.verif);if(!x)return;try{await putInm({...x,verificado:s.checked});toast(s.checked?"Marcado como verificado":"Verificación retirada")}catch(e){}}));
  $$("[data-citaest]").forEach(s=>s.addEventListener("change",async()=>{try{await patchCita(s.dataset.autor,s.dataset.citaest,{estado:s.value});toast("Cita actualizada")}catch(e){}}));
  const imp=$("#impfile");if(imp)imp.addEventListener("change",async()=>{const f=imp.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!d||d.app!=="SL Abogados")throw 0;CV.imp=d;softRender()}catch(e){toast("El archivo no es un respaldo válido de SL Abogados")}});
}
function bindCliTools(){
  const et=$("#cet");if(et)et.addEventListener("change",e=>{CV.etapa=e.target.value;softRender()});
  const ab=$("#cab");if(ab)ab.addEventListener("change",e=>{CV.abg=e.target.value;softRender()});
  const vw=$("#cvw");if(vw){segKnob(vw);vw.addEventListener("click",e=>{const b=e.target.closest("[data-vw]");if(!b)return;CV.view=b.dataset.vw;softRender()})}
  $$(".kc").forEach(k=>{k.addEventListener("dragstart",e=>{e.dataTransfer.setData("text/plain",k.dataset.cid);k.classList.add("drag")});k.addEventListener("dragend",()=>k.classList.remove("drag"));k.addEventListener("keydown",e=>{if(e.key==="Enter")openCli(k.dataset.cid)})});
  $$(".kcol").forEach(c=>{c.addEventListener("dragover",e=>{e.preventDefault();c.classList.add("over")});c.addEventListener("dragleave",()=>c.classList.remove("over"));c.addEventListener("drop",e=>{e.preventDefault();c.classList.remove("over");const id=e.dataTransfer.getData("text/plain");if(id)moveStage(id,c.dataset.drop)})});
}
function crmClick(e){
  const t=e.target;
  if(t.closest("[data-closesheet]")){closeSheet();return true}
  const md=t.closest("[data-mod]");if(md){syncDrafts();CV.mod=md.dataset.mod;if(md.dataset.fet!==undefined){CV.etapa=md.dataset.fet;CV.view="kanban"}abgEdit=null;confirmDel="";if(route!=="panel"){go("panel")}else{softRender();const m=$(".crm-main");if(m&&m.getBoundingClientRect().top<0)m.scrollIntoView({behavior:reduce?"auto":"smooth"})}return true}
  const kc=t.closest(".kc");if(kc){openCli(kc.dataset.cid);return true}
  const cl=t.closest("[data-cli]");if(cl){openCli(cl.dataset.cli);return true}
  const ck=t.closest("[data-clikey]");if(ck){const c=clientes().find(x=>keyOf(x.tel,x.email)===ck.dataset.clikey);c?openCli(c.id):toast("Sin datos de contacto");return true}
  if(t.closest("[data-newcli]")){newCli();return true}
  if(t.closest("[data-addnota]")){const v=($("#k-nota").value||"").trim();if(!v){$("#k-nota").focus();return true}readCli();saveCli(v);return true}
  if(t.closest("[data-discard]")){readCli();CV.draft.etapa="perdido";saveCli("Lead descartado");return true}
  if(t.closest("[data-askdelc]")){confirmDel="c"+CV.draft.id;drawSheet();return true}
  if(t.closest("[data-nodelc]")){confirmDel="";drawSheet();return true}
  if(t.closest("[data-delcli]")){(async()=>{try{await delCliente(CV.draft.id);confirmDel="";closeSheet();toast("Cliente eliminado")}catch(err){}})();return true}
  const is=t.closest("[data-isub]");if(is){CV.isub=is.dataset.isub;softRender();return true}
  const cs=t.closest("[data-csub]");if(cs){syncDrafts();CV.csub=cs.dataset.csub;CV.areaEdit=null;confirmDel="";softRender();return true}
  if(t.closest("[data-newarea]")){CV.areaEdit={_isNew:true,id:"",n:"",ic:"scale",g:"ambos",sh:"",d:"",law:[],doc:[],orden:ALLAREAS.length,s:[{id:"",n:"",d:"",c:[0,0],t:"",p:[],_open:true}]};softRender();window.scrollTo(0,$(".crm-main").offsetTop-80);return true}
  const ae=t.closest("[data-aedit]");if(ae){const a=ALLAREAS.find(x=>x.id===ae.dataset.aedit);CV.areaEdit=clone(a);delete CV.areaEdit._mod;delete CV.areaEdit._nueva;softRender();window.scrollTo(0,$(".crm-main").offsetTop-80);return true}
  if(t.closest("[data-acancel2]")){CV.areaEdit=null;confirmDel="";softRender();return true}
  const aic=t.closest("[data-aic]");if(aic){readAreaForm();CV.areaEdit.ic=aic.dataset.aic;$$("[data-aic]").forEach(b=>b.classList.toggle("on",b===aic));return true}
  if(t.closest("[data-sadd]")){readAreaForm();CV.areaEdit.s.push({id:"",n:"",d:"",c:[0,0],t:"",p:[],_open:true});softRender();setTimeout(()=>{const d=$$("#areaForm details");d[d.length-1].scrollIntoView({block:"center"});d[d.length-1].querySelector("input").focus()},50);return true}
  const sm=t.closest("[data-smove]");if(sm){readAreaForm();const L=CV.areaEdit.s,i=+sm.dataset.smove,j=i+(+sm.dataset.d);if(j>=0&&j<L.length){[L[i],L[j]]=[L[j],L[i]];softRender()}return true}
  const sd=t.closest("[data-sdel]");if(sd){readAreaForm();CV.areaEdit.s.splice(+sd.dataset.sdel,1);confirmDel="";softRender();return true}
  const am=t.closest("[data-amove]");if(am){moveArea(am.dataset.amove,+am.dataset.d);return true}
  const ah=t.closest("[data-ahide]");if(ah){const a=ALLAREAS.find(x=>x.id===ah.dataset.ahide);putArea({...clone(a),oculta:!a.oculta}).then(()=>toast(a.oculta?"Área visible en la web":"Área oculta en la web")).catch(()=>{});return true}
  const ar=t.closest("[data-areset]");if(ar){resetArea(ar.dataset.areset).then(()=>{confirmDel="";toast("Área restaurada")}).catch(()=>{});return true}
  const adl=t.closest("[data-adel]");if(adl){const a=ALLAREAS.find(x=>x.id===adl.dataset.adel);(async()=>{try{if(DEF_AREAS.some(x=>x.id===a.id))await putArea({...clone(a),eliminada:true});else{if(ST.mode==="db")await ST.db.doc("areas/"+a.id).delete();delete DBAREAS[a.id];if(ST.mode!=="db")store.set("sl-areas",DBAREAS);contentChanged()}confirmDel="";toast("Área eliminada")}catch(err){}})();return true}
  if(t.closest("[data-resetall]")){resetAllContent();return true}
  if(t.closest("[data-resettxt]")){delContenido("textos").then(()=>{CV.txtDraft=null;confirmDel="";toast("Textos originales restaurados")}).catch(()=>{});return true}
  const rp=t.closest("[data-resetpairs]");if(rp){const isF=rp.dataset.resetpairs==="faqForm";delContenido(isF?"faq":"glosario").then(()=>{if(isF)CV.faqDraft=null;else CV.glosDraft=null;confirmDel="";toast("Contenido original restaurado")}).catch(()=>{});return true}
  const pm=t.closest("[data-pmove]");if(pm){const id=pm.closest("form").id;const key=id==="faqForm"?"faqDraft":"glosDraft";CV[key]=readPairs(id);const L=CV[key],i=+pm.dataset.pmove,j=i+(+pm.dataset.d);if(j>=0&&j<L.length){[L[i],L[j]]=[L[j],L[i]];softRender()}return true}
  const pd=t.closest("[data-pdel2]");if(pd){const id=pd.closest("form").id;const key=id==="faqForm"?"faqDraft":"glosDraft";CV[key]=readPairs(id);CV[key].splice(+pd.dataset.pdel2,1);softRender();return true}
  const pa=t.closest("[data-padd]");if(pa){const id=pa.closest("form").id;const key=id==="faqForm"?"faqDraft":"glosDraft";CV[key]=readPairs(id);CV[key].push(["",""]);softRender();setTimeout(()=>{const i=$(`#${id}-a${CV[key].length-1}`);i&&(i.scrollIntoView({block:"center"}),i.focus())},50);return true}
  if(t.closest("[data-export]")){doExport(false);return true}
  if(t.closest("[data-exportcsv]")){doExport(true);return true}
  if(t.closest("[data-impick]")){$("#impfile").click();return true}
  if(t.closest("[data-impno]")){CV.imp=null;softRender();return true}
  if(t.closest("[data-impgo]")){doImport();return true}
  return false;
}
