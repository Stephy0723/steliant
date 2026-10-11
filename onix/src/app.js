/* ================= estado base ================= */
const root = document.documentElement;
let theme = store.get("co-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
root.dataset.theme = theme;
if (!hasG) document.body.classList.add("no-g");
const VIEWS = [["inicio", "home", IMG.villa], ["proyectos", "work", IMG.pool], ["torre", "dev", IMG.tower], ["servicios", "services", IMG.crew], ["estudio", "studio", IMG.plans], ["contacto", "contact", IMG.living]];
const VIDS = VIEWS.map((v) => v[0]);
const SLIDES = [PROJECTS[0], PROJECTS[4], PROJECTS[6]];
const SVC_IMG = [IMG.plans, IMG.crane, IMG.interior, IMG.eng, IMG.inter2, IMG.site];
const AMEN_IMG = [IMG.pool, U("1534438327276-14e5300c3a48", 1200), IMG.lux, IMG.facade, IMG.white, IMG.office];
const DATA_IMG = { tower: IMG.tower, quote: IMG.living, cta: IMG.villa, s1: IMG.crew, s2: IMG.eng, s3: IMG.plans };
const uName = (f, u) => (f >= 17 ? "PH" + f + "-" + "AB"[u] : String(f).padStart(2, "0") + "ABCD"[u]);
const es = () => lang === "es";
let bk = null, qt = null;
try { bk = JSON.parse(store.get("co-booking") || "null"); } catch (e) {}
try { qt = JSON.parse(store.get("co-quote") || "null"); } catch (e) {}
let sel = null; // unidad seleccionada {f,u}
const calcS = { kind: "house", area: 320, finish: "pre", ex: new Set(["smart"]) };

/* ================= utilidades ================= */
const chars = (lines) => lines.map((l) => `<span class="ln">${l.split(" ").map((w) => `<span class="wd">${[...w].map((c) => `<span class="ch">${esc(c)}</span>`).join("")}</span>`).join(" ")}</span>`).join("");
const toast = (m) => { const el = $("#toast"); el.textContent = m; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 3200); };
const code = () => "OX-" + Math.random().toString(36).slice(2, 6).toUpperCase();
const fmtDay = (d, o) => new Date(d).toLocaleDateString(loc(), o);
const statusOf = (f, u) => (bk && bk.unit && bk.unit.f === f && bk.unit.u === u ? "mine" : unitStatus(f, u));

/* ================= textos ================= */
function applyText() {
  root.lang = lang;
  $$("[data-t]").forEach((el) => { const v = get(el.dataset.t); if (typeof v === "string") el.textContent = v; });
  $$("[data-split]").forEach((el) => { const v = get(el.dataset.split); if (Array.isArray(v)) el.innerHTML = chars(v); });
  $$("[data-img]").forEach((el) => { if (!el.firstElementChild) el.innerHTML = pic(DATA_IMG[el.dataset.img], "ph"); });
}

/* ================= render ================= */
function renderMenu() {
  $("#menuList").innerHTML = VIEWS.map(([id, k], i) => { const w = get("nav." + k).split(" "); const last = w.pop(); return `<a href="#${id}" class="ml-a" data-view="${id}" data-i="${i}"><span class="mono">0${i + 1}</span><b class="ml-n">${w.length ? esc(w.join(" ")) + " " : ""}<i>${esc(last)}</i></b></a>`; }).join("");
  $("#menuPrev").innerHTML = VIEWS.map(([, , img], i) => `<img src="${img.replace("w=2200", "w=1000").replace("w=1800", "w=1000")}" alt="" class="${i === 0 ? "on" : ""}" data-i="${i}" onerror="this.style.opacity=0">`).join("");
  $("#ftNav").innerHTML = VIEWS.map(([id, k]) => `<a href="#${id}">${esc(get("nav." + k))}</a>`).join("");
  markNav();
  if (hasG && !menuOpen) gsap.set(".ml-n", { yPercent: 110 });
}
function renderHome() {
  $("#heroSlides").innerHTML = SLIDES.map((p, i) => `<div class="hs${i === slide ? " on" : ""}">${pic(p.img, "", L(p)[0])}</div>`).join("");
  $("#slideBars").innerHTML = SLIDES.map((_, i) => `<button type="button" data-slide="${i}" aria-label="${i + 1}"><i></i></button>`).join("");
  setSlideMeta();
  const st = t().home.stats;
  $("#stats").innerHTML = st.map(([n, s, l]) => `<div class="st"><i class="dim"></i><b><span class="cnt" data-n="${n}">${n}</span><sup>${s}</sup></b><span>${esc(l)}</span></div>`).join("");
  const words = t().home.manifesto.split(" ");
  const emw = es() ? ["vivir,", "generaciones,", "calma"] : ["live,", "generations,", "calm"];
  $("#manifesto").innerHTML = words.map((w) => `<span class="w${emw.includes(w) ? " em" : ""}">${esc(w)}</span>`).join(" ");
  $("#featRail").innerHTML = PROJECTS.map((p, i) => `<a href="#proyecto/${p.id}" class="fc" data-cursor="view"><div class="fc-img">${pic(p.img.replace(/w=\d+/, "w=1100"), "", L(p)[0])}<span class="fc-tag">${esc(t().cats[p.cat])}</span></div><div class="fc-meta"><h3>${esc(L(p)[0])}</h3><span class="mono">${p.loc} · ${p.year}</span></div></a>`).join("");
  const minP = unitPrice(1, 0);
  $("#tbFacts").innerHTML = [[FLOORS, es() ? "Niveles" : "Levels"], [68, es() ? "Unidades" : "Units"], ["US$" + Math.round(minP / 1000) + "K", es() ? "Desde" : "From"]].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join("");
  let fs = "";
  for (let f = 1; f <= FLOORS; f++) { const y = 400 - f * 21; fs += `<rect x="40" y="${y}" width="${f >= 17 ? 120 : 140}" height="17" data-f="${f}"/><text x="${f >= 17 ? 168 : 186}" y="${y + 12}">${String(f).padStart(2, "0")}</text>`; }
  $("#tbFloors").innerHTML = fs;
  $("#svcTeaser").innerHTML = t().svc.list.slice(0, 4).map(([h, p], i) => `<a href="#servicios" class="sv" data-svc="${i}"><span class="mono">0${i + 1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p><span class="arr">→</span></a>`).join("");
  const q = t().home.quote;
  $("#qText").innerHTML = q[0].split(" ").map((w) => `<span class="w">${esc(w)}</span>`).join(" ");
  $("#qBy").textContent = q[1]; $("#qProj").textContent = q[2];
  renderMine();
}
function renderWork() {
  const cats = ["all", "res", "corp", "hotel", "com"];
  $("#filters").innerHTML = cats.map((c) => `<button type="button" class="fbtn${c === workCat ? " on" : ""}" data-cat="${c}">${esc(t().cats[c])}<sup>${c === "all" ? PROJECTS.length : PROJECTS.filter((p) => p.cat === c).length}</sup></button>`).join("");
  $("#workGrid").innerHTML = PROJECTS.map((p, i) => `<a href="#proyecto/${p.id}" class="wc${workCat !== "all" && p.cat !== workCat ? " gone" : ""}" data-cursor="view" data-cat="${p.cat}"><div class="wc-img">${pic(p.img.replace(/w=\d+/, "w=1200"), "", L(p)[0])}</div><div class="wc-meta"><h3>${esc(L(p)[0])}</h3><span class="mono">${String(i + 1).padStart(2, "0")} · ${esc(t().cats[p.cat])}</span><p>${p.loc} · ${p.year} · ${p.area.toLocaleString("en-US")} m²</p></div></a>`).join("");
}
let workCat = "all";
function renderPD(id) {
  const i = Math.max(0, PROJECTS.findIndex((p) => p.id === id)); const p = PROJECTS[i]; const nx = PROJECTS[(i + 1) % PROJECTS.length]; const w = t().work;
  const [name, desc] = L(p); const nm = name.split(" ");
  $("#pd").innerHTML = `
  <section class="pd-hero"><div class="pd-bg">${pic(p.img, "", name)}</div><div class="wrap"><a href="#proyectos" class="pd-back">← ${esc(w.back)}</a><p class="kick ph-in"><span class="mono">${String(i + 1).padStart(2, "0")}/${String(PROJECTS.length).padStart(2, "0")}</span><span>${esc(t().cats[p.cat])} · ${p.loc}</span></p><h1 class="h1 chars">${chars([nm.slice(0, -1).join(" ") || nm[0], nm.length > 1 ? nm[nm.length - 1] : ""].filter(Boolean))}</h1></div></section>
  <section class="wrap pd-specs">${[[w.area, p.area.toLocaleString("en-US") + " m²"], [w.floors, p.floors], [w.year, p.year], [w.loc, p.loc]].map(([k, v]) => `<div class="rv"><span class="mono">${esc(k)}</span><b>${v}</b></div>`).join("")}</section>
  <section class="wrap pd-body"><div><p class="kick rv"><span class="mono">01</span><span>${esc(w.specs)}</span></p><p class="big rv">${esc(desc)}</p><div class="pd-tl rv"><p class="mono mut" style="margin-bottom:6px">${esc(w.timeline)}</p>${w.tl.map((x, k) => `<div><span>${esc(x)}</span><span class="bar"><i style="left:${k * 22}%;width:${[30, 34, 28, 26][k]}%"></i></span></div>`).join("")}</div></div>
    <div class="rv"><div class="ba" id="ba"><img src="${p.before}" alt="" onerror="this.style.opacity=0"><div class="ba-top"><img src="${p.gal[1]}" alt="" onerror="this.style.opacity=0"></div><span class="ba-h"></span><span class="ba-l l">${esc(w.before)}</span><span class="ba-l r">${esc(w.after)}</span></div></div></section>
  <section class="wrap"><p class="kick rv"><span class="mono">02</span><span>${esc(w.gallery)}</span></p></section>
  <section class="wrap pd-gal">${[...p.gal, IMG.villa].map((g, k) => `<button type="button" class="rv" data-lb="${k}" data-cursor="view">${pic(g.replace(/w=\d+/, "w=1400"), "", "")}</button>`).join("")}</section>
  <a href="#proyecto/${nx.id}" class="pd-next" data-cursor="view">${pic(nx.img, "", "")}<div class="wrap"><span class="mono">${esc(w.next)} →</span><b>${esc(L(nx)[0])}</b></div></a>`;
  pdGal = [...p.gal, IMG.villa];
}
let pdGal = [];
function renderTower() {
  const lg = t().dev.legend;
  $("#legend").innerHTML = ["free", "held", "sold"].map((k) => `<span><i class="lg-${k}"></i>${esc(lg[k])}</span>`).join("");
  let h = `<div class="tw-roof">ROOFTOP · ${es() ? "PISCINA" : "POOL"}</div>`;
  for (let f = FLOORS; f >= 1; f--) {
    const ph = f >= 17; const n = ph ? 2 : 4; let cells = "";
    for (let u = 0; u < n; u++) { const s = statusOf(f, u); const isSel = sel && sel.f === f && sel.u === u; cells += `<button type="button" class="u ${s === "mine" ? "held mine" : s}${isSel ? " sel" : ""}" data-f="${f}" data-u="${u}" aria-label="${uName(f, u)}">${uName(f, u).replace(/^PH\d+-/, "PH ")}<em>${unitType(f, u)}</em></button>`; }
    h += `<div class="flr${ph ? " pent" : ""}"><span class="fn">${String(f).padStart(2, "0")}</span>${cells}</div>`;
  }
  $("#twBuild").innerHTML = h + `<div class="tw-base"></div>`;
  renderPanel();
  $("#amenGrid").innerHTML = t().dev.amen.map((a, i) => `<div class="am rv">${pic(AMEN_IMG[i], "", a)}<span>${esc(a)}</span><em class="mono">0${i + 1}</em></div>`).join("");
}
const PLANS = {
  A: [[10, 10, 180, 110, "SALA · COMEDOR", "LIVING · DINING"], [190, 10, 120, 70, "COCINA", "KITCHEN"], [190, 80, 120, 110, "HAB. 1", "BED 1"], [10, 120, 90, 70, "BAÑO", "BATH"], [100, 120, 90, 70, "BALCÓN", "BALCONY", 1]],
  B: [[10, 10, 150, 110, "SALA · COMEDOR", "LIVING · DINING"], [160, 10, 90, 60, "COCINA", "KITCHEN"], [250, 10, 60, 60, "LAV.", "LAUNDRY"], [160, 70, 150, 120, "HAB. 1", "BED 1"], [10, 120, 90, 70, "HAB. 2", "BED 2"], [100, 120, 60, 70, "BAÑO", "BATH"]],
  C: [[10, 10, 140, 100, "SALA", "LIVING"], [150, 10, 80, 100, "COMEDOR", "DINING"], [230, 10, 80, 60, "COCINA", "KITCHEN"], [230, 70, 80, 60, "BAÑO", "BATH"], [10, 110, 100, 80, "HAB. 2", "BED 2"], [110, 110, 90, 80, "HAB. 3", "BED 3"], [200, 130, 110, 60, "HAB. 1", "BED 1"]],
  PH: [[10, 10, 170, 100, "DOBLE ALTURA", "DOUBLE HEIGHT"], [180, 10, 70, 60, "COCINA", "KITCHEN"], [250, 10, 60, 60, "BAR", "BAR"], [180, 70, 130, 60, "COMEDOR", "DINING"], [10, 110, 80, 80, "HAB. 2", "BED 2"], [90, 110, 80, 80, "HAB. 3", "BED 3"], [170, 130, 80, 60, "HAB. 4", "BED 4"], [250, 130, 60, 60, "HAB. 1", "BED 1"], [10, 110, 0, 0, "", ""]],
};
function planSVG(ty) {
  const m2 = TYPES[ty].m2; const wm = Math.sqrt(m2 * 1.5).toFixed(2), hm = (m2 / wm).toFixed(2);
  return `<svg class="plan" viewBox="0 0 330 218"><rect class="wall" x="10" y="10" width="300" height="180"/>${PLANS[ty].filter((r) => r[2]).map(([x, y, w, h, a, b, fx]) => `<rect class="${fx ? "fx" : ""}" x="${x}" y="${y}" width="${w}" height="${h}"/>${fx ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke-dasharray="3 3"/>` : ""}<text x="${x + w / 2}" y="${y + h / 2 + 2}">${es() ? a : b}</text>`).join("")}<path class="dim" d="M10 204H310M10 199v10M310 199v10"/><text class="dimt" x="160" y="215">${wm} m</text><path class="dim" d="M318 10V190M313 10h10M313 190h10"/><text class="dimt" x="326" y="104" transform="rotate(90 326 104)">${hm} m</text></svg>`;
}
function renderPanel() {
  const d = t().dev; const P = $("#twPanel");
  if (!sel) { P.innerHTML = `<div class="tp-empty"><svg viewBox="0 0 80 80"><rect x="10" y="10" width="60" height="60"/><path d="M10 40h30v30M40 10v20h30"/><circle cx="58" cy="54" r="6"/></svg><p>${esc(d.choose)}</p></div>`; return; }
  const { f, u } = sel; const ty = unitType(f, u); const T0 = TYPES[ty]; const pr = unitPrice(f, u); const s = statusOf(f, u);
  const msg = s === "sold" ? d.soldMsg : s === "held" ? d.heldMsg : s === "mine" ? (es() ? "Esta unidad está separada a tu nombre." : "This unit is on hold under your name.") : "";
  P.innerHTML = `<div class="tp-top"><div><span class="mono">${esc(d.floor)} ${f} · ${esc(d.type)} ${ty}</span><h3>${uName(f, u)}</h3></div><span class="tp-badge">${esc(s === "mine" ? (es() ? "Tuya" : "Yours") : d.legend[s] || "")}</span></div>
  ${planSVG(ty)}
  <div class="tp-specs"><div><b>${T0.m2}</b><span>${esc(d.m2)}</span></div><div><b>${T0.beds}</b><span>${esc(d.beds)}</span></div><div><b>${T0.baths}</b><span>${esc(d.baths)}</span></div><div><b>${T0.park}</b><span>${esc(d.park)}</span></div></div>
  <div class="tp-price"><span class="mono mut">${esc(d.price)}</span><b id="tpPrice">${usd(pr)}</b></div>
  <div class="tp-plan"><p class="mono mut" style="margin-bottom:4px">${esc(d.plan)}</p>${d.planRows.map(([k, pc], i) => `<div><span>${esc(k)}</span><em>${Math.round(pc * 100)}%</em><b>${i === 0 ? "US$2,000 + " + usd(pr * pc - 2000) : usd(pr * pc)}</b></div>`).join("")}<div><span>${es() ? "Cuota mensual (24 meses)" : "Monthly (24 months)"}</span><em>—</em><b>${usd((pr * 0.37) / 24)}</b></div></div>
  ${msg ? `<div class="tp-msg">${esc(msg)}</div>` : ""}
  <div class="tp-acts"><button type="button" class="btn btn-brass" data-book="hold" ${s !== "free" ? "disabled" : ""}><span>${esc(d.reserve)}</span><i class="arr">→</i></button><button type="button" class="btn btn-line" data-book="visit"><span>${esc(d.visit)}</span></button></div>`;
  if (hasG && !reduce) { gsap.fromTo(P.children, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: "power3.out", clearProps: "transform,opacity" }); const pl = $(".plan", P); $$("rect", pl).forEach((r) => { const l = 2 * ((+r.getAttribute("width")) + (+r.getAttribute("height"))); r.style.strokeDasharray = l; gsap.fromTo(r, { strokeDashoffset: l }, { strokeDashoffset: 0, duration: 1.2, ease: "power2.inOut" }); }); const o = { v: pr * 0.7 }; gsap.to(o, { v: pr, duration: 1, ease: "power3.out", onUpdate: () => { const el = $("#tpPrice"); if (el) el.textContent = usd(o.v); } }); }
}
function renderSvc() {
  $("#svcList").innerHTML = t().svc.list.map(([h, p], i) => `<div class="sv rv" data-svc="${i}"><span class="mono">0${i + 1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p><span class="arr">→</span></div>`).join("");
  $("#svcFollow").innerHTML = SVC_IMG.map((s, i) => `<img src="${s.replace(/w=\d+/, "w=700")}" alt="" data-i="${i}" onerror="this.style.opacity=0">`).join("");
  $("#procGrid").innerHTML = t().svc.proc.map(([h, p], i) => `<div class="pr rv"><span class="mono">${es() ? "Fase" : "Phase"} 0${i + 1}</span><h4>${esc(h)}</h4><p>${esc(p)}</p></div>`).join("");
}
function renderStudio() {
  const s = t().studio;
  $("#hist").innerHTML = s.hist.map(([y, p]) => `<div class="hi rv"><b>${y}</b><p>${esc(p)}</p></div>`).join("");
  $("#teamGrid").innerHTML = s.team.map(([n, r, id]) => `<div class="tm rv"><div class="tm-img">${pic(U(id, 700), "", n)}</div><b>${esc(n)}</b><span>${esc(r)}</span></div>`).join("");
  const ic = ['<path d="M20 4l14 8v16l-14 8-14-8V12z"/><path d="M14 20l4 4 8-8"/>', '<path d="M20 36c-8-6-12-12-12-20 6 0 10 2 12 6 2-4 6-6 12-6 0 8-4 14-12 20z"/>', '<path d="M6 34h28M10 34V16l10-8 10 8v18M16 34v-8h8v8"/>', '<circle cx="20" cy="20" r="14"/><path d="M20 10v10l7 5"/>'];
  $("#certRow").innerHTML = s.certs.map((c, i) => `<div class="cert rv"><svg viewBox="0 0 40 40">${ic[i]}</svg><span>${esc(c)}</span></div>`).join("");
}
function renderCalc() {
  const c = t().contact;
  $("#cKind").innerHTML = Object.entries(c.kinds).map(([k, v]) => `<button type="button" data-kind="${k}" class="${k === calcS.kind ? "on" : ""}">${esc(v)}</button>`).join("") + `<i class="sg-ind"></i>`;
  $("#cFinish").innerHTML = Object.entries(c.finishes).map(([k, v]) => `<button type="button" data-finish="${k}" class="${k === calcS.finish ? "on" : ""}">${esc(v)}</button>`).join("") + `<i class="sg-ind"></i>`;
  $("#cExtras").innerHTML = Object.entries(c.ex).map(([k, v]) => `<button type="button" class="chip${calcS.ex.has(k) ? " on" : ""}" data-ex="${k}"><i></i>${esc(v)}</button>`).join("");
  calc();
}
const KIND = { house: 1, apt: 0.92, com: 1.08 };
const calcVal = () => { const base = calcS.area * FINISH[calcS.finish] * KIND[calcS.kind]; const ex = [...calcS.ex].reduce((a, k) => a + EXTRAS[k], 0); const tot = base + ex; const months = Math.min(30, Math.max(5, Math.round(4 + calcS.area / 55 + (calcS.finish === "lux" ? 3 : calcS.finish === "pre" ? 1 : 0)))); return { tot, lo: tot * 0.92, hi: tot * 1.08, months }; };
let estShown = 0;
const mill = (n) => "RD$" + (n / 1e6).toFixed(1) + "M";
function calc() {
  const r = $("#cArea"); calcS.area = +r.value; r.style.setProperty("--p", ((calcS.area - 80) / (1500 - 80)) * 100 + "%");
  $("#cAreaV").textContent = calcS.area + " m²";
  const v = calcVal(); const c = t().contact;
  $("#estR").textContent = `${mill(v.lo)} – ${mill(v.hi)}`;
  $("#estM").textContent = v.months + " " + c.mo;
  if (hasG && !reduce) { const o = { v: estShown }; gsap.to(o, { v: v.tot, duration: 0.8, ease: "power3.out", onUpdate: () => ($("#estV").textContent = rd(o.v)) }); } else $("#estV").textContent = rd(v.tot);
  estShown = v.tot;
  $("#cfSum").innerHTML = `${esc(c.kinds[calcS.kind])} · ${calcS.area} m² · ${esc(c.finishes[calcS.finish])}${calcS.ex.size ? " · " + [...calcS.ex].map((k) => esc(c.ex[k])).join(", ") : ""}<br>${esc(c.est)}: <b>${rd(v.tot)}</b> · ${v.months} ${esc(c.mo)}`;
  requestAnimationFrame(() => $$(".seg").forEach(segInd));
}
function segInd(sg) { const on = $("button.on", sg); const ind = $(".sg-ind", sg); if (!on || !ind) return; ind.style.width = on.offsetWidth + "px"; ind.style.transform = `translateX(${on.offsetLeft}px)`; }

/* ================= mi reserva ================= */
function bookCard(b) {
  const isHold = b.mode === "hold"; const d = new Date(b.when); const ty = b.unit ? unitType(b.unit.f, b.unit.u) : null;
  const rows = [[t().mine.visit, fmtDay(b.when, { weekday: "short", day: "numeric", month: "short" }) + " · " + b.time], [t().book.where, "Piantini"]];
  if (b.unit) rows.unshift([t().mine.unit, uName(b.unit.f, b.unit.u) + " · " + ty + " · " + TYPES[ty].m2 + " m²"]);
  if (isHold) rows.push([t().mine.paid, "US$2,000"]);
  return `<div class="ticket"><div class="tk-img">${pic(IMG.tower.replace(/w=\d+/, "w=900"), "", "")}<span class="mono">${esc(isHold ? t().mine.paid : t().mine.pending)}</span></div><div class="tk-b"><h4>${esc(b.unit ? (es() ? "Torre Ónix · " : "Ónix Tower · ") + uName(b.unit.f, b.unit.u) : t().book.where)}</h4><div class="tk-rows">${rows.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}<div><span>${esc(t().book.name)}</span><b>${esc(b.name)}</b></div></div></div><div class="tk-cut"></div><div class="tk-code"><div><p class="mono mut">${esc(t().book.code)}</p><b>${b.code}</b></div><i class="barcode"></i></div></div>`;
}
function quoteCard(q) {
  const c = t().contact;
  return `<div class="ticket"><div class="tk-img">${pic(IMG.plans.replace(/w=\d+/, "w=900"), "", "")}<span class="mono">${esc(c.req)}</span></div><div class="tk-b"><h4>${esc(c.kinds[q.kind])} · ${q.area} m²</h4><div class="tk-rows"><div><span>${esc(c.finish)}</span><b>${esc(c.finishes[q.finish])}</b></div><div><span>${esc(c.est)}</span><b>${rd(q.tot)}</b></div><div><span>${esc(c.months)}</span><b>${q.months} ${esc(c.mo)}</b></div><div><span>${esc(c.name)}</span><b>${esc(q.name)}</b></div></div></div><div class="tk-cut"></div><div class="tk-code"><div><p class="mono mut">${esc(t().book.code)}</p><b>${q.code}</b></div><i class="barcode"></i></div></div>`;
}
function countdown(b) { const ms = new Date(b.when).getTime() - Date.now(); if (ms <= 0) return "—"; const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5); return `${d}d ${String(h).padStart(2, "0")}h`; }
function renderMine() {
  const box = $("#mineHome"); const fab = $("#fab"); const m = t().mine; const items = [];
  if (bk) { const ty = bk.unit ? unitType(bk.unit.f, bk.unit.u) : null; items.push(`<div class="mh"><div class="mh-img">${pic(IMG.tower.replace(/w=\d+/, "w=500"), "ph", "")}</div><div><p class="mono mut">${esc(m.title)} · ${bk.code}</p><h4>${esc(bk.unit ? uName(bk.unit.f, bk.unit.u) + " · " + ty : t().book.where)}</h4><div class="mh-steps">${m.steps.map((s, i) => `<span class="${i <= (bk.mode === "hold" ? 1 : 0) ? "on" : ""}">${esc(s)}</span>`).join("")}</div></div><div class="mh-cd"><p class="mono mut">${esc(m.in)}</p><b>${countdown(bk)}</b><button type="button" class="link-u" data-open-mine>${esc(t().nav.my)} →</button></div></div>`); }
  if (qt) items.push(`<div class="mh"><div class="mh-img">${pic(IMG.plans.replace(/w=\d+/, "w=500"), "ph", "")}</div><div><p class="mono mut">${esc(t().contact.req)} · ${qt.code}</p><h4>${esc(t().contact.kinds[qt.kind])} · ${qt.area} m² · ${rd(qt.tot)}</h4><div class="mh-steps">${(es() ? ["Recibida", "Revisión", "Visita técnica", "Propuesta"] : ["Received", "Review", "Site visit", "Proposal"]).map((s, i) => `<span class="${i === 0 ? "on" : ""}">${esc(s)}</span>`).join("")}</div></div><div class="mh-cd"><p class="mono mut">${esc(t().contact.months)}</p><b>${qt.months} ${esc(t().contact.mo)}</b><button type="button" class="link-u" data-open-mine>${esc(t().nav.my)} →</button></div></div>`);
  if (hasG && cur) requestAnimationFrame(() => ScrollTrigger.refresh());
  box.hidden = !items.length; box.innerHTML = `<div class="mh-list">${items.join("")}</div>`;
  fab.hidden = !items.length; $("#fabSub").textContent = bk ? bk.code + " · " + countdown(bk) : qt ? qt.code : "";
  $("#drIn").innerHTML = `<button type="button" class="dr-x" data-close-mine>×</button><p class="kick" style="margin-top:6px"><span class="mono">ÓNIX</span><span>${esc(t().nav.my)}</span></p>${bk ? `<h3 class="h3" style="margin-bottom:18px">${esc(m.title)}</h3>${bookCard(bk)}<div class="tp-acts" style="margin:16px 0 34px">${bk.unit ? `<a href="#torre" class="btn btn-ink" data-unit-open><span>${esc(m.open)}</span></a>` : ""}<button type="button" class="btn btn-line" data-cancel="bk"><span>${esc(m.clear)}</span></button></div>` : ""}${qt ? `<h3 class="h3" style="margin-bottom:18px">${esc(t().contact.calc)}</h3>${quoteCard(qt)}<div class="tp-acts" style="margin-top:16px"><button type="button" class="btn btn-line" data-cancel="qt"><span>${esc(m.clear)}</span></button></div>` : ""}`;
}
function openMine() { $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); }
function closeMine() { $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); }

/* ================= modal de reserva ================= */
const B = { mode: "visit", day: null, time: null };
function slots() { const out = []; const d = new Date(); d.setHours(0, 0, 0, 0); while (out.length < 12) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) out.push(new Date(d)); } return out; }
const TIMES = ["9:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"];
const takenT = (d, ti) => ((d.getDate() * 3 + ti * 5) % 7) === 0;
function openBook(mode) {
  B.mode = mode; B.day = null; B.time = null;
  if (mode === "hold" && (!sel || statusOf(sel.f, sel.u) !== "free")) { sel = { f: 12, u: 1 }; for (let f = 12; f > 1 && statusOf(sel.f, sel.u) !== "free"; f--) sel = { f, u: 1 }; }
  drawBook(); const m = $("#book"); m.classList.add("open"); m.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden";
  if (hasG && !reduce) gsap.fromTo(".mo-main > *", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.04, delay: 0.35, ease: "power3.out", clearProps: "transform,opacity" });
}
function closeBook() { const m = $("#book"); m.classList.remove("open"); m.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; }
function drawBook() {
  const b = t().book; const hold = B.mode === "hold"; const ds = slots();
  const unitBox = hold && sel ? `<div class="unit-pill"><span class="mono mut">${esc(t().mine.unit)}</span><b>${uName(sel.f, sel.u)}</b><span>${unitType(sel.f, sel.u)} · ${TYPES[unitType(sel.f, sel.u)].m2} m² · ${usd(unitPrice(sel.f, sel.u))}</span></div>` : "";
  $("#moCard").innerHTML = `<div class="mo-side">${pic((hold ? IMG.interior : IMG.lux).replace(/w=\d+/, "w=900"), "", "")}<span class="mono">${hold ? "US$2,000" : (es() ? "Sin costo" : "Free")}</span><h3>${esc(hold ? b.reserveTitle : b.title)}</h3><p>${esc(b.where)} · Av. Abraham Lincoln</p></div>
  <form class="mo-main" id="moForm" novalidate><button type="button" class="mo-x" data-close aria-label="close">×</button><h3>${esc(hold ? b.reserveTitle : b.title)}</h3>
  <div class="mo-tabs">${b.mode.map((x, i) => `<button type="button" data-mode="${i ? "hold" : "visit"}" class="${(i ? "hold" : "visit") === B.mode ? "on" : ""}">${esc(x)}</button>`).join("")}</div>
  ${unitBox}
  <span class="mo-lbl mono">${esc(b.day)}</span><div class="days">${ds.map((d) => `<button type="button" class="day${B.day && +B.day === +d ? " on" : ""}" data-day="${d.toISOString()}"><small>${fmtDay(d, { weekday: "short" })}</small><b>${d.getDate()}</b><small>${fmtDay(d, { month: "short" })}</small></button>`).join("")}</div>
  <span class="mo-lbl mono">${esc(b.time)}</span><div class="times">${TIMES.map((x, i) => `<button type="button" class="time${B.time === x ? " on" : ""}" data-time="${x}" ${B.day && takenT(B.day, i) ? "disabled" : ""}>${x}</button>`).join("")}</div>
  <div class="two"><div class="fl"><input id="b-name" placeholder=" " autocomplete="name"><label for="b-name">${esc(b.name)}</label></div><div class="fl"><input id="b-phone" placeholder=" " inputmode="tel"><label for="b-phone">${esc(b.phone)}</label></div></div>
  <div class="fl"><input id="b-email" placeholder=" " type="email"><label for="b-email">${esc(b.email)}</label></div>
  ${hold ? `<div class="card3d"><div class="cardx" id="cardx"><div class="cx-top"><i class="chip-c"></i><span class="cx-brand" id="cxBrand">ÓNIX</span></div><div class="cx-num" id="cxNum">•••• •••• •••• ••••</div><div class="cx-bot"><span id="cxName">${esc(b.holder)}</span><span id="cxExp">MM/AA</span></div></div></div>
  <div class="fl"><input id="b-card" placeholder=" " inputmode="numeric" maxlength="19"><label for="b-card">${esc(b.card)}</label></div><div class="two"><div class="fl"><input id="b-exp" placeholder=" " maxlength="5"><label for="b-exp">${esc(b.exp)}</label></div><div class="fl"><input id="b-cvc" placeholder=" " maxlength="4" inputmode="numeric"><label for="b-cvc">${esc(b.cvc)}</label></div></div>` : ""}
  <div class="mo-sum"><span class="mono mut">${hold ? esc(t().dev.planRows[0][0]) : esc(b.where)}</span><b>${hold ? "US$2,000" : (es() ? "Gratis" : "Free")}</b></div>
  <button type="button" class="btn btn-brass paybtn" id="payBtn"><i class="sp"></i><span>${esc(hold ? b.pay : b.confirm)}</span></button>
  <p class="mo-err" id="moErr"></p><p class="mo-sec">🔒 ${esc(b.secure)}</p></form>`;
}
function bookDone(rec) {
  const b = t().book;
  $(".mo-main").outerHTML = `<div class="mo-main mo-done"><button type="button" class="mo-x" data-close aria-label="close">×</button><div class="ok-ic"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h3>${esc(rec.kind ? t().contact.reqDone : b.ticket)}</h3><p>${esc(rec.kind ? t().contact.sent : b.done)}</p>${rec.kind ? quoteCard(rec) : bookCard(rec)}<div class="btns"><button type="button" class="btn btn-brass" data-home><span>${esc(t().nav.home)}</span><i class="arr">→</i></button><button type="button" class="btn btn-line" data-close><span>${esc(t().nav.close)}</span></button></div></div>`;
  if (rec.kind) { $(".mo-side h3").textContent = t().contact.req; $(".mo-side .mono").textContent = rec.code; $(".mo-side p").textContent = t().contact.addr; }
  if (hasG && !reduce) gsap.fromTo(".mo-done > *", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.06, ease: "power3.out", clearProps: "transform,opacity" });
}
function submitBook() {
  const b = t().book; const err = $("#moErr"); const hold = B.mode === "hold";
  const name = $("#b-name").value.trim(), phone = $("#b-phone").value.trim();
  $$(".mo-main .fl").forEach((x) => x.classList.remove("err"));
  if (!B.day || !B.time) { err.textContent = b.needSlot; return; }
  if (!name || phone.replace(/\D/g, "").length < 7) { err.textContent = b.need; if (!name) $("#b-name").parentNode.classList.add("err"); else $("#b-phone").parentNode.classList.add("err"); return; }
  if (hold && ($("#b-card").value.replace(/\D/g, "").length < 12 || $("#b-exp").value.length < 4 || $("#b-cvc").value.length < 3)) { err.textContent = b.needCard; return; }
  err.textContent = ""; const btn = $("#payBtn"); btn.classList.add("busy"); btn.disabled = true; $("span", btn).textContent = b.processing;
  setTimeout(() => {
    const [hh, mm] = B.time.split(":"); const when = new Date(B.day); when.setHours(+hh, +mm, 0, 0);
    bk = { mode: B.mode, unit: hold && sel ? { f: sel.f, u: sel.u } : null, when: when.toISOString(), time: B.time, name, phone, code: code() };
    store.set("co-booking", JSON.stringify(bk)); renderMine(); renderTower(); bookDone(bk);
  }, 1700);
}
function brandOf(n) { return /^4/.test(n) ? "VISA" : /^5[1-5]/.test(n) ? "MASTERCARD" : /^3[47]/.test(n) ? "AMEX" : "ÓNIX"; }

/* ================= navegación ================= */
let cur = null, curHash = (location.hash || "#inicio").slice(1), busy = false, ctx = null, menuOpen = false;
const route = () => { const [v, p] = (curHash || "inicio").split("/"); return v === "proyecto" ? { v, p } : { v: VIDS.includes(v) ? v : "inicio", p: null }; };
function go(h) { if (h === curHash && !menuOpen) { scrollTo({ top: 0, behavior: "smooth" }); return; } curHash = h; try { history.pushState(null, "", "#" + h); } catch (e) {} showView(true); }
function markNav() { const v = route().v; const id = v === "proyecto" ? "proyectos" : v; $$(".ml-a").forEach((a) => a.classList.toggle("cur", a.dataset.view === id)); }
function viewLabel(v) { return v === "proyecto" ? L(PROJECTS.find((p) => p.id === route().p) || PROJECTS[0])[0] : get("nav." + VIEWS.find((x) => x[0] === v)[1]); }
function showView(anim) {
  const { v, p } = route();
  if (!anim || !hasG || reduce || !cur) { swap(v, p, 0); if (menuOpen) closeMenu(true); return; }
  if (busy) return; busy = true;
  const lv = $("#louvers"); lv.classList.add("busy"); $("#lvLbl").textContent = viewLabel(v);
  const tl = gsap.timeline({ onComplete: () => { busy = false; lv.classList.remove("busy"); } });
  tl.set("#louvers i", { transformOrigin: "bottom" })
    .to("#louvers i", { scaleY: 1, duration: 0.6, stagger: { each: 0.05, from: "center" }, ease: "power3.inOut" })
    .fromTo("#lvLbl", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, "-=.25")
    .add(() => { if (menuOpen) closeMenu(true); swap(v, p, 0.15); })
    .to("#lvLbl", { opacity: 0, y: -30, duration: 0.35, ease: "power2.in" }, "+=.15")
    .set("#louvers i", { transformOrigin: "top" })
    .to("#louvers i", { scaleY: 0, duration: 0.65, stagger: { each: 0.05, from: "edges" }, ease: "power3.inOut" }, "-=.1");
}
function swap(v, p, delay) {
  if (ctx) { ctx.revert(); ctx = null; }
  if (v === "proyecto") renderPD(p);
  $$(".view").forEach((x) => x.classList.toggle("on", x.id === "v-" + v));
  window.scrollTo(0, 0); cur = v; markNav(); closeMine();
  $("#hudName").textContent = viewLabel(v); $("#hudSec").textContent = String(v === "proyecto" ? 2 : VIDS.indexOf(v) + 1).padStart(2, "0");
  document.title = "Ónix · " + viewLabel(v);
  enter(v, delay);
  onScroll();
}
function closeMenu(instant) {
  menuOpen = false; document.body.classList.remove("menu-open"); $("#menuBtn").setAttribute("aria-expanded", "false"); const M = $("#menu"); M.setAttribute("aria-hidden", "true");
  if (!hasG || instant) { M.classList.remove("open"); if (hasG) gsap.set(".menu-bg i", { scaleY: 0 }); return; }
  gsap.timeline({ onComplete: () => M.classList.remove("open") }).to(".menu-side", { opacity: 0, duration: 0.3 }).to(".ml-n", { yPercent: -110, duration: 0.45, stagger: 0.03, ease: "power3.in" }, 0).set(".menu-bg i", { transformOrigin: "bottom" }).to(".menu-bg i", { scaleY: 0, duration: 0.6, stagger: 0.06, ease: "power3.inOut" }, 0.25);
}
function openMenu() {
  menuOpen = true; document.body.classList.add("menu-open"); $("#menuBtn").setAttribute("aria-expanded", "true"); const M = $("#menu"); M.classList.add("open"); M.setAttribute("aria-hidden", "false");
  if (!hasG) { $$(".ml-n").forEach((x) => (x.style.transform = "none")); $(".menu-side").style.opacity = 1; $$(".menu-bg i").forEach((x) => (x.style.transform = "none")); return; }
  gsap.timeline().set(".menu-bg i", { transformOrigin: "top" }).fromTo(".menu-bg i", { scaleY: 0 }, { scaleY: 1, duration: 0.7, stagger: 0.07, ease: "power3.inOut" }).fromTo(".ml-n", { yPercent: 110 }, { yPercent: 0, duration: 0.8, stagger: 0.06, ease: "power4.out" }, "-=.3").fromTo(".menu-side", { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.8, ease: "power3.out" }, "-=.7");
}

/* ================= animaciones por vista ================= */
let firstLoad = true;
function charIn(el, d = 0, st) { const o = { yPercent: 115, rotate: 7 }; const to = { yPercent: 0, rotate: 0, duration: 1.1, stagger: 0.022, ease: "power4.out", delay: d }; if (st) to.scrollTrigger = { trigger: el, start: "top 85%" }; return gsap.fromTo($$(".ch", el), o, to); }
function enter(v, delay) {
  if (!hasG) return;
  const V = $("#v-" + v); const d = firstLoad ? 99 : delay; // primer load: espera al loader
  ctx = gsap.context(() => {
    if (reduce) return;
    if (v !== "inicio") {
      $$(".page-head .chars, .pd-hero .chars", V).forEach((el) => charIn(el, d + 0.1));
      gsap.fromTo($$(".ph-in", V), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.08, delay: d + 0.35, ease: "power3.out", clearProps: "transform" });
    }
    $$(".chars", V).forEach((el) => { if (!el.closest(".page-head,.pd-hero,.hero")) charIn(el, 0, true); });
    $$(".rv", V).forEach((el) => gsap.fromTo(el, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: "power3.out", clearProps: "transform", scrollTrigger: { trigger: el, start: "top 90%" } }));
    if (v === "inicio") homeFx(V, firstLoad ? null : delay);
    if (v === "proyectos") gsap.fromTo($$(".wc", V), { y: 80, opacity: 0, clipPath: "inset(20% 0 0 0)" }, { y: 0, opacity: 1, clipPath: "inset(0% 0 0 0)", duration: 1.2, stagger: 0.1, delay: d + 0.4, ease: "power3.out", clearProps: "transform,clipPath" });
    if (v === "proyecto") pdFx(V);
    if (v === "torre") gsap.fromTo($$(".u", V), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.5, stagger: { each: 0.006, from: "end" }, delay: d + 0.4, ease: "back.out(2)", clearProps: "transform,opacity" });
    if (v === "servicios") { const pth = $("#procPath"); gsap.fromTo(pth, { strokeDasharray: 1000, strokeDashoffset: 1000 }, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: ".proc", start: "top 75%", end: "bottom 70%", scrub: 1 } }); }
    if (v === "estudio") { $$(".sc img", V).forEach((im) => gsap.fromTo(im, { yPercent: -10 }, { yPercent: 0, ease: "none", scrollTrigger: { trigger: im.parentNode, start: "top bottom", end: "bottom top", scrub: true } })); }
    if (v === "contacto") requestAnimationFrame(() => $$(".seg").forEach(segInd));
  }, V);
}
function homeFx(V, delay) {
  const quick = delay != null;
  const dl = quick ? delay : 0;
  const tl = gsap.timeline({ delay: dl, paused: !quick && !skipHero });
  heroTl = tl;
  const draw = $$(".bp-draw path, .bp-dim path", V);
  draw.forEach((p) => { const l = p.getTotalLength ? Math.ceil(p.getTotalLength()) : 1500; p.style.strokeDasharray = l; p.style.strokeDashoffset = l; });
  $("#blueprint").classList.remove("faded");
  tl.set(".hero-slides", { clipPath: "inset(100% 0 0 0)" })
    .fromTo(".bp-grid", { opacity: 0 }, { opacity: 1, duration: 0.6 })
    .to(draw, { strokeDashoffset: 0, duration: quick ? 1.2 : 2, stagger: quick ? 0.04 : 0.09, ease: "power2.inOut" }, 0.1)
    .fromTo(".blueprint text", { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.05 }, quick ? 0.8 : 1.4)
    .to(".hero-slides", { clipPath: "inset(0% 0 0 0)", duration: 1.6, ease: "expo.inOut", onStart: () => $("#blueprint").classList.add("faded") }, quick ? 1 : 1.9)
    .add(() => charIn($(".h-title", V)), quick ? 1.5 : 2.5)
    .fromTo($$(".h-in", V), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.1, ease: "power3.out", clearProps: "transform" }, quick ? 1.8 : 2.8);
  gsap.set($$(".h-title .ch", V), { yPercent: 115 });
  gsap.set($$(".h-in", V), { opacity: 0 });
  // manifiesto
  const ws = $$("#manifesto .w");
  ScrollTrigger.create({ trigger: "#manifesto", start: "top 80%", end: "bottom 45%", scrub: true, onUpdate: (s) => { const n = Math.round(s.progress * ws.length); ws.forEach((w, i) => w.classList.toggle("lit", i < n)); } });
  // stats
  $$(".st", V).forEach((st, i) => {
    const c = $(".cnt", st); const n = +c.dataset.n; const o = { v: 0 }; c.textContent = "0";
    gsap.to(o, { v: n, duration: 2, delay: i * 0.12, ease: "power2.out", onUpdate: () => (c.textContent = Math.round(o.v)), scrollTrigger: { trigger: st, start: "top 88%" } });
    gsap.fromTo($(".dim", st), { scaleX: 0 }, { scaleX: 1, duration: 1.2, delay: i * 0.12, ease: "power3.inOut", scrollTrigger: { trigger: st, start: "top 88%" } });
  });
  gsap.fromTo($$(".fc", V), { x: 120, opacity: 0 }, { x: 0, opacity: 1, duration: 1.2, stagger: 0.08, ease: "power3.out", clearProps: "transform", scrollTrigger: { trigger: "#featTrack", start: "top 85%" } });
  const rects = $$("#tbFloors rect");
  ScrollTrigger.create({ trigger: ".tower-band", start: "top 70%", end: "bottom 60%", scrub: true, onUpdate: (s) => { const n = Math.round(s.progress * rects.length); rects.forEach((r, i) => r.classList.toggle("lit", i < n)); } });
  gsap.fromTo(".tb-img img", { yPercent: -8, scale: 1.15 }, { yPercent: 8, scale: 1.05, ease: "none", scrollTrigger: { trigger: ".tower-band", start: "top bottom", end: "bottom top", scrub: true } });
  gsap.to("#qText .w", { opacity: 1, stagger: 0.05, ease: "none", scrollTrigger: { trigger: "#qText", start: "top 80%", end: "bottom 50%", scrub: true } });
  gsap.fromTo(".q-img img", { scale: 1.25 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ".quote", start: "top bottom", end: "bottom top", scrub: true } });
  gsap.fromTo(".cta-img img", { yPercent: -10 }, { yPercent: 10, ease: "none", scrollTrigger: { trigger: ".cta-big", start: "top bottom", end: "bottom top", scrub: true } });
  gsap.to(".hero-media", { yPercent: 18, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
  gsap.to(".hero-copy", { yPercent: -30, opacity: 0.2, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
  if (skipHero) tl.progress(1);
  if ($("#mineHome") && !$("#mineHome").hidden) gsap.fromTo("#mineHome .mh", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.1, delay: dl + 0.3, ease: "power3.out", clearProps: "transform" });
}
let heroTl = null, skipHero = false;
function pdFx(V) {
  gsap.fromTo($(".pd-bg img", V), { scale: 1.3 }, { scale: 1, duration: 2.2, ease: "expo.out" });
  gsap.to($(".pd-bg img", V), { yPercent: 12, ease: "none", scrollTrigger: { trigger: ".pd-hero", start: "top top", end: "bottom top", scrub: true } });
  $$(".pd-tl .bar i", V).forEach((b, i) => gsap.fromTo(b, { scaleX: 0 }, { scaleX: 1, duration: 1, delay: i * 0.15, ease: "power3.inOut", scrollTrigger: { trigger: ".pd-tl", start: "top 85%" } }));
  const ba = $("#ba"); if (ba) gsap.fromTo(ba, { "--x": "90%" }, { "--x": "50%", duration: 1.6, ease: "power3.inOut", scrollTrigger: { trigger: ba, start: "top 75%" } });
  gsap.fromTo($(".pd-next img", V), { yPercent: -10 }, { yPercent: 10, ease: "none", scrollTrigger: { trigger: ".pd-next", start: "top bottom", end: "bottom top", scrub: true } });
}

/* ================= hero slideshow ================= */
let slide = 0, slideTimer = null;
function setSlideMeta() { const p = SLIDES[slide]; $("#slideIdx").textContent = `0${slide + 1} / 0${SLIDES.length}`; $("#slideName").textContent = L(p)[0]; $("#slideLoc").textContent = p.loc + " · " + p.year; $$("#slideBars button").forEach((b, i) => { const bar = $("i", b); if (hasG) { gsap.killTweensOf(bar); if (i < slide) gsap.set(bar, { width: "100%" }); else if (i > slide) gsap.set(bar, { width: 0 }); else gsap.fromTo(bar, { width: 0 }, { width: "100%", duration: 6.5, ease: "none" }); } }); }
function goSlide(i) { slide = (i + SLIDES.length) % SLIDES.length; $$("#heroSlides .hs").forEach((s, k) => s.classList.toggle("on", k === slide)); setSlideMeta(); clearInterval(slideTimer); slideTimer = setInterval(() => goSlide(slide + 1), 6500); }

/* ================= interacción global ================= */
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href^='#']");
  if (a) { e.preventDefault(); const h = a.getAttribute("href").slice(1); if (a.hasAttribute("data-unit-open")) { closeMine(); if (bk && bk.unit) sel = { ...bk.unit }; } go(h || "inicio"); return; }
  const t0 = e.target;
  if (t0.closest("#payBtn")) { if (!$("#payBtn").disabled) submitBook(); return; }
  if (t0.closest("#cfSend")) { sendQuote(); return; }
  const bb = t0.closest("[data-book]"); if (bb && !bb.disabled) { openBook(bb.dataset.book); return; }
  if (t0.closest("[data-close]")) { closeBook(); return; }
  if (t0.closest("[data-home]")) { closeBook(); go("inicio"); setTimeout(() => { const mh = $("#mineHome"); if (mh && !mh.hidden) { scrollTo({ top: mh.getBoundingClientRect().top + scrollY - 120, behavior: "smooth" }); $$(".mh", mh).forEach((x) => { x.classList.remove("pulse"); void x.offsetWidth; x.classList.add("pulse"); }); } }, hasG ? 2000 : 100); return; }
  if (t0.closest("[data-open-mine]") || t0.closest("#fab")) { openMine(); return; }
  if (t0.closest("[data-close-mine]") || t0 === $("#drawer")) { closeMine(); return; }
  const cn = t0.closest("[data-cancel]"); if (cn) { if (cn.dataset.cancel === "bk") { bk = null; store.del("co-booking"); renderTower(); } else { qt = null; store.del("co-quote"); } renderMine(); toast(es() ? "Cancelado" : "Cancelled"); if (!bk && !qt) closeMine(); return; }
  const md = t0.closest("[data-mode]"); if (md) { const keep = { n: $("#b-name").value, p: $("#b-phone").value, e: $("#b-email").value }; B.mode = md.dataset.mode; if (B.mode === "hold" && (!sel || statusOf(sel.f, sel.u) !== "free")) { sel = { f: 12, u: 1 }; for (let f = 12; f > 1 && statusOf(sel.f, sel.u) !== "free"; f--) sel = { f, u: 1 }; } drawBook(); $("#b-name").value = keep.n; $("#b-phone").value = keep.p; $("#b-email").value = keep.e; return; }
  const dy = t0.closest("[data-day]"); if (dy) { B.day = new Date(dy.dataset.day); if (B.time && takenT(B.day, TIMES.indexOf(B.time))) B.time = null; $$(".day").forEach((x) => x.classList.toggle("on", x === dy)); $$(".time").forEach((x, i) => { x.disabled = takenT(B.day, i); x.classList.toggle("on", x.dataset.time === B.time); }); return; }
  const tm = t0.closest("[data-time]"); if (tm) { B.time = tm.dataset.time; $$(".time").forEach((x) => x.classList.toggle("on", x === tm)); return; }
  const ct = t0.closest("[data-cat]"); if (ct && ct.classList.contains("fbtn")) { workCat = ct.dataset.cat; $$(".fbtn").forEach((x) => x.classList.toggle("on", x === ct)); filterWork(); return; }
  const un = t0.closest(".u"); if (un) { sel = { f: +un.dataset.f, u: +un.dataset.u }; $$(".u").forEach((x) => x.classList.toggle("sel", x === un)); renderPanel(); if (innerWidth <= 1080) $("#twPanel").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  const sl = t0.closest("[data-slide]"); if (sl) { goSlide(+sl.dataset.slide); return; }
  const lb = t0.closest("[data-lb]"); if (lb) { openLb(+lb.dataset.lb); return; }
  if (t0.closest("[data-lbx]") || t0 === $("#lb")) { $("#lb").classList.remove("open"); return; }
  const ls = t0.closest("[data-lbs]"); if (ls) { openLb(lbI + +ls.dataset.lbs); return; }
  const kd = t0.closest("[data-kind]"); if (kd) { calcS.kind = kd.dataset.kind; $$("[data-kind]").forEach((x) => x.classList.toggle("on", x === kd)); calc(); return; }
  const fn = t0.closest("[data-finish]"); if (fn) { calcS.finish = fn.dataset.finish; $$("[data-finish]").forEach((x) => x.classList.toggle("on", x === fn)); calc(); return; }
  const ex = t0.closest("[data-ex]"); if (ex) { const k = ex.dataset.ex; calcS.ex.has(k) ? calcS.ex.delete(k) : calcS.ex.add(k); ex.classList.toggle("on"); calc(); return; }
});
function filterWork() {
  const cards = $$(".wc"); const show = cards.filter((c) => workCat === "all" || c.dataset.cat === workCat);
  if (!hasG) { cards.forEach((c) => c.classList.toggle("gone", !show.includes(c))); return; }
  gsap.to(cards, { opacity: 0, y: 30, duration: 0.3, ease: "power2.in", onComplete: () => { cards.forEach((c) => c.classList.toggle("gone", !show.includes(c))); gsap.fromTo(show, { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, ease: "power3.out", clearProps: "transform" }); ScrollTrigger.refresh(); } });
}
let lbI = 0;
function openLb(i) { lbI = (i + pdGal.length) % pdGal.length; $("#lbImg").innerHTML = pic(pdGal[lbI].replace(/w=\d+/, "w=2000"), "", ""); $("#lbC").textContent = `${String(lbI + 1).padStart(2, "0")} / ${String(pdGal.length).padStart(2, "0")}`; $("#lb").classList.add("open"); if (hasG) gsap.fromTo("#lbImg img", { scale: 0.92, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: "power3.out" }); }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeBook(); closeMine(); $("#lb").classList.remove("open"); if (menuOpen) closeMenu(); } if ($("#lb").classList.contains("open")) { if (e.key === "ArrowRight") openLb(lbI + 1); if (e.key === "ArrowLeft") openLb(lbI - 1); } });
$("#book").addEventListener("submit", (e) => e.preventDefault());
$("#book").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("input")) { e.preventDefault(); submitBook(); } });
$("#book").addEventListener("input", (e) => {
  const id = e.target.id;
  if (id === "b-card") { let v = e.target.value.replace(/\D/g, "").slice(0, 16); e.target.value = v.replace(/(.{4})/g, "$1 ").trim(); $("#cxNum").textContent = (v + "•".repeat(16 - v.length)).replace(/(.{4})/g, "$1 ").trim(); $("#cxBrand").textContent = brandOf(v); }
  if (id === "b-exp") { let v = e.target.value.replace(/\D/g, "").slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2); e.target.value = v; $("#cxExp").textContent = v || "MM/AA"; }
  if (id === "b-name" && $("#cxName")) $("#cxName").textContent = e.target.value || t().book.holder;
});
$("#book").addEventListener("pointermove", (e) => { const c = $("#cardx"); if (!c) return; const r = c.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; if (x < -0.3 || x > 1.3 || y < -0.5 || y > 1.5) { c.style.transform = ""; return; } c.style.transform = `rotateY(${(x - 0.5) * 18}deg) rotateX(${(0.5 - y) * 14}deg)`; c.style.setProperty("--hx", x * 100 + "%"); c.style.setProperty("--hy", y * 100 + "%"); });
$("#cArea").addEventListener("input", calc);
function sendQuote() {
  const c = t().contact; const name = $("#f-name").value.trim(), phone = $("#f-phone").value.trim();
  $$("#cForm .fl").forEach((x) => x.classList.remove("err"));
  if (!name || phone.replace(/\D/g, "").length < 7) { toast(c.need); (!name ? $("#f-name") : $("#f-phone")).parentNode.classList.add("err"); return; }
  const v = calcVal(); qt = { kind: calcS.kind, area: calcS.area, finish: calcS.finish, ex: [...calcS.ex], tot: v.tot, months: v.months, name, phone, code: code() };
  store.set("co-quote", JSON.stringify(qt)); renderMine(); $("#cForm").reset();
  B.mode = "visit"; drawBook(); bookDone(qt); const m = $("#book"); m.classList.add("open"); m.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden";
}
$("#cForm").addEventListener("submit", (e) => { e.preventDefault(); sendQuote(); });
$("#menuBtn").addEventListener("click", () => (menuOpen ? closeMenu() : openMenu()));
$("#menuList").addEventListener("mouseover", (e) => { const a = e.target.closest(".ml-a"); if (!a) return; $$("#menuPrev img").forEach((im) => im.classList.toggle("on", im.dataset.i === a.dataset.i)); });
$("#langBtn").addEventListener("click", () => { lang = lang === "es" ? "en" : "es"; store.set("co-lang", lang); renderAllText(); });
$("#themeBtn").addEventListener("click", (e) => {
  const nt = root.dataset.theme === "dark" ? "light" : "dark"; const apply = () => { root.dataset.theme = nt; store.set("co-theme", nt); };
  if (!document.startViewTransition || reduce) { apply(); return; }
  const x = e.clientX || innerWidth - 60, y = e.clientY || 30; const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  try { const vt = document.startViewTransition(apply); vt.ready.then(() => root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 800, easing: "cubic-bezier(.7,0,.2,1)", pseudoElement: "::view-transition-new(root)" })).catch(() => {}); } catch (er) { apply(); }
});
addEventListener("popstate", () => { curHash = (location.hash || "#inicio").slice(1); showView(true); });

/* drag del slider destacado + antes/después */
const feat = { x: 0, tx: 0, down: false, sx: 0, st: 0, moved: 0 };
const track = $("#featTrack");
track.addEventListener("pointerdown", (e) => { feat.down = true; feat.sx = e.clientX; feat.st = feat.tx; feat.moved = 0; track.classList.add("dragging"); });
addEventListener("pointermove", (e) => { if (feat.down) { const dx = e.clientX - feat.sx; feat.moved = Math.max(feat.moved, Math.abs(dx)); feat.tx = feat.st + dx * 1.2; clampFeat(); } if (ba.down) moveBa(e); });
addEventListener("pointerup", () => { feat.down = false; track.classList.remove("dragging"); ba.down = false; });
track.addEventListener("click", (e) => { if (feat.moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
track.addEventListener("dragstart", (e) => e.preventDefault());
function clampFeat() { const rail = $("#featRail"); const max = Math.max(0, rail.scrollWidth - track.clientWidth + 60); feat.tx = Math.min(0, Math.max(-max, feat.tx)); }
const ba = { down: false };
function moveBa(e) { const el = $("#ba"); if (!el) return; const r = el.getBoundingClientRect(); const p = Math.min(98, Math.max(2, ((e.clientX - r.left) / r.width) * 100)); if (hasG) gsap.killTweensOf(el); el.style.setProperty("--x", p + "%"); }
document.addEventListener("pointerdown", (e) => { if (e.target.closest("#ba")) { ba.down = true; moveBa(e); } });

/* cursor, imán, follow de servicios */
const cur0 = { x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2 };
const dot = $(".c-dot"), ring = $(".c-ring"), cursorEl = $(".cursor"), follow = $("#svcFollow");
const fol = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener("pointermove", (e) => {
  cur0.x = e.clientX; cur0.y = e.clientY; fol.tx = e.clientX; fol.ty = e.clientY;
  const tg = e.target.closest ? e.target : null; if (!tg) return;
  const c = tg.closest("[data-cursor]");
  cursorEl.classList.toggle("big", !!c); $("#cLbl").textContent = c ? (c.dataset.cursor === "drag" ? t().home.drag : (es() ? "Ver" : "View")) : "";
  cursorEl.classList.toggle("hov", !c && !!tg.closest("a,button,input,textarea,.u"));
  const sv = tg.closest("#svcList .sv, #svcTeaser .sv");
  if (sv && innerWidth > 760) { follow.classList.add("on"); $$("img", follow).forEach((im) => im.classList.toggle("on", im.dataset.i === sv.dataset.svc)); } else follow.classList.remove("on");
});
document.addEventListener("pointermove", (e) => { const m = e.target.closest && e.target.closest(".mag"); $$(".mag.magon").forEach((x) => { if (x !== m) { x.classList.remove("magon"); x.style.transform = ""; } }); if (!m || innerWidth < 900) return; const r = m.getBoundingClientRect(); m.classList.add("magon"); m.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px,${(e.clientY - r.top - r.height / 2) * 0.28}px)`; });

/* scroll: header, hud */
let lastY = 0;
function onScroll() {
  const y = scrollY; const top = $("#top");
  top.classList.toggle("solid", y > 40); top.classList.toggle("hide", y > 500 && y > lastY && !menuOpen); lastY = y;
  const darkHero = (cur === "inicio" || cur === "proyecto") && y < innerHeight * 0.85; top.classList.toggle("on-dark", darkHero);
  const h = document.documentElement.scrollHeight - innerHeight; $("#hudBar").style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
  $(".hud").classList.toggle("dim", darkHero && y < 80);
}
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", () => { clampFeat(); $$(".seg").forEach(segInd); });

function loop() {
  cur0.rx += (cur0.x - cur0.rx) * 0.18; cur0.ry += (cur0.y - cur0.ry) * 0.18;
  dot.style.transform = `translate(${cur0.x}px,${cur0.y}px)`; ring.style.transform = `translate(${cur0.rx}px,${cur0.ry}px)`;
  feat.x += (feat.tx - feat.x) * 0.1; const rail = $("#featRail"); if (cur === "inicio") { rail.style.transform = `translate3d(${feat.x}px,0,0)`; const max = Math.max(1, rail.scrollWidth - track.clientWidth + 60); $("#featProg").style.width = Math.min(100, 12 + (-feat.x / max) * 88) + "%"; }
  fol.x += (fol.tx - fol.x) * 0.12; fol.y += (fol.ty - fol.y) * 0.12; follow.style.left = fol.x - 150 + "px"; follow.style.top = fol.y - 190 + "px";
  requestAnimationFrame(loop);
}

/* ================= idioma ================= */
function renderAllText() {
  applyText(); renderMenu(); renderHome(); renderWork(); renderTower(); renderSvc(); renderStudio(); renderCalc();
  if (cur) { const { v, p } = route(); if (ctx) { ctx.revert(); ctx = null; } if (v === "proyecto") renderPD(p); $("#hudName").textContent = viewLabel(v); document.title = "Ónix · " + viewLabel(v); skipHero = true; enter(v, 0); skipHero = false; if (hasG) ScrollTrigger.refresh(); }
  if ($("#book").classList.contains("open") && $("#moForm")) drawBook();
}

/* ================= arranque ================= */
renderAllText();
showView(false);
goSlide(0);
requestAnimationFrame(loop);
setInterval(() => { if (bk) { $("#fabSub").textContent = bk.code + " · " + countdown(bk); } }, 30000);
(function boot() {
  const ld = $("#loader");
  const finish = () => { firstLoad = false; if (cur === "inicio" && heroTl) heroTl.play(); else if (hasG) { if (ctx) ctx.revert(); enter(cur, 0); } };
  if (!hasG || reduce) { ld.style.display = "none"; firstLoad = false; if (heroTl) heroTl.progress(1); return; }
  const o = { v: 0 }; const bar = $(".ld-bar i");
  gsap.to(o, { v: 100, duration: 1.8, ease: "power2.inOut", onUpdate: () => { $("#ldPct").textContent = String(Math.round(o.v)).padStart(3, "0"); bar.style.width = o.v + "%"; }, onComplete: () => { ld.classList.add("out"); setTimeout(() => (ld.style.display = "none"), 1000); setTimeout(finish, 350); } });
})();
})();
