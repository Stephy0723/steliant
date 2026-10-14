/* ================= PANEL VENDEDOR ================= */
const CRM_NAV = [["dash", "panel"], ["inv", "shop"], ["orders", "store"], ["ship", "ship"], ["users", "users"], ["req", "heart"]];
ICON.ship = '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>';
ICON.users = '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.6-1.6-4.8-4-5.6"/>';
function daysAgo(d) { const a = new Date(); a.setHours(0, 0, 0, 0); const b = new Date(d); b.setHours(0, 0, 0, 0); return Math.round((a - b) / 864e5); }
function salesByDay(n) { const out = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); out.push({ d, v: allOrders().filter((o) => daysAgo(o.date) === i).reduce((a, o) => a + o.total, 0) }); } return out; }
function sumMonth(off = 0) { return allOrders().filter((o) => { const a = daysAgo(o.date); return a >= off && a < off + 30; }).reduce((a, o) => a + o.total, 0); }
const custOf = (id) => CUSTOMERS.find((c) => c.id === id) || { name: id, city: "—", img: "1500648767791-00dcc994a43e" };
const OS = ["paid", "prep", "ship", "done"];
const os = (s) => `<span class="os ${s}">${esc(t().crm.ord.st[s])}</span>`;
const newReqs = () => REQS.filter((r) => !r.converted).length;
function paintSide() {
  const r = route(); const sec = r.v === "panel" ? r.p : "";
  const out = PRODUCTS.filter((p) => level(p) === "out").length, nr = newReqs();
  $("#sideNav").innerHTML = CRM_NAV.map(([k, i]) => `<a href="#panel${k === "dash" ? "" : "/" + k}" class="sn${sec === k ? " on" : ""}">${ic(i)}${esc(t().crm.nav[k])}${k === "inv" && out ? `<em>${out}</em>` : ""}${k === "req" && nr ? `<em class="acc">${nr}</em>` : ""}</a>`).join("");
}
function renderCrm(sec) {
  if (!t().crm.nav[sec]) sec = "dash";
  paintSide(); $("#crmTitle").textContent = t().crm.nav[sec];
  const M = $("#crmMain"); M.innerHTML = { dash: crmDash, inv: crmInv, orders: crmOrders, ship: crmShip, users: crmUsers, req: crmReq }[sec]();
  if (sec === "inv") paintInv(); if (sec === "orders") paintOrders(); if (sec === "users") paintUsers();
  if (hasG && !reduce) {
    gsap.fromTo($$(".ch, .kpi, .panel, .tools, .inv-sum, .tbl-w, .col, .uc, .ucards > *", M), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.04, ease: "power3.out", clearProps: "transform,opacity" });
    $$(".kpi b[data-n]", M).forEach((b) => { const o = { v: 0 }; const n = +b.dataset.n; gsap.to(o, { v: n, duration: 1.4, ease: "power3.out", onUpdate: () => (b.textContent = b.dataset.money ? rd(o.v) : Math.round(o.v)) }); });
    gsap.fromTo($$(".chart .bar", M), { scaleY: 0, transformOrigin: "bottom" }, { scaleY: 1, duration: 0.9, stagger: 0.035, ease: "power3.out", delay: 0.2 });
    $$(".spark path", M).forEach((p) => { const l = p.getTotalLength(); gsap.fromTo(p, { strokeDasharray: l, strokeDashoffset: l }, { strokeDashoffset: 0, duration: 1.4, ease: "power2.out", delay: 0.3 }); });
  }
}
const spark = (vals) => { const mx = Math.max(...vals, 1); return `<svg class="spark" viewBox="0 0 70 28"><path d="${vals.map((v, i) => `${i ? "L" : "M"}${(i / (vals.length - 1)) * 68 + 1} ${26 - (v / mx) * 24}`).join(" ")}"/></svg>`; };
function crmDash() {
  const c = t().crm; const m0 = sumMonth(0), m1 = sumMonth(30); const o0 = allOrders().filter((o) => daysAgo(o.date) < 30); const o1 = allOrders().filter((o) => { const a = daysAgo(o.date); return a >= 30 && a < 60; });
  const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : 100);
  const s14 = salesByDay(14); const mx = Math.max(...s14.map((s) => s.v), 1); const W = 700, H = 230, bw = W / 14;
  const tops = {}; allOrders().forEach((o) => o.items.forEach((it) => (tops[it.id] = (tops[it.id] || 0) + it.qty)));
  const top = Object.entries(tops).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, q]) => [byId(id), q]).filter((x) => x[0]);
  const alerts = PRODUCTS.filter((p) => level(p) !== "ok").sort((a, b) => stockOf(a) - stockOf(b)).slice(0, 6);
  const out = PRODUCTS.filter((p) => level(p) === "out").length;
  return `<div class="ch"><div><h1>${c.hello}</h1><p>${c.sub}</p></div><div class="ch-r"><button type="button" class="btn btn-acc btn-sm" data-pnew>+ ${c.inv.add}</button></div></div>
  <div class="kpis">
    <div class="kpi"><span>${c.kpi[0]}</span><b data-n="${m0}" data-money="1">${rd(m0)}</b><small class="${m0 >= m1 ? "up" : "dn"}">${m0 >= m1 ? "▲" : "▼"} ${Math.abs(pct(m0, m1))}% ${c.vs}</small>${spark(s14.map((s) => s.v))}</div>
    <div class="kpi"><span>${c.kpi[1]}</span><b data-n="${o0.length}">${o0.length}</b><small class="${o0.length >= o1.length ? "up" : "dn"}">${o0.length >= o1.length ? "▲" : "▼"} ${Math.abs(pct(o0.length, o1.length))}% ${c.vs}</small></div>
    <div class="kpi"><span>${c.kpi[2]}</span><b data-n="${o0.length ? Math.round(m0 / o0.length) : 0}" data-money="1">${rd(o0.length ? m0 / o0.length : 0)}</b><small class="mut">${o0.reduce((a, o) => a + o.items.reduce((x, i) => x + i.qty, 0), 0)} ${t().mine.items}</small></div>
    <div class="kpi"><span>${c.kpi[3]}</span><b data-n="${out}">${out}</b><small class="${out ? "dn" : "up"}">${PRODUCTS.filter((p) => level(p) === "low").length} ${t().crm.inv.low.toLowerCase()}</small></div>
  </div>
  <div class="dash">
    <div class="panel"><div class="p-h"><b>${c.chart}</b><span class="mono mut">RD$</span></div><svg class="chart" viewBox="0 0 ${W} ${H + 20}" preserveAspectRatio="none">${[0.25, 0.5, 0.75, 1].map((g) => `<line class="gl" x1="0" x2="${W}" y1="${H - g * (H - 20)}" y2="${H - g * (H - 20)}"/>`).join("")}${s14.map((s, i) => { const h = Math.max(3, (s.v / mx) * (H - 30)); return `<g><rect class="bar${i === 13 ? " hi" : ""}" x="${i * bw + bw * 0.18}" y="${H - h}" width="${bw * 0.64}" height="${h}" rx="5"><title>${rd(s.v)}</title></rect><text x="${i * bw + bw / 2}" y="${H + 14}" text-anchor="middle">${s.d.getDate()}</text>${i === 13 || s.v === mx ? `<text class="tip" x="${i * bw + bw / 2}" y="${H - h - 6}" text-anchor="middle">${Math.round(s.v / 1000)}K</text>` : ""}</g>`; }).join("")}</svg></div>
    <div class="panel"><div class="p-h"><b>${c.top}</b></div><div class="lst">${top.map(([p, q]) => `<div class="li">${pic(U(p.imgs[0], 120))}<div><b>${esc(nameOf(p))}</b><span>${rd(p.price)}</span></div><span class="r">${q} ${es() ? "vend." : "sold"}</span></div>`).join("")}</div></div>
    <div class="panel"><div class="p-h"><b>${c.low}</b><a href="#panel/inv">${c.seeAll}</a></div><div class="lst">${alerts.length ? alerts.map((p) => `<div class="li">${pic(U(p.imgs[0], 120))}<div><b>${esc(nameOf(p))}</b><span class="sc ${level(p)}">${esc(stockLbl(p))}</span></div><button type="button" class="rbtn" data-restock="${p.id}">+5 ${c.inv.restock}</button></div>`).join("") : `<p class="mut">${c.lowNone}</p>`}</div></div>
    <div class="panel"><div class="p-h"><b>${c.recent}</b><a href="#panel/orders">${c.seeAll}</a></div><div class="lst">${allOrders().slice(0, 6).map((o) => { const cu = custOf(o.cust); return `<div class="li" data-order="${o.id}" style="cursor:pointer">${pic(U(cu.img, 100))}<div><b>${esc(cu.name)}</b><span>${o.id} · ${fmtD(o.date, { day: "numeric", month: "short" })}</span></div><span class="r">${rd(o.total)}<br>${os(o.status)}</span></div>`; }).join("")}</div></div>
  </div>`;
}
/* inventario */
const INV = { q: "", f: "all" };
function crmInv() {
  const c = t().crm.inv; const cnt = (f) => PRODUCTS.filter((p) => f === "all" || level(p) === f).length;
  return `<div class="ch"><div><h1>${c.title}</h1><p>${PRODUCTS.length} ${es() ? "productos" : "products"}</p></div><div class="ch-r"><button type="button" class="btn btn-acc btn-sm" data-pnew>+ ${c.add}</button></div></div>
  <div class="tools"><label class="tsearch">${ic("search")}<input id="invQ" placeholder="${c.search}" value="${esc(INV.q)}"></label><div class="segs">${["all", "ok", "low", "out"].map((f) => `<button type="button" data-invf="${f}" class="${INV.f === f ? "on" : ""}">${c[f]}<em>${cnt(f)}</em></button>`).join("")}</div></div>
  <div class="inv-sum" id="invSum"></div>
  <div class="tbl-w"><table><thead><tr><th>${c.prod}</th><th>${c.cat}</th><th>${c.price}</th><th>${c.stock}</th><th>${c.state}</th><th>${c.pub}</th><th></th></tr></thead><tbody id="invBody"></tbody></table></div>`;
}
function invRow(p) {
  const sized = typeof p.stock === "object";
  return `<tr data-prow="${p.id}"><td><div class="tp">${pic(U(p.imgs[0], 120))}<div><b>${esc(nameOf(p))}</b><span>${p.sku}</span></div></div></td><td>${esc(catName(p.cat))}</td><td><b>${rd(p.price)}</b></td>
    <td>${sized ? `<span class="stk sized">${Object.entries(p.stock).map(([s, n]) => `<span style="${n === 0 ? "color:var(--out)" : ""}">${s}:${n}</span>`).join(" · ")}</span>` : `<div class="stk"><button type="button" data-stk="${p.id}:-1">−</button><input type="number" min="0" value="${p.stock}" data-stki="${p.id}"><button type="button" data-stk="${p.id}:1">+</button></div>`}</td>
    <td class="st-cell"><span class="sc ${level(p)}">${esc(stockLbl(p))}</span></td><td><i class="sw mini-sw${p.hidden ? "" : " on"}" data-pub="${p.id}" role="switch" tabindex="0"></i></td><td><button type="button" class="ebtn" data-pedit="${p.id}">${t().crm.inv.edit}</button></td></tr>`;
}
function paintInv() {
  const q = INV.q.toLowerCase(); const a = PRODUCTS.filter((p) => (INV.f === "all" || level(p) === INV.f) && (!q || (nameOf(p) + " " + p.sku).toLowerCase().includes(q)));
  $("#invBody").innerHTML = a.length ? a.map(invRow).join("") : `<tr><td colspan="7" class="mut" style="text-align:center;padding:40px">${t().shop.empty}</td></tr>`;
  const units = PRODUCTS.reduce((s, p) => s + stockOf(p), 0), val = PRODUCTS.reduce((s, p) => s + stockOf(p) * p.price, 0);
  $("#invSum").innerHTML = `<span>${es() ? "Unidades" : "Units"}: <b>${units}</b></span><span>${t().crm.inv.value}: <b>${rd(val)}</b></span><span>${t().crm.inv.out}: <b>${PRODUCTS.filter((p) => level(p) === "out").length}</b></span>`;
}
function setStock(id, v) {
  const p = byId(id); p.stock = Math.max(0, Math.round(v) || 0); saveProducts();
  const row = $(`[data-prow="${id}"]`); if (row) { $("input", row) && ($("input", row).value = p.stock); $(".st-cell", row).innerHTML = `<span class="sc ${level(p)}">${esc(stockLbl(p))}</span>`; row.classList.remove("flash"); void row.offsetWidth; row.classList.add("flash"); }
  paintSide(); if ($("#invSum")) paintInv.sum ? 0 : null; const s = $("#invSum"); if (s) { const units = PRODUCTS.reduce((a, x) => a + stockOf(x), 0), val = PRODUCTS.reduce((a, x) => a + stockOf(x) * x.price, 0); s.innerHTML = `<span>${es() ? "Unidades" : "Units"}: <b>${units}</b></span><span>${t().crm.inv.value}: <b>${rd(val)}</b></span><span>${t().crm.inv.out}: <b>${PRODUCTS.filter((x) => level(x) === "out").length}</b></span>`; }
}
/* formulario producto */
let PF = null;
const SIZES_DEF = ["37", "38", "39", "40", "41", "42", "43"];
function openPF(id) {
  const p = id ? byId(id) : null; const f = t().crm.form;
  PF = p ? { id: p.id, imgs: [...p.imgs], es: [...p.es], en: [...p.en], cat: p.cat, price: p.price, old: p.old || "", sku: p.sku, sized: typeof p.stock === "object", stock: typeof p.stock === "object" ? { ...p.stock } : p.stock } : { id: null, imgs: [], es: ["", ""], en: ["", ""], cat: "accesorios", price: "", old: "", sku: "NV-" + String(100 + PRODUCTS.length * 7), sized: false, stock: 5 };
  drawPF(); openModal("pf");
}
function drawPF() {
  const f = t().crm.form;
  $("#pfCard").innerHTML = `<button type="button" class="m-x" data-x="pf">×</button><h3>${PF.id ? f.editT : f.newT}</h3>
  <div><p class="f-h">${f.photos}</p><label class="drop" id="drop">${PF.imgs[0] ? `<img class="cover" src="${U(PF.imgs[0], 800)}" alt="">` : `<svg viewBox="0 0 24 24"><path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg><b>${f.drop}</b><span>${f.dropHint}</span>`}<input type="file" id="pfFile" accept="image/*" multiple></label>
    <div class="pf-thumbs" id="pfThumbs">${PF.imgs.map((im, i) => `<div class="pft${i === 0 ? " cov" : ""}" data-pfcover="${i}" title="${f.cover}"><img src="${U(im, 160)}" alt=""><button type="button" data-pfrm="${i}">×</button></div>`).join("")}</div></div>
  <div>
    <div class="fld"><input id="pf-name" placeholder=" " value="${esc(PF.es[0])}"><label for="pf-name">${f.name}</label></div>
    <div class="fld"><input id="pf-name-en" placeholder=" " value="${esc(PF.en[0])}"><label for="pf-name-en">${f.nameEn}</label></div>
    <div class="fld"><textarea id="pf-desc" rows="2" placeholder=" ">${esc(es() ? PF.es[1] : PF.en[1])}</textarea><label for="pf-desc">${f.desc}</label></div>
    <div class="two"><div class="fld static"><select id="pf-cat">${CATS.map((c) => `<option value="${c.id}" ${PF.cat === c.id ? "selected" : ""}>${esc(L(c))}</option>`).join("")}</select><label>${f.cat}</label></div><div class="fld"><input id="pf-sku" placeholder=" " value="${esc(PF.sku)}"><label for="pf-sku">${f.sku}</label></div></div>
    <div class="two"><div class="fld"><input id="pf-price" placeholder=" " inputmode="numeric" value="${PF.price}"><label for="pf-price">${f.price}</label></div><div class="fld"><input id="pf-old" placeholder=" " inputmode="numeric" value="${PF.old}"><label for="pf-old">${f.old}</label></div></div>
    <label class="tog" data-pfsized style="margin:6px 0 12px">${f.useSizes}<i class="sw${PF.sized ? " on" : ""}"></i></label>
    ${PF.sized ? `<p class="f-h">${f.sizes}</p><div class="sz-ed">${Object.entries(PF.stock).map(([s, n]) => `<label>${s}<input type="number" min="0" value="${n}" data-pfsz="${s}"></label>`).join("")}</div>` : `<div class="fld"><input id="pf-stock" type="number" min="0" placeholder=" " value="${PF.stock}"><label for="pf-stock">${f.stock}</label></div>`}
    <p class="err-t" id="pfErr"></p>
    <div class="pf-acts">${PF.id ? `<button type="button" class="btn btn-line pf-del" data-pfdel>${f.del}</button>` : ""}<button type="button" class="btn btn-acc" data-pfsave>${f.save}</button></div>
  </div>`;
  const dz = $("#drop");
  ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
  dz.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
}
function syncPF() {
  if (!$("#pf-name")) return; PF.es[0] = $("#pf-name").value.trim(); PF.en[0] = $("#pf-name-en").value.trim(); const d = $("#pf-desc").value.trim(); if (es()) PF.es[1] = d; else PF.en[1] = d;
  PF.cat = $("#pf-cat").value; PF.sku = $("#pf-sku").value.trim(); PF.price = +$("#pf-price").value.replace(/\D/g, "") || ""; PF.old = +$("#pf-old").value.replace(/\D/g, "") || "";
  if (PF.sized) $$("[data-pfsz]").forEach((i) => (PF.stock[i.dataset.pfsz] = Math.max(0, +i.value || 0))); else PF.stock = Math.max(0, +$("#pf-stock").value || 0);
}
function addFiles(files) {
  syncPF(); const fs = [...files].filter((f) => f.type.startsWith("image/")).slice(0, 6); if (!fs.length) return;
  fs.forEach((file) => { const rd0 = new FileReader(); rd0.onload = () => { const im = new Image(); im.onload = () => { const s = Math.min(1, 900 / Math.max(im.width, im.height)); const cv = document.createElement("canvas"); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); PF.imgs.push(cv.toDataURL("image/jpeg", 0.8)); drawPF(); const last = $$("#pfThumbs .pft").pop(); if (last) { last.insertAdjacentHTML("beforeend", '<span class="up-bar"><i></i></span>'); requestAnimationFrame(() => { $(".up-bar i", last).style.width = "100%"; setTimeout(() => $(".up-bar", last)?.remove(), 800); }); } }; im.src = rd0.result; }; rd0.readAsDataURL(file); });
}
function savePF() {
  syncPF(); const f = t().crm.form;
  if (!(PF.es[0] || PF.en[0]) || !PF.price || !PF.imgs.length) { $("#pfErr").textContent = f.need; return; }
  if (!PF.en[0]) PF.en[0] = PF.es[0]; if (!PF.es[0]) PF.es[0] = PF.en[0]; if (!PF.es[1]) PF.es[1] = PF.en[1] || ""; if (!PF.en[1]) PF.en[1] = PF.es[1];
  const data = { cat: PF.cat, price: PF.price, old: PF.old || undefined, imgs: PF.imgs, stock: PF.stock, sku: PF.sku, es: PF.es, en: PF.en };
  if (PF.id) Object.assign(byId(PF.id), data); else PRODUCTS.unshift({ id: "n" + Date.now().toString(36), new: true, views: 0, ...data });
  saveProducts(); closeModal("pf"); toast("✓ " + f.saved); renderCrm(route().p);
}
/* ventas */
const ORD = { q: "", f: "all" };
function crmOrders() {
  const c = t().crm.ord; const A = allOrders(); const cnt = (f) => A.filter((o) => f === "all" || o.status === f).length;
  return `<div class="ch"><div><h1>${c.title}</h1><p>${A.length} ${es() ? "pedidos" : "orders"} · ${rd(A.reduce((a, o) => a + o.total, 0))}</p></div></div>
  <div class="tools"><label class="tsearch">${ic("search")}<input id="ordQ" placeholder="${c.id} / ${c.cust}" value="${esc(ORD.q)}"></label><div class="segs">${["all", ...OS].map((f) => `<button type="button" data-ordf="${f}" class="${ORD.f === f ? "on" : ""}">${f === "all" ? c.all : c.st[f]}<em>${cnt(f)}</em></button>`).join("")}</div></div>
  <div class="tbl-w"><table><thead><tr><th>${c.id}</th><th>${c.cust}</th><th>${c.date}</th><th>${c.items}</th><th>${c.total}</th><th>${c.pay}</th><th>${c.status}</th></tr></thead><tbody id="ordBody"></tbody></table></div>`;
}
function paintOrders() {
  const q = ORD.q.toLowerCase(); const a = allOrders().filter((o) => (ORD.f === "all" || o.status === ORD.f) && (!q || (o.id + " " + custOf(o.cust).name).toLowerCase().includes(q)));
  $("#ordBody").innerHTML = a.map((o) => { const cu = custOf(o.cust); return `<tr data-order="${o.id}" style="cursor:pointer"><td class="mono"><b>${o.id}</b></td><td><span class="cu">${pic(U(cu.img, 80))}${esc(cu.name)}</span></td><td>${fmtD(o.date, { day: "numeric", month: "short" })} · ${new Date(o.date).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" })}</td><td><div class="mc-imgs">${o.items.map((i) => byId(i.id)).filter(Boolean).slice(0, 3).map((p) => pic(U(p.imgs[0], 80))).join("")}</div></td><td><b>${rd(o.total)}</b></td><td>${o.pay}</td><td>${os(o.status)}</td></tr>`; }).join("") || `<tr><td colspan="7" class="mut" style="text-align:center;padding:40px">—</td></tr>`;
  $$("#ordBody .mc-imgs img").forEach((im) => { im.style.width = im.style.height = "32px"; im.style.borderRadius = "8px"; im.style.marginLeft = "-8px"; im.style.border = "2px solid var(--paper)"; });
}
function openOrder(id) {
  const o = allOrders().find((x) => x.id === id); if (!o) return; const c = t().crm.ord; const cu = custOf(o.cust); const si = OS.indexOf(o.status);
  openDrawer(`<p class="kick">${c.detail}</p><h3>${o.id}</h3><div class="uc-h" style="margin-bottom:16px">${pic(U(cu.img, 120))}<div><b>${esc(cu.name)}</b><span>${esc(cu.city)} · ${cu.phone || ""}</span></div></div>
    <div class="lst" style="margin-bottom:14px">${o.items.map((it) => { const p = byId(it.id); return p ? `<div class="li">${pic(U(p.imgs[0], 120))}<div><b>${esc(nameOf(p))}</b><span>${it.qty} × ${rd(it.price)}</span></div><span class="r">${rd(it.qty * it.price)}</span></div>` : ""; }).join("")}</div>
    <div class="ticket"><div class="tk-rows"><div><span>${c.total}</span><b>${rd(o.total)}</b></div><div><span>${c.pay}</span><b>${o.pay}</b></div><div><span>${c.carrier}</span><b>${o.carrier}</b></div><div><span>${c.track}</span><b class="mono">${o.track}</b></div></div></div>
    <p class="f-h">${c.status}</p><div class="steps" style="margin-bottom:16px">${OS.map((s, i) => `<span class="${i <= si ? "on" : ""}">${c.st[s]}</span>`).join("")}</div>
    <div class="segs">${OS.map((s) => `<button type="button" data-setst="${o.id}:${s}" class="${o.status === s ? "on" : ""}">${c.st[s]}</button>`).join("")}</div>`);
}
function setStatus(id, s) {
  SHIP_OVR[id] = s; store.set("vt-ship", JSON.stringify(SHIP_OVR));
  const ex = EXTRA_ORDERS.find((o) => o.id === id); if (ex) { ex.status = s; store.set("vt-orders", JSON.stringify(EXTRA_ORDERS)); }
  toast(`${t().crm.ship.moved} “${t().crm.ord.st[s]}”`);
}
/* envíos */
function crmShip() {
  const c = t().crm; const A = allOrders().filter((o) => o.status !== "done" || daysAgo(o.date) < 9).slice(0, 26);
  return `<div class="ch"><div><h1>${c.ship.title}</h1><p>${c.ship.hint}</p></div></div><div class="kan">${OS.map((s, si) => { const L0 = A.filter((o) => o.status === s); return `<div class="col" data-col="${s}"><div class="col-h">${os(s)}<em>${L0.length}</em></div>${L0.map((o) => { const cu = custOf(o.cust); return `<div class="kc" draggable="true" data-kc="${o.id}"><div class="kc-t"><b>${o.id}</b><span>${fmtD(o.date, { day: "numeric", month: "short" })}</span></div><b style="font-size:13.5px">${esc(cu.name)}</b><div class="imgs">${o.items.map((i) => byId(i.id)).filter(Boolean).slice(0, 4).map((p) => pic(U(p.imgs[0], 80))).join("")}</div><div class="kc-b"><span>${o.carrier} · ${esc(cu.city)}</span><div class="kc-mv">${si > 0 ? `<button type="button" data-mv="${o.id}:${OS[si - 1]}" aria-label="prev">←</button>` : ""}${si < 3 ? `<button type="button" data-mv="${o.id}:${OS[si + 1]}" aria-label="next">→</button>` : ""}</div></div><div class="trk"><i style="width:${(si + 1) * 25}%"></i></div></div>`; }).join("")}</div>`; }).join("")}</div>`;
}
let dragId = null;
document.addEventListener("dragstart", (e) => { const k = e.target.closest && e.target.closest("[data-kc]"); if (!k) return; dragId = k.dataset.kc; k.classList.add("drag"); try { e.dataTransfer.setData("text/plain", dragId); } catch (er) {} });
document.addEventListener("dragend", (e) => { const k = e.target.closest && e.target.closest("[data-kc]"); if (k) k.classList.remove("drag"); $$(".col.over").forEach((c) => c.classList.remove("over")); });
document.addEventListener("dragover", (e) => { const c = e.target.closest && e.target.closest("[data-col]"); if (!c || !dragId) return; e.preventDefault(); $$(".col").forEach((x) => x.classList.toggle("over", x === c)); });
document.addEventListener("drop", (e) => { const c = e.target.closest && e.target.closest("[data-col]"); if (!c || !dragId) return; e.preventDefault(); setStatus(dragId, c.dataset.col); dragId = null; renderCrm("ship"); });
/* clientes */
let UQ = "";
function crmUsers() {
  const c = t().crm.users; return `<div class="ch"><div><h1>${c.title}</h1><p>${CUSTOMERS.length + REQS.length} ${c.total.toLowerCase()}</p></div></div><div class="tools"><label class="tsearch">${ic("search")}<input id="usrQ" placeholder="${c.title}…" value="${esc(UQ)}"></label></div><div class="ucards" id="ucards"></div>`;
}
function paintUsers() {
  const c = t().crm.users; const A = allOrders(); const q = UQ.toLowerCase();
  const fromReq = REQS.map((r) => ({ id: "r" + r.code, name: r.name, city: es() ? "Catálogo" : "Catalog", phone: r.phone, email: r.email, since: 2026, img: "1534528741775-53994a69daeb", fresh: true }));
  const all = [...fromReq, ...CUSTOMERS].filter((u) => !q || (u.name + " " + u.city + " " + (u.email || "")).toLowerCase().includes(q));
  $("#ucards").innerHTML = all.map((u) => { const os0 = A.filter((o) => o.cust === u.id); const spent = os0.reduce((a, o) => a + o.total, 0); const last = os0[0];
    return `<div class="uc"><div class="uc-h">${pic(U(u.img, 120))}<div><b>${esc(u.name)}</b><span>${esc(u.city)}</span></div>${spent > 40000 ? `<span class="tag">${c.vip}</span>` : u.fresh ? `<span class="tag new">${es() ? "Nuevo" : "New"}</span>` : ""}</div><div class="uc-s"><div><b>${os0.length}</b><span>${c.orders}</span></div><div><b>${spent ? Math.round(spent / 1000) + "K" : "—"}</b><span>${c.spent}</span></div><div><b>${last ? fmtD(last.date, { day: "numeric", month: "short" }) : "—"}</b><span>${c.last}</span></div></div><div class="uc-c"><span>${esc(u.phone || "")}</span><span>${c.since} ${u.since}</span></div></div>`; }).join("");
}
/* solicitudes */
function crmReq() {
  const c = t().crm.reqs;
  return `<div class="ch"><div><h1>${c.title}</h1><p>${REQS.length} · ${newReqs()} ${es() ? "pendientes" : "pending"}</p></div></div>` + (REQS.length ? `<div class="ucards">${REQS.map((r, i) => `<div class="uc"><div class="uc-h"><div><b>${esc(r.name)}</b><span>${r.code} · ${fmtD(r.date, { day: "numeric", month: "short" })} · ${new Date(r.date).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" })}</span></div>${r.converted ? `<span class="tag">${c.converted}</span>` : `<span class="tag new">${es() ? "Nueva" : "New"}</span>`}</div><div class="mc-imgs">${r.items.map((x) => byId(x.id)).filter(Boolean).map((p) => pic(U(p.imgs[0], 100))).join("")}</div><div class="lst">${r.items.map((x) => { const p = byId(x.id); return p ? `<div class="uc-c"><span>${esc(nameOf(p))}${x.size ? " · " + x.size : ""} × ${x.qty}</span><b>${rd(p.price * x.qty)}</b></div>` : ""; }).join("")}</div><div class="uc-c"><span>${c.via}: ${t().req.vias[r.via]} · ${esc(r.phone)}</span><b>${rd(r.total)}</b></div>${r.note ? `<p class="mut" style="font-size:12.5px">“${esc(r.note)}”</p>` : ""}${r.converted ? "" : `<button type="button" class="btn btn-acc btn-sm" data-convert="${i}">${c.convert}</button>`}</div>`).join("")}</div>` : `<div class="sel-empty">${ic("heart")}<p>${c.empty}</p><a href="#catalogo" class="btn btn-line">${t().list.go}</a></div>`);
}
function convertReq(i) {
  const r = REQS[i]; if (!r || r.converted) return;
  r.items.forEach((x) => { const p = byId(x.id); if (!p) return; if (typeof p.stock === "object") { if (x.size && p.stock[x.size] != null) p.stock[x.size] = Math.max(0, p.stock[x.size] - x.qty); } else p.stock = Math.max(0, p.stock - x.qty); });
  const cid = "r" + r.code; const o = { id: "V-" + (2481 + EXTRA_ORDERS.length), cust: cid, items: r.items.map((x) => ({ id: x.id, qty: x.qty, price: (byId(x.id) || { price: 0 }).price })), total: r.total, date: new Date().toISOString(), status: "paid", carrier: r.via === 2 ? CARRIERS[2] : CARRIERS[0], track: "TRK" + Math.floor(100000 + Math.random() * 899999), pay: "Transferencia" };
  if (!CUSTOMERS.find((c) => c.id === cid)) CUSTOMERS.unshift({ id: cid, name: r.name, city: es() ? "Catálogo" : "Catalog", phone: r.phone, email: r.email, since: 2026, img: "1534528741775-53994a69daeb", fresh: true });
  EXTRA_ORDERS.unshift(o); store.set("vt-orders", JSON.stringify(EXTRA_ORDERS)); r.converted = true; store.set("vt-reqs", JSON.stringify(REQS)); saveProducts();
  if (req && req.code === r.code) { req.status = 2; store.set("vt-req", JSON.stringify(req)); renderMine(); }
  toast(`✓ ${t().crm.reqs.converted} · ${o.id}`); renderCrm("req");
}
/* eventos del panel (llamados desde el manejador global) */
function crmClick(e, t0) {
  if (t0.closest("#sideBtn")) { $("#side").classList.toggle("open"); return true; }
  if (t0.closest("[data-pnew]")) { openPF(null); return true; }
  const pe = t0.closest("[data-pedit]"); if (pe) { openPF(pe.dataset.pedit); return true; }
  const sk = t0.closest("[data-stk]"); if (sk) { const [id, d] = sk.dataset.stk.split(":"); setStock(id, byId(id).stock + +d); return true; }
  const rs = t0.closest("[data-restock]"); if (rs) { const p = byId(rs.dataset.restock); if (typeof p.stock === "object") Object.keys(p.stock).forEach((k) => (p.stock[k] += 1)); else p.stock += 5; saveProducts(); toast(`✓ ${nameOf(p)} · ${stockOf(p)} ${t().st.units}`); renderCrm("dash"); return true; }
  const pb = t0.closest("[data-pub]"); if (pb) { const p = byId(pb.dataset.pub); p.hidden = !p.hidden; pb.classList.toggle("on", !p.hidden); saveProducts(); toast(p.hidden ? (es() ? "Oculto del catálogo" : "Hidden from catalog") : (es() ? "Publicado en el catálogo" : "Published in catalog")); return true; }
  const iv = t0.closest("[data-invf]"); if (iv) { INV.f = iv.dataset.invf; $$("[data-invf]").forEach((b) => b.classList.toggle("on", b === iv)); paintInv(); return true; }
  const of = t0.closest("[data-ordf]"); if (of) { ORD.f = of.dataset.ordf; $$("[data-ordf]").forEach((b) => b.classList.toggle("on", b === of)); paintOrders(); return true; }
  const od = t0.closest("[data-order]"); if (od) { openOrder(od.dataset.order); return true; }
  const st = t0.closest("[data-setst]"); if (st) { const [id, s] = st.dataset.setst.split(":"); setStatus(id, s); openOrder(id); if (route().p === "orders") paintOrders(); return true; }
  const mv = t0.closest("[data-mv]"); if (mv) { const [id, s] = mv.dataset.mv.split(":"); setStatus(id, s); renderCrm("ship"); return true; }
  const cv = t0.closest("[data-convert]"); if (cv) { convertReq(+cv.dataset.convert); return true; }
  if (t0.closest("[data-pfsized]")) { e.preventDefault(); syncPF(); PF.sized = !PF.sized; PF.stock = PF.sized ? Object.fromEntries(SIZES_DEF.map((s) => [s, 1])) : 5; drawPF(); return true; }
  const pr = t0.closest("[data-pfrm]"); if (pr) { e.preventDefault(); e.stopPropagation(); syncPF(); PF.imgs.splice(+pr.dataset.pfrm, 1); drawPF(); return true; }
  const pc = t0.closest("[data-pfcover]"); if (pc) { syncPF(); const [im] = PF.imgs.splice(+pc.dataset.pfcover, 1); PF.imgs.unshift(im); drawPF(); return true; }
  if (t0.closest("[data-pfsave]")) { savePF(); return true; }
  if (t0.closest("[data-pfdel]")) { const i = PRODUCTS.findIndex((p) => p.id === PF.id); if (i > -1) PRODUCTS.splice(i, 1); list = list.filter((x) => x.id !== PF.id); saveList(); saveProducts(); closeModal("pf"); toast(t().crm.form.deleted); renderCrm(route().p); return true; }
  if (e.target === $("#side") ? false : $("#side").classList.contains("open") && !t0.closest("#side")) { $("#side").classList.remove("open"); return true; }
  return false;
}
function crmChange(e) { if (e.target.id === "pfFile") addFiles(e.target.files); const si = e.target.closest("[data-stki]"); if (si) setStock(si.dataset.stki, +si.value); }
function crmInput(e) {
  if (e.target.id === "invQ") { INV.q = e.target.value; paintInv(); }
  if (e.target.id === "ordQ") { ORD.q = e.target.value; paintOrders(); }
  if (e.target.id === "usrQ") { UQ = e.target.value; paintUsers(); }
}
document.addEventListener("keydown", (e) => { const sw = e.target.closest && e.target.closest("[data-pub]"); if (sw && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); sw.click(); } });

/* ================= arranque ================= */
$("#tiles").innerHTML = "<i></i>".repeat(40);
applyText(); renderNav(); renderStore();
showView(false);
(function boot() {
  const ld = $("#loader");
  const fin = () => { firstLoad = false; if (cur && cur !== "panel") { if (ctx) ctx.revert(); enter(cur); } };
  if (!hasG || reduce) { ld.style.display = "none"; firstLoad = false; return; }
  const o = { v: 0 }; gsap.to(o, { v: 100, duration: 1.3, ease: "power2.inOut", onUpdate: () => ($("#ldN").textContent = Math.round(o.v) + "%"), onComplete: () => { ld.classList.add("out"); setTimeout(fin, 150); } });
})();
})();
