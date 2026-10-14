# SL Abogados · Salvador López de la Rosa

Sitio web del despacho con CRM integrado. Un solo archivo: `index.html`.

**Secciones públicas:** Inicio · Áreas (21 áreas, 120+ servicios con honorarios, duración, proceso y documentos) · Inmuebles (alquiler y venta, publicar propiedad) · Abogados (perfiles con CARD, exequátur y notaría) · Honorarios · Proceso (FAQ y glosario) · Despacho · Contacto (agenda de consultas).

**CRM** (menú **Más → CRM del despacho**): resumen, clientes con embudo de 7 etapas y notas, citas, inmuebles, abogados, editor de todo el contenido (áreas, servicios, precios, preguntas, glosario, textos), datos del despacho y respaldo (JSON / CSV).

## Acceso al CRM

El CRM pide usuario y contraseña (enlace **Acceso del equipo** en el pie de página o en el menú). La primera vez se crea la cuenta de administrador; desde **Usuarios y acceso** se agregan abogados y asistentes. Las contraseñas se guardan como hash PBKDF2-SHA256 con sal y la sesión se cierra tras 30 minutos sin actividad.

En un sitio estático (GitHub Pages, VPS sin backend) este inicio de sesión protege el CRM de ese navegador, pero no reemplaza la seguridad de un servidor: para varios usuarios en distintos equipos hace falta una API con base de datos.

## Código

- `src/data.js` — contenido por defecto (áreas, servicios, contacto, glosario, FAQ, textos).
- `src/app.js` — navegación, vistas públicas y agenda.
- `src/ext.js` — inmuebles, abogados y capa de datos.
- `src/crm.js` — CRM y editores de contenido.
- `src/auth.js` — inicio de sesión, roles (administrador, abogado, asistente) y usuarios.
- `src/style.css`, `src/shell.html`, `src/boot.js`.
- `bash build.sh` — vuelve a generar `index.html`.

## Datos

Dentro de claude.ai el sitio usa una base de datos compartida. Fuera de ella (GitHub Pages o un VPS sin backend) funciona en **modo local**: lo que se guarda en el CRM, las citas y las propiedades quedan solo en el navegador de quien las crea. Para producción hace falta conectar una API con base de datos. Desde el CRM → Respaldo se puede exportar todo a JSON e importarlo en otra instalación.
