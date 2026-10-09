/* ---------- State ---------- */
const VIEWS = [["inicio", "home", "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"], ["proyectos", "work", "M3 3h7.5v9H3zM13.5 3H21v5.5h-7.5zM13.5 11.5H21V21h-7.5zM3 15h7.5v6H3z"], ["precios", "pricing", "M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM8 7.5h.01"], ["proceso", "process", "M4 6h16M4 12h10M4 18h6"], ["contacto", "contact", "M4 18.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8z"]];
let current = "inicio", payMode = "once", filter = "all", calc = { base: "crm", extras: ["bot"], term: 12 };
let quote = (() => { try { return JSON.parse(store.get("sp-quote")); } catch (e) { return null; } })();
let tt; const toast = (m) => { const e = $("#toast"); e.textContent = m; e.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => e.classList.remove("on"), 3400); };
const chars = (lines) => lines.map((l, i) => `<span class="ln${i === lines.length - 1 ? " accent" : ""}">${l.split(" ").map((w) => `<span class="wd">${[...w].map((c) => `<span class="ch">${c}</span>`).join("")}</span>`).join(" ")}</span>`).join("");
const svg = (d, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}><path d="${d}"/></svg>`;
const PRIVATE = [];
const CAT_ICON = { web: "M3 4h18v16H3zM3 9h18", shop: "M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6", crm: "M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM4 10h16M9 2v4M15 2v4", system: "M4 5h16v10H4zM8 19h8M12 15v4" };

/* ---------- Star mark ---------- */
const STAR = (() => { const cx = 50, cy = 53, R = 44, r = 18.5, pt = (i, rad) => { const a = -Math.PI / 2 + (i * Math.PI) / 5; return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad].map((v) => v.toFixed(1)).join(" "); }; const o = (k) => pt(k * 2, R), n = (k) => pt(k * 2 + 1, r);
  return { a: `M${o(0)} L${n(4)} L${o(4)} L${n(3)} L${o(3)} L${n(2)}`, b: `M${o(0)} L${n(0)} L${o(1)} L${n(1)} L${o(2)} L${n(2)}` }; })();
function paintStars() { $$(".sa").forEach((p) => p.setAttribute("d", STAR.a)); $$(".sb").forEach((p) => p.setAttribute("d", STAR.b)); $$(".ls-a").forEach((p) => p.setAttribute("d", STAR.a)); $$(".ls-b").forEach((p) => p.setAttribute("d", STAR.b)); }

/* ---------- Mock previews ---------- */
const mock = (p, big) => `<div class="mock${big ? " big" : ""}" style="--a:${p.pal[0]};--b:${p.pal[1]};--c:${p.pal[2]}"><div class="mk-bar"><i></i><i></i><i></i><span>${p.demo}.steliant</span></div><div class="mk-view"><div class="mk-scroll"><div class="mk-nav"><b></b><span></span><span></span><span></span><em></em></div><div class="mk-hero"><div><i></i><i></i><i class="s"></i><em></em></div><span class="mk-shape"></span></div><div class="mk-cards"><i></i><i></i><i></i></div><div class="mk-rows"><i></i><i></i><i></i></div><div class="mk-hero alt"><div><i></i><i class="s"></i></div></div><div class="mk-cards"><i></i><i></i><i></i></div></div></div></div>`;

/* ---------- Static render ---------- */
function renderStatic() {
  document.documentElement.lang = lang; $("#langLbl").textContent = lang === "es" ? "EN" : "ES";
  $$("[data-t]").forEach((el) => { const v = get(el.dataset.t); if (typeof v === "string") el.textContent = v; });
  $$("[data-split]").forEach((el) => (el.innerHTML = chars(get(el.dataset.split))));
  $("#rNav").innerHTML = VIEWS.map(([id, k, d], i) => `<a href="#${id}" data-view="${id}" class="rn">${svg(d)}<span>${t().nav[k]}</span><em>0${i + 1}</em></a>`).join("") + `<i class="rn-ink"></i>`;
  $("#mNav").innerHTML = VIEWS.map(([id, k], i) => `<a href="#${id}" data-view="${id}"><em>0${i + 1}</em>${t().nav[k]}</a>`).join("");
  $("#fNav").innerHTML = VIEWS.map(([id, k]) => `<a href="#${id}">${t().nav[k]}</a>`).join("");
  $("#fGiant").innerHTML = "Steliant".split("").map((c) => `<span>${c}</span>`).join("");
  $("#stats").innerHTML = t().home.stats.map(([v, s, l]) => `<div><strong data-count="${v}" data-suffix="${s}">${v}${s}</strong><span>${l}</span></div>`).join("");
  $("#orbit").innerHTML = PROJECTS.map((p, i) => `<button type="button" class="chip" data-open="${p.id}" style="--a:${p.pal[0]};--b:${p.pal[1]}"><i></i>${p.name.replace("Steliant ", "")}</button>`).join("");
  $("#feat").innerHTML = ["ecommerce", "reservas", "tour"].map((id, i) => { const p = PROJECTS.find((x) => x.id === id); return `<article class="fc fc${i}" data-open="${p.id}" data-cursor="${t().work.details}">${mock(p, true)}<div class="fc-info"><span class="cat">${t().work.filters[p.cat]}</span><h3>${p.name}</h3><p>${P(p)[0]}</p><span class="fc-price">${t().work.from} ${money(PKGS[p.pkg].once)} ${t().work.or} ${money(PKGS[p.pkg].monthly)}${t().work.per}</span></div></article>`; }).join("");
  $("#whyGrid").innerHTML = t().home.why.map(([a, b], i) => `<div class="why-c" data-tilt><span class="why-n">0${i + 1}</span><b>${a}</b><p>${b}</p></div>`).join("");
  $("#filters").innerHTML = `<span class="f-ink"></span>` + Object.entries(t().work.filters).map(([k, v]) => `<button type="button" data-filter="${k}" class="${filter === k ? "on" : ""}">${v}<em>${k === "all" ? PROJECTS.length : PROJECTS.filter((p) => p.cat === k).length}</em></button>`).join("");
  renderGrid(false); renderPricing(); renderCalc(); renderProcess(); renderContact(); renderQuoteHome(); movePill(); markActive(); paintStars();
}
function card(p, i) {
  const W = t().work, priv = PRIVATE.includes(p.repo);
  return `<article class="pc" data-id="${p.id}" style="--i:${i}" data-tilt><div class="pc-mock" data-open="${p.id}" data-cursor="${W.details}">${mock(p)}</div>
    <div class="pc-body"><div class="pc-top"><span class="cat">${svg(CAT_ICON[p.cat])}${W.filters[p.cat]}</span><span class="br ${p.branch ? "on" : ""}" title="${p.branch ? W.branchOn : W.branchOff}">${svg("M6 3v12M18 9a3 3 0 1 0 0-.01M6 21a3 3 0 1 0 0-.01M18 9c0 6-12 3-12 9")}${p.branch ? "steliant-exhibicion" : "portafolio"}</span></div>
      <h3>${p.name}</h3><p>${P(p)[0]}</p>
      <div class="pc-stack">${p.stack.map((s) => `<span>${s}</span>`).join("")}</div>
      <div class="pc-price"><small>${W.from}</small><b>${money(PKGS[p.pkg].once)}</b><small>${W.or} ${money(PKGS[p.pkg].monthly)}${W.per}</small></div>
      <div class="pc-act">${demoUrl(p) ? `<a class="btn btn-main sm" href="${demoUrl(p)}" target="_blank" rel="noopener">${W.demo} ↗</a>` : `<span class="btn btn-line sm soon">${lang === "en" ? "Demo soon" : "Demo pronto"}</span>`}<a class="btn btn-line sm gh" href="${ghUrl(p)}" target="_blank" rel="noopener" title="${priv ? W.priv : ghUrl(p)}">${svg("M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21")}${W.code}${priv ? " 🔒" : ""}</a><button type="button" class="btn btn-ghost sm" data-open="${p.id}">${W.details}</button></div></div></article>`;
}
function renderGrid(anim = true) {
  const list = PROJECTS.filter((p) => filter === "all" || p.cat === filter), g = $("#grid");
  const go = () => { g.innerHTML = list.map(card).join(""); if (anim && hasG && !reduce) gsap.fromTo(".pc", { y: 60, opacity: 0, rotateX: 12 }, { y: 0, opacity: 1, rotateX: 0, stagger: 0.07, duration: 0.9, ease: "expo.out", clearProps: "transform" }); };
  if (anim && hasG && !reduce && g.children.length) gsap.to(".pc", { y: -20, opacity: 0, scale: 0.96, stagger: 0.02, duration: 0.3, ease: "power2.in", onComplete: go }); else go();
}
function moveInk(sel, inkSel, pad = 4) { const on = $(sel), ink = $(inkSel); if (!on || !ink) return; ink.style.width = on.offsetWidth + "px"; ink.style.transform = `translateX(${on.offsetLeft - pad}px)`; }
function movePill() { moveInk("#filters .on", "#filters .f-ink"); moveInk("#payTog .on", "#payTog .pt-ink"); }
document.addEventListener("click", (e) => { const f = e.target.closest("[data-filter]"); if (!f) return; filter = f.dataset.filter; $$("[data-filter]").forEach((b) => b.classList.toggle("on", b === f)); movePill(); renderGrid(); });

/* ---------- Drawer ---------- */
function openDrawer(id) {
  const p = PROJECTS.find((x) => x.id === id), W = t().work, [desc, feats] = P(p), priv = PRIVATE.includes(p.repo);
  $("#drPanel").innerHTML = `<button type="button" class="x" data-close aria-label="Cerrar">✕</button>${mock(p, true)}
    <div class="dr-body"><span class="cat">${svg(CAT_ICON[p.cat])}${W.filters[p.cat]}</span><h2>${p.name}</h2><p>${desc}</p>
      <h4>${W.features}</h4><ul>${feats.map((f) => `<li>${svg("M5 12.5l4.5 4.5L19 7.5")}${f}</li>`).join("")}</ul>
      <h4>${W.stack}</h4><div class="pc-stack">${p.stack.concat(["ES/EN", "Light/Dark", "Responsive"]).map((s) => `<span>${s}</span>`).join("")}</div>
      <div class="dr-repo"><code>${ghUrl(p).replace("https://", "")}</code><small>${p.branch ? W.branchOn : W.branchOff}${priv ? " · " + W.priv : ""}</small></div>
      <div class="dr-price"><div><small>${t().pricing.once}</small><b>${money(PKGS[p.pkg].once)}</b></div><div><small>${t().pricing.monthly}</small><b>${money(PKGS[p.pkg].monthly)}<em>${W.per}</em></b></div></div>
      <div class="pc-act">${demoUrl(p) ? `<a class="btn btn-main" href="${demoUrl(p)}" target="_blank" rel="noopener">${W.demo} ↗</a>` : ""}<a class="btn btn-line" href="${ghUrl(p)}" target="_blank" rel="noopener">${W.code}</a><a class="btn btn-ghost" href="#precios" data-goto="calc" data-base="${p.pkg}">${t().nav.quote}</a></div></div>`;
  $("#drawer").classList.add("on"); document.body.classList.add("lock");
  if (hasG && !reduce) { gsap.fromTo("#drPanel", { xPercent: 100 }, { xPercent: 0, duration: 0.9, ease: "expo.out" }); gsap.from("#drPanel .mock", { scale: 0.9, opacity: 0, duration: 1, ease: "expo.out", delay: 0.2 }); gsap.from(".dr-body > *", { y: 24, opacity: 0, stagger: 0.04, duration: 0.7, ease: "expo.out", delay: 0.3 }); }
}
function closeDrawer() { const d = $("#drawer"); if (!d.classList.contains("on")) return; const done = () => { d.classList.remove("on"); document.body.classList.remove("lock"); }; hasG && !reduce ? gsap.to("#drPanel", { xPercent: 100, duration: 0.5, ease: "power3.in", onComplete: done }) : done(); }
document.addEventListener("click", (e) => { const o = e.target.closest("[data-open]"); if (o && !e.target.closest("a")) { e.preventDefault(); openDrawer(o.dataset.open); return; } if (e.target.closest("[data-close]")) closeDrawer(); });

/* ---------- Pricing ---------- */
function renderPricing() {
  const PR = t().pricing;
  $("#pkgs").innerHTML = Object.entries(PKGS).map(([k, v]) => { const [n, ex, pts] = PR.pkgs[k]; return `<article class="pk${k === "crm" ? " hot" : ""}" data-tilt>${k === "crm" ? `<span class="pk-badge">${PR.popular}</span>` : ""}<span class="pk-ico">${svg(CAT_ICON[k])}</span><b class="pk-n">${n}</b><small class="pk-ex">${ex}</small>
      <div class="pk-price"><strong data-once="${v.once}" data-mon="${v.monthly}">${money(payMode === "once" ? v.once : v.monthly)}</strong><em>${payMode === "once" ? "" : PR.perMonth}</em></div><p class="pk-sub">${payMode === "once" ? PR.plusHost : PR.x12}</p>
      <ul>${pts.map((x) => `<li>${svg("M5 12.5l4.5 4.5L19 7.5")}${x}</li>`).join("")}</ul><small class="pk-h">${v.hours}</small><a href="#precios" class="btn ${k === "crm" ? "btn-main" : "btn-line"} sm" data-goto="calc" data-base="${k}">${t().nav.quote}</a></article>`; }).join("");
  $("#costList").innerHTML = PR.costs.map(([a, b], i) => `<div class="cost"><span class="c-n">0${i + 1}</span><b>${a}</b><p>${b}</p><i style="--w:${[78, 34, 12, 22, 40][i]}%"></i></div>`).join("");
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-pay]"); if (!b) return; payMode = b.dataset.pay; $$("[data-pay]").forEach((x) => x.classList.toggle("on", x === b)); movePill();
  const PR = t().pricing;
  $$(".pk").forEach((pk) => { const s = pk.querySelector("strong"), from = +(payMode === "once" ? s.dataset.mon : s.dataset.once), to = +(payMode === "once" ? s.dataset.once : s.dataset.mon), o = { v: from }; pk.querySelector(".pk-price em").textContent = payMode === "once" ? "" : PR.perMonth; pk.querySelector(".pk-sub").textContent = payMode === "once" ? PR.plusHost : PR.x12;
    if (hasG && !reduce) { gsap.to(o, { v: to, duration: 0.9, ease: "power3.out", onUpdate: () => (s.textContent = money(o.v)) }); gsap.fromTo(pk, { rotateY: -14 }, { rotateY: 0, duration: 1, ease: "elastic.out(1,.6)" }); } else s.textContent = money(to); });
});

/* ---------- Calculator ---------- */
const calcTotal = () => PKGS[calc.base].once + calc.extras.reduce((s, x) => s + EXTRAS.find((e) => e.id === x).price, 0);
function calcOut() {
  const total = calcTotal(), term = TERMS.find((x) => x.m === calc.term);
  if (!term) return { total, initial: 0, monthly: 0, fee: 0 };
  return { total, initial: 0, monthly: r100((total * (1 + term.fee)) / term.m + HOSTING), fee: term.fee };
}
function renderCalc() {
  const PR = t().pricing;
  $("#calcBox").innerHTML = `<div class="c-in"><p class="c-l">${PR.base}</p><div class="c-base">${Object.keys(PKGS).map((k) => `<button type="button" data-cbase="${k}" class="${calc.base === k ? "on" : ""}">${svg(CAT_ICON[k])}<b>${PR.pkgs[k][0]}</b><small>${money(PKGS[k].once)}</small></button>`).join("")}</div>
      <p class="c-l">${PR.extras}</p><div class="c-ex">${EXTRAS.map((x) => `<label class="${calc.extras.includes(x.id) ? "on" : ""}"><input type="checkbox" data-cex="${x.id}" ${calc.extras.includes(x.id) ? "checked" : ""}><i class="sw"><b></b></i><span>${PR.extrasL[x.id]}</span><em>+${money(x.price)}</em></label>`).join("")}</div>
      <p class="c-l">${PR.term}</p><div class="c-term"><span class="ct-ink"></span><button type="button" data-cterm="0" class="${!calc.term ? "on" : ""}">${PR.upfront}</button>${TERMS.map((x) => `<button type="button" data-cterm="${x.m}" class="${calc.term === x.m ? "on" : ""}">${x.m} ${t().work.months}</button>`).join("")}</div></div>
    <div class="c-out"><div class="co-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52"/><circle cx="60" cy="60" r="52" class="cr-arc" id="crArc"/></svg><div><small id="coMainL"></small><strong id="coMain"></strong></div></div>
      <dl id="coDl"></dl><button type="button" class="btn btn-main mag" id="askQuote">${PR.ask}<i class="arr">→</i></button></div>`;
  updCalc(false);
}
let shown = { main: 0 };
function updCalc(anim = true) {
  const PR = t().pricing, o = calcOut(), mon = !!calc.term, main = mon ? o.monthly : o.total;
  $("#coMainL").textContent = mon ? PR.monthlyFee : PR.total;
  const el = $("#coMain"); if (anim && hasG && !reduce) { const s = { v: shown.main }; gsap.to(s, { v: main, duration: 0.9, ease: "power3.out", onUpdate: () => (el.textContent = money(s.v) + (mon ? PR.perMonth : "")) }); } else el.textContent = money(main) + (mon ? PR.perMonth : "");
  shown.main = main;
  $("#coDl").innerHTML = `<div><dt>${PR.total}</dt><dd>${money(o.total)}</dd></div>` + (mon ? `<div><dt>${PR.initial}</dt><dd>${lang === "en" ? "None" : "Sin inicial"}</dd></div><div><dt>${lang === "en" ? "Total financed" : "Total financiado"}</dt><dd>${money(o.monthly * calc.term)}</dd></div><div><dt>${PR.feeNote}</dt><dd>${o.fee ? Math.round(o.fee * 100) + " %" : PR.noFee}</dd></div><div><dt>${PR.hosting}</dt><dd>${lang === "en" ? "included" : "incluido"}</dd></div>` : `<div><dt>${PR.hosting}</dt><dd>${money(HOSTING)}${PR.perMonth}</dd></div>`);
  const arc = $("#crArc"); if (arc) { const frac = Math.min(1, o.total / 300000); hasG ? gsap.to(arc, { strokeDashoffset: 327 * (1 - frac), duration: 1, ease: "expo.out" }) : (arc.style.strokeDashoffset = 327 * (1 - frac)); }
  requestAnimationFrame(() => moveInk(".c-term .on", ".c-term .ct-ink"));
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-cbase]"); if (b) { calc.base = b.dataset.cbase; $$("[data-cbase]").forEach((x) => x.classList.toggle("on", x === b)); hasG && gsap.fromTo(b, { scale: 0.94 }, { scale: 1, duration: 0.6, ease: "elastic.out(1,.4)" }); updCalc(); return; }
  const tm = e.target.closest("[data-cterm]"); if (tm) { calc.term = +tm.dataset.cterm; $$("[data-cterm]").forEach((x) => x.classList.toggle("on", x === tm)); updCalc(); return; }
  if (e.target.closest("#askQuote")) openQuoteModal();
  const g = e.target.closest("[data-goto]"); if (g) { if (g.dataset.base) { calc.base = g.dataset.base; renderCalc(); } closeDrawer(); pendingScroll = g.dataset.goto; }
});
document.addEventListener("change", (e) => { const x = e.target.dataset.cex; if (!x) return; calc.extras = e.target.checked ? [...calc.extras, x] : calc.extras.filter((y) => y !== x); e.target.closest("label").classList.toggle("on", e.target.checked); updCalc(); });

/* ---------- Quote request flow ---------- */
function openQuoteModal() {
  const PR = t().pricing, C = t().contact, o = calcOut();
  $("#mPanel").innerHTML = `<button type="button" class="x" data-mclose aria-label="Cerrar">✕</button><p class="kick">${t().quote.title}</p><h3>${PR.pkgs[calc.base][0]}</h3>
    <div class="q-sum"><span>${calc.extras.map((x) => PR.extrasL[x]).join(" · ") || "—"}</span><b>${calc.term ? `${money(o.monthly)}${PR.perMonth} × ${calc.term}` : money(o.total)}</b></div>
    <div class="fl-grid">${[["name", C.name], ["biz", C.biz], ["phone", C.phone]].map(([k, l], i) => `<div class="fl${i === 0 ? " wide" : ""}"><input id="q-${k}" placeholder=" " autocomplete="off"><label for="q-${k}">${l}</label></div>`).join("")}</div>
    <button type="button" class="btn btn-main sendbtn" id="qSend"><span>${C.send}</span></button>`;
  $("#modal").classList.add("on"); document.body.classList.add("lock");
  hasG && !reduce && gsap.fromTo("#mPanel", { y: 60, scale: 0.94, opacity: 0, rotateX: 12 }, { y: 0, scale: 1, opacity: 1, rotateX: 0, duration: 0.9, ease: "expo.out" });
}
function closeModal() { $("#modal").classList.remove("on"); document.body.classList.remove("lock"); }
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-mclose]")) return closeModal();
  if (!e.target.closest("#qSend")) return;
  const name = $("#q-name").value.trim(), phone = $("#q-phone").value.trim();
  if (name.length < 2 || phone.length < 7) { toast(t().contact.need); hasG && gsap.fromTo("#mPanel", { x: -10 }, { x: 0, duration: 0.6, ease: "elastic.out(1,.3)" }); return; }
  const b = $("#qSend"); b.classList.add("busy"); b.querySelector("span").textContent = "…";
  setTimeout(() => {
    b.classList.remove("busy"); b.classList.add("ok"); b.innerHTML = `${svg("M5 12.5l4.5 4.5L19 7.5")}<span>${t().quote.sent}</span>`;
    quote = { name, biz: $("#q-biz").value.trim(), base: calc.base, extras: [...calc.extras], term: calc.term, ...calcOut(), at: Date.now() }; store.set("sp-quote", JSON.stringify(quote));
    setTimeout(() => { closeModal(); go("inicio"); setTimeout(() => { renderQuoteHome(); toast(t().contact.sent); showFab(true); const q = $("#quoteHome"); scrollTo({ top: q.getBoundingClientRect().top + scrollY - 40, behavior: "smooth" }); hasG && !reduce && gsap.fromTo(q, { y: 60, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 1.2, ease: "expo.out", delay: 0.3 }); }, 1300); }, 1200);
  }, 1400);
});
function renderQuoteHome() {
  const q = $("#quoteHome"); if (!quote) { q.hidden = true; $("#fab").hidden = true; return; }
  const PR = t().pricing, Q = t().quote; q.hidden = false;
  q.innerHTML = `<div class="qh"><span class="qh-ico">${svg(CAT_ICON[quote.base])}</span><div class="qh-main"><p class="kick">${Q.title} · ${esc(quote.name)}${quote.biz ? " · " + esc(quote.biz) : ""}</p><h3>${PR.pkgs[quote.base][0]}</h3><p>${Q.items}: ${quote.extras.map((x) => PR.extrasL[x]).join(", ") || "—"}</p>
    <div class="qh-steps"><span class="done">${Q.sent}</span><span class="now">${lang === "en" ? "Proposal in 24 h" : "Propuesta en 24 h"}</span><span>${lang === "en" ? "Kick-off" : "Arranque"}</span></div></div>
    <div class="qh-price"><small>${quote.term ? PR.monthlyFee : PR.total}</small><b>${money(quote.term ? quote.monthly : quote.total)}${quote.term ? `<em>${PR.perMonth}</em>` : ""}</b><small>${quote.term ? `${quote.term} ${t().work.months} · ${lang === "en" ? "no down payment" : "sin inicial"}` : ""}</small><div class="qh-act"><a href="#precios" class="btn btn-line sm" data-goto="calc" data-qload>${Q.open}</a><button type="button" class="btn btn-ghost sm" id="qClear">${Q.clear}</button></div></div></div>`;
  showFab(false);
}
function showFab(b) { const f = $("#fab"); if (!quote) return; f.hidden = false; if (b && hasG && !reduce) gsap.fromTo(f, { scale: 0, rotate: -30 }, { scale: 1, rotate: 0, duration: 1.1, ease: "elastic.out(1,.5)" }); }
$("#fab").addEventListener("click", () => { const doit = () => { const q = $("#quoteHome"); scrollTo({ top: q.getBoundingClientRect().top + scrollY - 40, behavior: "smooth" }); hasG && gsap.fromTo(".qh", { boxShadow: "0 0 0 0 rgba(30,200,184,.7)" }, { boxShadow: "0 0 0 20px rgba(30,200,184,0)", duration: 1.2, repeat: 1 }); }; if (current !== "inicio") { go("inicio"); setTimeout(doit, 1300); } else doit(); });
document.addEventListener("click", (e) => {
  if (e.target.closest("#qClear")) { quote = null; store.del("sp-quote"); renderQuoteHome(); }
  if (e.target.closest("[data-qload]") && quote) { calc = { base: quote.base, extras: [...quote.extras], term: quote.term }; renderCalc(); }
});

/* ---------- Process + contact ---------- */
function renderProcess() {
  const PC = t().process;
  $("#timeline").innerHTML = `<div class="tl-line"><i></i></div>` + PC.steps.map(([a, b, w], i) => `<div class="tl-step ${i % 2 ? "r" : "l"}"><span class="tl-dot">${i + 1}</span><div class="tl-card"><em>${w}</em><b>${a}</b><p>${b}</p></div></div>`).join("");
  $("#faq").innerHTML = PC.faq.map(([q, a]) => `<details class="qa"><summary>${q}<i></i></summary><p>${a}</p></details>`).join("");
}
function renderContact() {
  const C = t().contact, PR = t().pricing, wa = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(lang === "en" ? "Hi Steliant! I'd like a quote for my project." : "¡Hola Steliant! Quiero cotizar mi proyecto.")}`;
  $("#contactBox").innerHTML = `<form class="cform" id="cForm" novalidate><div class="fl-grid">${[["name", C.name, ""], ["biz", C.biz, ""], ["phone", C.phone, ""]].map(([k, l]) => `<div class="fl"><input id="c-${k}" placeholder=" " autocomplete="off"><label for="c-${k}">${l}</label></div>`).join("")}<div class="fl sel"><select id="c-type">${Object.keys(PKGS).map((k) => `<option value="${k}">${PR.pkgs[k][0]}</option>`).join("")}</select><label for="c-type">${C.type}</label></div><div class="fl wide"><textarea id="c-msg" placeholder=" " rows="4"></textarea><label for="c-msg">${C.msg}</label></div></div><button type="submit" class="btn btn-main mag">${C.send}<i class="arr">→</i></button></form>
    <aside class="cside"><a class="wa-btn" href="${wa}" target="_blank" rel="noopener"><span>${svg("M4 20l1.3-3.9A8 8 0 1 1 8 19zM9 9.5c.5 2 2.5 4 4.5 4.5l1-1 2 1")}</span><b>${C.wa}</b><i>→</i></a>
      ${CONTACT.email ? `<a class="ci" href="mailto:${CONTACT.email}">${svg("M3 6h18v12H3zM3 7l9 6 9-6")}<span>${CONTACT.email}</span></a>` : ""}
      <div class="ci">${svg("M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z")}<span><small>${C.where}</small>${CONTACT.city}</span></div><div class="ci">${svg("M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0")}<span>${C.hours}</span></div>
      <div class="c-star" aria-hidden="true"><svg viewBox="0 0 100 100"><path class="sa" d="${STAR.a}"/><path class="sb" d="${STAR.b}"/></svg></div></aside>`;
}
document.addEventListener("submit", (e) => {
  if (e.target.id !== "cForm") return; e.preventDefault();
  if ($("#c-name").value.trim().length < 2 || $("#c-phone").value.trim().length < 7) { toast(t().contact.need); return; }
  toast(t().contact.sent); e.target.reset(); hasG && gsap.fromTo(".cform", { scale: 0.98 }, { scale: 1, duration: 0.6, ease: "elastic.out(1,.4)" });
});

/* ---------- Theme + language ---------- */
const root = document.documentElement;
const sv = store.get("sp-theme"); if (sv) root.dataset.theme = sv;
const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
$("#themeBtn").addEventListener("click", (e) => {
  const next = isDark() ? "light" : "dark", swap = () => { root.dataset.theme = next; store.set("sp-theme", next); };
  if (!document.startViewTransition || reduce) return swap();
  const r = e.currentTarget.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.startViewTransition(swap).ready.then(() => root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] }, { duration: 850, easing: "cubic-bezier(.19,1,.22,1)", pseudoElement: "::view-transition-new(root)" })).catch(() => {});
});
$("#langBtn").addEventListener("click", () => { lang = lang === "es" ? "en" : "es"; store.set("sp-lang", lang); document.body.classList.add("swapping"); setTimeout(() => { renderStatic(); document.body.classList.remove("swapping"); buildMotion(false); }, 220); });

/* ---------- Views ---------- */
let pendingScroll = null;
function markActive() {
  $$("[data-view]").forEach((a) => a.classList.toggle("on", a.dataset.view === current));
  const on = $("#rNav .on"), ink = $(".rn-ink"); if (on && ink) { ink.style.transform = `translateY(${on.offsetTop}px)`; ink.style.height = on.offsetHeight + "px"; }
}
function showView(id, animate) {
  if (!VIEWS.some(([v]) => v === id)) id = "inicio";
  const swap = () => {
    $$(".view").forEach((v) => v.classList.toggle("on", v.id === "v-" + id)); current = id; markActive(); document.body.classList.remove("menu-on");
    if (id === "inicio") renderQuoteHome();
    scrollTo(0, 0); buildMotion(true);
    if (pendingScroll) { const target = $("#" + pendingScroll); pendingScroll = null; if (target) setTimeout(() => scrollTo({ top: target.getBoundingClientRect().top + scrollY - 30, behavior: "smooth" }), animate ? 900 : 100); }
  };
  if (!animate || !hasG || reduce) return swap();
  const m = $("#app");
  gsap.timeline()
    .set(".prog i", { scaleX: 0, opacity: 1 })
    .to(".prog i", { scaleX: 0.7, duration: 0.45, ease: "power2.out" }, 0)
    .to(m, { y: -40, scale: 0.97, opacity: 0, filter: "blur(10px)", duration: 0.45, ease: "power3.in" }, 0)
    .add(swap)
    .fromTo(m, { y: 90, scale: 0.985, opacity: 0, filter: "blur(10px)" }, { y: 0, scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.9, ease: "expo.out", clearProps: "transform,filter" })
    .to(".prog i", { scaleX: 1, duration: 0.3 }, "<").to(".prog i", { opacity: 0, duration: 0.3 });
}
function go(id) { try { history.pushState(null, "", "#" + id); } catch (e) {} if (id === current && pendingScroll) { const target = $("#" + pendingScroll); pendingScroll = null; if (target) scrollTo({ top: target.getBoundingClientRect().top + scrollY - 30, behavior: "smooth" }); return; } showView(id, true); }
document.addEventListener("click", (e) => { const a = e.target.closest('a[href^="#"]'); if (!a) return; const id = a.getAttribute("href").slice(1); if (!id) return; e.preventDefault(); go(id); });
addEventListener("popstate", () => showView(location.hash.slice(1), true));
addEventListener("keydown", (e) => { if (e.key === "Escape") { closeDrawer(); closeModal(); document.body.classList.remove("menu-on"); } });
$("#mMenu").addEventListener("click", () => { document.body.classList.toggle("menu-on"); if (document.body.classList.contains("menu-on") && hasG && !reduce) gsap.fromTo("#mNav a", { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.05, duration: 0.8, ease: "expo.out", delay: 0.2 }); });
addEventListener("resize", () => { movePill(); markActive(); });

/* ---------- Ambient: silk lines + orbit + cursor ---------- */
const cv = $("#field"), cx2 = cv.getContext("2d"); let W = 0, H = 0, tick = 0;
function sizeCv() { const d = Math.min(2, devicePixelRatio || 1); W = cv.width = innerWidth * d; H = cv.height = innerHeight * d; cv.style.width = innerWidth + "px"; cv.style.height = innerHeight + "px"; }
sizeCv(); addEventListener("resize", sizeCv);
function drawField() {
  tick += 0.004; cx2.clearRect(0, 0, W, H); const dark = isDark();
  for (let k = 0; k < 14; k++) { cx2.beginPath(); const yb = H * (0.25 + k * 0.045), amp = H * 0.06; for (let x = 0; x <= W; x += 16) { const y = yb + Math.sin(x / W * 4 + tick * 3 + k * 0.4) * amp * Math.sin(tick + k * 0.2) + Math.cos(x / W * 7 - tick * 2) * amp * 0.3; x ? cx2.lineTo(x, y) : cx2.moveTo(x, y); } cx2.strokeStyle = k % 3 === 0 ? (dark ? "rgba(46,230,208,.14)" : "rgba(10,156,150,.16)") : (dark ? "rgba(120,150,255,.07)" : "rgba(11,42,107,.07)"); cx2.lineWidth = (k % 3 === 0 ? 1.4 : 1) * (W / innerWidth); cx2.stroke(); }
  if (!reduce) requestAnimationFrame(drawField);
}
drawField();
let oa = 0, ov = 0.003, oHover = false;
(function orbitLoop() {
  if (current === "inicio") { const chips = $$("#orbit .chip"), wrap = $("#orbitWrap"); if (wrap && chips.length) { const rx = wrap.offsetWidth * 0.46, ry = wrap.offsetHeight * 0.17; if (!oHover) oa += ov; chips.forEach((c, i) => { const a = oa + (i / chips.length) * Math.PI * 2, z = Math.sin(a); c.style.transform = `translate(-50%,-50%) translate(${Math.cos(a) * rx}px, ${z * ry}px) scale(${0.72 + (z + 1) * 0.2})`; c.style.zIndex = z > 0 ? 3 : 1; c.style.opacity = 0.45 + (z + 1) * 0.28; }); } }
  requestAnimationFrame(orbitLoop);
})();
$("#orbit").addEventListener("mouseenter", () => (oHover = true)); $("#orbit").addEventListener("mouseleave", () => (oHover = false));
if (!reduce && matchMedia("(hover:hover) and (pointer:fine)").matches) {
  document.body.classList.add("has-cursor");
  const c = $(".cursor"); let mx = innerWidth / 2, my = innerHeight / 2, px = mx, py = my;
  addEventListener("mousemove", (e) => {
    mx = e.clientX; my = e.clientY;
    const m = e.target.closest(".mag"); if (m) { const r = m.getBoundingClientRect(); m.style.transform = `translate(${(mx - r.left - r.width / 2) * 0.2}px,${(my - r.top - r.height / 2) * 0.3}px)`; }
    const tl = e.target.closest("[data-tilt]"); if (tl) { const r = tl.getBoundingClientRect(), x = (mx - r.left) / r.width, y = (my - r.top) / r.height; tl.style.setProperty("--mx", x * 100 + "%"); tl.style.setProperty("--my", y * 100 + "%"); tl.style.transform = `perspective(1000px) rotateY(${(x - 0.5) * 7}deg) rotateX(${(0.5 - y) * 7}deg)`; }
    if (current === "inicio") { const s = $("#starBig"); if (s) s.style.transform = `rotateY(${(mx / innerWidth - 0.5) * 30}deg) rotateX(${(0.5 - my / innerHeight) * 20}deg)`; }
    document.documentElement.style.setProperty("--sx", mx + "px"); document.documentElement.style.setProperty("--sy", my + "px");
  });
  document.addEventListener("mouseout", (e) => { [".mag", "[data-tilt]"].forEach((s) => { const el = e.target.closest(s); if (el && !el.contains(e.relatedTarget)) { el.style.transition = "transform .7s cubic-bezier(.19,1,.22,1)"; el.style.transform = ""; setTimeout(() => (el.style.transition = ""), 700); } }); });
  document.addEventListener("mouseover", (e) => { const v = e.target.closest("[data-cursor]"), h = e.target.closest("a,button,label,summary,input,select,textarea"); c.classList.toggle("view", !!v); c.querySelector("span").textContent = v ? v.dataset.cursor : ""; c.classList.toggle("hover", !v && !!h); });
  (function loop() { px += (mx - px) * 0.2; py += (my - py) * 0.2; c.style.transform = `translate(${px}px,${py}px)`; requestAnimationFrame(loop); })();
}

/* ---------- Motion ---------- */
let firstPaint = true;
function countUp(el) { const end = +el.dataset.count, s = el.dataset.suffix || ""; if (!hasG || reduce) return; const o = { v: 0 }; gsap.to(o, { v: end, duration: 2, ease: "power3.out", onUpdate: () => (el.textContent = Math.round(o.v) + s) }); }
const charIn = (els, extra = {}) => gsap.from(els, { yPercent: 120, rotateX: -80, opacity: 0, transformOrigin: "50% 100%", stagger: 0.02, duration: 1.1, ease: "expo.out", ...extra });
function buildMotion(entering) {
  if (!hasG || reduce) return;
  ScrollTrigger.getAll().forEach((s) => s.kill());
  const view = $(".view.on"); if (!view) return; const q = (s) => view.querySelectorAll(s), d0 = firstPaint ? 1.9 : 0.5;
  if (entering) { const h = view.querySelector(".vhead h1, .h-title"); if (h) charIn(h.querySelectorAll(".ch"), { delay: d0 }); gsap.from(view.querySelectorAll(".vhead .kick, .vhead .v-lede, .h-in"), { y: 30, opacity: 0, stagger: 0.08, duration: 1.1, ease: "expo.out", delay: d0 + 0.2 }); }
  q(".s-head .chars, .cta-box .chars").forEach((h) => charIn(h.querySelectorAll(".ch"), { scrollTrigger: { trigger: h, start: "top 88%" } }));
  q(".s-head .kick, .costs > .kick, section > .kick").forEach((k) => gsap.from(k, { x: -30, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: k, start: "top 92%" } }));
  if (view.id === "v-inicio") {
    if (entering) {
      const sa = $$("#starBig .sa, #starBig .sb"); sa.forEach((p) => { const l = p.getTotalLength(); gsap.fromTo(p, { strokeDasharray: l, strokeDashoffset: l }, { strokeDashoffset: 0, duration: 2, ease: "power3.inOut", delay: d0 - 0.3 }); });
      gsap.fromTo("#orbit", { scale: 0.2, opacity: 0, rotate: -40 }, { scale: 1, opacity: 1, rotate: 0, duration: 1.6, ease: "expo.out", delay: d0 + 0.6 });
      gsap.from(".ring", { scale: 0.4, opacity: 0, stagger: 0.15, duration: 1.6, ease: "expo.out", delay: d0 + 0.3 });
      gsap.from("#stats > div", { y: 40, opacity: 0, stagger: 0.08, duration: 1, ease: "expo.out", delay: d0 + 0.6, onStart: () => $$("#stats [data-count]").forEach(countUp) });
    }
    gsap.to("#orbitWrap", { yPercent: -18, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    q(".fc").forEach((f, i) => { gsap.from(f, { y: 120, opacity: 0, rotateX: 18, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: f, start: "top 88%" } }); gsap.fromTo(f.querySelector(".mock"), { yPercent: 8 }, { yPercent: -8, ease: "none", scrollTrigger: { trigger: f, start: "top bottom", end: "bottom top", scrub: true } }); });
    gsap.from(".why-c", { y: 70, opacity: 0, stagger: 0.1, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: "#whyGrid", start: "top 85%" } });
    gsap.from(".cta-box", { scale: 0.92, opacity: 0, duration: 1.3, ease: "expo.out", scrollTrigger: { trigger: ".cta-box", start: "top 85%" } });
    gsap.fromTo(".cta-star svg", { rotate: -30 }, { rotate: 30, ease: "none", scrollTrigger: { trigger: ".cta-box", start: "top bottom", end: "bottom top", scrub: true } });
  }
  if (view.id === "v-proyectos") { gsap.from("#filters", { y: 20, opacity: 0, duration: 0.9, ease: "expo.out", delay: entering ? d0 + 0.3 : 0 }); gsap.fromTo(".pc", { y: 80, opacity: 0, rotateX: 14 }, { y: 0, opacity: 1, rotateX: 0, stagger: 0.07, duration: 1.1, ease: "expo.out", delay: entering ? d0 + 0.4 : 0, clearProps: "transform" }); requestAnimationFrame(movePill); }
  if (view.id === "v-precios") {
    gsap.fromTo(".pk", { y: 90, opacity: 0, rotateY: -14 }, { y: 0, opacity: 1, rotateY: 0, stagger: 0.1, duration: 1.2, ease: "expo.out", delay: entering ? d0 + 0.35 : 0, clearProps: "transform" });
    gsap.from(".cost", { x: -50, opacity: 0, stagger: 0.08, duration: 1, ease: "expo.out", scrollTrigger: { trigger: "#costList", start: "top 85%" } });
    gsap.from(".cost i", { scaleX: 0, transformOrigin: "left", stagger: 0.08, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: "#costList", start: "top 80%" } });
    gsap.from(".c-in > *, .c-out", { y: 40, opacity: 0, stagger: 0.06, duration: 1, ease: "expo.out", scrollTrigger: { trigger: "#calcBox", start: "top 85%" } });
    requestAnimationFrame(() => { movePill(); moveInk(".c-term .on", ".c-term .ct-ink"); });
  }
  if (view.id === "v-proceso") {
    gsap.fromTo(".tl-line i", { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: "#timeline", start: "top 70%", end: "bottom 60%", scrub: true } });
    q(".tl-step").forEach((s) => { gsap.from(s.querySelector(".tl-card"), { x: s.classList.contains("l") ? -80 : 80, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: s, start: "top 85%" } }); gsap.from(s.querySelector(".tl-dot"), { scale: 0, duration: 0.8, ease: "back.out(3)", scrollTrigger: { trigger: s, start: "top 80%" } }); });
    gsap.from(".qa", { y: 30, opacity: 0, stagger: 0.07, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: "#faq", start: "top 88%" } });
  }
  if (view.id === "v-contacto") { gsap.from(".cform .fl, .cform .btn", { y: 30, opacity: 0, stagger: 0.06, duration: 0.9, ease: "expo.out", delay: entering ? d0 + 0.3 : 0 }); gsap.from(".cside > *", { x: 40, opacity: 0, stagger: 0.08, duration: 1, ease: "expo.out", delay: entering ? d0 + 0.4 : 0 }); }
  gsap.fromTo("#fGiant span", { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.05, ease: "none", scrollTrigger: { trigger: ".foot", start: "top bottom", end: "bottom bottom", scrub: 0.6 } });
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

/* ---------- Boot ---------- */
renderStatic();
showView(location.hash.slice(1), false);
const ld = $("#loader");
if (!hasG || reduce) { ld.style.display = "none"; firstPaint = false; }
else {
  ld.style.animation = "none";
  const ps = $$(".ld-star path"); ps.forEach((p) => { const l = p.getTotalLength(); gsap.set(p, { strokeDasharray: l, strokeDashoffset: l }); });
  gsap.timeline({ onComplete: () => (firstPaint = false) })
    .to(ps, { strokeDashoffset: 0, duration: 1.1, stagger: 0.15, ease: "power3.inOut" })
    .from(".ld-word", { y: 20, opacity: 0, duration: 0.7, ease: "expo.out" }, 0.4)
    .to(".ld-star", { rotate: 72, scale: 0.8, duration: 0.7, ease: "power3.in" }, 1.3)
    .to(ld, { clipPath: "circle(0% at 50% 50%)", duration: 0.9, ease: "expo.inOut" }, 1.5).set(ld, { display: "none" });
}
})();
