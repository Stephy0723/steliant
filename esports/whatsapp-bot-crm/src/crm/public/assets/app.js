const SESSION_TIMEOUT = 8 * 60 * 60 * 1000;
let inactivityTimer;

const state = { view: "dashboard", rows: [], editingId: null };

const schemas = {
  contacts: [
    ["username","Usuario"],["phone","Teléfono"],["game","Juego"],["teamId","ID equipo"],
    ["role","Rol"],["status","Estado"],["verified","Verificado","select",["true","false"]]
  ],
  teams: [["name","Nombre"],["game","Juego"],["region","Región"],["status","Estado"]],
  tournaments: [
    ["name","Nombre"],["game","Juego"],["status","Estado"],["startDate","Fecha"],
    ["maxTeams","Máx. equipos","number"],["registeredTeams","Registrados","number"],
    ["bracketUrl","Bracket"],["rulesUrl","Reglas"],["discordUrl","Discord"]
  ],
  matches: [
    ["tournamentId","ID torneo"],["tournamentName","Torneo"],["teamA","Equipo A"],["teamB","Equipo B"],
    ["scheduledAt","Fecha/hora"],["checkinAt","Check-in"],["status","Estado"],["discordUrl","Discord"],["bracketUrl","Bracket"]
  ],
  groups: [["name","Nombre"],["whatsappGroupId","ID WhatsApp"],["status","Estado"],["botEnabled","Bot activo","select",["true","false"]]],
  checkins: [["phone","Teléfono"],["userId","ID usuario"],["matchId","ID partida"],["status","Estado"],["source","Origen"]],
  notes: [["title","Título"],["body","Nota","textarea"],["relatedType","Tipo relacionado"],["relatedId","ID relacionado"]]
};

const titles = {
  dashboard:"📊 Dashboard", ranking:"🏅 Ranking", analytics:"📈 Análisis", contacts:"👥 Usuarios", teams:"⚽ Equipos", tournaments:"🏆 Torneos",
  matches:"🎮 Partidas", groups:"💬 Grupos", checkins:"✅ Check-ins", conversations:"💭 Conversaciones",
  commandLogs:"⌨️ Comandos", loginAttempts:"Accesos", notes:"📝 Notas", settings:"⚙️ Configuración"
};

async function api(path, options={}) {
  const res = await fetch(`/crm/api/${path}`, {
    headers: {"Content-Type":"application/json", ...(options.headers||{})},
    ...options
  });
  if (res.status === 401) { location.href="/crm/login"; throw new Error("No autenticado"); }
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Error");
  return data;
}

function esc(v){return String(v ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function short(v,n=70){v=String(v??""); return v.length>n?v.slice(0,n)+"…":v;}
function badge(v){return `<span class="badge ${["active","open","confirmed","scheduled"].includes(String(v))?"ok":""}">${esc(v ?? "—")}</span>`;}

async function renderDashboard(){
  const d=await api("dashboard");
  const c=d.counts;
  document.querySelector("#content").innerHTML=`
    <div class="cards">
      ${[
        ["👥 Usuarios",c.contacts],["⚽ Equipos",c.teams],["🏆 Torneos",c.tournaments],["🎮 Partidas",c.matches],
        ["💬 Grupos",c.groups],["✅ Check-ins",c.checkins],["💭 Mensajes",c.conversations],["⌨️ Comandos",c.commands]
      ].map(x=>`<div class="card"><small>${x[0].split(" ")[1]}</small><div class="metric">${x[1]}</div></div>`).join("")}
    </div>
    <div class="grid-2">
      <div class="panel"><h3>🎮 Próximas partidas</h3>${tableFor("matches",d.upcomingMatches.slice(0,5),false)}</div>
      <div class="panel"><h3>⌨️ Actividad del bot</h3><div class="activity">
        ${(d.recentCommands.length?d.recentCommands:[{command:"Sin actividad",phone:"—",createdAt:""}]).map(x=>
          `<div class="activity-item"><strong>!${esc(x.command)}</strong><br><small>${esc(x.phone||"")} ${esc(x.groupName||"")}</small></div>`
        ).join("")}
      </div></div>`;
}

async function renderRanking(){
  try{
    const teams=await api("teams");
    const matches=await api("matches");
    const standings=teams.map(t=>{
      const teamMatches=matches.filter(m=>(m.teamA===t.name||m.teamB===t.name)&&m.status==="completed");
      const wins=teamMatches.filter(m=>(m.teamA===t.name&&m.winner===t.name)||(m.teamB===t.name&&m.winner===t.name)).length;
      const losses=teamMatches.length-wins;
      return{...t,wins,losses,matches:teamMatches.length,winRate:teamMatches.length>0?Math.round(wins/teamMatches.length*100):0};
    }).sort((a,b)=>b.wins-a.wins);
    
    document.querySelector("#content").innerHTML=`
      <div class="panel" style="max-width:100%">
        <h3>🏅 Ranking de Equipos</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>#</th><th>Equipo</th><th>Juego</th><th>Victorias</th><th>Derrotas</th><th>Matches</th><th>%</th></tr></thead>
          <tbody>${standings.map((t,i)=>`
            <tr style="border-left:4px solid ${i===0?'#fbbf24':i===1?'#c0c0c0':i===2?'#cd7f32':'var(--line)'}">
              <td><strong>${i+1}</strong></td>
              <td><strong>${esc(t.name)}</strong></td>
              <td>${esc(t.game)}</td>
              <td><span class="badge ok">${t.wins}</span></td>
              <td><span class="badge">${t.losses}</span></td>
              <td>${t.matches}</td>
              <td><strong>${t.winRate}%</strong></td>
            </tr>
          `).join("")}</tbody>
        </table></div>
      </div>`;
  }catch(e){
    document.querySelector("#content").innerHTML=`<div class="panel"><p style="color:var(--danger)">Error: ${esc(e.message)}</p></div>`;
  }
}

async function renderAnalytics(){
  try{
    const matches=await api("matches");
    const tournaments=await api("tournaments");
    const completed=matches.filter(m=>m.status==="completed").length;
    const scheduled=matches.filter(m=>m.status==="scheduled").length;
    const activeTournaments=tournaments.filter(t=>t.status==="active").length;
    const finishedTournaments=tournaments.filter(t=>t.status==="finished").length;
    
    document.querySelector("#content").innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="panel">
          <h3>📊 Estadísticas de Partidas</h3>
          <div class="cards" style="grid-template-columns:1fr">
            <div class="card"><small>Completadas</small><div class="metric">${completed}</div></div>
            <div class="card"><small>Programadas</small><div class="metric">${scheduled}</div></div>
            <div class="card"><small>Tasa de finalización</small><div class="metric">${matches.length>0?Math.round(completed/(completed+scheduled)*100):0}%</div></div>
          </div>
        </div>
        <div class="panel">
          <h3>🏆 Estadísticas de Torneos</h3>
          <div class="cards" style="grid-template-columns:1fr">
            <div class="card"><small>Activos</small><div class="metric">${activeTournaments}</div></div>
            <div class="card"><small>Finalizados</small><div class="metric">${finishedTournaments}</div></div>
            <div class="card"><small>Total</small><div class="metric">${tournaments.length}</div></div>
          </div>
        </div>
      </div>
      <div class="panel" style="margin-top:16px">
        <h3>📈 Últimas Partidas Completadas</h3>
        ${tableFor("matches",matches.filter(m=>m.status==="completed").slice(0,10),false)}
      </div>`;
  }catch(e){
    document.querySelector("#content").innerHTML=`<div class="panel"><p style="color:var(--danger)">Error: ${esc(e.message)}</p></div>`;
  }
}

function columnsFor(view, rows){
  const preferred={
    contacts:["username","phone","game","teamId","role","status"],
    teams:["name","game","region","status"],
    tournaments:["name","game","status","startDate","registeredTeams","maxTeams"],
    matches:["tournamentName","teamA","teamB","scheduledAt","status"],
    groups:["name","whatsappGroupId","status","botEnabled"],
    checkins:["phone","userId","matchId","status","source","checkedInAt"],
    conversations:["direction","phone","groupName","command","body","createdAt"],
    commandLogs:["command","phone","groupName","status","createdAt"],
    loginAttempts:["username","success","reason","ip","createdAt"],
    notes:["title","body","relatedType","relatedId","createdAt"]
  };
  return preferred[view] || Object.keys(rows[0]||{}).filter(k=>k!=="updatedAt").slice(0,7);
}

function tableFor(view, rows, actions=true){
  if(!rows?.length) return `<div class="empty">No hay registros todavía.</div>`;
  const cols=columnsFor(view,rows);
  return `<div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join("")}${actions?`<th>Acciones</th>`:""}</tr></thead><tbody>
    ${rows.map(r=>`<tr>${cols.map(c=>`<td>${["status","direction"].includes(c)?badge(r[c]):esc(short(r[c]))}</td>`).join("")}
    ${actions?`<td><button class="secondary" onclick="editRow('${view}','${r.id}')">Editar</button> <button class="danger" onclick="deleteRow('${view}','${r.id}')">Eliminar</button></td>`:""}</tr>`).join("")}
  </tbody></table></div>`;
}

async function renderCollection(view){
  const rows=await api(view);
  state.rows=rows;
  const canCreate=!!schemas[view];
  document.querySelector("#content").innerHTML=`
    <div class="panel">
      <div class="toolbar"><div class="left"><input id="search" placeholder="Buscar en ${titles[view].toLowerCase()}"></div>
      ${canCreate?`<button onclick="openCreate('${view}')">+ Nuevo</button>`:""}</div>
      <div id="tableArea">${tableFor(view,rows,canCreate)}</div>
    </div>`;
  document.querySelector("#search").addEventListener("input",e=>{
    const q=e.target.value.toLowerCase();
    const filtered=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q));
    document.querySelector("#tableArea").innerHTML=tableFor(view,filtered,canCreate);
  });
}

const TIER_LABELS={new:"Nueva",uni:"Universitaria",fem:"Femenina",pro:"Profesional"};

const TEAM_PERKS=[
  ["🎯","Scrims automáticos","Encuentra rivales de tu nivel sin salir del panel."],
  ["🛡️","Roster verificado","Cada jugador confirma su entrada desde WhatsApp."],
  ["🏆","Inscripción directa","Un equipo completo puede inscribirse a torneos con un clic."]
];

function teamsEmptyState(){
  return `<div class="tw">
    <div class="panel">
      <h3 style="margin-bottom:6px">Todavía no tienes escuadra</h3>
      <p style="color:var(--muted);margin:0">Crea la tuya en tres pasos: identidad, roster y publicación.</p>
      <div class="tw-cta">
        <button class="btn-primary" onclick="openTeamWizard()">Crear equipo</button>
        <button class="btn-ghost" onclick="alert('Unirse con código: próximamente')">Unirme con código</button>
      </div>
      <div class="tw-perks">
        ${TEAM_PERKS.map(p=>`<div class="tw-perk"><span class="ic">${p[0]}</span><div><strong>${esc(p[1])}</strong><span>${esc(p[2])}</span></div></div>`).join("")}
      </div>
    </div>
  </div>`;
}

function teamCards(teams){
  if(!teams.length) return teamsEmptyState();
  return `<div class="team-grid">${teams.map(t=>{
    const roster=Array.isArray(t.roster)?t.roster.length:(t.members||[]).length;
    const tiers=(t.tiers||[]).map(x=>`<span class="badge">${esc(TIER_LABELS[x]||x)}</span>`).join("");
    return `<div class="team-card">
      <div class="tc-top">
        <span class="tc-badge">${esc((t.tag||t.name||"GG").slice(0,3).toUpperCase())}</span>
        <div><h4>${esc(t.name)}</h4><div class="tc-meta">${esc([t.game,t.region,t.level].filter(Boolean).join(" · ")||"—")}</div></div>
      </div>
      ${tiers?`<div class="tc-tags">${tiers}</div>`:""}
      ${t.bio?`<div class="tc-meta" style="line-height:1.5">${esc(short(t.bio,110))}</div>`:""}
      <div class="tc-foot">
        <span>👥 ${roster}/5 · ${esc(t.captain&&t.captain.nick?"👑 "+t.captain.nick:"sin capitán")}</span>
        <button class="secondary" onclick="editRow('teams','${t.id}')">Editar</button>
      </div>
    </div>`;
  }).join("")}</div>`;
}

async function renderTeams(){
  const teams=await api("teams");
  state.rows=teams;
  if(!teams.length){ document.querySelector("#content").innerHTML=teamsEmptyState(); return; }
  document.querySelector("#content").innerHTML=`
    <div class="panel">
      <div class="toolbar">
        <div class="left"><input id="search" placeholder="Buscar equipos"></div>
        <button onclick="openTeamWizard()">+ Crear equipo</button>
      </div>
      <div id="tableArea">${teamCards(teams)}</div>
    </div>`;
  document.querySelector("#search").addEventListener("input",e=>{
    const q=e.target.value.toLowerCase();
    const f=teams.filter(r=>JSON.stringify(r).toLowerCase().includes(q));
    document.querySelector("#tableArea").innerHTML=f.length?teamCards(f):`<div class="empty">Sin resultados.</div>`;
  });
}

function openTeamWizard(){
  const done=()=>navigate("teams");
  window.TeamWizard.open(document.querySelector("#content"),{onClose:done,onSaved:done});
}
window.openTeamWizard=openTeamWizard;

async function renderSettings(){
  const s=await api("settings");
  document.querySelector("#content").innerHTML=`
  <div class="panel"><h3>Configuración del bot</h3>
    <div class="form-grid">
      <label>Nombre<input id="businessName" value="${esc(s.businessName||"")}"></label>
      <label>Prefijo<input id="commandPrefix" value="${esc(s.commandPrefix||"!")}"></label>
      <label class="full">Mensaje de soporte<textarea id="supportMessage">${esc(s.supportMessage||"")}</textarea></label>
    </div>
    <button id="saveSettings">Guardar configuración</button>
  </div>`;
  document.querySelector("#saveSettings").onclick=async()=>{
    await api("settings",{method:"PUT",body:JSON.stringify({
      businessName:document.querySelector("#businessName").value,
      commandPrefix:document.querySelector("#commandPrefix").value,
      supportMessage:document.querySelector("#supportMessage").value
    })});
    alert("Configuración guardada");
  };
}

async function navigate(view){
  state.view=view;
  document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  document.querySelector("#pageTitle").textContent=titles[view];
  if(view==="dashboard") return renderDashboard();
  if(view==="ranking") return renderRanking();
  if(view==="analytics") return renderAnalytics();
  if(view==="teams") return renderTeams();
  if(view==="settings") return renderSettings();
  return renderCollection(view);
}

function renderFields(view,row={}){
  return schemas[view].map(([key,label,type="text",options])=>{
    if(type==="textarea") return `<label class="full">${label}<textarea name="${key}">${esc(row[key]??"")}</textarea></label>`;
    if(type==="select") return `<label>${label}<select name="${key}">${options.map(o=>`<option value="${o}" ${String(row[key])===o?"selected":""}>${o}</option>`).join("")}</select></label>`;
    return `<label>${label}<input name="${key}" type="${type}" value="${esc(row[key]??"")}"></label>`;
  }).join("");
}

function openCreate(view){
  state.editingId=null;
  document.querySelector("#modalTitle").textContent=`Nuevo — ${titles[view]}`;
  document.querySelector("#modalFields").innerHTML=renderFields(view,{});
  document.querySelector("#modal").showModal();
}

function editRow(view,id){
  state.editingId=id;
  const row=state.rows.find(r=>r.id===id)||{};
  document.querySelector("#modalTitle").textContent=`Editar — ${titles[view]}`;
  document.querySelector("#modalFields").innerHTML=renderFields(view,row);
  document.querySelector("#modal").showModal();
}
window.editRow=editRow; window.openCreate=openCreate;

async function deleteRow(view,id){
  if(!confirm("¿Eliminar este registro?")) return;
  await api(`${view}/${id}`,{method:"DELETE"});
  navigate(view);
}
window.deleteRow=deleteRow;

document.querySelector("#saveBtn").onclick=async()=>{
  const form=new FormData(document.querySelector("#modalForm"));
  const body=Object.fromEntries(form.entries());
  for(const k of Object.keys(body)){
    if(body[k]==="true") body[k]=true;
    if(body[k]==="false") body[k]=false;
    if(["maxTeams","registeredTeams"].includes(k)&&body[k]!=="") body[k]=Number(body[k]);
  }
  const path=state.editingId?`${state.view}/${state.editingId}`:state.view;
  const method=state.editingId?"PUT":"POST";
  await api(path,{method,body:JSON.stringify(body)});
  document.querySelector("#modal").close();
  navigate(state.view);
};

document.querySelectorAll("#nav button").forEach(b=>b.onclick=()=>navigate(b.dataset.view));
async function logout(){
  await fetch("/crm/auth/logout",{method:"POST"});
  location.href="/crm/login";
}

function resetInactivityTimer(){
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(logout, SESSION_TIMEOUT);
}

["mousemove","keydown","click","scroll","touchstart"].forEach(eventName => {
  document.addEventListener(eventName, resetInactivityTimer, { passive: true });
});

document.querySelector("#logout").onclick=logout;
resetInactivityTimer();
navigate("dashboard");
