# SL Abogados · Salvador López de la Rosa

Sitio web del despacho con CRM integrado. Un solo archivo: `index.html`.

**Secciones públicas:** Inicio · Áreas (21 áreas, 120+ servicios con honorarios, duración, proceso y documentos) · Inmuebles (alquiler y venta, publicar propiedad) · Abogados (perfiles con CARD, exequátur y notaría) · Honorarios · Proceso (FAQ y glosario) · Despacho · Contacto (agenda de consultas).

**CRM** (menú **Más → CRM del despacho**): resumen, clientes con embudo de 7 etapas y notas, citas, inmuebles, abogados, editor de todo el contenido (áreas, servicios, precios, preguntas, glosario, textos), datos del despacho y respaldo (JSON / CSV).

## Código

- `src/data.js` — contenido por defecto (áreas, servicios, contacto, glosario, FAQ, textos).
- `src/app.js` — navegación, vistas públicas y agenda.
- `src/ext.js` — inmuebles, abogados y capa de datos.
- `src/crm.js` — CRM y editores de contenido.
- `src/style.css`, `src/shell.html`, `src/boot.js`.
- `bash build.sh` — vuelve a generar `index.html`.

## Datos

Dentro de claude.ai el sitio usa una base de datos compartida. Fuera de ella (GitHub Pages o un VPS sin backend) funciona en **modo local**: lo que se guarda en el CRM, las citas y las propiedades quedan solo en el navegador de quien las crea. Para producción hace falta conectar una API con base de datos. Desde el CRM → Respaldo se puede exportar todo a JSON e importarlo en otra instalación.
