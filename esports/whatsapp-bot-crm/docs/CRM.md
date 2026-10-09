# GlitchGang CRM — Diseño

## Objetivo

Centralizar la operación del bot de grupos de WhatsApp de GlitchGang.

## Entidades

- Contacts: usuario, teléfono, juego, equipo, rol, verificación y estado.
- Teams: nombre, juego, región y estado.
- Tournaments: torneo, juego, fecha, cupos, bracket, reglas y Discord.
- Matches: torneo, equipos, fecha, check-in, Discord, bracket y estado.
- Groups: grupo de WhatsApp, identificador, estado y activación del bot.
- Checkins: usuario/teléfono, partida, origen y estado.
- Conversations: mensajes entrantes y salientes.
- CommandLogs: comandos ejecutados, grupo, usuario, estado y error.
- Notes: notas internas relacionadas con usuarios/equipos/torneos.

## Flujo del bot

WhatsApp Group
-> WhatsApp client
-> registra grupo + mensaje entrante
-> commandHandler
-> registra comando
-> servicio GlitchGang
-> CRM local o API externa
-> comando responde
-> registra mensaje saliente

## Seguridad inicial

El CRM usa sesión HTTP y credenciales por variables de entorno. Para producción:

1. HTTPS obligatorio.
2. Contraseña fuerte.
3. `CRM_SESSION_SECRET` aleatorio.
4. Reverse proxy Nginx.
5. Sustituir el almacenamiento JSON por PostgreSQL/MySQL.
6. Añadir roles/usuarios administrativos si habrá más de un operador.
