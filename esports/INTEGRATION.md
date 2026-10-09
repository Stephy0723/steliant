# GlitchGang — Estado de integración

Resumen de lo que ya está construido y lo único que falta (credenciales + conexión).
La idea: el **espacio/estructura ya existe** en backend y frontend; cuando agregues las
credenciales y pongas `VITE_USE_BACKEND=true`, queda conectado sin reescribir pantallas.

## ✅ Listo y funcionando (sin credenciales)
Backend con **persistencia en archivos JSON** (`backend/data/`, no requiere MongoDB):

| Dominio | Endpoints | Estado |
|---|---|---|
| Torneos | `GET/POST /api/tournaments`, `GET/PUT/DELETE /api/tournaments/:id` | ✅ persiste |
| Bracket | `GET/PUT /api/tournaments/:id/bracket` | ✅ persiste (publicar + resultados) |
| Inscripciones | `GET/POST /api/tournaments/:id/registrations` | ✅ |
| Check-in | `POST /api/tournaments/:id/registrations/:rid/checkin` | ✅ (presencia / previo) |
| Reportes | `GET/POST /api/tournaments/:id/reports` | ✅ |
| Notificaciones | `GET/POST /api/notifications`, `POST /api/notifications/:id/read` | ✅ persiste |
| Uploads | `POST /api/uploads` (capturas, banners, PDF) → guarda en `backend/uploads/` | ✅ (local; cambiar a S3 luego) |
| Auth | `POST /api/auth/register|login`, `GET /api/auth/me` | ✅ (modo demo sin Mongo) |

Frontend: clientes listos en `frontend/src/lib/serverApi.js` + flag `frontend/src/lib/features.js`.
El **bracket** ya hace dual-write y `pullBracket` al backend cuando `VITE_USE_BACKEND=true`
(con respaldo a localStorage si el backend está caído).

## 🟡 Estructura lista — falta solo la credencial
| Función | Qué falta | Variables |
|---|---|---|
| **Pagos** | Cuenta Stripe. Sin clave funciona en modo DEMO (orden marcada como pagada). | `STRIPE_PUBLIC_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLIC_KEY` |
| **OAuth (Discord/Google)** | Crear apps OAuth y pegar IDs. Endpoints `/api/oauth/*` ya existen. | `DISCORD_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET` |
| **Email** | Datos SMTP para verificación/recuperación/notificaciones. | `SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM` |
| **Discord bot / check-in** | Token del bot y vincular servidor↔torneo. | `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID` |
| **WhatsApp** | Credenciales de Meta Cloud API. | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` |
| **MongoDB (opcional)** | Solo si quieres BD en vez de archivos JSON. | `MONGODB_ENABLED=true`, `MONGODB_URI` |

## 🔌 Cómo conectar (cuando tengas credenciales)
1. `cp backend/.env.example backend/.env` y completa las claves que tengas.
2. `cp frontend/.env.example frontend/.env` y pon `VITE_USE_BACKEND=true`.
3. Levanta backend (`cd backend && npm run dev`) y frontend (`cd frontend && npm run dev`).
4. Con eso, torneos/brackets/inscripciones/uploads pasan a ser **multiusuario y multi-dispositivo**.

## 🔜 Pendiente de "cablear" en el frontend (siguiente fase)
Las pantallas siguen leyendo de mocks en `frontend/src/data/*`. Falta cambiar cada una para
que consuma `serverApi` (los clientes ya existen):
- Lista/creación de torneos (`Tournaments`, `TorneoCrear`, `OrganizerDashboard`) → `tournamentsApi`.
- Inscripción y check-in en `TorneoDetalle` → `registrationsApi`.
- Justificaciones: subir capturas con `uploadsApi` en vez de URLs locales.
- Notificaciones globales → `notificationsApi` (hoy son locales).
- Checkout/Premium → `paymentsApi`.
- Botones OAuth del login → `oauthApi.start()`.

> El bracket ya está cableado como referencia de cómo migrar el resto.
