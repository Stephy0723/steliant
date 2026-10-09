# GLITCH GANG — Plataforma de eSports

**by Steliant** · Tecnología + Comunidad + Gaming Premium + Glitch Elegante.

## Monorepo

```
glitchgang/
├── frontend/   # React + Vite + Framer Motion  (rama principal de UI)
└── backend/    # Node + Express                 (rama principal de API)
```

Cada feature vive en su carpeta con su `.jsx` y su `.css`. Nunca todo en un archivo.

## Frontend

```
frontend/src/
├── theme/        # tokens, paletas (acento + fondo), modo claro/oscuro · ThemeContext
├── i18n/         # diccionario ES/EN + LangContext (idioma conmutable)
├── hooks/        # useReveal (animación viva al scroll), useScrolled
├── components/   # atómicos: Logo, Button, GlitchText, Preloader, Navbar,
│                 #           ThemeSwitcher, Reveal, SocialLinks, Sidebar, Topbar, icons
├── sections/     # Hero (+CircuitGrid), Stats, Features, Footer (espectacular)
├── layouts/      # DashboardLayout (Sidebar + Topbar + contenido)
└── pages/        # Landing (pública)  ·  Dashboard (app con sidebar-menú)
```

### Navegación
- `#/` → Landing con preloader + animaciones al scroll.
- `#/app` → Dashboard (los botones "Iniciar sesión / Unirse" llevan aquí; "Cerrar sesión" vuelve).

### Arrancar
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

## Backend

```
backend/
├── server.js
└── src/{config,routes,controllers,middleware,models}/
```

```bash
cd backend && npm install && cp .env.example .env && npm run dev   # http://localhost:4000
```

### MongoDB

The API waits for MongoDB before accepting requests. For a local database, keep:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/glitchgang
```

For MongoDB Atlas, replace `MONGODB_URI` in `backend/.env` with the connection string provided by Atlas:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER/glitchgang
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
```

Use `GET /api/health` to confirm the API and database status.

The backend synchronizes the `countries` collection on startup and exposes it at `GET /api/countries`.
Authentication endpoints live under `/api/auth`: register, login, forgot password and reset password.

## Características
- **Sidebar-menú** colapsable (Dashboard, Torneos, Equipos, GLITCH GANG TV, Comunidad, Amigos,
  Mensajes, Noticias, Mi Perfil, Notificaciones, Ajustes, GLITCH GANG) + tarjeta **Premium**,
  idioma ES/EN, modo claro/oscuro, temas y **Cerrar sesión**.
- **Topbar** con datos cruciales (GP/puntos, mensajes, notificaciones, perfil, búsqueda global).
- **Footer espectacular** con columnas (Plataforma / Soporte / Legal), redes sociales,
  aviso legal de Riot Games y firma **by Steliant**.
- **Animaciones al scroll** que reviven cada vez que el bloque entra en pantalla.
- **i18n** completo ES/EN y **temas** (6 acentos · 6 fondos).

## Paleta
Verde `#00E676` (principal) · Morado `#8B5CF6` · Azul `#3B82F6` · Rosa `#FF4FD8` ·
Amarillo `#FACC15` · Rojo `#EF4444`. Fondos: AMOLED, Premium, Oscuro, Claro, Blanco, Crema.

