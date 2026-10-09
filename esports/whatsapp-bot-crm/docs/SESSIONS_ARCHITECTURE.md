# 🔐 Arquitectura de Sesión y Autenticación - GlitchGang CRM

## 📊 Flujo Actual (Sessions HTTP)

```
┌─────────────────────────────────────────────────────────────┐
│                        NAVEGADOR                             │
│                                                              │
│  1. Usuario abre: http://localhost:4100/crm/login          │
│  2. Ve formulario de login                                  │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    LOGIN.HTML (Frontend)                    │
│                                                              │
│  - Captura: usuario & contraseña                           │
│  - Validación local: campos requeridos                      │
│  - Envía: POST /crm/auth/login                            │
│    Body: {"username":"admin", "password":"..."}            │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│           BACKEND - crm/routes.js (POST /auth/login)        │
│                                                              │
│  1. Recibe: username & password                            │
│  2. Valida: compara con .env                               │
│     CRM_ADMIN_USER = "admin"                               │
│     CRM_ADMIN_PASSWORD = "change-me-now"                   │
│  3. Si es correcto:                                        │
│     ✅ req.session.crmUser = { username: "admin" }        │
│     → Express Session guarda en memoria/cookies            │
│  4. Responde: { ok: true }                                 │
│  5. Si es incorrecto:                                      │
│     ❌ Responde: 401 { message: "Credenciales incorrectas"}│
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
                    ¿Login OK?
                   /         \
                  ✅           ❌
                  │             │
                  ▼             ▼
          Redirecciona    Muestra error
          a /crm          en login.html
                  │             
                  ▼             
┌─────────────────────────────────────────────────────────────┐
│              INDEX.HTML (Dashboard - Frontend)               │
│                                                              │
│  - Se carga app.js automáticamente                         │
│  - Hace fetch a /crm/api/dashboard                         │
│  - Renderiza vistas (Dashboard, Rankings, etc)             │
│  - Muestra: Dashboard, Usuarios, Equipos, etc.             │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│     BACKEND - Middleware de Auth (requireCrmAuth)           │
│                                                              │
│  Cada request a /crm/:                                      │
│  1. Verifica: req.session?.crmUser                         │
│  2. Si existe:                                              │
│     ✅ next() → Permite acceso                             │
│  3. Si NO existe:                                           │
│     ❌ res.status(401)                                      │
│     → Si es página: redirige a /crm/login                  │
│     → Si es API: devuelve {"message":"No autenticado"}     │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│           BACKEND - Rutas de API (/crm/api/*)              │
│                                                              │
│  Ejemplos:                                                  │
│  - GET /crm/api/dashboard → datos del dashboard            │
│  - GET /crm/api/teams → lista de equipos                   │
│  - GET /crm/api/matches → lista de partidas                │
│  - GET /crm/api/ranking → ranking calculado                │
│                                                              │
│  Todos devuelven JSON que app.js procesa                   │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│          FRONTEND - app.js (Renderización)                  │
│                                                              │
│  function api(path, options) {                              │
│    1. Fetch a /crm/api/{path}                              │
│    2. Si 401 → redirige a /crm/login                       │
│    3. Si 200 → retorna JSON                                │
│    4. Si error → muestra en panel                          │
│  }                                                          │
│                                                              │
│  async function render*() {                                │
│    - Llama api() para obtener datos                        │
│    - Genera HTML con esc() para XSS protection             │
│    - Inserta en #content                                   │
│  }                                                          │
└────────────────────────────────────────────────────────────┘
```

## 🔑 Cómo Funciona la Sesión

### Backend (Express Session)

```javascript
// src/server.js
app.use(session({
  secret: process.env.CRM_SESSION_SECRET,     // Clave para firmar cookies
  resave: false,                               // No guarda si no cambia
  saveUninitialized: false,                    // No crea sesión vacía
  cookie: {
    httpOnly: true,        // No accesible desde JavaScript (XSS protection)
    sameSite: "lax",       // Protección CSRF
    secure: false,         // true si HTTPS en producción
    maxAge: 1000*60*60*8   // 8 horas de expiración
  }
}));

// src/crm/routes.js - Login
router.post("/auth/login", (req, res) => {
  if (credenciales_correctas) {
    req.session.crmUser = { username: "admin" };  // ← Guarda en sesión
    return res.json({ ok: true });
  }
  res.status(401).json({ message: "Incorrecto" });
});

// src/crm/auth.js - Verificación
function requireCrmAuth(req, res, next) {
  if (req.session?.crmUser) return next();  // ← Lee sesión
  res.redirect("/crm/login");
}
```

### Frontend (Cookies Automáticas)

```javascript
// login.html
const res = await fetch("/crm/auth/login", {
  method: "POST",
  headers: {"Content-Type":"application/json"},
  body: JSON.stringify({username, password})
});

if (res.ok) {
  // El navegador recibió Set-Cookie automáticamente
  // Todas las siguientes requests incluyen la cookie
  location.href = "/crm";  // Va al dashboard
}

// app.js
async function api(path, options={}) {
  const res = await fetch(`/crm/api/${path}`, {
    headers: {"Content-Type":"application/json"},
    // ← La cookie se envía automáticamente (httpOnly)
  });
  
  if (res.status === 401) {
    location.href = "/crm/login";  // Sesión expiró
  }
}
```

## 🔄 Ciclo de Vida Completo

```
1. Usuario llega a http://localhost:4100/crm/login
   └─ GET /crm/login → Sirve login.html
   
2. Usuario ingresa credenciales
   └─ POST /crm/auth/login
      ├─ Backend verifica
      ├─ Si OK: req.session.crmUser = {...}
      └─ Responde: {ok: true}
   
3. Navegador recibe respuesta + Cookie de sesión
   └─ Automáticamente guarda: 
      Connect.sid=abc123def456 (httpOnly)
   
4. JavaScript redirige a /crm
   └─ GET /crm
      ├─ Middleware: requireCrmAuth chequea sesión
      ├─ Si válida: Sirve index.html
      └─ Si NO: Redirige a /crm/login
   
5. index.html carga app.js
   └─ app.js llama: api("dashboard")
      ├─ Fetch a /crm/api/dashboard
      ├─ Browser envía cookie automáticamente
      ├─ Middleware verifica req.session.crmUser
      ├─ Devuelve datos JSON
      └─ app.js renderiza
   
6. Usuario interactúa (click, scroll, etc)
   └─ Cada request API envía cookie automáticamente
   
7. Usuario hace logout
   └─ POST /crm/auth/logout
      ├─ req.session.destroy()
      ├─ Borra cookie de sesión
      └─ Redirige a /crm/login
```

## 📱 Comparación: Cookie vs Token vs Local Storage

### Actual: Cookie (Session)
```
✅ Seguro por defecto (httpOnly)
✅ No requiere código en frontend
✅ Automático en cada request
✅ Fácil de invalidar (logout)
❌ Solo funciona en mismo dominio
❌ Débil contra CSRF sin protección
```

### Alternativa: JWT Token
```
✅ Funciona en múltiples dominios
✅ Stateless (no necesita guardar en servidor)
❌ Más código en frontend
❌ Más vulnerable a XSS si está en localStorage
❌ Difícil de invalidar antes de expiración
```

## 🚀 Mejoras Posibles

### 1. **Roles y Permisos Mejorados**
```javascript
// Actual: Solo usuario/contraseña
// Mejora: Agregar roles (admin, moderador, staff)

router.post("/auth/login", (req, res) => {
  const user = getUser(username);
  if (user && verificarPassword(password, user.hash)) {
    req.session.crmUser = {
      id: user.id,
      username: user.username,
      role: user.role,  // ← NUEVO: admin, moderator, staff
      permissions: user.permissions  // ← NUEVO: array de permisos
    };
    return res.json({ ok: true });
  }
});

// Middleware para verificar permisos
function requirePermission(permission) {
  return (req, res, next) => {
    if (req.session?.crmUser?.permissions?.includes(permission)) {
      return next();
    }
    res.status(403).json({ message: "Permisos insuficientes" });
  };
}

// Uso
router.delete("/api/matches/:id", requirePermission("delete_matches"), ...);
```

### 2. **Recordar inicio de sesión (Remember Me)**
```javascript
// login.html
<input type="checkbox" name="remember" id="remember">
<label for="remember">Recordarme</label>

// Enviar
const remember = document.getElementById("remember").checked;
const res = await fetch("/crm/auth/login", {
  body: JSON.stringify({username, password, remember})
});

// Backend
if (remember) {
  req.session.cookie.maxAge = 1000*60*60*24*30;  // 30 días
} else {
  req.session.cookie.maxAge = 1000*60*60*8;      // 8 horas
}
```

### 3. **Auditoria de Login**
```javascript
// Registrar todos los logins
router.post("/auth/login", (req, res) => {
  const loginAttempt = {
    username,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    success: false,
    timestamp: new Date()
  };
  
  try {
    // Verificar credenciales...
    loginAttempt.success = true;
    crm.logLogin(loginAttempt);
    req.session.crmUser = {...};
    res.json({ ok: true });
  } catch (error) {
    crm.logLogin(loginAttempt);
    res.status(401).json({ message: "Error" });
  }
});
```

### 4. **Two-Factor Authentication (2FA)**
```javascript
// Primera fase: usuario/contraseña
// Segunda fase: código OTP

router.post("/auth/login", (req, res) => {
  if (credenciales_correctas) {
    const otp = generarOTP();  // Similar a WhatsApp
    enviarOTP(email_o_sms, otp);
    
    req.session.tempUser = { username, otp, expiresAt: ... };
    return res.json({ requiresOTP: true });
  }
});

router.post("/auth/verify-otp", (req, res) => {
  if (req.session.tempUser?.otp === code) {
    req.session.crmUser = { username: req.session.tempUser.username };
    delete req.session.tempUser;
    return res.json({ ok: true });
  }
  res.status(401).json({ message: "OTP incorrecto" });
});
```

### 5. **Logout Automático y Refresh**
```javascript
// app.js
const SESSION_TIMEOUT = 8 * 60 * 60 * 1000;  // 8 horas
let inactivityTimer;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(logout, SESSION_TIMEOUT);
}

// Resetear timer en cada interacción
document.addEventListener("mousemove", resetInactivityTimer);
document.addEventListener("keypress", resetInactivityTimer);
document.addEventListener("click", resetInactivityTimer);

async function logout() {
  await fetch("/crm/auth/logout", { method: "POST" });
  location.href = "/crm/login";
}
```

## 📋 Archivos Involucrados

```
Backend (Node.js):
├── src/server.js                    # Configuración express-session
├── src/crm/routes.js               # Endpoints de auth (/auth/login, /auth/logout)
├── src/crm/auth.js                 # Middleware requireCrmAuth
└── .env.example                    # CRM_SESSION_SECRET, credenciales

Frontend (HTML/JS):
├── src/crm/public/login.html       # Formulario y fetch a /auth/login
├── src/crm/public/index.html       # Dashboard (cargado si autenticado)
└── src/crm/public/assets/app.js    # Lógica de API calls, verificación 401
```

## 🔐 Seguridad Actual

✅ **Implementado:**
- httpOnly cookies (no accesibles desde JS)
- sameSite=lax (protección CSRF básica)
- Session storage en memoria
- Contraseña en .env (no en código)

⚠️ **Mejorable:**
- Sin encriptación de contraseña (usar bcrypt)
- Sin rate limiting en login
- Sin auditoría de intentos fallidos
- Sin 2FA
- Sin verificación de IP/User-Agent

---

¿Quieres que implemente alguna de estas mejoras?
