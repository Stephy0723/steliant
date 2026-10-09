# 🎮 GlitchGang WhatsApp Bot + CRM

Sistema completo de bot de WhatsApp y CRM para gestión de torneos esports, con autenticación OTP integrada.

## ✨ Características

### 🤖 Bot de WhatsApp
- Comandos inteligentes: `!perfil`, `!partidas`, `!checkin`, `!equipo`, `!ranking`, etc.
- Respuestas formateadas y amigables
- Integración con base de datos de usuarios
- Verificación de número de WhatsApp mediante OTP

### 📊 CRM Web
- Dashboard con estadísticas
- Vista de rankings y análisis
- Gestión de equipos, torneos y partidas
- Sistema de check-in en tiempo real

### 🔐 Autenticación
- OTP seguro por WhatsApp (6 dígitos, 5 minutos)
- Hash SHA256 de códigos
- Limitador de intentos
- Vinculación de números a cuentas de usuarios

### 💾 Base de Datos
- SQLite para desarrollo (fácil de testear)
- PostgreSQL ready para producción
- 13 tablas normalizadas
- Historial completo de actividades

### 🔔 Notificaciones
- Recordatorios automáticos de partidas
- Alertas de check-in
- Historial de notificaciones
- Preferencias personalizables

## 🚀 Inicio Rápido

### 1️⃣ Instalación
```bash
# Clonar y entrar
git clone <repo>
cd glitchgang-whatsapp-bot-crm

# Instalar dependencias
npm install

# Copiar configuración
cp .env.example .env
```

### 2️⃣ Configuración
Editar `.env`:
```env
PORT=4100
NODE_ENV=development
CRM_ADMIN_PASSWORD=tu_contraseña
CRM_SESSION_SECRET=algo_aleatorio_largo
```

### 3️⃣ Iniciar
```bash
npm start
```

### 4️⃣ Acceder
- **API:** http://localhost:4100
- **CRM:** http://localhost:4100/crm
- **Linking WhatsApp:** http://localhost:4100/crm/linking

## 📱 Estructura de Carpetas

```
glitchgang-whatsapp-bot-crm/
├── src/
│   ├── db/                          # Base de datos
│   │   └── init.js                  # SQLite initialization
│   ├── services/
│   │   ├── otpService.js           # Generación de OTP
│   │   ├── userService.js          # Usuarios y WhatsApp
│   │   ├── notificationService.js  # Notificaciones
│   │   └── glitchgangApi.js        # API de datos
│   ├── api/
│   │   ├── routes.js               # Rutas principales
│   │   └── routes/
│   │       └── whatsappAuth.routes.js
│   ├── commands/                    # Comandos del bot
│   │   ├── perfil.js
│   │   ├── partidas.js
│   │   ├── checkin.js
│   │   └── ... (11 más)
│   ├── crm/
│   │   ├── public/
│   │   │   ├── index.html          # Dashboard
│   │   │   ├── login.html
│   │   │   └── linking.html        # ⭐ Vinculación WhatsApp
│   │   ├── routes.js
│   │   ├── auth.js
│   │   └── store.js
│   ├── jobs/
│   │   └── scheduler.js            # Jobs automáticos
│   ├── whatsapp/
│   │   └── client.js               # Cliente WhatsApp Web
│   ├── server.js                   # Express app
│   └── index.js                    # Entry point
├── docs/                            # Documentación
│   ├── API.md
│   ├── CRM.md
│   └── ...
├── AUTHENTICATION.md               # 🔐 Guía de autenticación
├── QUICKSTART.md                  # ⚡ Inicio rápido
├── IMPLEMENTATION_SUMMARY.md      # 📋 Resumen técnico
├── .env.example
├── package.json
└── README.md (este archivo)
```

## 🔐 Sistema de Autenticación

### Flujo Completo
```
Usuario → /crm/linking → Ingresa teléfono
  ↓
Sistema genera OTP → Almacena en BD
  ↓
Usuario recibe código por WhatsApp (en desarrollo se muestra en web)
  ↓
Usuario verifica código
  ↓
Sistema valida:
  ✓ ¿Código correcto?
  ✓ ¿No expiró?
  ✓ ¿Intentos disponibles?
  ↓
Usuario crea o selecciona cuenta
  ↓
Sistema vincula teléfono a usuario
  ↓
Ahora !perfil devuelve datos reales
```

### Endpoints de API

```bash
# Solicitar código OTP
POST /api/whatsapp/request-code
{
  "phone": "+18295551234"
}

# Verificar código y crear/vincular cuenta
POST /api/whatsapp/verify-code
{
  "phone": "+18295551234",
  "code": "482913",
  "userId": "usr_123",      // Opcional
  "username": "tephy"       // Si es nuevo usuario
}

# Obtener información de cuenta
GET /api/whatsapp/account/:phone

# Solicitar código nuevo
POST /api/whatsapp/request-new-code
{
  "phone": "+18295551234"
}
```

## 🎮 Comandos del Bot

| Comando | Descripción |
|---------|-------------|
| `!perfil` | Mostrar tu perfil |
| `!partidas` | Tus próximas partidas |
| `!partida` | Detalles de una partida |
| `!equipo` | Tu equipo |
| `!equipos` | Todos los equipos |
| `!ranking` | Rankings de equipos |
| `!torneos` | Todos los torneos |
| `!torneo` | Detalles de un torneo |
| `!checkin` | Hacer check-in |
| `!reglas` | Reglas del torneo |
| `!bracket` | Ver bracket |
| `!discord` | Discord link |
| `!soporte` | Contacto de soporte |
| `!ayuda` | Ver ayuda |

## 📊 Base de Datos

### Tablas Principales

```sql
users                         -- Usuarios de GlitchGang
whatsapp_accounts            -- Teléfono ↔ Usuario
whatsapp_verification_codes  -- OTP (temporal)
teams                        -- Equipos
tournaments                  -- Torneos
matches                      -- Partidas
checkins                     -- Asistencia
notifications                -- Historial de alertas
notification_preferences     -- Preferencias por usuario
command_logs                 -- Comandos ejecutados
conversations                -- Mensajes
notes                        -- Notas administrativas
```

## 🔔 Notificaciones Automáticas

Sistema de jobs que envía alertas:

- **Recordatorio de partida** (30 min antes)
- **Apertura de check-in** (cuando abre)
- **Cierre de check-in** (5 min antes de cerrar)
- **Resultado confirmado** (cuando termina partida)

## 🛠️ Desarrollo

### Requisitos
- Node.js 14+
- npm 6+
- SQLite3 (incluido en npm)

### Instalación local
```bash
npm install
npm start
```

### Variables de entorno
```env
PORT=4100
NODE_ENV=development
DATABASE_PATH=./data/glitchgang.db

# Meta WhatsApp (vacío en desarrollo)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=

# CRM
CRM_ADMIN_USER=admin
CRM_ADMIN_PASSWORD=change-me-now
CRM_SESSION_SECRET=super-secret
```

### Scripts útiles
```bash
# Iniciar en desarrollo
npm start

# Ver base de datos
sqlite3 ./data/glitchgang.db ".tables"

# Limpiar datos
rm ./data/glitchgang.db

# Ver último comando ejecutado
npm run logs
```

## 📈 Roadmap

### ✅ Completado
- [x] Base de datos SQLite
- [x] Servicio OTP
- [x] API de autenticación
- [x] Interfaz de vinculación
- [x] Jobs programados
- [x] Notificaciones (estructura)
- [x] Comando !perfil integrado

### 🔄 En Progreso
- [ ] Integración con Meta WhatsApp Cloud API
- [ ] Envío real de OTP por WhatsApp
- [ ] Envío de notificaciones

### 📋 Por Hacer
- [ ] Todos los comandos con datos reales
- [ ] Migración a PostgreSQL
- [ ] Dashboard de admin
- [ ] Reportes avanzados
- [ ] Mobile app
- [ ] Integración con Discord

## 🔒 Seguridad

- ✅ Códigos OTP con hash SHA256
- ✅ Expiración de 5 minutos
- ✅ Máximo 3 intentos
- ✅ CORS configurado
- ✅ Helmet headers
- ✅ Session segura
- ✅ Validación de inputs

## 📚 Documentación

| Archivo | Contenido |
|---------|----------|
| `QUICKSTART.md` | Inicio en 5 minutos |
| `AUTHENTICATION.md` | Guía completa de autenticación |
| `IMPLEMENTATION_SUMMARY.md` | Resumen técnico de lo implementado |
| `docs/API.md` | Documentación de API |
| `docs/CRM.md` | Documentación de CRM |

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📞 Soporte

Si encuentras problemas:

1. Revisa `QUICKSTART.md` → Problemas comunes
2. Revisa `AUTHENTICATION.md` → Debugging
3. Verifica que `NODE_ENV=development`
4. Mira los logs: `npm start`

## 📄 Licencia

Este proyecto es privado de GlitchGang. Todos los derechos reservados.

## 👥 Equipo

Desarrollado por GlitchGang Team

---

**¿Listo para empezar?** → Ve a [QUICKSTART.md](QUICKSTART.md)
