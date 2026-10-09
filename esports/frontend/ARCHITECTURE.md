# GlitchGang Frontend - Arquitectura de Paneles

## 🏗️ Estructura de Dos Paneles Completamente Separados

La plataforma tiene DOS paneles **COMPLETAMENTE INDEPENDIENTES** con acceso mutuamente excluyente:

### 1. **PANEL DE ADMINISTRACIÓN** (`/admin`) 
#### Ve TODO pero NO puede interferir en torneos de terceros

- **Para:** Administradores del sistema SOLAMENTE
- **Acceso:** Solo usuarios con `role === 'admin'`
- **Bloqueo:** Los admins NO pueden acceder a `/organizador` (redirige a `/admin`)
- **Layout:** `AdminLayout` (tema verde)
- **Componente protector:** `AdminProtectedRoute`

**Funcionalidades (Visibilidad Total + Acciones Limitadas):**
- 📊 Dashboard - Métricas globales de la plataforma
- ✅ Autorizaciones - Aprobar solicitudes de roles, becas, reembolsos
- 👥 Usuarios - Ver/gestionar todos los usuarios, bans, roles
- 🏆 **Torneos (Auditoría)** - Ver TODOS los torneos pero SIN poder editarlos
  - Monitoreo de eventos
  - Vigilancia de conducta
  - Detección de fraudes
  - **NO permite:** Crear, editar, cancelar torneos de terceros
- 📋 Reportes - Revisar reportes de conducta a nivel global
- 📰 Noticias - Publicar comunicados para toda la plataforma
- ⚡ Moderación - Ejecutar sanciones y acciones disciplinarias
- 💳 Pagos - Validar, rechazar, reembolsar pagos globalmente

**Rutas:**
```
/admin                      → Dashboard del sistema
/admin/autorizaciones       → Aprobar solicitudes
/admin/usuarios             → Gestionar usuarios globalmente
/admin/torneos              → Auditoría de TODOS los torneos (lectura)
/admin/reportes             → Revisar reportes globales
/admin/noticias             → Publicar noticias del sistema
/admin/moderacion           → Acciones de moderación
/admin/pagos                → Gestionar pagos globales
```

---

### 2. **PANEL DE EVENTOS/TORNEOS** (`/organizador`)
#### Gestión de eventos propios - Solo para Organizadores

- **Para:** Creadores y organizadores de torneos SOLAMENTE
- **Acceso:** Usuarios con rol `tournament-organizer` o `moderator` que sean miembros de comunidades
- **Bloqueo:** Los admins NO pueden acceder (redirige a `/admin`)
- **Layout:** `OrganizerLayout` (tema naranja)
- **Componente protector:** `TournamentOrgRoute` (rechaza admins)

**Funcionalidades (Control Total de Propios Eventos):**
- 🏠 Dashboard - Resumen de eventos activos del organizador
- 🎮 Mis Eventos - Crear, editar, gestionar sus propios torneos
- 👥 Participantes - Gestionar inscripciones en sus eventos
- 📊 Mis Pagos - Reportes y ganancias de sus eventos
- ⚙️ Configuración - Perfil del organizador

**Rutas:**
```
/organizador                 → Dashboard del organizador
/organizador/eventos         → Gestionar mis eventos
/organizador/participantes   → Gestionar participantes en mis eventos
/organizador/pagos           → Reportes y ganancias de mis eventos
/organizador/configuracion   → Configuración del perfil
```

---

## 🔐 Flujo de Autenticación y Permisos

```
Usuario Autenticado
├── Es Admin?
│   ├── SI → AdminProtectedRoute → AdminLayout → /admin/*
│   │        ↓ (Intenta /organizador)
│   │        ↓ Redirige a /admin
│   │
│   └── NO ↓ (Es organizador/moderador?)
│       ├── SI → TournamentOrgRoute → OrganizerLayout → /organizador/*
│       └── NO → Usuario regular → DashboardLayout → /dashboard
```

---

## 📊 Tabla Comparativa

| Capacidad | Admin | Organizador |
|-----------|-------|------------|
| **Ver todos los usuarios** | ✅ | ❌ |
| **Ver todos los torneos** | ✅ (lectura) | ❌ |
| **Crear torneos** | ❌ | ✅ (propios) |
| **Editar torneos de terceros** | ❌ | ❌ |
| **Editar sus propios torneos** | ❌ | ✅ |
| **Gestionar reportes** | ✅ | ❌ |
| **Publicar noticias globales** | ✅ | ❌ |
| **Acceso a /admin** | ✅ | ❌ |
| **Acceso a /organizador** | ❌ | ✅ |

---

## 📁 Estructura de Archivos

```
frontend/src/
├── layouts/
│   ├── AdminLayout.jsx              (Panel Admin - Verde)
│   ├── AdminLayout.css
│   ├── OrganizerLayout.jsx          (Panel Organizador - Naranja) ✨ NUEVO
│   ├── OrganizerLayout.css          ✨ NUEVO
│   └── DashboardLayout.jsx          (Usuario normal)
├── pages/
│   ├── admin/
│   │   ├── AdminDashboard/
│   │   ├── AdminUsers/
│   │   ├── AdminTournaments/        ← Modo auditoría (lectura)
│   │   ├── AdminReports/
│   │   ├── AdminApprovals/
│   │   ├── AdminNews/
│   │   ├── AdminModeration/
│   │   └── AdminPayments/
│   ├── organizer/                   (Pages del Organizador) ✨ NUEVO
│   │   └── OrganizerDashboard/      ✨ NUEVO
│   └── ...
├── components/
│   ├── AdminProtectedRoute.jsx      (Solo admins)
│   ├── TournamentOrgRoute.jsx       (Solo organizadores - rechaza admins)
│   └── ProtectedRoute.jsx           (Usuarios normales)
└── routes/
    └── AppRoutes.jsx                (Rutas separadas por tipo)
```

---

## 🎨 Diferenciación Visual

| Aspecto | Admin Panel | Organizador Panel |
|---------|------------|------------------|
| **Color principal** | Verde (#00ff00) | Naranja (#f97316) |
| **Sidebar icon** | Shield (🛡️) | Trophy (🏆) |
| **Header title** | Panel de Administración | Centro de Eventos |
| **User role badge** | Admin | Organizador |
| **Ruta base** | `/admin/*` | `/organizador/*` |
| **Acceso** | Solo admins | Solo organizadores |

---

## ✨ Cambios Realizados

### Nuevos archivos creados:
1. ✨ `layouts/OrganizerLayout.jsx` - Layout para organizadores (tema naranja)
2. ✨ `layouts/OrganizerLayout.css` - Estilos diferenciados
3. ✨ `pages/organizer/OrganizerDashboard/OrganizerDashboard.jsx` - Dashboard organizador
4. ✨ `pages/organizer/OrganizerDashboard/OrganizerDashboard.css` - Estilos

### Archivos modificados:
1. ✅ `components/TournamentOrgRoute.jsx` - Ahora rechaza admins, solo organizadores
2. ✅ `layouts/AdminLayout.jsx` - Agregado "Torneos (Auditoría)" al menú
3. ✅ `routes/AppRoutes.jsx` - Separación clara de rutas:
   - `/admin/*` → Solo admins
   - `/organizador/*` → Solo organizadores (rechaza admins)

---

## 🔒 Lógica de Control de Acceso

### AdminProtectedRoute (Admins)
```javascript
if (user.role !== 'admin') return <Navigate to="/dashboard" />
return <Outlet /> // Acceso a /admin/*
```

### TournamentOrgRoute (Organizadores)
```javascript
if (user.role === 'admin') return <Navigate to="/admin" /> // Admins NO acceden aquí
if (!isTOrg && !isMod) return <Navigate to="/dashboard" />
return <Outlet /> // Acceso a /organizador/*
```

---

## 🚀 Próximos Pasos (Recomendaciones)

1. **Hacer AdminTournaments "read-only" cuando se accede desde `/admin`:**
   - Detectar si viene de `/admin` o `/organizador`
   - En `/admin` mostrar todos los torneos pero sin botones de edición
   - En `/organizador` mostrar solo los torneos del usuario actual

2. **Crear páginas específicas para organizadores:**
   - `pages/organizer/OrganizerEvents/OrganizerEvents.jsx` (con edición completa)
   - O adaptar AdminTournaments con un parámetro `readOnly={false}`

3. **Agregar auditoría en AdminTournaments:**
   - Indicador visual "MODO AUDITORÍA"
   - Log de quién vio qué cuando
   - Campos de solo lectura

4. **Permisos más granulares:**
   - Implementar `role` más específicos: `admin`, `tournament-organizer`, `tournament-moderator`, etc.
   - Cada rol con sus propias capacidades

---

## 📝 Flujo de Usuarios

### Usuario Admin
```
Login → Admin check → /admin/dashboard (acceso total)
Intenta /organizador → Redirige a /admin (bloqueado)
```

### Usuario Organizador
```
Login → Organizador check → /organizador/dashboard (gestión de eventos)
Intenta /admin → Redirige a /dashboard (bloqueado)
```

### Usuario Normal
```
Login → Verifica permisos → /dashboard (usuario regular)
Intenta /admin o /organizador → Redirige a /dashboard (bloqueado)
```

---

## ✅ Decisiones de Arquitectura

1. **Paneles mutuamente excluyentes** - Un user solo accede a UNO
2. **Admin ve TODO pero no interfiere** - Auditoría, no edición de eventos ajenos
3. **Organizadores controlan sus eventos** - Control total de lo suyo
4. **Layouts diferentes** - Máxima claridad visual
5. **Redirecciones de seguridad** - No hay forma de "burlarse" de los checks


