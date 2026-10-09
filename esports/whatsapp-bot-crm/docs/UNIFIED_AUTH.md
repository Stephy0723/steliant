# 🔗 Integración: WhatsApp Auth + CRM Session

## 🎯 Objetivo

Actualmente tienes dos sistemas de autenticación separados:

1. **CRM Login** → Usuario/Contraseña → Acceso a dashboard
2. **WhatsApp Linking** → Teléfono + OTP → Vinculación de cuenta

**Meta:** Unificar para que sean un solo flujo.

## 📊 Situación Actual

```
┌──────────────────────┐          ┌──────────────────────┐
│   CRM Dashboard      │          │  WhatsApp Linking    │
│  /crm/login          │          │  /crm/linking        │
│                      │          │                      │
│ Usuario/Contraseña   │          │ Teléfono + OTP       │
│ (Hardcoded en .env)  │          │ (BD SQLite)          │
│                      │          │                      │
│ ✅ Login exitoso     │          │ ✅ Verificado        │
│ → Dashboard          │          │ → Vinculado          │
└──────────────────────┘          └──────────────────────┘
        Aislados
```

## 🚀 Arquitectura Mejorada

### Opción 1: Mismo login para ambos (RECOMENDADO)

```
┌────────────────────────────────────────────────────────────┐
│                  NUEVO FLUJO UNIFICADO                     │
└────────────────────────────────────────────────────────────┘

1. Usuario va a: /crm/login
   ├─ Opción A: Usuario/Contraseña (para admins)
   └─ Opción B: Teléfono + OTP (para usuarios normales)

2. Si elige A (Usuario/Contraseña):
   ├─ POST /auth/login
   ├─ Verifica en BD (tabla: crm_admins)
   ├─ req.session.user = {role: "admin", ...}
   └─ Va a: /crm (Dashboard CRM)

3. Si elige B (Teléfono + OTP):
   ├─ POST /auth/request-code
   ├─ Genera OTP, guarda en BD
   ├─ Envía por WhatsApp
   ├─ Usuario ingresa OTP
   ├─ POST /auth/verify-code
   ├─ req.session.user = {phone, userId, role: "user", ...}
   └─ Va a: /crm/user (Dashboard limitado) O /crm/linking (termina vinculación)

4. Ambos usuarios ahora tienen sesión en req.session.user
   ├─ Middleware requireCrmAuth verifica sesión
   ├─ Rutas verifican req.session.user.role para permisos
   └─ API responde según permisos
```

## 💾 Cambios en Base de Datos

### Tabla: users (MODIFICADA)
```sql
-- Almacenar todos los usuarios (admins + jugadores)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT,           -- NUEVO: bcrypt hash
  role TEXT DEFAULT 'user',     -- 'admin', 'moderator', 'user'
  game TEXT,
  region TEXT,
  verified BOOLEAN DEFAULT 0,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla separada para admins (alternativa)
CREATE TABLE crm_admins (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,  -- bcrypt
  role TEXT DEFAULT 'admin',
  permissions TEXT,             -- JSON: ["view_dashboard", "edit_matches", ...]
  active BOOLEAN DEFAULT 1,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla: sessions (NUEVA - para tracking)
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  session_data TEXT,            -- JSON serializado
  ip_address TEXT,
  user_agent TEXT,
  login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  logout_at TIMESTAMP,
  expires_at TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
```

## 🔧 Implementación: Código Nuevo

### 1. `/src/crm/auth.js` (MODIFICADO)

```javascript
const bcrypt = require("bcrypt");
const db = require("../db/init");

/**
 * Middleware: Verifica que hay sesión
 */
function requireCrmAuth(req, res, next) {
  if (req.session?.user) return next();

  if (req.path.startsWith("/api/")) {
    return res.status(401).json({ 
      message: "No autenticado",
      requiresAuth: true 
    });
  }

  return res.redirect("/crm/login");
}

/**
 * Middleware: Verifica rol específico
 */
function requireRole(role) {
  return (req, res, next) => {
    if (req.session?.user?.role === role || req.session?.user?.role === "admin") {
      return next();
    }
    
    if (req.path.startsWith("/api/")) {
      return res.status(403).json({ 
        message: "Rol insuficiente",
        requiredRole: role 
      });
    }
    
    res.redirect("/crm/login?error=forbidden");
  };
}

/**
 * Autentica usuario con usuario/contraseña (ADMINS)
 */
async function authenticateAdmin(username, password) {
  try {
    const admin = await db.get(
      `SELECT * FROM crm_admins WHERE username = ? AND active = 1`,
      [username]
    );

    if (!admin) {
      return { success: false, error: "Usuario no encontrado" };
    }

    const passwordMatch = await bcrypt.compare(password, admin.password_hash);
    
    if (!passwordMatch) {
      return { success: false, error: "Contraseña incorrecta" };
    }

    // Actualizar último login
    await db.run(
      `UPDATE crm_admins SET last_login = ? WHERE id = ?`,
      [new Date().toISOString(), admin.id]
    );

    return {
      success: true,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions ? JSON.parse(admin.permissions) : []
      }
    };
  } catch (error) {
    console.error("Error authenticating admin:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Autentica usuario con teléfono + OTP (USUARIOS)
 */
async function authenticatePhoneUser(phone, code) {
  try {
    // Verificar código OTP (ya existe en otpService)
    const otpService = require("./otpService"); // ← usar el existente
    const verifyResult = await otpService.verifyCode(phone, code);

    if (!verifyResult.success) {
      return { success: false, error: verifyResult.error };
    }

    // Obtener o crear usuario
    const user = await db.get(
      `SELECT u.* FROM users u
       JOIN whatsapp_accounts wa ON u.id = wa.user_id
       WHERE wa.phone = ? AND wa.verified = 1`,
      [phone]
    );

    if (user) {
      // Actualizar última actividad
      await db.run(
        `UPDATE whatsapp_accounts SET last_activity = ?, updated_at = ? WHERE phone = ?`,
        [new Date().toISOString(), new Date().toISOString(), phone]
      );

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          phone: phone,
          role: user.role || "user",
          verified: true
        }
      };
    }

    // Usuario no existe aún (pendiente de crear)
    return {
      success: true,
      newUser: true,
      phone: phone,
      message: "Usuario debe crear su cuenta"
    };
  } catch (error) {
    console.error("Error authenticating phone user:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  requireCrmAuth,
  requireRole,
  authenticateAdmin,
  authenticatePhoneUser
};
```

### 2. `/src/crm/routes.js` (MODIFICADO)

```javascript
const router = require("express").Router();
const path = require("path");
const store = require("./store");
const { requireCrmAuth, requireRole, authenticateAdmin, authenticatePhoneUser } = require("./auth");
const otpService = require("../services/otpService");

// ==================== LOGIN (público) ====================

router.get("/login", (req, res) => {
  // Si ya está autenticado, redirige
  if (req.session?.user) {
    return res.redirect("/crm");
  }
  res.sendFile(path.join(process.cwd(), "src/crm/public/login.html"));
});

// ==================== AUTENTICACIÓN ====================

/**
 * POST /crm/auth/login-admin
 * Login con usuario/contraseña para admins
 */
router.post("/auth/login-admin", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: "Usuario y contraseña requeridos" 
      });
    }

    const result = await authenticateAdmin(username, password);

    if (!result.success) {
      return res.status(401).json({ 
        success: false, 
        error: result.error 
      });
    }

    // Guardar en sesión
    req.session.user = result.user;
    res.json({ success: true, redirectTo: "/crm" });
  } catch (error) {
    console.error("Error in login-admin:", error);
    res.status(500).json({ 
      success: false, 
      error: "Error al procesar login" 
    });
  }
});

/**
 * POST /crm/auth/request-code
 * Solicitar código OTP para usuarios
 */
router.post("/auth/request-code", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ 
        success: false, 
        error: "Teléfono requerido" 
      });
    }

    // Usar servicio OTP existente
    const otpResult = await otpService.createVerificationCode(phone);

    if (!otpResult.success) {
      return res.status(500).json({ 
        success: false, 
        error: "Error al generar código" 
      });
    }

    // TODO: Enviar por WhatsApp Cloud API
    
    res.json({
      success: true,
      message: "Código enviado por WhatsApp",
      code: process.env.NODE_ENV === "development" ? otpResult.code : undefined
    });
  } catch (error) {
    console.error("Error in request-code:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /crm/auth/verify-code
 * Verificar OTP y crear/vincular usuario
 */
router.post("/auth/verify-code", async (req, res) => {
  try {
    const { phone, code, username, email } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ 
        success: false, 
        error: "Teléfono y código requeridos" 
      });
    }

    // Usar función existente de autenticación por phone
    const result = await authenticatePhoneUser(phone, code);

    if (!result.success) {
      return res.status(401).json({ 
        success: false, 
        error: result.error 
      });
    }

    if (result.newUser) {
      // Usuario no existe, necesita crear cuenta
      if (!username) {
        return res.status(400).json({ 
          success: true,
          newUser: true,
          phone: phone,
          message: "Debe proporcionar username para crear cuenta" 
        });
      }

      // Crear nuevo usuario
      const userService = require("../services/userService");
      const createResult = await userService.createUser({
        username,
        email: email || null,
        phone: phone
      });

      if (!createResult.success) {
        return res.status(500).json({ 
          success: false, 
          error: createResult.error 
        });
      }

      // Vinculación automática
      await userService.linkWhatsAppAccount(
        createResult.userId,
        phone,
        true
      );

      req.session.user = {
        id: createResult.userId,
        username: username,
        phone: phone,
        role: "user",
        verified: true
      };

      return res.json({
        success: true,
        newUserCreated: true,
        redirectTo: "/crm/user"
      });
    }

    // Usuario existente, guardar sesión
    req.session.user = result.user;
    res.json({
      success: true,
      redirectTo: "/crm/user"
    });
  } catch (error) {
    console.error("Error in verify-code:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /crm/auth/logout
 */
router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// ==================== RUTAS PROTEGIDAS ====================

// Verificar autenticación antes de servir dashboard
router.use(requireCrmAuth);

/**
 * GET /crm
 * Dashboard (diferente según rol)
 */
router.get("/", (req, res) => {
  if (req.session.user.role === "admin") {
    // Admin ve todo
    res.sendFile(path.join(process.cwd(), "src/crm/public/index.html"));
  } else {
    // Usuarios normales ven versión limitada
    res.sendFile(path.join(process.cwd(), "src/crm/public/user-dashboard.html"));
  }
});

// ... resto de rutas existentes, con verificación de rol donde sea necesario
```

### 3. Nueva página: `login.html` (MODIFICADA)

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>GlitchGang — Login</title>
  <link rel="stylesheet" href="/crm/assets/styles.css">
  <style>
    .login-tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 2px solid var(--line);
    }
    .login-tabs button {
      flex: 1;
      padding: 10px;
      background: none;
      border: none;
      border-bottom: 3px solid transparent;
      cursor: pointer;
      font-weight: 600;
      color: #999;
      transition: all 0.3s;
    }
    .login-tabs button.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }
    .login-form { display: none; }
    .login-form.active { display: block; }
  </style>
</head>
<body class="login-page">
  <main class="login-card">
    <div class="brand-mark">GG</div>
    <h1>GlitchGang</h1>
    <p>Centro de operaciones para torneos y bot de WhatsApp</p>

    <!-- Tabs de login -->
    <div class="login-tabs">
      <button data-tab="admin" class="active">👤 Admin</button>
      <button data-tab="user">📱 Usuario</button>
    </div>

    <!-- Tab 1: Admin Login -->
    <form id="adminForm" class="login-form active">
      <label>Usuario
        <input name="username" autocomplete="username" required>
      </label>
      <label>Contraseña
        <input name="password" type="password" autocomplete="current-password" required>
      </label>
      <button type="submit">Entrar como Admin</button>
      <div id="adminError" class="error"></div>
    </form>

    <!-- Tab 2: User Login -->
    <form id="userForm" class="login-form">
      <div id="userStep1" class="step active">
        <label>Número de WhatsApp
          <select id="country">
            <option value="+1">+1 🇺🇸</option>
            <option value="+1-829" selected>+1-829 🇩🇴</option>
            <!-- más países... -->
          </select>
          <input id="phone" type="tel" placeholder="8293334455" required>
        </label>
        <button type="button" id="requestCodeBtn">Enviar código</button>
        <div id="userPhoneError" class="error"></div>
      </div>

      <div id="userStep2" class="step" style="display:none">
        <p>Ingresa el código que recibiste:</p>
        <label>Código OTP (6 dígitos)
          <input id="otp" type="text" maxlength="6" inputmode="numeric" required>
        </label>
        <button type="button" id="verifyCodeBtn">Verificar</button>
        <button type="button" id="backBtn" style="background:none;color:#999">← Atrás</button>
        <div id="userOtpError" class="error"></div>
      </div>
    </form>

    <div id="errorMessage" class="error"></div>
  </main>

  <script>
    const adminForm = document.getElementById("adminForm");
    const userForm = document.getElementById("userForm");
    const tabs = document.querySelectorAll(".login-tabs button");

    // Cambiar tabs
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        
        document.querySelectorAll(".login-form").forEach(f => f.classList.remove("active"));
        if (tab.dataset.tab === "admin") {
          adminForm.classList.add("active");
        } else {
          userForm.classList.add("active");
        }
      });
    });

    // Admin login
    adminForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(adminForm));
      
      try {
        const res = await fetch("/crm/auth/login-admin", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify(body)
        });

        const data = await res.json();
        
        if (res.ok) {
          location.href = data.redirectTo || "/crm";
        } else {
          document.getElementById("adminError").textContent = data.error;
        }
      } catch (error) {
        document.getElementById("adminError").textContent = "Error: " + error.message;
      }
    });

    // User login - Step 1
    document.getElementById("requestCodeBtn").addEventListener("click", async () => {
      const country = document.getElementById("country").value;
      const phone = document.getElementById("phone").value;
      const fullPhone = country + phone;

      try {
        const res = await fetch("/crm/auth/request-code", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({phone: fullPhone})
        });

        const data = await res.json();

        if (res.ok) {
          // Mostrar step 2
          document.getElementById("userStep1").style.display = "none";
          document.getElementById("userStep2").style.display = "block";
          if (data.code) alert("Código (dev): " + data.code);
        } else {
          document.getElementById("userPhoneError").textContent = data.error;
        }
      } catch (error) {
        document.getElementById("userPhoneError").textContent = "Error: " + error.message;
      }
    });

    // User login - Step 2
    document.getElementById("verifyCodeBtn").addEventListener("click", async () => {
      const country = document.getElementById("country").value;
      const phone = document.getElementById("phone").value;
      const code = document.getElementById("otp").value;

      try {
        const res = await fetch("/crm/auth/verify-code", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({
            phone: country + phone,
            code: code
          })
        });

        const data = await res.json();

        if (res.ok) {
          if (data.newUserCreated) {
            alert("¡Cuenta creada exitosamente!");
          }
          location.href = data.redirectTo || "/crm/user";
        } else {
          document.getElementById("userOtpError").textContent = data.error;
        }
      } catch (error) {
        document.getElementById("userOtpError").textContent = "Error: " + error.message;
      }
    });

    // Volver atrás
    document.getElementById("backBtn").addEventListener("click", () => {
      document.getElementById("userStep1").style.display = "block";
      document.getElementById("userStep2").style.display = "none";
    });
  </script>
</body>
</html>
```

## 🎯 Ventajas de esta Arquitectura

✅ **Un solo login** para admin y usuarios
✅ **Roles y permisos** integrados
✅ **Reutiliza** OTP existente para WhatsApp
✅ **Escalable** a más roles (moderator, staff, etc)
✅ **Seguro** con bcrypt para passwords
✅ **Auditoria** de login/logout
✅ **Flexible** para agregar 2FA, rememberMe, etc

## 🚀 Implementación Paso a Paso

1. Instalar bcrypt: `npm install bcrypt`
2. Modificar `src/db/init.js` para crear tablas con usuarios/admins
3. Crear nuevas funciones en `auth.js`
4. Actualizar `routes.js` con nuevos endpoints
5. Crear nueva `login.html` con tabs
6. Crear `user-dashboard.html` (versión limitada para usuarios)
7. Testear todo

¿Quieres que lo implemente?
