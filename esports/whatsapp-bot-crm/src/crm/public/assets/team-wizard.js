/* GlitchGang CRM — Wizard "Crear equipo"
 * Reconstrucción vanilla de los mockups CrearEquipo-A / CrearEquipo-B.
 * Depende de `api()` y `esc()` definidos en app.js (cargado antes que este archivo).
 */
(function () {
  "use strict";

  const DICT = {
    es: {
      eyebrow: "MIS PANELES", title: "Mis equipos",
      subtitle: "Organiza escuadras, encuentra rivales para scrims y recluta jugadores.",
      emptyTitle: "Todavía no tienes escuadra",
      emptyDesc: "Crea la tuya en tres pasos: identidad, roster y publicación.",
      createCta: "Crear equipo", joinCta: "Unirme con código",
      perk1t: "Scrims automáticos", perk1d: "Encuentra rivales de tu nivel sin salir del panel.",
      perk2t: "Roster verificado", perk2d: "Cada jugador confirma su entrada desde WhatsApp.",
      perk3t: "Inscripción directa", perk3d: "Un equipo completo puede inscribirse a torneos con un clic.",
      stepId: "Identidad", stepRoster: "Roster", stepPublish: "Publicar",
      stepIdSub: "Quién es tu equipo y dónde compite.",
      stepRosterSub: "Cinco titulares para poder inscribirte.",
      stepPublishSub: "Revisa cómo se verá y publícalo.",
      secIdentity: "Identidad", secGame: "Disciplina y juego", secTiers: "Divisiones",
      secCaptain: "Capitán", secProfile: "Perfil de la escuadra",
      fName: "Nombre del equipo *", phName: "ej: Glitch Wolves",
      fTag: "Tag *", hTag: "2 a 5 caracteres, se muestra en el bracket",
      fRegion: "Región *", fLang: "Idioma *", fLevel: "Nivel competitivo *", choose: "Selecciona…",
      fFullName: "Nombre completo *", phFullName: "Verificación interna", hFullName: "Solo lo ven los árbitros",
      fNick: "Nick in-game *", fUserTag: "Usuario competitivo / tag *", fRole: "Tu rol principal *",
      fSponsor: "Patrocinador *", phSponsor: "ej: Steliant", fCommunity: "Comunidad *",
      fBio: "Descripción *", phBio: "Describe tu escuadra, objetivos y vibra…",
      tiersNote: "Legendary y Next League se asignan internamente según el rendimiento del equipo.",
      tierNewD: "Menos de 6 meses", tierUniD: "Representa una universidad",
      tierFemD: "Roster femenino", tierProD: "Contrato o sueldo",
      secRoster: "Roster", rosterHelp: "Mínimo 5 titulares para inscribirte en torneos.",
      captain: "CAPITÁN", tabSearch: "Buscar jugadores", tabInvite: "Invitar por link", tabSlots: "Slots vacíos",
      phSearch: "Busca por nick, teléfono o juego…", add: "Añadir", added: "Añadido",
      noContacts: "No hay usuarios que coincidan. Regístralos primero en Usuarios.",
      inviteDiscord: "Compartir en Discord", inviteWhatsapp: "Compartir por WhatsApp",
      inviteNote: "Cualquiera con el link puede pedir entrar. Tú apruebas cada solicitud.",
      slotsNote: "Reserva posiciones ahora y asigna jugadores más tarde.",
      addSlot: "Añadir titular", addSub: "Añadir suplente",
      secShare: "Revisión y publicación", shareDiscord: "Publicar en Discord", shareCopy: "Copiar link del equipo",
      checklist: "Para poder crear", checklistHelp: "Todos los campos son obligatorios. Toca uno para ir a él.",
      draft: "Guardar borrador", draftSaved: "Borrador guardado", draftNote: "Se guarda en este navegador.",
      back: "Atrás", cancel: "Cancelar", next: "Continuar", publish: "Crear equipo",
      pendingOne: "Falta 1 campo", pendingMany: "Faltan {n} campos", ready: "Todo listo",
      detailNext: "Siguiente: {x}", detailReady: "Puedes publicar tu equipo",
      done: "Listo", todo: "Pendiente", chars: "{n}/240 caracteres", copy: "Copiar", copied: "Copiado",
      complete: "Completo", emptySlot: "Vacante", starter: "Titular ", sub: "Suplente",
      kName: "Nombre y tag", kRegion: "Región e idioma", kLevel: "Nivel competitivo", kGame: "Juego principal",
      kTiers: "Divisiones", kCaptain: "Datos del capitán", kProfile: "Patrocinador y comunidad",
      kBio: "Descripción", kRoster: "Roster de 5 titulares",
      sName: "Equipo", sGame: "Juego", sRegion: "Región", sLevel: "Nivel", sRoster: "Roster",
      sTiers: "Divisiones", sCaptain: "Capitán", sSponsor: "Patrocinador",
      created: "Equipo creado ✅", createError: "No se pudo crear el equipo",
      langNames: ["Español", "Inglés", "Bilingüe"],
      levels: ["Casual", "Amateur", "Semi-pro", "Profesional"],
      cats: ["MOBA", "FPS", "Battle Royale", "Deportes"],
      yourTeam: "Tu equipo"
    },
    en: {
      eyebrow: "MY PANELS", title: "My teams",
      subtitle: "Run squads, find scrim opponents, recruit players.",
      emptyTitle: "No squad yet",
      emptyDesc: "Build one in three steps: identity, roster, publish.",
      createCta: "Create team", joinCta: "Join with code",
      perk1t: "Automatic scrims", perk1d: "Find opponents at your level without leaving the panel.",
      perk2t: "Verified roster", perk2d: "Every player confirms from WhatsApp.",
      perk3t: "Direct entry", perk3d: "A full team enters tournaments in one click.",
      stepId: "Identity", stepRoster: "Roster", stepPublish: "Publish",
      stepIdSub: "Who your team is and where it plays.",
      stepRosterSub: "Five starters to enter tournaments.",
      stepPublishSub: "Check how it looks, then publish.",
      secIdentity: "Identity", secGame: "Discipline & game", secTiers: "Divisions",
      secCaptain: "Captain", secProfile: "Squad profile",
      fName: "Team name *", phName: "e.g. Glitch Wolves",
      fTag: "Tag *", hTag: "2 to 5 characters, shown in brackets",
      fRegion: "Region *", fLang: "Language *", fLevel: "Competitive level *", choose: "Select…",
      fFullName: "Full name *", phFullName: "Internal verification", hFullName: "Only referees see this",
      fNick: "In-game nick *", fUserTag: "Competitive user / tag *", fRole: "Your main role *",
      fSponsor: "Sponsor *", phSponsor: "e.g. Steliant", fCommunity: "Community *",
      fBio: "Description *", phBio: "Describe your squad, goals and vibe…",
      tiersNote: "Legendary and Next League are assigned internally based on team performance.",
      tierNewD: "Under 6 months old", tierUniD: "Represents a university",
      tierFemD: "All-female roster", tierProD: "Contracted or salaried",
      secRoster: "Roster", rosterHelp: "Five starters minimum to enter tournaments.",
      captain: "CAPTAIN", tabSearch: "Search players", tabInvite: "Invite by link", tabSlots: "Empty slots",
      phSearch: "Search by nick, phone or game…", add: "Add", added: "Added",
      noContacts: "No matching users. Register them first under Users.",
      inviteDiscord: "Share on Discord", inviteWhatsapp: "Share on WhatsApp",
      inviteNote: "Anyone with the link can request to join. You approve each request.",
      slotsNote: "Reserve positions now, assign players later.",
      addSlot: "Add starter", addSub: "Add sub",
      secShare: "Review & publish", shareDiscord: "Post to Discord", shareCopy: "Copy team link",
      checklist: "Before you can create", checklistHelp: "Every field is required. Tap one to jump to it.",
      draft: "Save draft", draftSaved: "Draft saved", draftNote: "Stored in this browser.",
      back: "Back", cancel: "Cancel", next: "Continue", publish: "Create team",
      pendingOne: "1 field left", pendingMany: "{n} fields left", ready: "All set",
      detailNext: "Next: {x}", detailReady: "You can publish your team",
      done: "Done", todo: "Missing", chars: "{n}/240 characters", copy: "Copy", copied: "Copied",
      complete: "Complete", emptySlot: "Open", starter: "Starter ", sub: "Sub",
      kName: "Name and tag", kRegion: "Region and language", kLevel: "Competitive level", kGame: "Main game",
      kTiers: "Divisions", kCaptain: "Captain details", kProfile: "Sponsor and community",
      kBio: "Description", kRoster: "Five starters",
      sName: "Team", sGame: "Game", sRegion: "Region", sLevel: "Level", sRoster: "Roster",
      sTiers: "Divisions", sCaptain: "Captain", sSponsor: "Sponsor",
      created: "Team created ✅", createError: "Could not create the team",
      langNames: ["Spanish", "English", "Bilingual"],
      levels: ["Casual", "Amateur", "Semi-pro", "Professional"],
      cats: ["MOBA", "FPS", "Battle Royale", "Sports"],
      yourTeam: "Your team"
    }
  };

  const GAMES = ["Valorant", "League of Legends", "CS2", "Free Fire", "Rocket League", "Dota 2", "EA FC 25", "Fortnite", "Mobile Legends"];
  const REGIONS = ["RD", "LATAM Norte", "LATAM Sur", "NA", "EU"];
  const COMMUNITIES = ["Steliant Community", "INTEC Esports", "PUCMM Gaming", "ITLA Arena"];
  const TIERS = [
    { id: "new", es: "Nueva", en: "New", d: "tierNewD" },
    { id: "uni", es: "Universitaria", en: "University", d: "tierUniD" },
    { id: "fem", es: "Femenina", en: "Female", d: "tierFemD" },
    { id: "pro", es: "Profesional", en: "Professional", d: "tierProD" }
  ];
  const DRAFT_KEY = "gg-crm-team-draft";
  const DASH = "—";

  function blankValues() {
    return {
      name: "", tag: "", region: "", language: "", level: "", category: "", game: "", tiers: [],
      fullName: "", nick: "", userTag: "", role: "", sponsor: "", community: "", bio: ""
    };
  }

  const W = {
    host: null, opts: {},
    lang: "es", step: 0, open: "identity", rosterTab: "search",
    copied: false, drafted: false, saving: false, query: "",
    members: [],            // jugadores añadidos (sin el capitán)
    contacts: [],           // usuarios reales del CRM
    v: blankValues(),

    t() { return DICT[this.lang]; },

    open_(host, opts) {
      this.host = host;
      this.opts = opts || {};
      this.lang = "es"; this.step = 0; this.open = "identity";
      this.rosterTab = "search"; this.copied = false; this.drafted = false; this.saving = false;
      this.query = ""; this.members = []; this.v = blankValues();
      this.loadDraft();
      this.render();
      api("contacts").then((rows) => { this.contacts = Array.isArray(rows) ? rows : []; if (this.step === 1) this.render(); }).catch(() => {});
    },

    close() {
      this.host = null;
      if (typeof this.opts.onClose === "function") this.opts.onClose();
    },

    /* ---------- roster helpers ---------- */
    captainMember() {
      const v = this.v;
      if (!v.nick) return null;
      return { nick: v.nick, role: v.role || (this.lang === "es" ? "Capitán" : "Captain"), captain: true };
    },
    roster() {
      const cap = this.captainMember();
      const seen = new Set();
      const all = (cap ? [cap] : []).concat(this.members);
      return all.filter((m) => {
        const k = (m.nick || "").toLowerCase();
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    },

    /* ---------- requirements / checklist ---------- */
    reqs() {
      const v = this.v, t = this.t();
      return [
        { step: 0, sec: "identity", label: t.kName, done: !!(v.name && v.tag) },
        { step: 0, sec: "identity", label: t.kRegion, done: !!(v.region && v.language) },
        { step: 0, sec: "identity", label: t.kLevel, done: !!v.level },
        { step: 0, sec: "game", label: t.kGame, done: !!v.game },
        { step: 0, sec: "tiers", label: t.kTiers, done: v.tiers.length > 0 },
        { step: 0, sec: "captain", label: t.kCaptain, done: !!(v.fullName && v.nick && v.userTag && v.role) },
        { step: 0, sec: "profile", label: t.kProfile, done: !!(v.sponsor && v.community) },
        { step: 0, sec: "profile", label: t.kBio, done: v.bio.trim().length > 10 },
        { step: 1, sec: null, label: t.kRoster, done: this.roster().length >= 5 }
      ];
    },
    secDone(id) { return this.reqs().filter((r) => r.sec === id).every((r) => r.done); },
    stepPending(n) { return this.reqs().filter((r) => r.step === n && !r.done).length; },
    pct() {
      const r = this.reqs();
      return Math.round((r.filter((x) => x.done).length / r.length) * 100);
    },
    blocked() {
      if (this.step === 2) return this.reqs().some((r) => !r.done);
      return this.stepPending(this.step) > 0;
    },

    /* ---------- state setters ---------- */
    setVal(k, val) { this.v[k] = val; this.saveDraft(); this.syncDerived(); },
    pickOne(k, val) { this.v[k] = this.v[k] === val ? "" : val; this.saveDraft(); this.render(); },
    toggleTier(id) {
      const i = this.v.tiers.indexOf(id);
      if (i >= 0) this.v.tiers.splice(i, 1); else this.v.tiers.push(id);
      this.saveDraft(); this.render();
    },
    addPlayer(c) {
      const nick = c.username || c.phone;
      if (!nick) return;
      if (this.roster().some((m) => (m.nick || "").toLowerCase() === nick.toLowerCase())) return;
      this.members.push({ contactId: c.id || null, nick, role: c.game || (this.lang === "es" ? "Jugador" : "Player") });
      this.render();
    },
    removeMember(idx) { this.members.splice(idx, 1); this.render(); },

    saveDraft() {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ v: this.v, members: this.members, lang: this.lang })); } catch (e) {}
    },
    loadDraft() {
      try {
        const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
        if (d && d.v) { this.v = Object.assign(blankValues(), d.v); this.members = d.members || []; if (d.lang) this.lang = d.lang; }
      } catch (e) {}
    },
    clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} },

    inviteLink() {
      return "glitchgang.gg/join/" + (this.v.tag ? this.v.tag.toLowerCase() : "tu-equipo") + "-x7k2";
    },

    async submit() {
      if (this.blocked() || this.saving) return;
      this.saving = true; this.render();
      const v = this.v;
      const payload = {
        name: v.name, tag: v.tag, game: v.game, category: v.category,
        region: v.region, language: v.language, level: v.level, tiers: v.tiers.slice(),
        sponsor: v.sponsor, community: v.community, bio: v.bio,
        captain: { fullName: v.fullName, nick: v.nick, userTag: v.userTag, role: v.role },
        roster: this.roster().map((m) => ({ contactId: m.contactId || null, nick: m.nick, role: m.role, captain: !!m.captain })),
        status: "active", source: "crm-wizard"
      };
      try {
        await api("teams", { method: "POST", body: JSON.stringify(payload) });
        this.clearDraft();
        this.toast(this.t().created);
        if (typeof this.opts.onSaved === "function") this.opts.onSaved();
      } catch (e) {
        this.saving = false;
        this.toast((this.t().createError) + ": " + e.message, true);
        this.render();
      }
    },

    toast(msg, isError) {
      const el = document.createElement("div");
      el.className = "tw-toast";
      if (isError) el.style.borderColor = "#ef4444";
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2600);
    },

    /* ================= render ================= */
    render() {
      if (!this.host) return;
      this.host.innerHTML = this.viewWizard(this.t());
      this.bind();
    },

    headerHTML(t) {
      return `
      <div class="tw-head">
        <div>
          <span class="eyebrow">${esc(t.eyebrow)}</span>
          <h2>${esc(t.title)}</h2>
          <p>${esc(t.subtitle)}</p>
        </div>
        <div class="tw-lang">
          <button data-lang="es" class="${this.lang === "es" ? "on" : ""}">ES</button>
          <button data-lang="en" class="${this.lang === "en" ? "on" : ""}">EN</button>
        </div>
      </div>`;
    },

    viewWizard(t) {
      const steps = [t.stepId, t.stepRoster, t.stepPublish];
      const subs = [t.stepIdSub, t.stepRosterSub, t.stepPublishSub];
      const allPending = this.reqs().filter((r) => !r.done).length;
      const tabs = [0, 1, 2].map((i) => {
        const total = this.reqs().filter((r) => r.step === i).length;
        const done = total - this.stepPending(i);
        const meta = i === 2
          ? (allPending ? t.pendingMany.replace("{n}", allPending) : t.ready)
          : (total ? done + "/" + total : "");
        return `<button data-step="${i}" class="${this.step === i ? "on" : ""}">
          <span class="n">${i + 1}</span>
          <span><span class="lb">${esc(steps[i])}</span><span class="mt">${esc(meta)}</span></span>
        </button>`;
      }).join("");

      return `
      <div class="tw">
        ${this.headerHTML(t)}
        <div class="tw-grid">
          <div class="tw-panel">
            <div class="tw-steptabs">${tabs}</div>
            <div class="tw-bar"><i style="width:${this.pct()}%"></i></div>
            <div class="tw-body">
              <div class="tw-sectitle">${esc(subs[this.step])}</div>
              ${this.step === 0 ? this.stepIdentity(t) : this.step === 1 ? this.stepRoster(t) : this.stepPublish(t)}
            </div>
            <div class="tw-foot" id="tw-foot">${this.footHTML(t)}</div>
          </div>
          <aside class="tw-side" id="tw-side">${this.sideHTML(t)}</aside>
        </div>
      </div>`;
    },

    /* ---------- step 1 ---------- */
    section(id, title, bodyHTML) {
      const open = this.open === id;
      const done = this.secDone(id);
      const t = this.t();
      const sum = this.sectionSummary(id);
      return `
      <div class="tw-sec ${open ? "open" : ""} ${done ? "done" : ""}" data-sec="${id}">
        <button class="h" data-toggle="${id}">
          <span class="dot">${done ? "✓" : "+"}</span>
          <span style="flex:1;min-width:0">
            <span style="display:block;font-size:14px;font-weight:600">${esc(title)}</span>
            <span class="sum" data-sum="${id}">${esc(sum)}</span>
          </span>
          <span class="st" data-secstate="${id}">${done ? t.done : t.todo}</span>
        </button>
        ${open ? `<div class="bd">${bodyHTML}</div>` : ""}
      </div>`;
    },

    sectionSummary(id) {
      const v = this.v, t = this.t();
      if (id === "identity") return [v.name && v.name + (v.tag ? " [" + v.tag + "]" : ""), v.region, v.language, v.level].filter(Boolean).join(" · ") || t.fName.replace(" *", "");
      if (id === "game") return [v.category, v.game].filter(Boolean).join(" · ") || t.choose;
      if (id === "tiers") return v.tiers.length ? v.tiers.map((x) => this.tierLabel(x)).join(", ") : t.choose;
      if (id === "captain") return [v.nick, v.role].filter(Boolean).join(" · ") || t.choose;
      if (id === "profile") return [v.sponsor, v.community].filter(Boolean).join(" · ") || t.choose;
      return "";
    },
    tierLabel(id) { const d = TIERS.find((x) => x.id === id); return d ? d[this.lang] : id; },

    field(k, label, ph, hint) {
      return `<div class="tw-f">
        <label>${esc(label)}</label>
        <input data-val="${k}" value="${esc(this.v[k])}" placeholder="${esc(ph || "")}">
        ${hint ? `<span class="hint">${esc(hint)}</span>` : ""}
      </div>`;
    },
    chipRow(k, items) {
      return `<div class="tw-chips">${items.map((it) => {
        const val = typeof it === "string" ? it : it.val;
        const lbl = typeof it === "string" ? it : it.label;
        return `<button class="tw-chip ${this.v[k] === val ? "on" : ""}" data-pick="${k}" data-v="${esc(val)}">${esc(lbl)}</button>`;
      }).join("")}</div>`;
    },

    stepIdentity(t) {
      const identity = `
        <div class="tw-row tag">
          ${this.field("name", t.fName, t.phName)}
          ${this.field("tag", t.fTag, "GG", t.hTag)}
        </div>
        <div class="tw-f"><label>${esc(t.fRegion)}</label>${this.chipRow("region", REGIONS)}</div>
        <div class="tw-f"><label>${esc(t.fLang)}</label>${this.chipRow("language", t.langNames)}</div>
        <div class="tw-f"><label>${esc(t.fLevel)}</label>${this.chipRow("level", t.levels)}</div>`;

      const game = `
        ${this.chipRow("category", t.cats)}
        <div class="tw-games">
          ${GAMES.map((g) => `<button class="tw-game ${this.v.game === g ? "on" : ""}" data-pick="game" data-v="${esc(g)}">
            <span class="ic">🎮</span><span>${esc(g)}</span></button>`).join("")}
        </div>`;

      const tiers = `
        <div class="tw-tiers">
          ${TIERS.map((d) => {
            const on = this.v.tiers.indexOf(d.id) >= 0;
            return `<button class="tw-tier ${on ? "on" : ""}" data-tier="${d.id}">
              <span class="bx">${on ? "✓" : "+"}</span>
              <span><b>${esc(d[this.lang])}</b><span>${esc(t[d.d])}</span></span>
            </button>`;
          }).join("")}
        </div>
        <p class="tw-note">${esc(t.tiersNote)}</p>`;

      const captain = `
        <div class="tw-row">
          ${this.field("fullName", t.fFullName, t.phFullName, t.hFullName)}
          ${this.field("nick", t.fNick, "tephygg")}
          ${this.field("userTag", t.fUserTag, "tephy#1234")}
          ${this.field("role", t.fRole, "EXP / Mid / IGL")}
        </div>`;

      const profile = `
        <div class="tw-row">
          ${this.field("sponsor", t.fSponsor, t.phSponsor)}
          <div class="tw-f">
            <label>${esc(t.fCommunity)}</label>
            <select data-val="community">
              <option value="">${esc(t.choose)}</option>
              ${COMMUNITIES.map((c) => `<option value="${esc(c)}" ${this.v.community === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="tw-f">
          <label>${esc(t.fBio)}</label>
          <textarea data-val="bio" rows="3" placeholder="${esc(t.phBio)}">${esc(this.v.bio)}</textarea>
          <span class="hint">${esc(t.chars.replace("{n}", this.v.bio.length))}</span>
        </div>`;

      return this.section("identity", t.secIdentity, identity)
        + this.section("game", t.secGame, game)
        + this.section("tiers", t.secTiers, tiers)
        + this.section("captain", t.secCaptain, captain)
        + this.section("profile", t.secProfile, profile);
    },

    /* ---------- step 2 ---------- */
    stepRoster(t) {
      const roster = this.roster();
      const slots = [0, 1, 2, 3, 4].map((i) => {
        const m = roster[i];
        const initials = m ? (m.nick || "?").slice(0, 2).toUpperCase() : "";
        const removable = m && !m.captain;
        const memberIdx = m && !m.captain ? this.members.findIndex((x) => x === m) : -1;
        return `<div class="tw-slot ${m ? "" : "empty"}">
          <span class="av">${m ? esc(initials) : "+"}</span>
          <div>
            <div class="nm">${esc(m ? m.nick : t.emptySlot)}</div>
            <div class="rl">${esc(m ? m.role : t.starter + (i + 1))}</div>
          </div>
          ${m && m.captain ? `<span class="tw-chip on" style="padding:2px 8px;font-size:9px">${esc(t.captain)}</span>` : ""}
          ${removable ? `<button class="rm" data-rm="${memberIdx}">✕ quitar</button>` : ""}
        </div>`;
      }).join("");

      const tabs = [["search", t.tabSearch], ["invite", t.tabInvite], ["slots", t.tabSlots]]
        .map(([id, lb]) => `<button data-rtab="${id}" class="${this.rosterTab === id ? "on" : ""}">${esc(lb)}</button>`).join("");

      let body = "";
      if (this.rosterTab === "search") {
        const q = this.query.toLowerCase();
        const rows = (this.contacts || []).filter((c) => {
          if (!q) return true;
          return [c.username, c.phone, c.game].some((x) => String(x || "").toLowerCase().includes(q));
        });
        body = `
          <input data-query placeholder="${esc(t.phSearch)}" value="${esc(this.query)}">
          <div class="tw-results">
            ${rows.length ? rows.map((c) => {
              const nick = c.username || c.phone || "?";
              const added = roster.some((m) => (m.nick || "").toLowerCase() === String(nick).toLowerCase());
              return `<div class="tw-result">
                <span class="av">${esc(String(nick).slice(0, 2).toUpperCase())}</span>
                <div class="info"><b>${esc(nick)}</b><span>${esc([c.game, c.phone].filter(Boolean).join(" · ") || DASH)}</span></div>
                <span style="font-size:10px;color:var(--muted)">${c.verified ? "VERIFICADO" : "NUEVO"}</span>
                <button class="btn-ghost sm" data-addc="${esc(c.id || nick)}" ${added ? "disabled" : ""}>${esc(added ? t.added : t.add)}</button>
              </div>`;
            }).join("") : `<div class="empty">${esc(t.noContacts)}</div>`}
          </div>`;
      } else if (this.rosterTab === "invite") {
        body = `
          <div class="tw-invite">
            <code>${esc(this.inviteLink())}</code>
            <button class="btn-ghost sm" data-copy>${esc(this.copied ? t.copied : t.copy)}</button>
          </div>
          <div class="tw-cta" style="margin:14px 0 0">
            <button class="btn-ghost sm" data-act="noop">${esc(t.inviteDiscord)}</button>
            <button class="btn-ghost sm" data-act="noop">${esc(t.inviteWhatsapp)}</button>
          </div>
          <p class="tw-note">${esc(t.inviteNote)}</p>`;
      } else {
        body = `
          <p class="tw-note" style="margin-bottom:12px">${esc(t.slotsNote)}</p>
          <div class="tw-cta" style="margin:0">
            <button class="btn-ghost sm" data-addslot="starter">${esc(t.addSlot)}</button>
            <button class="btn-ghost sm" data-addslot="sub">${esc(t.addSub)}</button>
          </div>`;
      }

      return `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
          <p style="margin:0;font-size:13px;color:var(--muted)">${esc(t.rosterHelp)}</p>
          <span style="font-weight:700;color:${roster.length >= 5 ? "var(--ok)" : "var(--warning)"}">${roster.length}/5</span>
        </div>
        <div class="tw-slots">${slots}</div>
        <div class="tw-tabs">${tabs}</div>
        ${body}`;
    },

    /* ---------- step 3 ---------- */
    stepPublish(t) {
      return `<div class="tw-step3">
        <div id="tw-summary">${this.summaryHTML(t)}</div>
        <div id="tw-preview">${this.previewHTML(t)}</div>
      </div>`;
    },
    summaryHTML(t) {
      const v = this.v, roster = this.roster();
      const rows = [
        [t.sName, v.name ? v.name + (v.tag ? "  [" + v.tag + "]" : "") : DASH],
        [t.sGame, v.game || DASH],
        [t.sRegion, [v.region, v.language].filter(Boolean).join(" · ") || DASH],
        [t.sLevel, v.level || DASH],
        [t.sTiers, v.tiers.length ? v.tiers.map((x) => this.tierLabel(x)).join(", ") : DASH],
        [t.sCaptain, v.nick ? v.nick + (v.role ? " · " + v.role : "") : DASH],
        [t.sSponsor, v.sponsor || DASH],
        [t.sRoster, roster.length + "/5"]
      ];
      return `<div class="tw-summary">
        ${rows.map(([k, val]) => `<div class="tw-srow"><span class="k">${esc(k)}</span><span class="v ${val === DASH ? "dim" : ""}">${esc(val)}</span></div>`).join("")}
        <div class="tw-cta" style="margin:6px 0 0">
          <button class="btn-ghost sm" data-act="noop">${esc(t.shareDiscord)}</button>
          <button class="btn-ghost sm" data-act="noop">${esc(t.shareCopy)}</button>
        </div>
      </div>`;
    },
    previewHTML(t) {
      const v = this.v, roster = this.roster();
      return `<div class="tw-preview">
        <div class="cap"></div>
        <div class="bd">
          <div class="bx">${esc(v.tag ? v.tag.toUpperCase() : "GG")}</div>
          <h4>${esc(v.name || t.yourTeam)}</h4>
          <div class="mt">${esc([v.game, v.region, v.level].filter(Boolean).join(" · ") || DASH)}</div>
          <div class="tw-chips" style="margin-top:10px">
            ${v.tiers.map((x) => `<span class="tw-chip">${esc(this.tierLabel(x))}</span>`).join("")}
          </div>
          <div class="avs">${roster.slice(0, 5).map(() => "<span></span>").join("")}</div>
        </div>
      </div>`;
    },

    /* ---------- footer + side ---------- */
    footHTML(t) {
      const pending = this.reqs().filter((r) => !r.done).length;
      const first = this.reqs().find((r) => !r.done);
      const firstLabel = first ? first.label : t.stepRoster;
      const pendLabel = pending === 0 ? t.ready : pending === 1 ? t.pendingOne : t.pendingMany.replace("{n}", pending);
      const detail = pending === 0 ? t.detailReady : t.detailNext.replace("{x}", firstLabel);
      const nextLabel = this.step === 2 ? t.publish : t.next;
      return `
        <button class="btn-ghost" data-act="back">${esc(this.step === 0 ? t.cancel : t.back)}</button>
        <div class="right">
          <div class="pend">
            <div class="lb" style="color:${pending === 0 ? "var(--ok)" : "var(--warning)"}">${esc(pendLabel)}</div>
            <div class="dt">${esc(detail)}</div>
          </div>
          <button class="btn-primary" data-act="next" ${this.blocked() || this.saving ? "disabled" : ""}>${esc(this.saving ? "…" : nextLabel)}</button>
        </div>`;
    },
    sideHTML(t) {
      const reqs = this.reqs();
      return `
        <div class="top">
          <div class="tw-sectitle" style="margin:0">${esc(t.checklist)}</div>
          <span class="pc">${this.pct()}%</span>
        </div>
        <p>${esc(t.checklistHelp)}</p>
        <div class="tw-check">
          ${reqs.map((r, i) => `<button class="${r.done ? "done" : ""}" data-goto="${r.step}" data-sec="${r.sec || ""}">
            <span class="dot">${r.done ? "✓" : "+"}</span>${esc(r.label)}
          </button>`).join("")}
        </div>
        <div class="draft">
          <button class="btn-ghost sm" style="width:100%" data-act="draft">${esc(this.drafted ? t.draftSaved : t.draft)}</button>
          <span class="hint" style="display:block;text-align:center;margin-top:6px">${esc(t.draftNote)}</span>
        </div>`;
    },

    syncDerived() {
      if (!this.host) return;
      const t = this.t();
      const side = this.host.querySelector("#tw-side");
      if (side) side.innerHTML = this.sideHTML(t);
      const foot = this.host.querySelector("#tw-foot");
      if (foot) foot.innerHTML = this.footHTML(t);
      const bar = this.host.querySelector(".tw-bar i");
      if (bar) bar.style.width = this.pct() + "%";
      this.host.querySelectorAll("[data-sum]").forEach((el) => { el.textContent = this.sectionSummary(el.dataset.sum); });
      this.host.querySelectorAll("[data-secstate]").forEach((el) => {
        const done = this.secDone(el.dataset.secstate);
        el.textContent = done ? t.done : t.todo;
        el.closest(".tw-sec").classList.toggle("done", done);
      });
      const sm = this.host.querySelector("#tw-summary");
      if (sm) sm.innerHTML = this.summaryHTML(t);
      const pv = this.host.querySelector("#tw-preview");
      if (pv) pv.innerHTML = this.previewHTML(t);
      this.bindDerived();
    },

    /* ================= events ================= */
    bind() {
      const h = this.host;
      if (!h) return;

      h.querySelectorAll("[data-lang]").forEach((b) => b.onclick = () => { this.lang = b.dataset.lang; this.saveDraft(); this.render(); });

      h.querySelectorAll("[data-act]").forEach((b) => b.onclick = () => {
        const a = b.dataset.act;
        if (a === "back") {
          if (this.step === 0) this.close();
          else { this.step -= 1; this.render(); }
        } else if (a === "next") {
          if (this.step === 2) this.submit();
          else if (!this.blocked()) { this.step = Math.min(2, this.step + 1); this.render(); }
        } else if (a === "draft") {
          this.saveDraft(); this.drafted = true; this.syncDerived();
          setTimeout(() => { this.drafted = false; this.syncDerived(); }, 1600);
        }
      });

      h.querySelectorAll("[data-step]").forEach((b) => b.onclick = () => { this.step = Number(b.dataset.step); this.render(); });
      h.querySelectorAll("[data-toggle]").forEach((b) => b.onclick = () => {
        this.open = this.open === b.dataset.toggle ? "" : b.dataset.toggle; this.render();
      });
      h.querySelectorAll("[data-pick]").forEach((b) => b.onclick = () => this.pickOne(b.dataset.pick, b.dataset.v));
      h.querySelectorAll("[data-tier]").forEach((b) => b.onclick = () => this.toggleTier(b.dataset.tier));
      h.querySelectorAll("[data-rtab]").forEach((b) => b.onclick = () => { this.rosterTab = b.dataset.rtab; this.render(); });
      h.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => this.removeMember(Number(b.dataset.rm)));
      h.querySelectorAll("[data-addc]").forEach((b) => b.onclick = () => {
        const c = (this.contacts || []).find((x) => String(x.id) === b.dataset.addc) || { username: b.dataset.addc };
        this.addPlayer(c);
      });
      h.querySelectorAll("[data-addslot]").forEach((b) => b.onclick = () => {
        const t = this.t();
        if (b.dataset.addslot === "starter") {
          if (this.roster().length >= 5) return;
          this.members.push({ nick: t.emptySlot, role: "TBD" });
        } else {
          this.members.push({ nick: t.sub, role: "SUB" });
        }
        this.render();
      });

      const copyBtn = h.querySelector("[data-copy]");
      if (copyBtn) copyBtn.onclick = () => {
        try { navigator.clipboard.writeText(this.inviteLink()); } catch (e) {}
        this.copied = true; this.render();
        setTimeout(() => { this.copied = false; if (this.host) this.render(); }, 1600);
      };

      const qi = h.querySelector("[data-query]");
      if (qi) qi.oninput = () => {
        this.query = qi.value;
        const pos = qi.selectionStart;
        this.render();
        const again = this.host.querySelector("[data-query]");
        if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) {} }
      };

      this.bindDerived();
    },

    bindDerived() {
      const h = this.host;
      if (!h) return;
      h.querySelectorAll("[data-val]").forEach((el) => {
        el.oninput = el.tagName === "SELECT" ? null : () => this.setVal(el.dataset.val, el.value);
        el.onchange = () => { this.setVal(el.dataset.val, el.value); if (el.tagName === "SELECT") this.render(); };
      });
      h.querySelectorAll("[data-goto]").forEach((b) => b.onclick = () => {
        this.step = Number(b.dataset.goto);
        if (b.dataset.sec) this.open = b.dataset.sec;
        this.render();
      });
    }
  };

  window.TeamWizard = {
    open(host, opts) { W.open_(host, opts); }
  };
})();
