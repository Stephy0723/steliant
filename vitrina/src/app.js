/* ================= estado ================= */
const root = document.documentElement;
root.dataset.theme = store.get("vt-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
if (!hasG) document.body.classList.add("no-g");
const ICON = {
  home: '<path d="M4 10.5 12 4l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/>', shop: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>', store: '<path d="M4 9h16l-1-4H5zM5 9v11h14V9M9 20v-6h6v6"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>', panel: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.5 2 2.5 4 4.5 4.5l1-1 2 1c-.3 1.2-1.3 2-2.5 1.8C10.5 15.3 8.7 13.5 8.2 10c-.2-1.2.6-2.2 1.8-2.5l1 2z"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>', pin: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
};
const ic = (k) => `<svg viewBox="0 0 24 24">${ICON[k]}</svg>`;
const SITE_NAV = [["inicio", "home", "home"], ["catalogo", "shop", "shop"], ["seleccion", "list", "heart"], ["tienda", "info", "store"]];
let list = (() => { try { return JSON.parse(store.get("vt-list") || "[]"); } catch (e) { return []; } })();
let req = (() => { try { return JSON.parse(store.get("vt-req") || "null"); } catch (e) { return null; } })();
let REQS = (() => { try { return JSON.parse(store.get("vt-reqs") || "[]"); } catch (e) { return []; } })();
let notifySet = new Set((() => { try { return JSON.parse(store.get("vt-notify") || "[]"); } catch (e) { return []; } })());
const F = { cat: "all", max: 16000, avail: false, sort: "pop" };
const saveList = () => { store.set("vt-list", JSON.stringify(list)); paintCount(); };
const visible = () => PRODUCTS.filter((p) => !p.hidden);
const inList = (id) => list.some((x) => x.id === id);
const nameOf = (p) => L(p)[0];
const catName = (id) => { const c = CATS.find((x) => x.id === id); return c ? L(c) : id; };
const toast = (m) => { const el = $("#toast"); el.textContent = m; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 2600); };
const code = () => "VT-" + Math.random().toString(36).slice(2, 6).toUpperCase();
const words = (lines) => lines.map((l) => `<span class="ln">${l.split(" ").map((w) => `<span class="w">${esc(w)}</span>`).join(" ")}</span>`).join("");
const fmtD = (d, o) => new Date(d).toLocaleDateString(loc(), o);
const stockLbl = (p) => { const s = stockOf(p), lv = level(p); return lv === "out" ? t().st.out : lv === "low" ? `${t().st.low} · ${s}` : `${s} ${t().st.units}`; };
const maxStock = () => Math.max(...PRODUCTS.map(stockOf), 1);
const sbar = (p) => `<div class="sbar ${level(p)}"><i style="--w:${level(p) === "out" ? 100 : Math.max(8, Math.min(100, (stockOf(p) / 15) * 100))}%"></i></div>`;

/* ================= textos ================= */
function applyText() {
  root.lang = lang; $("#langLbl").textContent = lang.toUpperCase(); $("#langLbl2").textContent = lang.toUpperCase();
  $$("[data-t]").forEach((el) => { const v = get(el.dataset.t); if (typeof v === "string") el.textContent = v; });
  $$("[data-split]").forEach((el) => { const v = get(el.dataset.split); if (Array.isArray(v)) el.innerHTML = words(v); });
  $$("[data-img]").forEach((el) => { if (!el.firstElementChild) el.innerHTML = pic(U(el.dataset.img === "store" ? HERO.c : HERO.a, 1400)); });
  $("#sInput").placeholder = t().nav.search;
}

/* ================= render: sitio ================= */
function card(p) {
  const lv = level(p); const on = inList(p.id);
  return `<article class="card${lv === "out" ? " is-out" : ""}" data-pid="${p.id}">
    <a href="#producto/${p.id}" class="c-img">${pic(U(p.imgs[0], 700), nameOf(p))}${p.imgs[1] ? pic(U(p.imgs[1], 700), "") : ""}</a>
    <div class="c-tags">${p.new ? `<span class="tag new">${t().shop.newTag}</span>` : ""}${p.old ? `<span class="tag sale">−${Math.round((1 - p.price / p.old) * 100)}%</span>` : ""}</div>
    <button type="button" class="like${on ? " on" : ""}" data-like="${p.id}" aria-label="${t().shop.add}">${ic("heart")}</button>
    <button type="button" class="c-quick" data-qv="${p.id}">${t().shop.quick}</button>
    <div class="c-b"><span class="c-cat">${esc(catName(p.cat))} · ${p.sku}</span><h3><a href="#producto/${p.id}">${esc(nameOf(p))}</a></h3>
      <div class="c-stock">${sbar(p)}<small>${esc(stockLbl(p))}</small></div>
      <div class="c-row"><span class="price">${rd(p.price)}${p.old ? `<s>${rd(p.old)}</s>` : ""}</span><span class="sc ${lv}">${lv === "ok" ? t().st.ok : lv === "low" ? t().st.low : t().st.out}</span></div></div></article>`;
}
function renderNav() {
  $("#pill").innerHTML = `<i class="pill-ind" id="pillInd"></i>` + SITE_NAV.map(([id, k]) => `<a href="#${id}" data-nav="${id}">${esc(t().nav[k])}</a>`).join("");
  $("#tabbar").innerHTML = [["inicio", "home", "home"], ["catalogo", "shop", "shop"]].map(([id, k, i]) => `<a href="#${id}" data-nav="${id}">${ic(i)}<span>${esc(t().nav[k])}</span></a>`).join("") + `<button type="button" data-open-search>${ic("search")}<span>${es() ? "Buscar" : "Search"}</span></button><a href="#seleccion" data-nav="seleccion">${ic("heart")}<span>${es() ? "Selección" : "Picks"}</span><em class="badge" id="listCount2">0</em></a><a href="#panel">${ic("panel")}<span>Panel</span></a>`;
  $("#ftNav").innerHTML = SITE_NAV.map(([id, k]) => `<a href="#${id}">${esc(t().nav[k])}</a>`).join("") + `<a href="#panel">${esc(t().nav.panel)}</a>`;
  markNav(); paintCount();
}
function markNav() {
  const v = route().v; const id = v === "producto" ? "catalogo" : v;
  $$("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === id));
  requestAnimationFrame(() => { const on = $("#pill a.on"), ind = $("#pillInd"); if (!ind) return; if (!on) { ind.style.width = "0px"; return; } ind.style.width = on.offsetWidth + "px"; ind.style.transform = `translateX(${on.offsetLeft}px)`; });
}
function paintCount() {
  const n = list.reduce((a, x) => a + x.qty, 0);
  ["#listCount", "#listCount2"].forEach((s) => { const b = $(s); if (!b) return; b.textContent = n; b.classList.toggle("on", n > 0); b.classList.remove("bump"); void b.offsetWidth; if (n) b.classList.add("bump"); });
}
let liveT0 = Date.now();
function renderHome() {
  const V = visible();
  const st = [U(HERO.a, 1200), U(byId("p07")?.imgs[0] || HERO.b, 700), U(byId("p04")?.imgs[0] || HERO.b, 700), U(byId("p11")?.imgs[0] || HERO.b, 600)];
  const tg = ["p01", "p04", "p08"].map(byId).filter(Boolean);
  $("#stage").innerHTML = `<div class="hc big" data-d="1">${pic(st[0])}</div><div class="hc s1" data-d="2">${pic(st[1])}</div><div class="hc s2" data-d="1.5">${pic(st[2])}</div><div class="hc s3" data-d="2.5">${pic(st[3])}</div>` +
    tg.map((p, i) => `<a href="#producto/${p.id}" class="tagc t${i + 1}" data-d="${3 + i}">${pic(U(p.imgs[0], 120))}<span><b>${esc(nameOf(p))}</b><em class="${level(p) === "low" ? "dn" : "up"}">${rd(p.price)} · ${esc(stockLbl(p))}</em></span></a>`).join("");
  paintLive();
  $("#cats").innerHTML = CATS.map((c) => { const n = V.filter((p) => p.cat === c.id).length; return `<a href="#catalogo/${c.id}" class="cat rv">${pic(U(c.img, 600), L(c))}<span><b>${esc(L(c))}</b><em>${n} ${es() ? "productos" : "items"}</em></span></a>`; }).join("");
  $("#rail").innerHTML = [...V].sort((a, b) => b.views - a.views).slice(0, 9).map(card).join("");
  const low = V.filter((p) => level(p) === "low").sort((a, b) => stockOf(a) - stockOf(b)).slice(0, 4);
  $("#lowList").innerHTML = low.map((p) => `<a href="#producto/${p.id}" class="lb-it rv">${pic(U(p.imgs[0], 160))}<div><b>${esc(nameOf(p))}</b><span class="mono">${rd(p.price)}</span>${sbar(p)}</div><span class="n">${stockOf(p)}<small>${t().st.left}</small></span></a>`).join("");
  $("#howGrid").innerHTML = t().home.how.map(([h, p], i) => `<div class="hw rv"><span class="n">0${i + 1}</span><div><h4>${esc(h)}</h4><p>${esc(p)}</p></div></div>`).join("");
  const sales = salesByDay(14);
  $("#miniDash").innerHTML = `<div class="md-k"><span>${t().crm.kpi[0]}</span><b>${rd(sumMonth())}</b></div><div class="md-k"><span>${t().crm.kpi[1]}</span><b>${allOrders().filter((o) => daysAgo(o.date) < 30).length}</b></div><div class="md-k"><span>${t().crm.kpi[3]}</span><b>${PRODUCTS.filter((p) => level(p) === "out").length}</b></div><div class="md-chart">${sales.map((s) => `<i style="height:${Math.max(6, (s.v / Math.max(...sales.map((x) => x.v), 1)) * 100)}%"></i>`).join("")}</div>`;
  renderMine();
}
function paintLive() {
  const V = visible(); const units = V.reduce((a, p) => a + stockOf(p), 0); const s = Math.round((Date.now() - liveT0) / 1000);
  $("#livebox").innerHTML = `<i class="dot"></i><div><b>${V.length}</b><span> ${t().home.prods}</span></div><i class="sep"></i><div><b id="liveUnits">${units}</b><span> ${t().home.units}</span></div><i class="sep"></i><span class="mono">${t().home.live}<br>${t().home.upd} ${s < 60 ? s + " s" : Math.round(s / 60) + " min"}</span>`;
}
function renderFilters() {
  const V = visible(); const f = t().shop;
  const maxP = Math.max(...PRODUCTS.map((p) => p.price)); if (F.max > maxP || F.max < 500) F.max = Math.ceil(maxP / 500) * 500;
  $("#filt").innerHTML = `<div><p class="f-h">${f.cat}</p><div class="f-cats"><button type="button" class="f-cat${F.cat === "all" ? " on" : ""}" data-fcat="all">${f.all}<em>${V.length}</em></button>${CATS.map((c) => `<button type="button" class="f-cat${F.cat === c.id ? " on" : ""}" data-fcat="${c.id}">${esc(L(c))}<em>${V.filter((p) => p.cat === c.id).length}</em></button>`).join("")}</div></div>
    <div><p class="f-h">${f.price}<b id="fMaxV">${rd(F.max)}</b></p><input type="range" id="fMax" min="1000" max="${Math.ceil(maxP / 500) * 500}" step="250" value="${F.max}"><div class="f-pr"><span>RD$1,000</span><span>${rd(Math.ceil(maxP / 500) * 500)}</span></div></div>
    <label class="tog" data-favail>${f.avail}<i class="sw${F.avail ? " on" : ""}"></i></label>
    <button type="button" class="btn btn-line btn-sm" data-fclear>${f.clear}</button>`;
  rangeFill($("#fMax"));
  $("#sort").innerHTML = `<button type="button" class="f-mob" data-fmob>⚙ ${f.filters}</button>` + Object.entries(f.sorts).map(([k, v]) => `<button type="button" data-sort="${k}" class="${F.sort === k ? "on" : ""}">${esc(v)}</button>`).join("");
}
const rangeFill = (r) => r && r.style.setProperty("--p", ((r.value - r.min) / (r.max - r.min)) * 100 + "%");
function filtered() {
  let a = visible().filter((p) => (F.cat === "all" || p.cat === F.cat) && p.price <= F.max && (!F.avail || stockOf(p) > 0));
  const s = { pop: (x, y) => y.views - x.views, low: (x, y) => x.price - y.price, high: (x, y) => y.price - x.price, new: (x, y) => (y.new ? 1 : 0) - (x.new ? 1 : 0) || y.views - x.views, stock: (x, y) => stockOf(y) - stockOf(x) }[F.sort];
  return a.sort(s);
}
function renderGrid(anim) {
  const a = filtered(); $("#resN").textContent = `${a.length} ${t().shop.results}`;
  $("#grid").innerHTML = a.length ? a.map(card).join("") : `<div class="empty">${esc(t().shop.empty)}<br><button type="button" class="btn btn-line btn-sm" data-fclear>${t().shop.clear}</button></div>`;
  if (anim && hasG && !reduce) gsap.fromTo("#grid .card", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.035, ease: "power3.out", clearProps: "transform,opacity" });
}
let pdSel = { size: null, qty: 1, img: 0 };
function renderPD(id) {
  const p = byId(id) || visible()[0]; const sized = typeof p.stock === "object"; const f = t().pd; const lv = level(p);
  if (pdSel.id !== p.id) pdSel = { id: p.id, size: null, qty: 1, img: 0 };
  const avail = sized ? (pdSel.size ? p.stock[pdSel.size] : 0) : stockOf(p);
  const rel = visible().filter((x) => x.cat === p.cat && x.id !== p.id).concat(visible().filter((x) => x.cat !== p.cat)).slice(0, 4);
  $("#pd").innerHTML = `<section class="wrap pd">
    <div><a href="#catalogo" class="pd-back">← ${esc(t().nav.back)}</a><div class="gal"><div class="thumbs">${p.imgs.map((im, i) => `<button type="button" class="${i === pdSel.img ? "on" : ""}" data-thumb="${i}">${pic(U(im, 200))}</button>`).join("")}</div><div class="main-img" id="mainImg">${pic(U(p.imgs[pdSel.img] || p.imgs[0], 1300), nameOf(p))}</div></div></div>
    <div class="pd-info">
      <div class="pd-meta"><span>${esc(catName(p.cat))}</span><span>${f.sku} ${p.sku}</span>${p.new ? `<span class="tag new">${t().shop.newTag}</span>` : ""}</div>
      <h1>${esc(nameOf(p))}</h1>
      <div class="pd-price"><b>${rd(p.price)}</b>${p.old ? `<s>${rd(p.old)}</s><span class="tag sale">−${Math.round((1 - p.price / p.old) * 100)}%</span>` : ""}</div>
      <p class="pd-desc">${esc(L(p)[1])}</p>
      <div class="pd-box"><div class="pd-st"><span class="sc ${lv}">${lv === "ok" ? t().st.ok : lv === "low" ? t().st.low : t().st.out}</span><b id="pdStock">${stockOf(p)}<small>${t().st.units}</small></b></div>${sbar(p)}
        ${sized ? `<p class="f-h" style="margin-top:14px">${f.by}</p><div class="sizes">${Object.entries(p.stock).map(([s, n]) => `<button type="button" class="sz${n === 0 ? " no" : n <= 2 ? " low" : ""}${pdSel.size === s ? " on" : ""}" data-size="${s}" ${n === 0 ? "disabled" : ""}><b>${s}</b><small>${n === 0 ? t().st.out : n + " " + t().st.units}</small></button>`).join("")}</div>` : ""}
      </div>
      ${lv === "out" ? `<button type="button" class="btn btn-line" style="width:100%" data-notify="${p.id}">${notifySet.has(p.id) ? "✓ " + t().st.notified : "🔔 " + t().st.notify}</button>` : `<div class="pd-acts"><div class="qty"><button type="button" data-q="-1">−</button><span id="pdQty">${pdSel.qty}</span><button type="button" data-q="1">+</button></div><button type="button" class="btn btn-acc" data-pdadd="${p.id}" ${sized && !pdSel.size ? "disabled" : ""}><span>${sized && !pdSel.size ? f.pick : f.add}</span>${ic("heart")}</button></div><p class="mono mut" style="margin-top:8px">${f.max}: ${avail || "—"}</p>`}
      <div class="pd-ul">${f.info.map((x) => `<span>${esc(x)}</span>`).join("")}</div>
    </div></section>
    <section class="wrap related"><p class="kick">${f.related}</p><div class="grid">${rel.map(card).join("")}</div></section>`;
}
function listRows() { return list.map((x, i) => ({ ...x, i, p: byId(x.id) })).filter((x) => x.p); }
function renderSel() {
  const rows = listRows(); const f = t().list;
  if (!rows.length) { $("#sel").innerHTML = `<div class="sel-empty">${ic("heart")}<p>${esc(f.empty)}</p><a href="#catalogo" class="btn btn-acc">${f.go}<i class="arr">→</i></a></div>`; return; }
  const total = rows.reduce((a, x) => a + x.p.price * x.qty, 0);
  $("#sel").innerHTML = `<div class="sel-list">${rows.map((x) => { const p = x.p; const sized = typeof p.stock === "object"; const av = sized ? (x.size ? p.stock[x.size] : 0) : stockOf(p);
    return `<div class="si-row" data-row="${x.i}">${pic(U(p.imgs[0], 200), nameOf(p))}<div><h4><a href="#producto/${p.id}">${esc(nameOf(p))}</a></h4><div class="meta"><span>${rd(p.price)}</span>${sized ? `<select class="ebtn" data-lsize="${x.i}"><option value="">${t().st.size}…</option>${Object.entries(p.stock).map(([s, n]) => `<option value="${s}" ${x.size === s ? "selected" : ""} ${n === 0 ? "disabled" : ""}>${s} (${n})</option>`).join("")}</select>` : ""}<span class="sc ${av === 0 ? "out" : av <= 3 ? "low" : "ok"}">${av === 0 ? (sized && !x.size ? t().pd.pick : f.unav) : av + " " + t().st.units}</span></div></div>
    <div class="si-r"><div class="qty"><button type="button" data-lq="${x.i}:-1">−</button><span>${x.qty}</span><button type="button" data-lq="${x.i}:1">+</button></div><button type="button" class="rm" data-lrm="${x.i}">${f.remove}</button></div></div>`; }).join("")}</div>
    <aside class="sel-sum"><div class="row"><span>${rows.reduce((a, x) => a + x.qty, 0)} ${f.items}</span><span>${rows.length} ${es() ? "productos" : "products"}</span></div><div class="tot"><span>${f.total}</span><b>${rd(total)}</b></div><button type="button" class="btn btn-acc" data-send>${f.send}<i class="arr">→</i></button><p>${esc(f.note)}</p></aside>`;
}
function renderStore() { $("#faq").innerHTML = t().info.faq.map(([q, a], i) => `<div class="fq${i === 0 ? " open" : ""}"><button type="button" data-fq>${esc(q)}<i>+</i></button><p>${esc(a)}</p></div>`).join(""); }

/* ================= solicitud ================= */
function renderMine() {
  const box = $("#mineHome"), fab = $("#fab");
  if (!req) { box.hidden = true; fab.hidden = true; return; }
  const m = t().mine; const st = req.status || 0; const hold = new Date(new Date(req.date).getTime() + 48 * 36e5);
  box.hidden = false; fab.hidden = false; $("#fabSub").textContent = req.code + " · " + m.status[st];
  box.innerHTML = `<div class="mc"><div class="mc-imgs">${req.items.slice(0, 4).map((x) => { const p = byId(x.id); return p ? pic(U(p.imgs[0], 150)) : ""; }).join("")}</div><div><p class="mono mut">${esc(m.title)} · ${req.code}</p><h4>${req.items.reduce((a, x) => a + x.qty, 0)} ${m.items} · ${rd(req.total)}</h4><div class="steps">${m.status.map((s, i) => `<span class="${i <= st ? "on" : ""}">${esc(s)}</span>`).join("")}</div></div><div class="mc-r"><p class="mono mut">${t().req.hold}</p><b>${fmtD(hold, { weekday: "short", day: "numeric" })} · ${hold.toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" })}</b><button type="button" class="ebtn" data-open-req style="margin-top:6px">${m.open} →</button></div></div>`;
}
function openDrawer(html) { $("#drIn").innerHTML = `<button type="button" class="m-x" data-x="drawer">×</button>` + html; $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); }
function closeDrawer() { $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); }
function reqTicket(r) {
  const hold = new Date(new Date(r.date).getTime() + 48 * 36e5); const q = t().req;
  return `<div class="ticket"><div class="tk-h"><span class="mono">${q.code}</span><b>${r.code}</b></div><div class="tk-rows">${r.items.map((x) => { const p = byId(x.id); return p ? `<div><span>${esc(nameOf(p))}${x.size ? " · " + x.size : ""} × ${x.qty}</span><b>${rd(p.price * x.qty)}</b></div>` : ""; }).join("")}<div><span>${t().list.total}</span><b>${rd(r.total)}</b></div><div><span>${q.via}</span><b>${q.vias[r.via]}</b></div><div><span>${q.hold}</span><b>${fmtD(hold, { weekday: "short", day: "numeric", month: "short" })}</b></div></div></div>`;
}
let reqVia = 0;
function openModal(id) { const m = $("#" + id); m.classList.add("open"); m.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; }
function closeModal(id) { const m = $("#" + id); m.classList.remove("open"); m.setAttribute("aria-hidden", "true"); if (!$$(".modal.open").length) document.body.style.overflow = ""; }
function openReq() {
  const rows = listRows(); const q = t().req;
  $("#reqCard").innerHTML = `<button type="button" class="m-x" data-x="req">×</button><h3>${q.title}</h3><div class="req-items">${rows.map((x) => pic(U(x.p.imgs[0], 120))).join("")}</div>
    <p class="f-h">${q.via}</p><div class="via">${[["wa", 0], ["mail", 1], ["pin", 2]].map(([k, i]) => `<button type="button" data-via="${i}" class="${reqVia === i ? "on" : ""}">${ic(k)}${q.vias[i]}</button>`).join("")}</div>
    <div class="two"><div class="fld"><input id="r-name" placeholder=" " autocomplete="name"><label for="r-name">${q.name}</label></div><div class="fld"><input id="r-phone" placeholder=" " inputmode="tel"><label for="r-phone">${q.phone}</label></div></div>
    <div class="fld"><input id="r-email" placeholder=" " type="email"><label for="r-email">${q.email}</label></div><div class="fld"><textarea id="r-note" rows="2" placeholder=" "></textarea><label for="r-note">${q.note}</label></div>
    <p class="err-t" id="rErr"></p><button type="button" class="btn btn-acc" id="rSend"><i class="sp"></i><span>${q.send} · ${rd(rows.reduce((a, x) => a + x.p.price * x.qty, 0))}</span></button><p class="demo-n">${q.demo}</p>`;
  openModal("req");
}
function sendReq() {
  const q = t().req; const name = $("#r-name").value.trim(), phone = $("#r-phone").value.trim();
  $$("#reqCard .fld").forEach((x) => x.classList.remove("err"));
  if (!name || phone.replace(/\D/g, "").length < 7) { $("#rErr").textContent = q.need; (!name ? $("#r-name") : $("#r-phone")).parentNode.classList.add("err"); return; }
  const b = $("#rSend"); b.classList.add("busy"); b.disabled = true; $("span", b).textContent = q.sending;
  setTimeout(() => {
    const rows = listRows();
    req = { code: code(), date: new Date().toISOString(), via: reqVia, name, phone, email: $("#r-email").value.trim(), note: $("#r-note").value.trim(), items: rows.map((x) => ({ id: x.id, size: x.size || null, qty: x.qty })), total: rows.reduce((a, x) => a + x.p.price * x.qty, 0), status: 0 };
    REQS.unshift({ ...req }); store.set("vt-reqs", JSON.stringify(REQS)); store.set("vt-req", JSON.stringify(req));
    list = []; saveList(); renderMine(); renderSel(); paintSide();
    $("#reqCard").innerHTML = `<button type="button" class="m-x" data-x="req">×</button><div class="done"><div class="ok-ic"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h3>${q.done}</h3><p>${q.doneText}</p>${reqTicket(req)}<div class="btns"><button type="button" class="btn btn-acc" data-home>${q.home}<i class="arr">→</i></button><button type="button" class="btn btn-line" data-x="req">${q.close}</button></div></div>`;
    if (hasG && !reduce) gsap.fromTo(".done > *", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.06, ease: "power3.out", clearProps: "transform,opacity" });
    setTimeout(() => { if (req && req.status === 0) { req.status = 1; store.set("vt-req", JSON.stringify(req)); renderMine(); } }, 25000);
  }, 1500);
}
function openQV(id) {
  const p = byId(id); const lv = level(p);
  $("#qvCard").innerHTML = `<button type="button" class="m-x" data-x="qv">×</button><div class="qv-img">${pic(U(p.imgs[0], 1000), nameOf(p))}</div><div class="qv-b"><span class="c-cat">${esc(catName(p.cat))} · ${p.sku}</span><h3>${esc(nameOf(p))}</h3><div class="pd-price"><b>${rd(p.price)}</b>${p.old ? `<s>${rd(p.old)}</s>` : ""}</div><p class="pd-desc">${esc(L(p)[1])}</p><div class="pd-st"><span class="sc ${lv}">${lv === "ok" ? t().st.ok : lv === "low" ? t().st.low : t().st.out}</span><b>${stockOf(p)}<small>${t().st.units}</small></b></div>${sbar(p)}${typeof p.stock === "object" ? `<div class="sizes">${Object.entries(p.stock).map(([s, n]) => `<span class="sz${n === 0 ? " no" : ""}"><b>${s}</b><small>${n}</small></span>`).join("")}</div>` : ""}<a href="#producto/${p.id}" class="btn btn-acc" data-x="qv">${es() ? "Ver producto" : "View product"}<i class="arr">→</i></a></div>`;
  openModal("qv");
}
function toggleLike(id, btn) {
  const p = byId(id); const was = inList(id);
  if (was) list = list.filter((x) => x.id !== id); else list.push({ id, size: null, qty: 1 });
  saveList(); $$(`[data-like="${id}"]`).forEach((b) => { b.classList.toggle("on", !was); b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); });
  toast(was ? (es() ? "Quitado de tu selección" : "Removed from your picks") : `♥ ${nameOf(p)} · ${t().shop.added}`);
  if (route().v === "seleccion") renderSel();
  if (!was && btn && hasG && !reduce) flyTo(btn);
}
function flyTo(from) {
  const tg = innerWidth <= 900 ? $("#tabbar [data-nav=seleccion]") : $("#heartBtn"); if (!tg) return;
  const a = from.getBoundingClientRect(), b = tg.getBoundingClientRect(); const d = document.createElement("i");
  d.style.cssText = `position:fixed;z-index:500;left:${a.left + a.width / 2 - 7}px;top:${a.top + a.height / 2 - 7}px;width:14px;height:14px;border-radius:50%;background:var(--out);pointer-events:none`;
  document.body.appendChild(d);
  gsap.to(d, { x: b.left + b.width / 2 - (a.left + a.width / 2), y: b.top + b.height / 2 - (a.top + a.height / 2), scale: 0.4, duration: 0.75, ease: "power2.in", onComplete: () => d.remove() });
}

/* ================= búsqueda ================= */
let sIdx = 0;
function openSearch() { $("#search").classList.add("open"); $("#search").setAttribute("aria-hidden", "false"); $("#sInput").value = ""; doSearch(); setTimeout(() => $("#sInput").focus(), 50); }
function closeSearch() { $("#search").classList.remove("open"); $("#search").setAttribute("aria-hidden", "true"); }
function doSearch() {
  const q = $("#sInput").value.trim().toLowerCase(); const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const r = visible().filter((p) => !q || norm(nameOf(p) + " " + p.sku + " " + catName(p.cat)).includes(norm(q))).slice(0, 8); sIdx = 0;
  const hl = (s) => (q ? esc(s).replace(new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>") : esc(s));
  $("#sRes").innerHTML = r.length ? r.map((p, i) => `<a href="#producto/${p.id}" class="s-it${i === 0 ? " on" : ""}" data-sclose>${pic(U(p.imgs[0], 120))}<div><b>${hl(nameOf(p))}</b><span>${esc(catName(p.cat))} · ${p.sku}</span></div><div style="text-align:right"><b>${rd(p.price)}</b><span class="sc ${level(p)}">${esc(stockLbl(p))}</span></div></a>`).join("") : `<p class="s-none">${t().shop.empty}</p>`;
}

/* ================= navegación ================= */
let cur = null, curHash = (location.hash || "#inicio").slice(1), busy = false, ctx = null;
const SITE_V = ["inicio", "catalogo", "producto", "seleccion", "tienda"];
const route = () => { const [v, p] = (curHash || "inicio").split("/"); if (v === "panel") return { v: "panel", p: p || "dash" }; return { v: SITE_V.includes(v) ? v : "inicio", p: p || null }; };
function go(h) { if (h === curHash) { scrollTo({ top: 0, behavior: "smooth" }); return; } curHash = h; try { history.pushState(null, "", "#" + h); } catch (e) {} showView(true); }
function tilesIn(cb) {
  const T0 = $("#tiles"); T0.classList.add("busy"); const tiles = $$("#tiles i");
  const tl = gsap.timeline({ onComplete: () => { T0.classList.remove("busy"); busy = false; } });
  tl.set(tiles, { scale: 0, borderRadius: "40%" }).to(tiles, { scale: 1.02, borderRadius: "0%", duration: 0.42, ease: "power3.in", stagger: { grid: [5, 8], from: lastClick, amount: 0.32 } })
    .add(cb).to(tiles, { scale: 0, borderRadius: "40%", duration: 0.5, ease: "power3.out", stagger: { grid: [5, 8], from: lastClick, amount: 0.32 } }, "+=.05");
}
let lastClick = "center";
function showView(anim) {
  const r = route();
  if (!anim || !hasG || reduce || !cur) { swap(r); return; }
  if (busy) return; busy = true; tilesIn(() => swap(r));
}
function swap(r) {
  if (ctx) { ctx.revert(); ctx = null; }
  closeSearch(); closeDrawer(); ["qv", "req", "pf"].forEach((m) => $("#" + m).classList.contains("open") && closeModal(m));
  const isCrm = r.v === "panel"; $("#site").hidden = isCrm; $("#crm").hidden = !isCrm;
  if (isCrm) { cur = "panel"; renderCrm(r.p); scrollTo(0, 0); document.title = "Vitrina · " + t().crm.nav[r.p]; return; }
  if (r.v === "catalogo") { if (r.p && CATS.some((c) => c.id === r.p)) F.cat = r.p; renderFilters(); renderGrid(); }
  if (r.v === "producto") renderPD(r.p);
  if (r.v === "seleccion") renderSel();
  if (r.v === "inicio") { renderHome(); }
  $$("#app .view").forEach((x) => x.classList.toggle("on", x.id === "v-" + r.v));
  scrollTo(0, 0); cur = r.v; markNav();
  document.title = "Vitrina · " + (r.v === "producto" ? nameOf(byId(r.p) || PRODUCTS[0]) : t().nav[{ inicio: "home", catalogo: "shop", seleccion: "list", tienda: "info" }[r.v]]);
  enter(r.v); onScroll();
}
let firstLoad = true;
function enter(v) {
  if (!hasG || reduce) return;
  const V = $("#v-" + v); const d = firstLoad ? 99 : 0.15;
  ctx = gsap.context(() => {
    $$(".page-head .split .w, .hero .split .w", V).length && gsap.fromTo($$(".page-head .split .w, .hero .split .w", V), { yPercent: 110 }, { yPercent: 0, duration: 1, stagger: 0.05, ease: "power4.out", delay: d });
    gsap.fromTo($$(".in", V), { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.07, delay: d + 0.25, ease: "power3.out", clearProps: "transform" });
    $$(".split", V).forEach((el) => { if (!el.closest(".page-head,.hero")) gsap.fromTo($$(".w", el), { yPercent: 110 }, { yPercent: 0, duration: 1, stagger: 0.05, ease: "power4.out", scrollTrigger: { trigger: el, start: "top 88%" } }); });
    $$(".rv", V).forEach((el) => gsap.fromTo(el, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: "power3.out", clearProps: "transform", scrollTrigger: { trigger: el, start: "top 92%" } }));
    if (v === "inicio") {
      gsap.fromTo(".hc", { y: 80, opacity: 0, rotate: (i) => [-4, 5, -3, 6][i] }, { y: 0, opacity: 1, rotate: 0, duration: 1.3, stagger: 0.1, delay: d + 0.2, ease: "expo.out", clearProps: "opacity" });
      gsap.fromTo(".tagc", { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, stagger: 0.12, delay: d + 0.9, ease: "back.out(1.8)", clearProps: "transform,opacity" });
      gsap.fromTo(".hc img", { scale: 1.25 }, { scale: 1, duration: 1.8, delay: d + 0.2, ease: "expo.out" });
      gsap.to(".hero-stage", { yPercent: 10, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
      gsap.fromTo("#rail .card", { x: 80, opacity: 0 }, { x: 0, opacity: 1, duration: 1, stagger: 0.06, ease: "power3.out", clearProps: "transform,opacity", scrollTrigger: { trigger: "#rail", start: "top 88%" } });
      gsap.fromTo(".md-chart i", { scaleY: 0 }, { scaleY: 1, duration: 0.9, stagger: 0.04, ease: "power3.out", scrollTrigger: { trigger: ".mini-dash", start: "top 85%" } });
      if (!$("#mineHome").hidden) gsap.fromTo("#mineHome .mc", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, delay: d + 0.5, ease: "power3.out", clearProps: "transform" });
    }
    if (v === "catalogo") gsap.fromTo("#grid .card", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.04, delay: d + 0.3, ease: "power3.out", clearProps: "transform,opacity" });
    if (v === "producto") { gsap.fromTo(".main-img", { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 1.1, delay: d, ease: "expo.inOut", clearProps: "clipPath" }); gsap.fromTo(".pd-info > *", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.06, delay: d + 0.3, ease: "power3.out", clearProps: "transform,opacity" }); }
    if (v === "seleccion") gsap.fromTo(".si-row, .sel-sum, .sel-empty", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.06, delay: d + 0.3, ease: "power3.out", clearProps: "transform,opacity" });
  }, V);
}

/* ================= eventos ================= */
document.addEventListener("pointerdown", (e) => { const c = Math.min(7, Math.floor((e.clientX / innerWidth) * 8)), r = Math.min(4, Math.floor((e.clientY / innerHeight) * 5)); lastClick = [c, r]; }, true);
document.addEventListener("click", (e) => {
  const t0 = e.target;
  const a = t0.closest("a[href^='#']");
  if (a) { e.preventDefault(); if (a.hasAttribute("data-x")) closeModal(a.dataset.x); if (a.hasAttribute("data-sclose")) closeSearch(); if (a.closest(".side")) $("#side").classList.remove("open"); go(a.getAttribute("href").slice(1) || "inicio"); return; }
  const x = t0.closest("[data-x]"); if (x || t0.classList.contains("m-back")) { const id = (x || t0).dataset.x; if (id === "search") closeSearch(); else if (id === "drawer") closeDrawer(); else closeModal(id); return; }
  const lk = t0.closest("[data-like]"); if (lk) { toggleLike(lk.dataset.like, lk); return; }
  const qv = t0.closest("[data-qv]"); if (qv) { openQV(qv.dataset.qv); return; }
  if (t0.closest("[data-open-search]") || t0.closest("#srchBtn")) { openSearch(); return; }
  const sc = t0.closest("[data-scroll]"); if (sc) { const el = $(sc.dataset.scroll); el && scrollTo({ top: el.getBoundingClientRect().top + scrollY - 90, behavior: "smooth" }); return; }
  const rl = t0.closest("[data-rail]"); if (rl) { $("#rail").scrollBy({ left: +rl.dataset.rail * 320, behavior: "smooth" }); return; }
  const fc = t0.closest("[data-fcat]"); if (fc) { F.cat = fc.dataset.fcat; $$("[data-fcat]").forEach((b) => b.classList.toggle("on", b === fc)); renderGrid(true); return; }
  if (t0.closest("[data-favail]")) { e.preventDefault(); F.avail = !F.avail; $("[data-favail] .sw").classList.toggle("on", F.avail); renderGrid(true); return; }
  if (t0.closest("[data-fclear]")) { Object.assign(F, { cat: "all", max: 99999, avail: false, sort: "pop" }); renderFilters(); renderGrid(true); return; }
  if (t0.closest("[data-fmob]")) { $("#filt").classList.toggle("open"); return; }
  const so = t0.closest("[data-sort]"); if (so) { F.sort = so.dataset.sort; $$("[data-sort]").forEach((b) => b.classList.toggle("on", b === so)); renderGrid(true); return; }
  const th = t0.closest("[data-thumb]"); if (th) { pdSel.img = +th.dataset.thumb; $$("[data-thumb]").forEach((b) => b.classList.toggle("on", b === th)); const p = byId(pdSel.id); const im = $("#mainImg img"); im.src = U(p.imgs[pdSel.img], 1300); hasG && gsap.fromTo(im, { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 0.6, clearProps: "transform" }); return; }
  const sz = t0.closest("[data-size]"); if (sz && !sz.disabled) { pdSel.size = sz.dataset.size; pdSel.qty = 1; renderPD(pdSel.id); return; }
  const q = t0.closest("[data-q]"); if (q) { const p = byId(pdSel.id); const av = typeof p.stock === "object" ? (pdSel.size ? p.stock[pdSel.size] : 1) : stockOf(p); pdSel.qty = Math.max(1, Math.min(av, pdSel.qty + +q.dataset.q)); $("#pdQty").textContent = pdSel.qty; if (pdSel.qty === av && +q.dataset.q > 0) toast(`${t().pd.max}: ${av}`); return; }
  const pa = t0.closest("[data-pdadd]"); if (pa) { const id = pa.dataset.pdadd; const ex = list.find((x) => x.id === id && (x.size || null) === (pdSel.size || null)) || list.find((x) => x.id === id && !x.size); if (ex) { ex.size = pdSel.size || null; ex.qty = pdSel.qty; } else list.push({ id, size: pdSel.size || null, qty: pdSel.qty }); saveList(); flyTo(pa); toast(`♥ ${nameOf(byId(id))} · ${t().pd.inList}`); $$(`[data-like="${id}"]`).forEach((b) => b.classList.add("on")); return; }
  const nt = t0.closest("[data-notify]"); if (nt) { const id = nt.dataset.notify; notifySet.has(id) ? notifySet.delete(id) : notifySet.add(id); store.set("vt-notify", JSON.stringify([...notifySet])); nt.textContent = notifySet.has(id) ? "✓ " + t().st.notified : "🔔 " + t().st.notify; toast(notifySet.has(id) ? t().st.notified : "OK"); return; }
  const lq = t0.closest("[data-lq]"); if (lq) { const [i, dlt] = lq.dataset.lq.split(":").map(Number); const it = list[i]; const p = byId(it.id); const av = typeof p.stock === "object" ? (it.size ? p.stock[it.size] : 9) : stockOf(p); it.qty = Math.max(1, Math.min(Math.max(av, 1), it.qty + dlt)); saveList(); renderSel(); return; }
  const lr = t0.closest("[data-lrm]"); if (lr) { const row = lr.closest(".si-row"); const done = () => { list.splice(+lr.dataset.lrm, 1); saveList(); renderSel(); $$(".like").forEach((b) => b.classList.toggle("on", inList(b.dataset.like))); }; hasG && !reduce ? gsap.to(row, { x: 60, opacity: 0, height: 0, padding: 0, marginBottom: -10, duration: 0.45, ease: "power3.in", onComplete: done }) : done(); return; }
  if (t0.closest("[data-send]")) { openReq(); return; }
  const vb = t0.closest("[data-via]"); if (vb) { reqVia = +vb.dataset.via; $$("[data-via]").forEach((b) => b.classList.toggle("on", b === vb)); return; }
  if (t0.closest("#rSend")) { sendReq(); return; }
  if (t0.closest("[data-home]")) { closeModal("req"); go("inicio"); setTimeout(() => { const mh = $("#mineHome .mc"); if (mh) { scrollTo({ top: mh.getBoundingClientRect().top + scrollY - 110, behavior: "smooth" }); mh.classList.remove("pulse"); void mh.offsetWidth; mh.classList.add("pulse"); } }, hasG ? 1400 : 50); return; }
  if (t0.closest("[data-open-req]") || t0.closest("#fab")) { if (req) openDrawer(`<p class="kick">${t().mine.title}</p><h3>${req.code}</h3><div class="steps" style="margin-bottom:16px">${t().mine.status.map((s, i) => `<span class="${i <= (req.status || 0) ? "on" : ""}">${esc(s)}</span>`).join("")}</div>${reqTicket(req)}<button type="button" class="btn btn-line" style="width:100%" data-cancel-req>${t().mine.clear}</button>`); return; }
  if (t0.closest("[data-cancel-req]")) { req = null; store.del("vt-req"); renderMine(); closeDrawer(); toast(es() ? "Solicitud cancelada" : "Request cancelled"); return; }
  const fq = t0.closest("[data-fq]"); if (fq) { fq.parentNode.classList.toggle("open"); return; }
  if (crmClick(e, t0)) return;
});
document.addEventListener("change", (e) => { const s = e.target.closest("[data-lsize]"); if (s) { const it = list[+s.dataset.lsize]; it.size = s.value || null; const p = byId(it.id); if (it.size) it.qty = Math.min(it.qty, Math.max(1, p.stock[it.size])); saveList(); renderSel(); } crmChange(e); });
document.addEventListener("input", (e) => {
  if (e.target.id === "fMax") { F.max = +e.target.value; rangeFill(e.target); $("#fMaxV").textContent = rd(F.max); clearTimeout(renderGrid.t); renderGrid.t = setTimeout(() => renderGrid(true), 120); }
  if (e.target.id === "sInput") doSearch();
  crmInput(e);
});
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#search").classList.contains("open") ? closeSearch() : openSearch(); return; }
  if (e.key === "Escape") { closeSearch(); closeDrawer(); ["qv", "req", "pf"].forEach((m) => $("#" + m).classList.contains("open") && closeModal(m)); }
  if ($("#search").classList.contains("open")) { const it = $$(".s-it"); if (!it.length) return; if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sIdx = (sIdx + (e.key === "ArrowDown" ? 1 : -1) + it.length) % it.length; it.forEach((x, i) => x.classList.toggle("on", i === sIdx)); it[sIdx].scrollIntoView({ block: "nearest" }); } if (e.key === "Enter") { e.preventDefault(); it[sIdx].click(); } }
});
$("#app").addEventListener("pointermove", (e) => { const mi = e.target.closest("#mainImg"); if (!mi || innerWidth < 900) return; const r = mi.getBoundingClientRect(); mi.style.setProperty("--zx", ((e.clientX - r.left) / r.width) * 100 + "%"); mi.style.setProperty("--zy", ((e.clientY - r.top) / r.height) * 100 + "%"); mi.classList.add("zoom"); });
$("#app").addEventListener("pointerout", (e) => { const mi = e.target.closest("#mainImg"); if (mi && !mi.contains(e.relatedTarget)) mi.classList.remove("zoom"); });
$("#stage").addEventListener("pointermove", (e) => { if (!hasG || reduce) return; const r = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; $$("[data-d]", e.currentTarget).forEach((el) => gsap.to(el, { x: x * 14 * el.dataset.d, y: y * 12 * el.dataset.d, rotateY: x * 6, rotateX: -y * 6, duration: 0.8, ease: "power3.out" })); });
$("#stage").addEventListener("pointerleave", (e) => { if (hasG) gsap.to($$("[data-d]", e.currentTarget), { x: 0, y: 0, rotateX: 0, rotateY: 0, duration: 1, ease: "power3.out" }); });
const doLang = () => { lang = lang === "es" ? "en" : "es"; store.set("vt-lang", lang); applyText(); renderNav(); renderStore(); if (cur && cur !== "panel") { if (ctx) { ctx.revert(); ctx = null; } swap(route()); } else if (cur === "panel") renderCrm(route().p); };
const doTheme = (e) => { const nt = root.dataset.theme === "dark" ? "light" : "dark"; const apply = () => { root.dataset.theme = nt; store.set("vt-theme", nt); }; if (!document.startViewTransition || reduce) { apply(); return; } const x = e.clientX || innerWidth - 40, y = e.clientY || 30, r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)); try { document.startViewTransition(apply).ready.then(() => root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 700, easing: "cubic-bezier(.65,0,.15,1)", pseudoElement: "::view-transition-new(root)" })).catch(() => {}); } catch (er) { apply(); } };
$("#langBtn").addEventListener("click", doLang); $("#langBtn2").addEventListener("click", doLang);
$("#themeBtn").addEventListener("click", doTheme); $("#themeBtn2").addEventListener("click", doTheme);
addEventListener("popstate", () => { curHash = (location.hash || "#inicio").slice(1); showView(true); });
let lastY = 0;
function onScroll() { const y = scrollY; const b = $("#bar"); b.classList.toggle("solid", y > 30); b.classList.toggle("hide", y > 400 && y > lastY + 4); if (y < lastY - 4) b.classList.remove("hide"); lastY = y; }
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", markNav);
setInterval(() => { if (cur === "inicio") paintLive(); }, 5000);
