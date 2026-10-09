# Catálogo de videojuegos y editor de perfil

## Diagnóstico de truncamiento

Este repositorio usa MongoDB/Mongoose, no SQL. El script PostgreSQL incluido es una propuesta de migración o integración para un servicio relacional futuro.

1. **Frontend:** `frontend/src/data/games.js` contenía solo ocho juegos y existían listas locales adicionales de seis u ocho opciones. Aunque la base aceptara 25 registros, el usuario nunca podía seleccionar aquello que la UI no renderizaba. Mantener varias listas también produce IDs incompatibles (`val`, `Valorant`, `valorant`).
2. **API/backend:** una API suele truncar por un `limit=10` predeterminado, una allowlist/enum desactualizada o una sanitización que hace `slice(0, 10)`. En este proyecto había además una causa funcional independiente: las mutaciones exigían CSRF y el cliente no solicitaba ni enviaba el token, por lo que guardar el perfil podía fallar antes de llegar a Mongoose.
3. **SQL:** las causas más frecuentes son un `CHECK/ENUM` con juegos antiguos, una relación modelada como columnas fijas (`game_1`, `game_2`) o un seed que colisiona con índices únicos y revierte la transacción. También debe comprobarse que el endpoint no haga `SELECT ... LIMIT 10` sin paginación explícita.

## Estructura data-driven recomendada

- `game_categories` y `games` son catálogos normalizados; el slug es la identidad estable y el nombre es presentación.
- Las relaciones de usuario deben vivir en `user_games(user_id, game_id, priority, rank, role)`, no en columnas repetidas ni enums de código. Un índice único en `(user_id, game_id)` evita duplicados.
- La API expone `GET /games?active=true`, agrupable por `category_id`, y devuelve todos los activos o paginación con `total`, `limit` y `offset` visibles.
- El frontend renderiza la respuesta del endpoint; no mantiene listas paralelas. Mientras el catálogo siga embebido, `games.js` es la única fuente canónica.
- Altas y bajas se hacen con migraciones/seeds idempotentes y `is_active`; retirar un juego no rompe perfiles históricos.
- Los logos son metadatos (`logo_path`, `official_logo`) y no condiciones en componentes.
- La API valida que los slugs enviados existan y estén activos consultando datos, no mediante un `switch` o enum compilado.

## Prompts para los cinco logos internos

Todos los prompts piden una identidad interna original; no deben copiar marcas, personajes, tipografías ni emblemas registrados.

### Brawlhalla Comunitario

> Diseña un logotipo original para una liga comunitaria de fighting games llamada “Brawlhalla Comunitario”. Isotipo vectorial plano 2D basado en una letra B geométrica dividida en dos bloques que sugieran combate versus, acompañado por la palabra COMUNITARIO en tipografía sans serif condensada y limpia. Paleta limitada: azul cian, ámbar y carbón oscuro. Alto contraste, formas sólidas, trazos consistentes, legible a 32 px, composición cuadrada 1:1, fondo transparente. Sin personajes, armas detalladas, escudos heráldicos, degradados, sombras, brillos, texturas, mockups, 3D, ornamentos ni artefactos visuales. Entregar apariencia de SVG limpio con máximo tres colores.

### Slay the Spire Competitivo

> Crea una marca tipográfica original para “Slay the Spire Competitivo”. Isotipo vectorial plano 2D: una torre abstracta construida con una única forma angular y una sutil silueta de carta, junto a las iniciales SSC en sans serif geométrica. Paleta de tres tintas: rojo coral, dorado apagado y negro ciruela. Diseño minimalista, modular, centrado, reconocible en tamaño pequeño, relación 1:1 y fondo transparente. No imitar el arte o logotipo del videojuego; sin monstruos, ilustración narrativa, degradados, sombras, volumen, fuego realista, filigranas, mockup ni ruido. Texto perfectamente limpio y editable, estética de competición digital.

### Ajedrez Online

> Diseña un isotipo vectorial plano 2D para “Ajedrez Online”: una pieza de caballo reducida a cinco o seis planos geométricos combinada sutilmente con un cursor o nodo de conexión. Wordmark AJEDREZ ONLINE en sans serif moderna, espaciado amplio y máxima legibilidad. Paleta: blanco frío, verde menta y azul noche; máximo tres colores, fondo transparente, formato cuadrado 1:1. Debe funcionar en favicon y avatar. Sin tablero completo, coronas, ornamentos clásicos, degradados, sombras, biseles, 3D, texturas, circuitos complejos, fotografías o artefactos visuales. Resultado limpio, original y apto para SVG.

### TrackMania Open Series

> Genera una identidad interna original para “TrackMania Open Series” sin replicar logotipos comerciales. Isotipo vectorial plano 2D formado por una T y una flecha de pista ascendente usando geometría modular; wordmark OPEN SERIES en sans serif técnica y limpia. Colores sólidos: azul eléctrico, rojo coral y blanco sobre versión transparente. Sensación de velocidad obtenida solo mediante inclinación y espacio negativo, no con efectos. Composición 1:1, trazos gruesos, legibilidad a 32 px, máximo tres colores. Sin automóviles, banderas detalladas, degradados, sombras, motion blur, metal, 3D, mockups, ornamentos ni artefactos.

### SimRacing Ligas

> Crea un logotipo original para “SimRacing Ligas”. Isotipo vectorial plano 2D de un volante simplificado inscrito en una S geométrica, acompañado por LIGAS en tipografía sans serif robusta y limpia. Paleta limitada: grafito, azul celeste y rojo señal; formas sólidas, simetría controlada, alto contraste, fondo transparente, composición cuadrada 1:1 y legibilidad perfecta en avatar pequeño. Sin marcas de automóviles, coches realistas, pistas complejas, banderas a cuadros ornamentales, degradados, sombras, reflejos, cromado, 3D, texturas, mockup ni ruido visual. Apariencia final de SVG profesional con nodos mínimos.

