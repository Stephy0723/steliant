# Steliant Vitrina · Catálogo + panel del vendedor

Plantilla de exhibición (solo diseño, sin backend; datos de ejemplo guardados en el navegador).

**Catálogo** — precios y existencias en vivo (stock por talla), filtros, búsqueda (⌘K), vista rápida, ficha con galería y zoom, "Avísame cuando llegue". El cliente arma *Mi selección* y la envía por WhatsApp, correo o visita; recibe un código y la ve en el inicio.

**Panel del vendedor** (`#panel`) — resumen con ventas y alertas de stock, inventario (+/−, publicar/ocultar), alta y edición de productos con subida de fotos, ventas, envíos en tablero (arrastrar entre etapas), clientes y solicitudes del catálogo que se convierten en venta.

Modo claro/oscuro, español/inglés y responsive.

- `src/` — `data.js` (productos, clientes, pedidos), `i18n.js`, `app.js` (catálogo), `crm.js` (panel), `style.css`, `body.html`.
- `bash build.sh` — genera `index.html`.

Demo: https://stephy0723.github.io/steliant/demos/steliant-vitrina/
