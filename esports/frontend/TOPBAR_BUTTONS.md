# Botones Admin y Organizador en Topbar

## 📍 Ubicación en el Topbar

```
┌────────────────────────────────────────────────────────────────────┐
│  GLITCH GANG   Search...        PTS    News   Ranking  [Admin]  [Torneos]  🔔  👤│
│                                                         ↑           ↑
│                                                    BOTÓN ADMIN   BOTÓN ORGANIZADOR
└────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Botón ADMIN

**Solo visible si:** `user.role === 'admin'`

```
┌─────────────────┐
│  🛡️ ADMIN      │
└─────────────────┘
```

- **Ícono:** Shield (🛡️)
- **Texto:** ADMIN
- **Ruta:** `/admin`
- **Color:** Verde (accent)
- **Descripción:** Acceso rápido al Panel de Administración

---

## 🏆 Botón TORNEOS

**Solo visible si:** Usuario es `tournament-organizer` o `moderator`

```
┌─────────────────┐
│  📅 TORNEOS    │
└─────────────────┘
```

- **Ícono:** Calendar (📅)
- **Texto:** TORNEOS
- **Ruta:** `/organizador/eventos`
- **Color:** Naranja
- **Descripción:** Acceso rápido a Administrar Torneos

---

## 🎨 Estilos

| Propiedad | Valor |
|-----------|-------|
| **Padding** | 6px 12px |
| **Border-radius** | 8px |
| **Font-size** | 12px |
| **Font-weight** | 700 |
| **Text-transform** | uppercase |
| **Letter-spacing** | .04em |
| **Gap** | 6px |

### Hover Effects:
- Background aumenta de opacidad
- Border se vuelve del color principal
- Box-shadow agrega glow

---

## ✨ Lógica de Visibilidad

```javascript
// Admin check
const isAdmin = user?.role === 'admin'
if (isAdmin) mostrar botón ADMIN

// Organizador check  
const isOrganizer = COMMUNITIES.some(c => 
  c.joined && (c.userRole === 'tournament-organizer' || c.userRole === 'moderator')
)
if (isOrganizer) mostrar botón TORNEOS
```

---

## 📱 En Móvil (Responsive)

En pantallas < 520px:
- Los botones pueden ocultarse si hay poco espacio
- Se adaptan al ancho disponible
- El texto permanece visible

---

## 🧪 Cómo Verificar

### Como Admin:
1. Login con usuario admin
2. Verás botón **🛡️ ADMIN** en el topbar
3. Haz click → va a `/admin`
4. Hover → cambia a verde más brillante

### Como Organizador:
1. Login con usuario organizador
2. Verás botón **📅 TORNEOS** en el topbar
3. Haz click → va a `/organizador/eventos`
4. Hover → cambia a naranja más brillante

### Como Usuario Normal:
1. Los botones NO aparecen
2. Solo ves: PTS, News, Ranking, 🔔, 👤

---

## 🔗 Rutas de Destino

| Botón | Ruta | Panel |
|-------|------|-------|
| **ADMIN** | `/admin` | Panel de Administración |
| **TORNEOS** | `/organizador/eventos` | Centro de Eventos - Mis Eventos |

---

## 💾 Archivos Modificados

1. **Topbar.jsx**
   - Agregado import de COMMUNITIES
   - Agregada lógica de detección de rol
   - Agregados botones condicionales

2. **Topbar.css**
   - Agregados estilos para `.gg-btn-admin`
   - Agregados estilos para `.gg-btn-organizer`
   - Hover effects y responsive styles

