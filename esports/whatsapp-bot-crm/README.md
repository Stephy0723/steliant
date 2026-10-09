# GlitchGang WhatsApp Bot + API

Starter modular para operar un bot de comandos dentro de grupos de WhatsApp y conectarlo con GlitchGang.

## Funciones incluidas

- Motor de comandos independiente del proveedor de WhatsApp.
- Comandos: !ayuda, !torneos, !torneo, !equipos, !equipo, !perfil, !partida, !partidas, !checkin, !bracket, !discord, !ranking, !reglas y !soporte.
- API REST para salud, torneos, equipos, perfiles, próximas partidas y check-in.
- Datos demo incluidos.
- Adaptador para API externa de GlitchGang mediante `GLITCHGANG_API`.
- Cliente opcional de WhatsApp Web con `whatsapp-web.js`.
- Filtro para aceptar únicamente mensajes de grupos autorizados.

## Instalación

```bash
npm install
cp .env.example .env
npm run dev
```

API por defecto:

```text
http://localhost:4100
```

## Endpoints principales

```text
GET  /api/health
GET  /api/tournaments
GET  /api/tournaments/:id
GET  /api/teams
GET  /api/teams/:name
GET  /api/users/by-phone/:phone
GET  /api/users/by-phone/:phone/upcoming-match
GET  /api/users/by-phone/:phone/matches
POST /api/checkins
```

## Conectar WhatsApp

Cambia en `.env`:

```env
ENABLE_WHATSAPP=true
```

Al iniciar, aparecerá un QR en terminal. Escanéalo desde la cuenta de WhatsApp que operará el bot.

> Nota: `whatsapp-web.js` automatiza WhatsApp Web y no es la API oficial de Meta. Para producción, evalúa el riesgo operativo y los términos aplicables antes de usarlo con una cuenta importante.

## Conectar con GlitchGang real

Configura:

```env
GLITCHGANG_API=https://api.glitchgang.net
GLITCHGANG_API_TOKEN=tu_token
```

El archivo `src/services/glitchgangApi.js` centraliza las llamadas. Ajusta las rutas a tu backend real cuando confirmemos el contrato de tu API.

## Flujo

Grupo WhatsApp -> commandHandler -> comando -> glitchgangApi -> API/BD GlitchGang -> respuesta al grupo.


# CRM administrativo integrado

El proyecto incluye ahora un CRM accesible en:

```text
http://localhost:4100/crm
```

Credenciales iniciales de desarrollo:

```env
CRM_ADMIN_USER=admin
CRM_ADMIN_PASSWORD=change-me-now
```

**Cámbialas antes de desplegar.**

## Módulos del CRM

- Dashboard con métricas del bot.
- Usuarios vinculados por número de WhatsApp.
- Equipos.
- Torneos.
- Partidas.
- Grupos de WhatsApp detectados por el bot.
- Check-ins.
- Historial de conversaciones.
- Registro de comandos ejecutados.
- Notas internas.
- Configuración básica.

El almacenamiento local se guarda en `data/crm.json`. Es útil para desarrollo y pruebas. Para producción, se recomienda sustituirlo por PostgreSQL/MySQL conservando la misma capa de servicios.

El bot utiliza los datos del CRM local cuando `GLITCHGANG_API` está vacío. Cuando se configura la API externa de GlitchGang, puede operar contra el backend real.
