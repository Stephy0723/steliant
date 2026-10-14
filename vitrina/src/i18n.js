const T = {
  es: {
    nav: { home: "Inicio", shop: "Catálogo", news: "Novedades", list: "Mi selección", info: "Tienda", panel: "Panel vendedor", search: "Buscar productos…", back: "Volver al catálogo" },
    st: { ok: "Disponible", low: "Últimas unidades", out: "Agotado", units: "unid.", left: "quedan", notify: "Avísame cuando llegue", notified: "Te avisaremos", size: "Talla" },
    home: {
      kick: "Catálogo 2026", title: ["Todo lo que te gusta,", "en una vitrina."], lede: "Explora precios y existencias en tiempo real. Guarda lo que te enamora en tu selección y te lo apartamos.",
      cta1: "Ver catálogo", cta2: "Cómo funciona", live: "Inventario en vivo", prods: "productos", units: "unidades en stock", upd: "actualizado hace",
      catKick: "Categorías", catTitle: ["Elige por", "categoría"], topKick: "Lo más visto", topTitle: ["Favoritos de", "esta semana"], lowKick: "Se están agotando", lowTitle: ["Últimas", "unidades"],
      howKick: "Cómo funciona", how: [["Explora", "Filtra por categoría, precio y disponibilidad."], ["Guarda", "Toca el corazón para armar tu selección."], ["Envía", "Mándanos tu lista por WhatsApp, correo o pasa por la tienda."], ["Te lo apartamos", "Confirmamos existencias y reservamos 48 h."]],
      ctaTitle: ["¿Vendes productos?", "Así se ve tu panel."], ctaText: "Este catálogo viene con un panel para el vendedor: inventario, fotos, clientes, ventas y envíos.", ctaBtn: "Abrir panel vendedor",
    },
    shop: { kick: "Catálogo", title: ["Explora", "la colección"], filters: "Filtros", cat: "Categoría", all: "Todo", price: "Precio máx.", avail: "Solo disponibles", sort: "Ordenar", sorts: { pop: "Más vistos", low: "Menor precio", high: "Mayor precio", new: "Novedades", stock: "Más stock" }, results: "resultados", empty: "No hay productos con estos filtros.", clear: "Limpiar filtros", quick: "Vista rápida", add: "Guardar", added: "Guardado", newTag: "Nuevo", sale: "Oferta" },
    pd: { sku: "Código", stock: "Existencias", by: "Disponibilidad por talla", qty: "Cantidad", add: "Agregar a mi selección", inList: "En tu selección", related: "También te puede gustar", info: ["Envío a todo el país", "Cambios en 15 días", "Pago al retirar o transferencia"], max: "Máximo disponible", pick: "Elige una talla" },
    list: { kick: "Mi selección", title: ["Tu lista", "de favoritos"], empty: "Aún no has guardado nada. Toca el corazón en cualquier producto.", go: "Ir al catálogo", total: "Total estimado", items: "artículos", send: "Enviar mi selección", note: "No es una compra: te confirmamos existencias y te apartamos los productos por 48 h.", remove: "Quitar", unav: "Sin stock en esta talla" },
    req: { title: "Enviar selección", via: "¿Cómo te contactamos?", vias: ["WhatsApp", "Correo", "Visita a tienda"], name: "Nombre", phone: "Teléfono", email: "Correo", note: "Comentario (opcional)", send: "Enviar solicitud", sending: "Enviando…", need: "Completa nombre y teléfono.", done: "¡Solicitud enviada!", doneText: "Te escribimos en menos de 2 horas para confirmar. Tu solicitud quedó en el inicio.", code: "Código", hold: "Apartado hasta", home: "Volver al inicio", close: "Cerrar", demo: "Demostración: no se envía nada." },
    mine: { title: "Tu solicitud", status: ["Enviada", "Confirmando", "Apartado", "Listo para retirar"], open: "Ver detalle", clear: "Cancelar solicitud", items: "artículos" },
    info: { kick: "La tienda", title: ["Visítanos o", "escríbenos"], lede: "Todo lo del catálogo está en tienda. Pide tu selección y la tenemos lista.", addr: "Av. Winston Churchill 1099, Santo Domingo", hours: "Lun–Sáb · 10:00–20:00 · Dom 11:00–17:00", faq: [["¿Puedo comprar en línea?", "Este es un catálogo: eliges, nos envías tu selección y coordinamos pago y entrega."], ["¿El stock es real?", "Sí, se actualiza desde el panel del vendedor cada vez que entra o sale mercancía."], ["¿Hacen envíos?", "A todo el país en 24–72 h. Santo Domingo el mismo día antes de las 2 pm."], ["¿Cuánto tiempo apartan?", "48 horas desde que confirmamos tu selección."]] },
    footer: { tag: "Catálogo con inventario en vivo.", rights: "Plantilla diseñada por Steliant · Vista previa", sample: "Contenido de ejemplo" },
    crm: {
      brand: "Panel vendedor", exit: "Ver catálogo", hello: "Hola, Marta", sub: "Esto es lo que pasa en tu tienda hoy.",
      nav: { dash: "Resumen", inv: "Inventario", orders: "Ventas", ship: "Envíos", users: "Clientes", req: "Solicitudes" },
      kpi: ["Ventas del mes", "Pedidos", "Ticket promedio", "Productos agotados"], vs: "vs. mes anterior", chart: "Ventas últimos 14 días", top: "Más vendidos", low: "Alertas de stock", lowNone: "Todo el inventario está sano.", recent: "Ventas recientes", seeAll: "Ver todo",
      inv: { title: "Inventario", add: "Nuevo producto", search: "Buscar por nombre o código", all: "Todos", ok: "Disponibles", low: "Stock bajo", out: "Agotados", prod: "Producto", cat: "Categoría", price: "Precio", stock: "Stock", state: "Estado", pub: "Publicado", edit: "Editar", value: "Valor del inventario", restock: "Reponer" },
      form: { newT: "Nuevo producto", editT: "Editar producto", photos: "Fotos", drop: "Arrastra imágenes aquí o toca para subir", dropHint: "JPG o PNG · se optimizan automáticamente", name: "Nombre", nameEn: "Nombre en inglés", desc: "Descripción", cat: "Categoría", price: "Precio (RD$)", old: "Precio anterior (opcional)", sku: "Código", stock: "Unidades en stock", sizes: "Stock por talla", useSizes: "Maneja tallas", save: "Guardar producto", saved: "Producto guardado", del: "Eliminar", deleted: "Producto eliminado", need: "Completa nombre, precio y una foto.", cover: "Portada" },
      ord: { title: "Ventas", id: "Pedido", cust: "Cliente", date: "Fecha", items: "Artículos", total: "Total", pay: "Pago", status: "Estado", all: "Todas", st: { paid: "Pagado", prep: "Preparando", ship: "En camino", done: "Entregado" }, detail: "Detalle del pedido", carrier: "Envío", track: "Rastreo" },
      ship: { title: "Envíos", hint: "Arrastra o usa las flechas para mover los pedidos entre etapas.", moved: "Pedido movido a" },
      users: { title: "Clientes", total: "Clientes", orders: "Pedidos", spent: "Total comprado", last: "Última compra", since: "Cliente desde", city: "Ciudad", vip: "VIP" },
      reqs: { title: "Solicitudes del catálogo", empty: "Aún no hay solicitudes. Envía una desde el catálogo y aparecerá aquí.", convert: "Convertir en venta", converted: "Convertida en venta", via: "Canal" },
    },
  },
  en: {
    nav: { home: "Home", shop: "Catalog", news: "New in", list: "My picks", info: "Store", panel: "Seller panel", search: "Search products…", back: "Back to catalog" },
    st: { ok: "In stock", low: "Last units", out: "Sold out", units: "units", left: "left", notify: "Notify me", notified: "We'll let you know", size: "Size" },
    home: {
      kick: "Catalog 2026", title: ["Everything you love,", "in one showcase."], lede: "Browse prices and live stock. Save what you love to your picks and we'll hold it for you.",
      cta1: "Browse catalog", cta2: "How it works", live: "Live inventory", prods: "products", units: "units in stock", upd: "updated",
      catKick: "Categories", catTitle: ["Shop by", "category"], topKick: "Most viewed", topTitle: ["This week's", "favorites"], lowKick: "Selling out", lowTitle: ["Last", "units"],
      howKick: "How it works", how: [["Browse", "Filter by category, price and availability."], ["Save", "Tap the heart to build your picks."], ["Send", "Send your list via WhatsApp, email or visit the store."], ["We hold it", "We confirm stock and hold it for 48 h."]],
      ctaTitle: ["Do you sell products?", "This is your panel."], ctaText: "This catalog comes with a seller panel: inventory, photos, customers, sales and shipping.", ctaBtn: "Open seller panel",
    },
    shop: { kick: "Catalog", title: ["Explore", "the collection"], filters: "Filters", cat: "Category", all: "All", price: "Max price", avail: "In stock only", sort: "Sort", sorts: { pop: "Most viewed", low: "Lowest price", high: "Highest price", new: "New in", stock: "Most stock" }, results: "results", empty: "No products match these filters.", clear: "Clear filters", quick: "Quick view", add: "Save", added: "Saved", newTag: "New", sale: "Sale" },
    pd: { sku: "Code", stock: "Stock", by: "Availability by size", qty: "Quantity", add: "Add to my picks", inList: "In your picks", related: "You may also like", info: ["Nationwide shipping", "15-day exchanges", "Pay on pickup or transfer"], max: "Maximum available", pick: "Pick a size" },
    list: { kick: "My picks", title: ["Your list", "of favorites"], empty: "Nothing saved yet. Tap the heart on any product.", go: "Go to catalog", total: "Estimated total", items: "items", send: "Send my picks", note: "This is not a purchase: we confirm stock and hold your items for 48 h.", remove: "Remove", unav: "Out of stock in this size" },
    req: { title: "Send your picks", via: "How should we reach you?", vias: ["WhatsApp", "Email", "Store visit"], name: "Name", phone: "Phone", email: "Email", note: "Comment (optional)", send: "Send request", sending: "Sending…", need: "Fill in name and phone.", done: "Request sent!", doneText: "We'll write within 2 hours to confirm. Your request is on the home page.", code: "Code", hold: "Held until", home: "Back to home", close: "Close", demo: "Demo: nothing is sent." },
    mine: { title: "Your request", status: ["Sent", "Confirming", "Held", "Ready for pickup"], open: "See details", clear: "Cancel request", items: "items" },
    info: { kick: "The store", title: ["Visit us or", "write to us"], lede: "Everything in the catalog is in store. Request your picks and we'll have them ready.", addr: "1099 Winston Churchill Ave, Santo Domingo", hours: "Mon–Sat · 10:00–20:00 · Sun 11:00–17:00", faq: [["Can I buy online?", "This is a catalog: you choose, send us your picks and we arrange payment and delivery."], ["Is the stock real?", "Yes, it's updated from the seller panel every time stock comes in or goes out."], ["Do you ship?", "Nationwide in 24–72 h. Santo Domingo same day before 2 pm."], ["How long do you hold items?", "48 hours after we confirm your picks."]] },
    footer: { tag: "Catalog with live inventory.", rights: "Template designed by Steliant · Preview", sample: "Sample content" },
    crm: {
      brand: "Seller panel", exit: "View catalog", hello: "Hi, Marta", sub: "Here's what's happening in your store today.",
      nav: { dash: "Overview", inv: "Inventory", orders: "Sales", ship: "Shipping", users: "Customers", req: "Requests" },
      kpi: ["Sales this month", "Orders", "Average ticket", "Sold-out products"], vs: "vs. last month", chart: "Sales last 14 days", top: "Best sellers", low: "Stock alerts", lowNone: "All inventory is healthy.", recent: "Recent sales", seeAll: "See all",
      inv: { title: "Inventory", add: "New product", search: "Search by name or code", all: "All", ok: "In stock", low: "Low stock", out: "Sold out", prod: "Product", cat: "Category", price: "Price", stock: "Stock", state: "Status", pub: "Published", edit: "Edit", value: "Inventory value", restock: "Restock" },
      form: { newT: "New product", editT: "Edit product", photos: "Photos", drop: "Drag images here or tap to upload", dropHint: "JPG or PNG · optimized automatically", name: "Name", nameEn: "Name in English", desc: "Description", cat: "Category", price: "Price (RD$)", old: "Previous price (optional)", sku: "Code", stock: "Units in stock", sizes: "Stock by size", useSizes: "Uses sizes", save: "Save product", saved: "Product saved", del: "Delete", deleted: "Product deleted", need: "Fill in name, price and one photo.", cover: "Cover" },
      ord: { title: "Sales", id: "Order", cust: "Customer", date: "Date", items: "Items", total: "Total", pay: "Payment", status: "Status", all: "All", st: { paid: "Paid", prep: "Preparing", ship: "On the way", done: "Delivered" }, detail: "Order details", carrier: "Shipping", track: "Tracking" },
      ship: { title: "Shipping", hint: "Drag or use the arrows to move orders between stages.", moved: "Order moved to" },
      users: { title: "Customers", total: "Customers", orders: "Orders", spent: "Total spent", last: "Last purchase", since: "Customer since", city: "City", vip: "VIP" },
      reqs: { title: "Catalog requests", empty: "No requests yet. Send one from the catalog and it will show up here.", convert: "Convert to sale", converted: "Converted to sale", via: "Channel" },
    },
  },
};
let lang = store.get("vt-lang") || ((navigator.language || "es").startsWith("en") ? "en" : "es");
const t = () => T[lang];
const get = (p) => p.split(".").reduce((o, k) => (o == null ? o : o[k]), t());
const L = (o) => (lang === "en" ? o.en : o.es);
const loc = () => (lang === "en" ? "en-US" : "es-DO");
const es = () => lang === "es";
