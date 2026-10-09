# Tour Steliant — plantilla premium de transporte terrestre

Rama de exhibición `steliant-exhibicion-completa`. Next.js 16 (exportación estática, `basePath: /demos/tour-steliant`), sin backend: pagos, envíos y pedidos son demostraciones.

## Páginas
Inicio · Destinos · Horarios · Reservas · VIP · Tracking · Paquetería · Cafetería · Promociones — cada una con su propia vista y transición de cortina entre páginas.

## Incluye
- **Tema claro/oscuro**: paleta en variables CSS (`src/app/globals.css`). La escena 3D cambia de atardecer a noche con faros.
- **ES / EN**: todos los textos en `src/lib/content.ts` (`T.es`, `T.en`).
- **Responsive** de 360 px a pantallas grandes.
- **Movimiento**: GSAP + ScrollTrigger + Flip, scroll suave con Lenis, portada cinematográfica con fotos reales, navbar con mega menú y ticker de salidas, tablero de salidas tipo *split-flap*, mapa de rutas con coordenadas reales, mapa en vivo (Leaflet), cursor y botones magnéticos.
- **Reservas**: ruta → mapa de asientos → pasajeros → checkout (tarjeta holográfica, Apple/Google Pay demo) → boleto impreso → regreso al inicio con botón flotante "Mi boleto" y tarjeta "Tu próximo viaje".

## Personalizar
- Colores: `:root` en `globals.css` (claro y oscuro).
- Rutas, ciudades, precios, menú y fotos: `src/lib/content.ts` (fotos de Unsplash de muestra).

```bash
npm ci
npm run dev
npm run build   # genera /out
```
