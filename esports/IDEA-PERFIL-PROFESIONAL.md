# Idea: Perfil Profesional (tarjeta pública + edición completa)

Anotado el 22/sep a pedido de Stephanie — es una idea grande, más compleja
que un ajuste chico, y no había tiempo para construirla en el momento. Este
archivo existe para no perder el concepto. No es una tarea lista para picar
como las de `BACKEND-PENDIENTE.md`, es la visión a la que apuntar cuando se
retome.

## La idea, como la describió Stephanie

Dentro de cada panel de rol (Coach, Caster, Analista, Marca, Creador...),
junto a "Perfil" y "Salir" en la sección de cuenta, agregar un **"Perfil
profesional"**:

- Se edita como el Perfil normal — subir foto, agregar información,
  "armar" el perfil.
- Pero de cara a otras personas, **se ve como una tarjeta** — literalmente
  el formato tarjeta (piensa en el mismo lenguaje visual puntiagudo que ya
  usan `GGTeamCard`/`OrganizerStatCard`/las fichas de `RoleStaffSearch`:
  cresta con la esquina cortada, glow, "Ver más" que despliega detalle).
- Al hacer click en **"Ver más"** sobre la tarjeta de alguien, te lleva a
  **su perfil profesional completo** — la página de detalle armada con todo
  lo que esa persona cargó.

En resumen: cada persona con un rol de staff/marca/creador tiene un perfil
profesional propio, editable, que se muestra como tarjeta resumen en
cualquier lado donde aparezca (buscador de staff, directorio de
organizadores del Centro de Marcas, etc.) y que se expande a una página
completa al pedir más detalle.

## Cómo conecta con lo que ya existe (22/sep)

Esta sesión ya se construyó buena parte de la base para esto, sin querer
apuntar exactamente a esta idea pero dejando el terreno preparado:

- `frontend/src/lib/roleProfileCompleteness.js` — ya sabe qué campos hacen
  a un perfil de rol "completo" (`profileFields` por rol, ver
  `frontend/src/data/roleApplications.js`).
- `frontend/src/components/ProfileCompletionBanner/` — ya avisa cuando
  falta completar el perfil.
- `frontend/src/components/RoleStaffSearch/RoleStaffSearch.jsx` — ya
  muestra tarifa/disponibilidad/idiomas/experiencia/bio real por persona,
  y ya oculta perfiles incompletos — es basicamente una version embrionaria
  de "la tarjeta".
- `frontend/src/components/OrganizerStatCard/` — ya tiene el "Ver más" que
  despliega detalle (torneo por torneo) dentro de la misma tarjeta, en vez
  de navegar a otra página — el mismo patrón de interacción que esta idea
  pide, solo que hoy se queda dentro de la tarjeta en lugar de llevar a una
  página propia.
- `BACKEND-PENDIENTE.md` → **`#role-profile-sin-editar`** — ya documenta
  que hoy NO existe ningún endpoint para editar `roleProfiles.<rol>.details`
  después de aprobado (solo se llena una vez, con lo que la persona escribió
  al aplicar el rol). Esa tarea es un prerequisito directo de esta idea: sin
  poder editar el perfil, no hay nada que la tarjeta pueda reflejar de
  verdad.

## Lo que faltaría para construirla de verdad

1. El endpoint de edición (`#role-profile-sin-editar` en BACKEND-PENDIENTE.md).
2. Una página de **perfil profesional completo** por persona+rol (ruta
   pública, ej. `/organizadores/:id` ya existe como precedente para
   organizador — faltaría el equivalente para Coach/Caster/Analista/Marca/
   Creador), con foto grande, bio, trayectoria, y lo que sea relevante a
   ese rol (torneos como staff, equipos manejados, etc. — datos que esta
   sesión ya dejó disponibles en varios paneles).
3. Convertir las fichas que ya existen (`RoleStaffSearch`, tarjetas del
   Centro de Marcas) para que su botón "Ver más"/"Seleccionar" navegue a
   esa página nueva, en vez de (o además de) desplegar el panel inline.
4. Decidir con Stephanie: ¿esta tarjeta/perfil es exclusiva de roles de
   staff (Coach/Caster/Analista/etc.), o también aplica a Marca y Creador?
   ¿Reemplaza al "Perfil" normal de toda la vida, o convive aparte como
   "profesional" vs. "personal"?

No implementar sin retomar esta conversación con Stephanie primero — hay
decisiones de producto (punto 4) que cambian bastante el alcance.
