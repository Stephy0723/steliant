
/* =====================================================================
   ACCESO DEL EQUIPO — inicio de sesión, roles y usuarios del CRM
   Contraseñas guardadas como hash PBKDF2-SHA256 con sal (nunca en texto).
   ===================================================================== */
const ROLES={admin:["Administrador","Todo el CRM, el contenido de la web y los usuarios"],abogado:["Abogado","Sus clientes, citas e inmuebles"],asistente:["Asistente","Clientes, citas e inmuebles"]};
const ROLE_MODS={admin:null,abogado:["resumen","clientes","citas","inmuebles"],asistente:["resumen","clientes","citas","inmuebles"]};
const AUTH={users:[],ready:false,user:null,fails:0,lockUntil:0,lastAct:Date.now(),setup:false,editU:null,show:false};
const IDLE_MIN=30;
const b64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function hashPass(pass,saltB64){
  const salt=saltB64?unb64(saltB64):crypto.getRandomValues(new Uint8Array(16));
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(pass),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:120000,hash:"SHA-256"},key,256);
  return {salt:b64(salt),hash:b64(bits)};
}
const normU=u=>String(u||"").trim().toLowerCase();
function passScore(p){let s=0;if(p.length>=8)s++;if(p.length>=12)s++;if(/[A-Z]/.test(p)&&/[a-z]/.test(p))s++;if(/\d/.test(p))s++;if(/[^A-Za-z0-9]/.test(p))s++;return Math.min(4,s)}
const SCORE_TXT=["Muy débil","Débil","Aceptable","Buena","Excelente"];

/* ---------- Datos de usuarios ---------- */
function loadLocalUsers(){AUTH.users=store.get("sl-users")||[];AUTH.ready=true}
function subscribeUsers(){ST.db.collection("usuarios").onSnapshot(s=>{AUTH.users=s.docs.map(d=>({...d.data(),id:d.id}));AUTH.ready=true;checkSession();changed()},e=>{AUTH.ready=true;dbErr(e);changed()})}
async function putUser(u){
  if(ST.mode==="db")await ST.db.doc("usuarios/"+u.id).set(u).catch(writeErr);
  else{AUTH.users=AUTH.users.filter(x=>x.id!==u.id).concat([u]);store.set("sl-users",AUTH.users)}
}
async function delUser(id){
  if(ST.mode==="db")await ST.db.doc("usuarios/"+id).delete().catch(writeErr);
  else{AUTH.users=AUTH.users.filter(x=>x.id!==id);store.set("sl-users",AUTH.users)}
}

/* ---------- Sesión ---------- */
function readSess(){let s=null;try{s=JSON.parse(sessionStorage.getItem("sl-sess"))}catch(e){}if(!s)s=store.get("sl-sess");return s}
function writeSess(s,remember){try{sessionStorage.setItem("sl-sess",JSON.stringify(s))}catch(e){}if(remember)store.set("sl-sess",s);else store.del("sl-sess")}
function clearSess(){try{sessionStorage.removeItem("sl-sess")}catch(e){}store.del("sl-sess")}
function checkSession(){
  const s=readSess();
  if(!s){AUTH.user=null;return}
  const u=AUTH.users.find(x=>x.id===s.uid&&x.activo!==false);
  if(!u||(s.exp&&Date.now()>s.exp)||u.ver!==s.ver){AUTH.user=null;if(AUTH.ready)clearSess();return}
  AUTH.user=u;
}
function logout(msg){
  AUTH.user=null;clearSess();if(CV.sel)closeSheet();CV.mod="resumen";
  paintPanelLink();toast(msg||"Sesión cerrada");
  if(route==="panel"||route==="login")softRender();
}
function allowedMods(){const r=AUTH.user&&ROLE_MODS[AUTH.user.rol];return MODS.filter(m=>!r||r.includes(m[0])).concat(AUTH.user&&AUTH.user.rol==="admin"?[["usuarios","Usuarios y acceso","lock"]]:[])}
function canMod(k){return allowedMods().some(m=>m[0]===k)}
function scopeClientes(C){const u=AUTH.user;if(u&&u.rol==="abogado"&&u.abg)return C.filter(c=>c.abg===u.abg||!c.abg);return C}
["pointerdown","keydown","scroll"].forEach(ev=>addEventListener(ev,()=>{AUTH.lastAct=Date.now()},{passive:true}));
setInterval(()=>{if(AUTH.user&&Date.now()-AUTH.lastAct>IDLE_MIN*60000)logout(`Sesión cerrada por ${IDLE_MIN} minutos de inactividad`)},30000);

/* ---------- Pantalla de acceso ---------- */
function vLogin(){
  if(ST.mode==="db"&&!ST.admin)return `<div class="auth"><div class="auth-card card"><div class="auth-f">${seal(false)}<h1>Acceso del <em>equipo</em></h1><p class="hint">Esta cuenta de Claude no tiene permiso para administrar el sitio. Pida al propietario que le comparta la página como <b>Editor</b>.</p><a class="btn" href="#inicio">Volver al inicio</a></div></div></div>`;
  if(!AUTH.ready)return `<div class="auth"><div class="empty" style="margin:60px auto;max-width:420px">Cargando acceso…</div></div>`;
  if(AUTH.user)return `<div class="auth"><div class="auth-card card"><div class="auth-f"><span class="av lg"><i>${esc(initials(AUTH.user.nombre))}</i></span><h1>Hola, <em>${esc(AUTH.user.nombre.split(" ")[0])}</em></h1><p class="hint">Ya inició sesión como ${esc(ROLES[AUTH.user.rol][0].toLowerCase())}.</p><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><a class="btn pri" href="#panel">${ic("arr","arr")}Ir al CRM</a><button class="btn" data-logout>Cerrar sesión</button></div></div></div></div>`;
  const setup=!AUTH.users.length;
  const locked=Date.now()<AUTH.lockUntil;
  return `<div class="auth">
   <aside class="auth-side"><div class="as-in"><div class="as-seal">${seal(true,{fill:"transparent",ink:"var(--on-green)"})}</div>
    <h2>${setup?"Configure el acceso al <em>CRM</em>":"Bienvenido al <em>despacho</em>"}</h2>
    <p>${setup?"Cree la primera cuenta de administrador. Con ella podrá invitar al resto del equipo y asignar sus permisos.":"Clientes, citas, inmuebles y todo el contenido de la web, en un solo lugar."}</p>
    <ul class="as-l"><li>${ic("lock")}Contraseñas cifradas, nunca guardadas en texto</li><li>${ic("users")}Roles para administrador, abogados y asistentes</li><li>${ic("clock")}Cierre automático tras ${IDLE_MIN} minutos sin actividad</li></ul></div></aside>
   <div class="auth-card card"><form class="auth-f" id="authForm" novalidate data-mode="${setup?"setup":"login"}">
    <span class="eyebrow">${setup?"Primer acceso":"Acceso del equipo"}</span>
    <h1>${setup?"Crear <em>administrador</em>":"Iniciar <em>sesión</em>"}</h1>
    ${setup?`<div class="fl"><label for="au-nombre">Nombre completo</label><input id="au-nombre" autocomplete="name" placeholder="Ej.: Salvador López de la Rosa"></div>`:""}
    <div class="fl"><label for="au-user">Usuario o correo</label><input id="au-user" autocomplete="username" autocapitalize="none" spellcheck="false" ${locked?"disabled":""}></div>
    <div class="fl"><label for="au-pass">Contraseña</label><div class="pw"><input id="au-pass" type="${AUTH.show?"text":"password"}" autocomplete="${setup?"new-password":"current-password"}" ${locked?"disabled":""}><button type="button" class="pw-t" data-showpw aria-label="${AUTH.show?"Ocultar":"Mostrar"} contraseña">${ic(AUTH.show?"lock":"eye")}</button></div>
     ${setup?`<div class="pw-m"><i id="pwBar" data-s="0"></i></div><small class="hint" id="pwTxt">Mínimo 8 caracteres, con letras y números.</small>`:""}</div>
    ${setup?`<div class="fl"><label for="au-pass2">Repetir contraseña</label><input id="au-pass2" type="password" autocomplete="new-password"></div>`:`<label class="chk"><input type="checkbox" id="au-rem">Mantener la sesión en este equipo</label>`}
    <div class="perr" id="auErr" ${locked?"":"hidden"}>${locked?`${ic("alert")}<span>Demasiados intentos. Espere un minuto e intente de nuevo.</span>`:""}</div>
    <button type="submit" class="btn pri block" id="auBtn" ${locked?"disabled":""}>${setup?"Crear cuenta y entrar":"Entrar"}${ic("arr","arr")}</button>
    ${!setup?`<p class="hint auth-help">¿Olvidó su contraseña? Pida a un administrador que la restablezca desde <b>Usuarios y acceso</b>.${(ST.mode!=="db")||ST.isOwnerFlag?` <button type="button" class="link" data-forgot style="font-size:inherit">Restablecer acceso</button>`:""}</p>`:""}
    ${AUTH.forgot?forgotBox():""}
    ${ST.mode!=="db"?`<p class="mnote" style="margin-top:4px">${ic("alert")}Modo local: las cuentas y los datos del CRM se guardan solo en este navegador. Para usarlo con todo el equipo desde varios equipos, el sitio necesita un servidor con base de datos.</p>`:""}
   </form></div></div>`;
}
function forgotBox(){
  return `<div class="notes" style="margin-top:4px"><h4>${ic("alert")}Restablecer acceso</h4>${ST.mode==="db"?`<p>Como propietario de la página puede borrar todas las cuentas y crear un administrador nuevo. Los clientes, citas y contenido no se borran.</p><span class="inline-confirm"><button type="button" class="btn sm pri" data-resetusers>Borrar cuentas y empezar</button><button type="button" class="btn sm" data-noforgot>Cancelar</button></span>`:`<p>En modo local, por seguridad, restablecer el acceso también borra los datos del CRM guardados en este navegador (clientes, citas, cambios de contenido).</p><span class="inline-confirm"><button type="button" class="btn sm pri" data-resetlocal>Borrar todo y empezar</button><button type="button" class="btn sm" data-noforgot>Cancelar</button></span>`}</div>`;
}
function bindLogin(){
  const f=$("#authForm");if(!f)return;
  const err=m=>{const b=$("#auErr");b.hidden=false;b.innerHTML=`${ic("alert")}<span>${m}</span>`;f.classList.remove("shake");void f.offsetWidth;f.classList.add("shake")};
  const p1=$("#au-pass");
  if(f.dataset.mode==="setup")p1.addEventListener("input",()=>{const s=passScore(p1.value);$("#pwBar").dataset.s=p1.value?s+1:0;$("#pwTxt").textContent=p1.value?`Seguridad: ${SCORE_TXT[s]}`:"Mínimo 8 caracteres, con letras y números."});
  setTimeout(()=>{const first=$(f.dataset.mode==="setup"?"#au-nombre":"#au-user");first&&first.focus()},350);
  f.addEventListener("submit",async e=>{
    e.preventDefault();
    if(!crypto||!crypto.subtle){err("Este navegador no permite un inicio de sesión seguro. Abra el sitio con https.");return}
    const user=normU($("#au-user").value),pass=$("#au-pass").value,btn=$("#auBtn");
    if(f.dataset.mode==="setup"){
      const nombre=$("#au-nombre").value.trim(),pass2=$("#au-pass2").value;
      if(!nombre||!user)return err("Escriba su nombre y un usuario.");
      if(pass.length<8||!/\d/.test(pass)||!/[a-zA-Z]/.test(pass))return err("La contraseña debe tener al menos 8 caracteres, con letras y números.");
      if(pass!==pass2)return err("Las contraseñas no coinciden.");
      btn.disabled=true;btn.textContent="Creando cuenta…";
      try{const h=await hashPass(pass);const u={id:newId("u"),nombre,usuario:user,rol:"admin",abg:"",activo:true,ver:1,...h,creado:new Date().toISOString(),ultimoAcceso:new Date().toISOString()};
        await putUser(u);AUTH.users=AUTH.users.filter(x=>x.id!==u.id).concat([u]);startSession(u,false);toast("Cuenta creada. Bienvenido");if(route==="panel")softRender();else go("panel")}
      catch(x){btn.disabled=false;btn.textContent="Crear cuenta y entrar";err("No se pudo crear la cuenta. Intente de nuevo.")}
      return;
    }
    if(Date.now()<AUTH.lockUntil)return err("Demasiados intentos. Espere un minuto.");
    if(!user||!pass)return err("Escriba su usuario y contraseña.");
    btn.disabled=true;btn.textContent="Verificando…";
    const u=AUTH.users.find(x=>normU(x.usuario)===user);
    let ok=false;
    try{const h=await hashPass(pass,u?u.salt:b64(new Uint8Array(16)));ok=!!u&&h.hash===u.hash}catch(x){}
    if(ok&&u.activo===false){btn.disabled=false;btn.innerHTML=`Entrar${ic("arr","arr")}`;return err("Esta cuenta está desactivada. Hable con un administrador.")}
    if(!ok){AUTH.fails++;if(AUTH.fails>=5){AUTH.lockUntil=Date.now()+60000;AUTH.fails=0;setTimeout(()=>{if(route==="panel"||route==="login")softRender()},60500);softRender();return}
      btn.disabled=false;btn.innerHTML=`Entrar${ic("arr","arr")}`;return err(`Usuario o contraseña incorrectos.${AUTH.fails>=3?` Le quedan ${5-AUTH.fails} intentos.`:""}`)}
    AUTH.fails=0;startSession(u,$("#au-rem")&&$("#au-rem").checked);
    putUser({...u,ultimoAcceso:new Date().toISOString()}).catch(()=>{});
    toast(`Bienvenido, ${u.nombre.split(" ")[0]}`);
    if(route==="panel")softRender();else go("panel");
  });
}
function startSession(u,remember){AUTH.user=u;AUTH.lastAct=Date.now();writeSess({uid:u.id,ver:u.ver,exp:remember?Date.now()+14*864e5:Date.now()+12*36e5},remember);paintPanelLink()}

/* ---------- Módulo: Usuarios ---------- */
function mUsuarios(){
  if(AUTH.editU)return userForm(AUTH.editU);
  return `<div style="margin-bottom:14px"><button class="btn sm pri" data-newuser>${ic("plus")}Agregar usuario</button></div>
   ${AUTH.users.slice().sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(u=>{const l=lawyerById(u.abg);return `<div class="prow ${u.activo===false?"dim":""}"><span class="av sm"><i>${esc(initials(u.nombre))}</i></span><div style="min-width:0"><b>${esc(u.nombre)}${u.id===AUTH.user.id?` <span class="pill ok">Usted</span>`:""}</b><small>${esc(u.usuario)} · ${esc(ROLES[u.rol][0])}${l?" · Perfil: "+esc(l.nombre):""}${u.activo===false?" · Desactivado":""}</small><small>Último acceso: ${u.ultimoAcceso?esc(fdate(u.ultimoAcceso)):"nunca"}</small></div>
    <div class="pact"><button class="btn sm" data-edituser="${esc(u.id)}">${ic("edit")}Editar</button>${u.id===AUTH.user.id?"":confirmDel==="u"+u.id?`<span class="inline-confirm">¿Eliminar? <button class="btn sm pri" data-deluser="${esc(u.id)}">Sí</button><button class="btn sm" data-nodel>No</button></span>`:`<button class="btn sm ghost" data-askdel="u${esc(u.id)}" aria-label="Eliminar">${ic("trash")}</button>`}</div></div>`}).join("")}
   <div class="notes" style="margin-top:18px"><h4>${ic("shield")}Permisos por rol</h4><ul>${Object.values(ROLES).map(r=>`<li><b>${r[0]}:</b> ${r[1]}.</li>`).join("")}<li>Los abogados con perfil vinculado ven solo sus clientes y los que no tienen abogado asignado.</li><li>La sesión se cierra sola tras ${IDLE_MIN} minutos sin actividad.</li></ul></div>`;
}
function userForm(u){
  const isNew=!u.id;
  return `<form class="card aform" id="userForm" novalidate><h3>${isNew?"Nuevo usuario":"Editar usuario"}</h3>
   <div class="two"><div class="fl"><label for="uf-nombre">Nombre completo</label><input id="uf-nombre" value="${esc(u.nombre||"")}"></div><div class="fl"><label for="uf-usuario">Usuario o correo</label><input id="uf-usuario" autocapitalize="none" spellcheck="false" value="${esc(u.usuario||"")}"></div></div>
   <div class="fl"><label>Rol</label><div class="opts s3">${Object.entries(ROLES).map(([k,[l,d]])=>`<button type="button" class="opt big ${u.rol===k?"on":""}" data-urol="${k}"><b>${l}</b><small>${d}</small></button>`).join("")}</div></div>
   <div class="two"><div class="fl"><label for="uf-abg">Perfil de abogado vinculado</label><select class="sel" id="uf-abg"><option value="">Ninguno</option>${lawyers(true).filter(l=>!l.eliminado).map(l=>`<option value="${esc(l.id)}" ${u.abg===l.id?"selected":""}>${esc(l.nombre)}</option>`).join("")}</select></div>
    <div class="fl" style="align-content:end"><label class="chk"><input type="checkbox" id="uf-activo" ${u.activo!==false?"checked":""} ${u.id===AUTH.user.id?"disabled":""}>Cuenta activa</label></div></div>
   <h4>${isNew?"Contraseña":"Cambiar contraseña (opcional)"}</h4>
   <div class="two"><div class="fl"><label for="uf-pass">${isNew?"Contraseña":"Nueva contraseña"}</label><input id="uf-pass" type="password" autocomplete="new-password"></div><div class="fl"><label for="uf-pass2">Repetir</label><input id="uf-pass2" type="password" autocomplete="new-password"></div></div>
   <p class="hint">${isNew?"Comparta la contraseña con la persona por un medio privado. Podrá cambiarla luego.":"Al cambiar la contraseña se cierran las sesiones abiertas de este usuario."}</p>
   <div class="perr" id="ufErr" hidden></div>
   <div class="pbar"><button type="button" class="btn ghost" data-ucancel>Cancelar</button><button type="submit" class="btn pri">Guardar usuario</button></div></form>`;
}
function bindUsers(){
  const f=$("#userForm");if(!f)return;const u=AUTH.editU;
  f.addEventListener("click",e=>{const r=e.target.closest("[data-urol]");if(r){u.rol=r.dataset.urol;$$("[data-urol]",f).forEach(b=>b.classList.toggle("on",b===r))}});
  f.addEventListener("submit",async e=>{
    e.preventDefault();
    const err=m=>{const b=$("#ufErr");b.hidden=false;b.innerHTML=`${ic("alert")}<span>${m}</span>`};
    const nombre=$("#uf-nombre").value.trim(),usuario=normU($("#uf-usuario").value),p=$("#uf-pass").value,p2=$("#uf-pass2").value;
    if(!nombre||!usuario)return err("Escriba el nombre y el usuario.");
    if(AUTH.users.some(x=>x.id!==u.id&&normU(x.usuario)===usuario))return err("Ese usuario ya existe.");
    if(!u.id&&!p)return err("Escriba una contraseña para el usuario nuevo.");
    if(p&&(p.length<8||!/\d/.test(p)||!/[a-zA-Z]/.test(p)))return err("La contraseña debe tener al menos 8 caracteres, con letras y números.");
    if(p!==p2)return err("Las contraseñas no coinciden.");
    if(u.id===AUTH.user.id&&u.rol!=="admin"&&AUTH.users.filter(x=>x.rol==="admin"&&x.activo!==false).length<2)return err("Debe quedar al menos un administrador activo.");
    const out={...u,nombre,usuario,abg:$("#uf-abg").value,activo:u.id===AUTH.user.id?true:$("#uf-activo").checked};
    if(!out.id){out.id=newId("u");out.creado=new Date().toISOString();out.ver=1}
    if(p){Object.assign(out,await hashPass(p));out.ver=(+out.ver||1)+(u.id?1:0)}
    try{await putUser(out);if(out.id===AUTH.user.id){AUTH.user=out;writeSess({...readSess(),ver:out.ver},!!store.get("sl-sess"))}AUTH.editU=null;toast("Usuario guardado");softRender()}catch(x){}
  });
}
async function resetUsers(local){
  try{
    if(local){["sl-users","sl-crm","sl-citas","sl-areas","sl-contenido","sl-env","sl-inm","sl-abg","sl-cfg","sl-cita"].forEach(k=>store.del(k));clearSess();location.reload();return}
    for(const u of AUTH.users)await ST.db.doc("usuarios/"+u.id).delete();
    AUTH.users=[];AUTH.forgot=false;clearSess();toast("Cuentas borradas. Cree un administrador nuevo");softRender();
  }catch(e){toast("No se pudo restablecer el acceso")}
}
function authClick(e){
  const t=e.target;
  if(t.closest("[data-logout]")){logout();return true}
  if(t.closest("[data-showpw]")){const i=$("#au-pass");AUTH.show=i.type==="password";i.type=AUTH.show?"text":"password";t.closest("[data-showpw]").innerHTML=ic(AUTH.show?"lock":"eye");i.focus();return true}
  if(t.closest("[data-forgot]")){AUTH.forgot=true;softRender();return true}
  if(t.closest("[data-noforgot]")){AUTH.forgot=false;softRender();return true}
  if(t.closest("[data-resetusers]")){resetUsers(false);return true}
  if(t.closest("[data-resetlocal]")){resetUsers(true);return true}
  if(t.closest("[data-newuser]")){AUTH.editU={nombre:"",usuario:"",rol:"asistente",abg:"",activo:true};softRender();return true}
  const eu=t.closest("[data-edituser]");if(eu){AUTH.editU=JSON.parse(JSON.stringify(AUTH.users.find(x=>x.id===eu.dataset.edituser)));softRender();return true}
  if(t.closest("[data-ucancel]")){AUTH.editU=null;softRender();return true}
  const du=t.closest("[data-deluser]");if(du){delUser(du.dataset.deluser).then(()=>{confirmDel="";toast("Usuario eliminado");softRender()}).catch(()=>{});return true}
  return false;
}
