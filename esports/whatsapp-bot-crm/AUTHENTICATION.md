# Sistema de Autenticación WhatsApp - Guía de Implementación

## 📋 Resumen

Este nuevo sistema permite que los usuarios vinculen sus números de WhatsApp a sus cuentas de GlitchGang mediante códigos OTP, mejorando significativamente la autenticación y personalizción del bot.

## 🚀 Instalación

### 1. Instalar dependencias
```bash
npm install
```

Esto instala `sqlite3` y `node-cron` automáticamente.

### 2. Inicializar la base de datos
La base de datos se inicializa automáticamente cuando el servidor inicia. Se crean las siguientes tablas:

- **users** - Usuarios de GlitchGang
- **whatsapp_accounts** - Vínculos usuario ↔ WhatsApp
- **whatsapp_verification_codes** - Códigos OTP
- **teams** - Equipos
- **tournaments** - Torneos
- **matches** - Partidas
- **checkins** - Check-ins
- **notifications** - Historial de alertas
- **notification_preferences** - Preferencias de alertas
- **command_logs** - Registro de comandos

## 🔐 Flujo de Autenticación

### Paso 1: Solicitar código OTP desde la web

```bash
POST /api/whatsapp/request-code
Content-Type: application/json

{
  "phone": "+18295551234"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Código enviado por WhatsApp",
  "phone": "+18295551234",
  "expiresIn": "5 minutos",
  "code": "482913"  // Solo en desarrollo
}
```

> 💡 En desarrollo, el código se devuelve. En producción, NO se devuelve.

### Paso 2: Usuario recibe el código por WhatsApp

El bot envía automáticamente:

```
🎮 GlitchGang

Tu código de verificación es:

482913

Expira en 5 minutos.

No compartas este código con nadie.
```

### Paso 3: Usuario verifica el código desde la web

```bash
POST /api/whatsapp/verify-code
Content-Type: application/json

{
  "phone": "+18295551234",
  "code": "482913",
  "userId": "usr_123",  // Opcional - si es usuario existente
  "username": "tephy"   // Requerido si es nuevo usuario
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Cuenta vinculada correctamente",
  "userId": "usr_123",
  "phone": "+18295551234",
  "verified": true
}
```

### Paso 4: El comando `!perfil` funciona

Ahora el usuario puede usar comandos personalizados:

```
Usuario escribe: !perfil

Bot responde:
═════════════════════════════════════
👤 *PERFIL DE TEPHY*
═════════════════════════════════════

🆔 ID: GG-00241
📍 Región: República Dominicana

👤 Rol: Jugador
🎮 Juego: Valorant
🛡️ Equipo: NEOXYS

📊 *Estadísticas*
🎯 Próxima partida: Torneo Universitario
✅ WhatsApp: ✅ Verificado

═════════════════════════════════════
💡 Usa !partida para ver más detalles
```

## 📱 Endpoints disponibles

### Solicitar código OTP
```bash
POST /api/whatsapp/request-code
```
| Param | Tipo | Requerido |
|-------|------|-----------|
| phone | string | Sí |

### Verificar código
```bash
POST /api/whatsapp/verify-code
```
| Param | Tipo | Requerido |
|-------|------|-----------|
| phone | string | Sí |
| code | string | Sí |
| userId | string | No |
| username | string | Sí si userId es vacío |

### Obtener cuenta verificada
```bash
GET /api/whatsapp/account/:phone
```

Retorna información de la cuenta y usuario si está verificado.

### Solicitar nuevo código
```bash
POST /api/whatsapp/request-new-code
```
| Param | Tipo | Requerido |
|-------|------|-----------|
| phone | string | Sí |

## 🎯 Próximos pasos

### 1. Integración con Meta WhatsApp Cloud API

En `src/services/whatsappCloudApi.js`:

```javascript
async function sendOTP(phone, code) {
  // Usar plantilla de Meta para enviar OTP
  // POST https://graph.instagram.com/v18.0/YOUR_NUMBER_ID/messages
  
  const response = await axios.post(
    `https://graph.instagram.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: "otp_verification",  // Plantilla aprobada por Meta
        language: { code: "es" },
        parameters: {
          body: { parameters: [{ type: "text", text: code }] }
        }
      }
    },
    {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }
    }
  );
}
```

### 2. Notificaciones automáticas

En `src/services/notificationService.js`:

```javascript
async function sendCheckInReminder(userId, matchId) {
  // Obtener cuenta de WhatsApp
  // Construir mensaje personalizado
  // Enviar por Cloud API
}
```

### 3. Jobs programados

En `src/jobs/`:

- `matchReminderJob.js` - Alertas 30 min antes de partida
- `checkinReminderJob.js` - Alertas de check-in abierto

```javascript
cron.schedule("*/5 * * * *", async () => {
  // Buscar partidas en próxima media hora
  // Enviar alertas a usuarios verificados
});
```

## 🗄️ Migración a PostgreSQL

Cuando estés listo para producción, cambia de SQLite a PostgreSQL:

### Instalar Prisma
```bash
npm install @prisma/client
npm install -D prisma
```

### Crear schema.prisma
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                    String    @id @default(cuid())
  username              String    @unique
  email                 String?   @unique
  game                  String?
  region                String?
  status                String    @default("active")
  verified              Boolean   @default(false)
  whatsappAccounts      WhatsappAccount[]
  notifications         Notification[]
  notificationPreferences NotificationPreferences?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}

model WhatsappAccount {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  phone       String    @unique
  verified    Boolean   @default(false)
  verifiedAt  DateTime?
  lastActivity DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

// ... más modelos
```

### Ejecutar migraciones
```bash
prisma migrate dev --name init
```

## 🔒 Seguridad

- ✅ Códigos OTP con hash SHA256
- ✅ Expiración automática (5 minutos)
- ✅ Máximo 3 intentos fallidos
- ✅ Números de teléfono únicos
- ✅ Validación de formato telefónico

## 📊 Monitoreo

Los siguientes datos se registran automáticamente:

- **command_logs**: Todos los comandos ejecutados
- **conversations**: Historial de mensajes
- **notifications**: Alertas enviadas
- **whatsapp_accounts.last_activity**: Última interacción

Esto permite analizar patrones de uso y mejorar el servicio.

## 🐛 Debugging

Para ver códigos OTP en desarrollo:

```bash
NODE_ENV=development npm start
```

Los códigos aparecerán en la respuesta de `/api/whatsapp/request-code`.

## ✅ Checklist de implementación

- [ ] Instalar dependencias (`npm install`)
- [ ] Verificar que SQLite se inicializa
- [ ] Probar endpoint `/api/whatsapp/request-code`
- [ ] Probar endpoint `/api/whatsapp/verify-code`
- [ ] Verificar que `!perfil` usa usuarios reales
- [ ] Integrar con Meta WhatsApp Cloud API
- [ ] Configurar notificaciones automáticas
- [ ] Migrar a PostgreSQL
- [ ] Configurar jobs de alertas
- [ ] Testear flujo completo en staging
- [ ] Deploy a producción

---

**¿Preguntas?** Revisa los archivos en:
- `src/services/otpService.js`
- `src/services/userService.js`
- `src/api/routes/whatsappAuth.routes.js`
- `src/db/init.js`
