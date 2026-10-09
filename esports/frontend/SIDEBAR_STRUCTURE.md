# Estructura de Sidebars

## 🛡️ Admin Panel (`/admin`)

```
┌─────────────────────────────────────┐
│      GLITCH GANG | Admin Panel      │
├─────────────────────────────────────┤
│                                     │
│  ⬜ PRINCIPAL                        │
│  ├─ 📊 Dashboard        (/admin)    │
│                                     │
│  ⬜ GESTIÓN                          │
│  ├─ 👥 Usuarios         (/admin/usuarios)       │
│  ├─ 🏆 Torneos (Auditoría) (/admin/torneos)     │
│  └─ 💳 Pagos            (/admin/pagos)          │
│                                     │
│  ⬜ MODERACIÓN                       │
│  ├─ ✅ Autorizaciones   (/admin/autorizaciones) │
│  ├─ 🛡️  Reportes        (/admin/reportes)      │
│  └─ ⚡ Moderación       (/admin/moderacion)    │
│                                     │
│  ⬜ CONTENIDO                        │
│  └─ 📰 Noticias         (/admin/noticias)      │
│                                     │
├─────────────────────────────────────┤
│  👁️  Ver app                        │
│  🚪 Cerrar sesión                   │
├─────────────────────────────────────┤
│  [Avatar] Admin Name                │
│           Admin                     │
└─────────────────────────────────────┘
```

---

## 🏆 Organizador Panel (`/organizador`)

```
┌─────────────────────────────────────┐
│    GLITCH GANG | Centro de Eventos  │
├─────────────────────────────────────┤
│                                     │
│  ⬜ PANEL                            │
│  ├─ 🏠 Dashboard        (/organizador)         │
│                                     │
│  ⬜ EVENTOS                          │
│  ├─ 📅 Mis Eventos      (/organizador/eventos) │
│  └─ 👥 Participantes    (/organizador/participantes) │
│                                     │
│  ⬜ REPORTES                         │
│  └─ 💳 Pagos & Reportes (/organizador/pagos)   │
│                                     │
│  ⬜ CONFIGURACIÓN                    │
│  └─ ⚙️  Mi Perfil        (/organizador/configuracion) │
│                                     │
├─────────────────────────────────────┤
│  👁️  Ver app                        │
│  🚪 Cerrar sesión                   │
├─────────────────────────────────────┤
│  [Avatar] Organizador Name          │
│           Organizador               │
└─────────────────────────────────────┘
```

---

## 📋 Componentes Disponibles

### Admin Pages (`/pages/admin/`)
- ✅ AdminDashboard
- ✅ AdminUsers
- ✅ AdminTournaments (Modo Auditoría)
- ✅ AdminPayments
- ✅ AdminApprovals (Autorizaciones)
- ✅ AdminReports
- ✅ AdminModeration
- ✅ AdminNews

### Organizer Pages (`/pages/organizer/`)
- ✅ OrganizerDashboard
- ✅ OrganizerEvents
- ✅ OrganizerParticipants
- ✅ OrganizerPayments
- ✅ OrganizerSettings

---

## 🎨 Características del Sidebar

### Ambos paneles tienen:
- **Secciones agrupadas** - Items organizados por categoría
- **Iconos diferenciados** - Cada item con su propio ícono
- **Colores únicos** - Admin (verde), Organizador (naranja)
- **Responsive** - Se colapsa en móvil
- **Navegación activa** - Indica la ruta actual
- **Usuario al pie** - Muestra avatar y rol

### Diferencias visuales:
| Elemento | Admin | Organizador |
|----------|-------|------------|
| **Color** | Verde (#00ff00) | Naranja (#f97316) |
| **Logo** | Shield 🛡️ | Trophy 🏆 |
| **Subtitle** | Admin Panel | Centro de Eventos |
| **Secciones** | 4 (Principal, Gestión, Moderación, Contenido) | 4 (Panel, Eventos, Reportes, Configuración) |

---

## 🔗 Rutas Completas

### Admin:
```
/admin                          ← Dashboard
/admin/usuarios                 ← Gestión de usuarios
/admin/torneos                  ← Auditoría de torneos
/admin/pagos                    ← Pagos del sistema
/admin/autorizaciones           ← Aprobar solicitudes
/admin/reportes                 ← Ver reportes
/admin/moderacion               ← Acciones de moderación
/admin/noticias                 ← Publicar noticias
```

### Organizador:
```
/organizador                    ← Dashboard
/organizador/eventos            ← Gestionar eventos
/organizador/participantes      ← Ver participantes
/organizador/pagos              ← Reportes y ganancias
/organizador/configuracion      ← Configurar perfil
```

---

## ✨ Cambios Implementados

1. ✅ Reorganizado AdminLayout con secciones lógicas
2. ✅ Reorganizado OrganizerLayout con secciones lógicas
3. ✅ Todos los links apuntan a componentes existentes
4. ✅ Iconos actualizados y coherentes
5. ✅ Mejor organización visual para mayor usabilidad

