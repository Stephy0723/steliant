# 🚀 Guía de Inicio Rápido - Autenticación WhatsApp

## ⚡ En 5 minutos

### 1. Instalar dependencias
```bash
npm install
```

### 2. Copiar archivo .env
```bash
cp .env.example .env
```

Editar `.env` y cambiar variables:
```env
CRM_ADMIN_PASSWORD=tu_contraseña_aquí
CRM_SESSION_SECRET=algo_aleatorio_largo
PORT=4100
NODE_ENV=development
```

### 3. Iniciar servidor
```bash
npm start
```

Deberías ver:
```
API GlitchGang: http://localhost:4100
CRM GlitchGang: http://localhost:4100/crm
Linking WhatsApp: http://localhost:4100/crm/linking
✅ Base de datos inicializada
✅ Jobs programados iniciados
```

### 4. Acceder a la página de vinculación
Abre en tu navegador: `http://localhost:4100/crm/linking`

## 🎮 Pruebas Rápidas

### Solicitar código OTP
```bash
curl -X POST http://localhost:4100/api/whatsapp/request-code \
  -H "Content-Type: application/json" \
  -d '{"phone": "+18295551234"}'
```

En desarrollo, recibirás el código en la respuesta:
```json
{
  "success": true,
  "message": "Código enviado por WhatsApp",
  "code": "482913"
}
```

### Verificar código
```bash
curl -X POST http://localhost:4100/api/whatsapp/verify-code \
  -H "Content-Type: application/json" \
  -d '{"phone": "+18295551234", "code": "482913", "username": "tephy"}'
```

## 📱 Flujo de usuario (actual)

1. Usuario accede a `http://localhost:4100/crm/linking`
2. Ingresa su número: `+1 829 333 4455`
3. Presiona "Enviar Código"
4. Sistema genera OTP (en desarrollo se muestra, en producción va por WhatsApp)
5. Usuario ingresa código
6. Elige crear cuenta nueva o usar existente
7. ¡Listo! Ya puede usar `!perfil`

## 🔄 Verificar que funciona

### Comando !perfil en WhatsApp
Si has vinculado tu teléfono, escribe en WhatsApp:

```
!perfil
```

Bot responde:
```
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

## 📂 Archivos importantes

| Archivo | Propósito |
|---------|-----------|
| `src/db/init.js` | Base de datos SQLite |
| `src/services/otpService.js` | Generación de códigos OTP |
| `src/services/userService.js` | Gestión de usuarios |
| `src/api/routes/whatsappAuth.routes.js` | API de autenticación |
| `src/crm/public/linking.html` | Interfaz web |
| `src/commands/perfil.js` | Comando actualizado |
| `src/jobs/scheduler.js` | Jobs automáticos |

## 🧪 Debugging

### Ver errores de base de datos
```bash
NODE_ENV=development npm start 2>&1 | grep -i "database\|error"
```

### Ver códigos OTP generados
```bash
NODE_ENV=development npm start
# Los códigos aparecen en la respuesta de request-code
```

### Verificar BD
```bash
sqlite3 ./data/glitchgang.db ".tables"
```

Ver usuarios:
```bash
sqlite3 ./data/glitchgang.db "SELECT * FROM users;"
```

Ver cuentas WhatsApp:
```bash
sqlite3 ./data/glitchgang.db "SELECT * FROM whatsapp_accounts;"
```

## ⚠️ Problemas comunes

### "DATABASE_PATH no existe"
Crear carpeta:
```bash
mkdir -p data
```

### "Puerto 4100 en uso"
Cambiar en `.env`:
```env
PORT=4101
```

### "Código inválido"
Verificar que está en desarrollo:
```bash
grep NODE_ENV .env
```
Debe ser: `NODE_ENV=development`

### "Módulo sqlite3 no encontrado"
Reinstalar:
```bash
npm install sqlite3
```

## 📋 Checklist antes de producción

- [ ] Cambiar `CRM_ADMIN_PASSWORD`
- [ ] Cambiar `CRM_SESSION_SECRET`
- [ ] Establecer `NODE_ENV=production`
- [ ] Obtener credentials de Meta WhatsApp
- [ ] Crear plantillas de mensajes en Meta
- [ ] Testear envío real de OTP
- [ ] Configurar reminders de partidas
- [ ] Migrar a PostgreSQL
- [ ] Configurar backups de BD
- [ ] Configurar monitoreo de errors

## 📖 Documentación Completa

Ver: `AUTHENTICATION.md` para detalles técnicos completos.

## 🆘 Soporte

### Revisar logs
```bash
npm start
# Busca líneas con ERROR, WARN, etc.
```

### Mensaje de error específico
Busca en: `AUTHENTICATION.md` → sección "🐛 Debugging"

### Más ayuda
Revisar archivos en `src/services/` y `src/api/routes/`

---

**¿Listo?** Comienza en: `http://localhost:4100/crm/linking` 🚀
