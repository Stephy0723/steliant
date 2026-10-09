# Botones en el Sidebar

## 📍 Ubicación de los Botones

### Admin Panel

```
┌───────────────────────────────────┐
│   GLITCH GANG | Admin Panel       │
├───────────────────────────────────┤
│                                   │
│  Secciones de navegación...       │
│                                   │
│  - Dashboard                      │
│  - Usuarios                       │
│  - Torneos                        │
│  - Pagos                          │
│  - Autorizaciones                 │
│  - Reportes                       │
│  - Moderación                     │
│  - Noticias                       │
│                                   │
├───────────────────────────────────┤  ← AQUÍ ESTÁN LOS BOTONES
│  👁️  Ver app                      │  ← Botón 1
│  🚪 Cerrar sesión                │  ← Botón 2
├───────────────────────────────────┤
│  [Avatar] Admin Name              │
│           Admin                   │
└───────────────────────────────────┘
```

### Organizador Panel

```
┌───────────────────────────────────┐
│ GLITCH GANG | Centro de Eventos   │
├───────────────────────────────────┤
│                                   │
│  Secciones de navegación...       │
│                                   │
│  - Dashboard                      │
│  - Mis Eventos                    │
│  - Participantes                  │
│  - Pagos & Reportes               │
│  - Mi Perfil                      │
│                                   │
├───────────────────────────────────┤  ← AQUÍ ESTÁN LOS BOTONES
│  👁️  Ver app                      │  ← Botón 1
│  🚪 Cerrar sesión                │  ← Botón 2
├───────────────────────────────────┤
│  [Avatar] Organizador Name        │
│           Organizador             │
└───────────────────────────────────┘
```

---

## 🔘 Funcionalidad de los Botones

| Botón | Ícono | Función | Ruta |
|-------|-------|---------|------|
| **Ver app** | 👁️ | Vuelve a la app normal (dashboard usuario) | `/dashboard` |
| **Cerrar sesión** | 🚪 | Cierra la sesión y va al login | `/` |

---

## 🎨 Estilos Mejorados

Los botones ahora tienen:
- ✅ Mejor espaciado (gap aumentado de 2px a 4px)
- ✅ Padding mejorado (12px en lugar de 10px)
- ✅ Efectos hover más visibles
  - Admin: Gris → Verde (accent)
  - Organizador: Gris → Naranja (org-color)
- ✅ Texto visible tanto en modo normal como colapsado
- ✅ Cursor pointer para indicar que son clickeables

---

## 📱 En Móvil (Collapsed)

Cuando el sidebar está colapsado:
- Los botones mostraban solo el ícono
- El título aparece en el tooltip (title attribute)
- Ahora son más claros con mejor contraste

---

## ✨ CSS Agregado

```css
.gg-admin-side__bottom .gg-admin-nav:hover {
  background: rgba(var(--accent-rgb), .1);  /* Fondo de color */
  color: var(--accent);                      /* Texto de color */
}

.gg-organizer-side__bottom .gg-organizer-nav:hover {
  background: rgba(var(--org-color-rgb), .1);  /* Fondo naranja */
  color: var(--org-color);                      /* Texto naranja */
}
```

---

## 🧪 Cómo Verificar

1. Abre el admin panel (`/admin`)
2. Mira el pie del sidebar
3. Verás 2 botones: "Ver app" y "Cerrar sesión"
4. Haz hover sobre ellos → cambian de color
5. Haz click en "Ver app" → vuelves a `/dashboard`
6. Haz click en "Cerrar sesión" → cierra sesión y vas a `/`

