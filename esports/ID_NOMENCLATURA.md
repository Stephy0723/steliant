# Nomenclatura oficial de identificadores — GlitchGang

**Estado del documento:** guía previa a la implementación relacional  
**Fecha de revisión:** 2026-06-22  
**Alcance:** únicamente entidades y relaciones existentes en el backend y MongoDB.

Este documento es la fuente de consulta para interpretar cómo se forma cada ID. Un formato marcado como **REGISTRADO** ya existe en la base de datos. Un formato marcado como **DEFINIDO** existe en el backend, aunque puede no tener documentos. Un formato marcado como **PENDIENTE** todavía no debe generarse ni mostrarse como definitivo.

## 1. Lectura estándar con slash

Todos los formatos se documentan siguiendo esta lectura:

```text
ENTIDAD / RELACIÓN PRINCIPAL / CONTEXTO / SECUENCIA
```

Los slash sirven para explicar la composición. El valor renderizado utiliza guiones:

```text
EXPLICACIÓN: TORNEO / JUEGO / SECUENCIA / PAÍS
RENDER:      TOR-MLBB-001-01
```

Reglas generales:

- Mayúsculas obligatorias.
- Guion `-` como separador visual principal.
- Secuencias con ceros a la izquierda.
- Una secuencia nunca se reutiliza después de eliminar un registro.
- Los IDs públicos son visibles; los IDs internos solo se muestran al propietario autorizado.
- MongoDB `_id`, tokens, `jti` y códigos de seguridad nunca forman parte del ID público.
- Los hijos deben incorporar una referencia corta y reconocible de sus padres.
- No se puede incorporar una relación que no exista como campo real en el modelo.

### Contenido obligatorio de cada ficha de ID

Ninguna entidad se considera correctamente documentada si su ficha no contiene estos datos:

```text
ESTADO / ENTIDAD / RELACIÓN PADRE / ID PÚBLICO / ID EXTENSO / FECHA / CONTADOR / VISIBILIDAD / CAMPOS
```

Cada entidad que vaya a recibir nomenclatura deberá tener dos identificadores:

- **ID público:** corto, estable y apto para directorios, tarjetas, búsquedas y soporte.
- **ID extenso:** conserva el contexto de creación y las relaciones necesarias para auditoría.

Regla estándar para la fecha del ID extenso:

```text
FECHA DE CREACIÓN DEL REGISTRO = createdAt = YYYYMMDD
```

Solo se usará otra fecha cuando el dominio ya tenga una regla registrada diferente. Por ejemplo, el usuario actualmente utiliza su fecha de nacimiento y la universidad utiliza `registeredOn`.

## 2. Catálogo de segmentos

| Segmento | Significado | Máscara | Ejemplo |
|---|---|---:|---|
| `{INI}` | Primera inicial del nombre | `A` | `S` |
| `{INIA}` | Inicial del nombre + iniciales de apellidos | `AAA` | `SLF` |
| `{SEQ3}` | Secuencia correlativa de 3 dígitos | `000` | `001` |
| `{SEQ4}` | Secuencia correlativa de 4 dígitos | `0000` | `0001` |
| `{PAIS}` | Número del catálogo de país | `00` o `000` | `01` |
| `{JUEGO}` | Código sanitizado del juego, máximo 4 caracteres | `AAAA` | `MLBB` |
| `{YYMMDD}` | Fecha año/mes/día | `000000` | `260622` |
| `{DDMMYY}` | Fecha día/mes/año | `000000` | `220626` |
| `{YYYY}` | Año completo | `0000` | `2026` |
| `{YYYYMMDD}` | Fecha completa de activación | `00000000` | `20260622` |
| `{BRANDREF}` | Código de marca sin guion | `BRD000` | `BRD001` |
| `{ORGREF}` | ID público del organizador sin guiones ni país | `ORG000` | `ORG001` |
| `{TOURREF}` | Código corto de torneo sin guiones | Variable | `TORMLBB00101` |

## 3. Usuario — REGISTRADO

### Ficha estructural

```text
ESTADO           / Registrado
ENTIDAD          / User
RELACIÓN PADRE   / Country
FECHA            / birthDate en el ID interno actual; createdAt permanece como metadato
CONTADOR         / player:{countryCode}
VISIBILIDAD      / Público visible; interno solo propietario y procesos autorizados
CAMPOS           / playerCode e internalCode
```

### ID público

```text
USUARIO / INICIAL / SECUENCIA POR PAÍS / PAÍS
{INI}{SEQ3}-{PAIS}
S001-01
```

- Campo: `User.playerCode`.
- Contador: `player:{countryCode}`.
- La secuencia es independiente para cada país.
- Se muestra en perfil, ranking y referencias de jugadores.

### ID interno

```text
USUARIO / NACIMIENTO / INICIALES / SECUENCIA / PAÍS
{YYMMDD}-{INIA}-{SEQ3}-{PAIS}
031007-SLF-001-01
```

- Campo: `User.internalCode`.
- Comparte la misma secuencia del ID público.
- No cambia si el usuario adquiere los roles `admin`, `organizer`, `coach`, `caster`, `analyst`, `creator` o `brand`.
- No se crean IDs distintos por rol porque todos los roles pertenecen al mismo `User`.

## 4. Equipo — REGISTRADO

### Ficha estructural

```text
ESTADO           / Registrado
ENTIDAD          / Team
RELACIÓN PADRE   / User líder + Country del líder
FECHA            / Team.createdAt
CONTADOR         / team:{countryCode}
VISIBILIDAD      / Público visible; interno solo líder/propietario
CAMPOS           / publicCode, internalCode y teamInviteCode
```

### ID público

```text
EQUIPO / SECUENCIA POR PAÍS / PAÍS
TEAM-{SEQ3}-{PAIS}
TEAM-001-01
```

- Campo: `Team.publicCode`.
- Contador: `team:{countryCode}`.
- El país se toma del líder creador.
- Visible en directorio, tarjeta, detalle y panel del equipo.

### ID interno

```text
EQUIPO / FECHA DE CREACIÓN / SECUENCIA / PAÍS
TEAM-{YYMMDD}-{SEQ3}-{PAIS}
TEAM-260622-001-01
```

- Campo: `Team.internalCode`.
- Comparte secuencia con el ID público.
- Solo se entrega y renderiza al líder/propietario.

### Código de invitación

```text
EQUIPO / INVITACIÓN PRIVADA
XXXXXXXX
7A21BC4F
```

- Campo: `Team.teamInviteCode`.
- Ocho caracteres hexadecimales aleatorios.
- No es correlativo y no reemplaza el ID público.
- Debe llamarse **Código de invitación**, nunca **ID del equipo**.

## 5. Torneo — FORMATO RELACIONAL CORREGIDO / CONSOLIDACIÓN PENDIENTE

### Ficha estructural

```text
ESTADO           / Formato relacional aprobado; persistencia pendiente de consolidación
ENTIDAD          / Tournament
RELACIÓN PADRE   / Organizador aprobado + juego + Country del organizador
FECHA            / Tournament.createdAt para el ID interno
CONTADOR         / tournament:{organizerId}:{countryCode}:{gameCode}
VISIBILIDAD      / Público visible; interno para organizador propietario
CAMPOS           / publicId en MongoDB; tournamentCode en modelo; internalCode pendiente
```

### ID público

```text
TORNEO / JUEGO / ORGANIZADOR / SECUENCIA POR ORGANIZADOR, JUEGO Y PAÍS / PAÍS
TOR-{JUEGO}-{ORGREF}-{SEQ3}-{PAIS}
TOR-MLBB-ORG001-001-01
```

- `{ORGREF}` se deriva de `organizerCode` eliminando guiones y el segmento de país: `ORG-001-01 → ORG001`.
- Contador: `tournament:{organizerId}:{countryCode}:{gameCode}`.
- MongoDB actual utiliza `publicId`.
- El modelo nuevo declara `tournamentCode`.
- Esta diferencia debe resolverse antes de crear IDs relacionales dependientes de torneos.

### ID interno definido por el servicio

```text
TORNEO / JUEGO / FECHA / ORGANIZADOR / SECUENCIA / PAÍS
TOR-{JUEGO}-{YYMMDD}-{ORGREF}-{SEQ3}-{PAIS}
TOR-MLBB-260622-ORG001-001-01
```

- El servicio puede formarlo.
- El modelo actual no dispone de un campo persistente definitivo para guardarlo.
- Estado: **DEFINIDO, NO CONSOLIDADO**.

### Regla visual condicional

```text
ORGANIZADOR PROPIETARIO O ADMIN / TOR-MLBB-ORG001-001-01 / TOR-MLBB-260622-ORG001-001-01
VISTA PÚBLICA                   / TOR-MLBB-ORG001-001-01
```

- El frontend consume los IDs entregados por el backend; nunca reconstruye `ORGREF`.
- La propiedad se determina comparando `Tournament.organizer` con el usuario activo.
- El ID extenso se omite para cualquier tercero.

## 6. Marca — PÚBLICO REGISTRADO / EXTENSO PENDIENTE

### Ficha estructural

```text
ESTADO           / ID público registrado; ID extenso pendiente
ENTIDAD          / Brand
RELACIÓN PADRE   / Ninguna; es una entidad raíz
FECHA            / Brand.createdAt
CONTADOR         / brand
VISIBILIDAD      / Público visible; extenso solo marca propietaria y auditoría autorizada
CAMPOS           / code existente; internalCode pendiente
```

### ID público

```text
MARCA / SECUENCIA GLOBAL
BRD-{SEQ3}
BRD-001
```

- Campo: `Brand.code`.
- Contador: `brand`.
- Secuencia global para todas las marcas.
- Visible en perfil, tarjetas públicas y administración.

### ID extenso obligatorio — PENDIENTE

```text
MARCA / FECHA DE CREACIÓN / SECUENCIA GLOBAL
BRD-{YYYYMMDD}-{SEQ3}
BRD-20260622-001
```

- Campo futuro: `Brand.internalCode`.
- La fecha sale exclusivamente de `Brand.createdAt`.
- Comparte la misma secuencia de `Brand.code`.
- No se recalcula si cambia el nombre, nivel, contacto o estado de la marca.
- No incluye país porque `Brand` actualmente no posee una relación persistente con `Country`.
- No incluye patrocinador porque, en el modelo actual, la marca es la entidad patrocinadora.

### Correlación entre ambos

```text
PÚBLICO  / BRD-001
EXTENSO  / BRD-20260622-001
SECUENCIA COMPARTIDA / 001
```

### Regla de generación

```text
1 / Reservar siguiente valor atómico de Counter.key = brand
2 / Formar BRD-{SEQ3}
3 / Leer createdAt en UTC como YYYYMMDD
4 / Formar BRD-{YYYYMMDD}-{SEQ3}
5 / Guardar ambos IDs en la misma operación de creación
```

## 7. Factura — REGISTRADO, PENDIENTE DE CONVERSIÓN RELACIONAL

### Ficha estructural

```text
ESTADO           / Número actual registrado; formato relacional pendiente
ENTIDAD          / Invoice
RELACIÓN PADRE   / Invoice → Campaign → Brand; Tournament pendiente de formalizar
FECHA            / Invoice.createdAt
CONTADOR ACTUAL  / invoice:{year}
CONTADOR FUTURO  / invoice:{tournamentId}:{brandId}
VISIBILIDAD      / Marca propietaria y administración financiera autorizada
CAMPOS           / invoiceNumber existente; internalCode pendiente
```

### Formato actual

```text
FACTURA / AÑO / SECUENCIA ANUAL
INV-{YYYY}-{SEQ4}
INV-2026-0001
```

- Campo: `Invoice.invoiceNumber`.
- Contador: `invoice:{year}`.
- La secuencia reinicia por año.
- Relación real almacenada: `Invoice → Campaign → Brand`.
- Actualmente el número visible no contiene todavía las referencias de campaña, marca o torneo.

### Formato relacional solicitado — PENDIENTE

```text
FACTURA / TORNEO / MARCA / SECUENCIA
INV-{TOURREF}-{BRANDREF}-{SEQ4}
INV-TORMLBB00101-BRD001-0001
```

### ID extenso relacional — PENDIENTE

```text
FACTURA / FECHA DE CREACIÓN / TORNEO / MARCA / SECUENCIA
INV-{YYYYMMDD}-{TOURREF}-{BRANDREF}-{SEQ4}
INV-20260622-TORMLBB00101-BRD001-0001
```

- Campo futuro: `Invoice.internalCode`.
- `invoiceNumber` será el ID público relacional.
- El ID extenso añade `Invoice.createdAt` como `YYYYMMDD`.
- Ambos comparten la misma secuencia.

Condiciones antes de implementarlo:

1. La campaña debe tener una relación persistente y validada con el torneo.
2. La factura obtiene la marca desde su campaña; no debe recibir una marca escrita manualmente.
3. `{TOURREF}` y `{BRANDREF}` se derivan de IDs existentes, nunca de nombres.
4. La secuencia propuesta debe definirse por combinación `torneo + marca`.

Clave propuesta del contador:

```text
invoice:{tournamentId}:{brandId}
```

## 8. Campaña — EXISTE, SIN ID PÚBLICO

### Ficha estructural

```text
ESTADO           / Pendiente
ENTIDAD          / Campaign
RELACIÓN PADRE   / Brand obligatoria; Tournament debe formalizarse
FECHA            / Campaign.createdAt
CONTADOR FUTURO  / campaign:{brandId}:{tournamentId}
VISIBILIDAD      / ID público visible en campaña; extenso para marca y administración
CAMPOS           / publicCode e internalCode pendientes
```

Relaciones reales actuales:

```text
CAMPAÑA / MARCA
Campaign.brandId → Brand._id
```

MongoDB contiene registros con `tournamentId`, pero el modelo `Campaign` actual no declara formalmente ese campo. Por eso el formato relacional todavía es **PENDIENTE**.

### Formato relacional propuesto

```text
CAMPAÑA / MARCA / TORNEO / SECUENCIA
CAM-{BRANDREF}-{TOURREF}-{SEQ3}
CAM-BRD001-TORMLBB00101-001
```

### ID extenso relacional propuesto

```text
CAMPAÑA / FECHA DE CREACIÓN / MARCA / TORNEO / SECUENCIA
CAM-{YYYYMMDD}-{BRANDREF}-{TOURREF}-{SEQ3}
CAM-20260622-BRD001-TORMLBB00101-001
```

- `Campaign.publicCode`: formato corto relacional.
- `Campaign.internalCode`: mismo ID con fecha de creación.
- Ambos IDs comparten secuencia.

Clave propuesta del contador:

```text
campaign:{brandId}:{tournamentId}
```

La relación requerida antes de generar el ID será:

```text
Campaign.brandId      → Brand._id
Campaign.tournamentId → Tournament._id
```

## 9. Creatividad o anuncio — DEFINIDO

### Ficha estructural

```text
ESTADO           / adId definido; formato relacional definitivo pendiente
ENTIDAD          / Creative
RELACIÓN PADRE   / Creative → Campaign → Brand
FECHA            / Creative.createdAt para identidad; fecha de activación para publicación
CONTADOR ACTUAL  / secuencia diaria de activación
VISIBILIDAD      / ID público visible en reportes publicitarios; extenso para marca y administración
CAMPOS           / adId existente; internalCode pendiente
```

```text
ANUNCIO / MARCA / TIPO / POSICIÓN EN CAMPAÑA / FECHA / SECUENCIA DIARIA
{BRANDREF}_{TIPO}-{SEQ2}_{YYYYMMDD}_{SEQ3}
BRD001_BNR-01_20260622_001
```

- Campo: `Creative.adId`.
- Se genera cuando la creatividad se activa.
- Tipos: `BNR` banner / `STP` strip / `FLT` floating.
- Relación: `Creative → Campaign → Brand`.
- La colección existe; el registro comprobado aún no tiene `adId` poblado.

Formato relacional futuro recomendado después de crear `Campaign.publicCode`:

```text
ANUNCIO / MARCA / CAMPAÑA / TIPO / SECUENCIA
ADS-{BRANDREF}-{CAMREF}-{TIPO}-{SEQ3}
ADS-BRD001-CAM001-BNR-001
```

### ID extenso relacional recomendado

```text
ANUNCIO / FECHA DE CREACIÓN / MARCA / CAMPAÑA / TIPO / SECUENCIA
ADS-{YYYYMMDD}-{BRANDREF}-{CAMREF}-{TIPO}-{SEQ3}
ADS-20260622-BRD001-CAM001-BNR-001
```

- `Creative.adId`: ID público.
- `Creative.internalCode`: pendiente.
- La fecha del ID extenso será `Creative.createdAt`, no la fecha en que el anuncio fue activado.

## 10. Universidad — DEFINIDO, SIN REGISTROS

### Ficha estructural

```text
ESTADO           / Definido; colección sin registros
ENTIDAD          / University
RELACIÓN PADRE   / User opcional
FECHA            / University.registeredOn
CONTADOR         / university:{siglas}
VISIBILIDAD      / Público visible; extenso para propietario y verificación universitaria
CAMPOS           / publicCode e internalCode existentes
```

### ID público

```text
UNIVERSIDAD / MATRÍCULA REDUCIDA / SECUENCIA POR UNIVERSIDAD
{SIGLAS}-{MATRICULA4}-{SEQ4}
ITLA-0614-0001
```

### ID interno

```text
UNIVERSIDAD / MATRÍCULA / FECHA DE REGISTRO / SECUENCIA
{SIGLAS}-{MATRICULA4}-{DDMMYY}-{SEQ4}
ITLA-0614-220626-0001
```

- Campos: `University.publicCode` y `University.internalCode`.
- Contador: `university:{siglas}`.
- La colección actualmente no contiene documentos.

## 11. País — CATÁLOGO REGISTRADO

### Ficha estructural

```text
ESTADO           / Registrado
ENTIDAD          / Country
RELACIÓN PADRE   / Ninguna; catálogo raíz
FECHA            / No forma parte del identificador
CONTADOR         / Posición fija del catálogo
VISIBILIDAD      / Público
CAMPOS           / id, code, number
```

```text
PAÍS / ID NUMÉRICO / ISO / NÚMERO DE PLATAFORMA
1 / RD / 01
```

- `Country.id`: posición incremental del catálogo.
- `Country.code`: código ISO adaptado por la plataforma.
- `Country.number`: segmento usado en usuario, equipo y torneo.
- El país no recibe un ID público adicional.

## 12. Entidades existentes todavía sin ID formateado

Esta tabla ya incluye el formato público, el extenso, la fecha y la correlación requerida. Todos permanecen **PENDIENTES** hasta implementar sus campos y contadores.

| Entidad | Relación incluida | ID público propuesto | ID extenso propuesto | Fecha | Contador propuesto |
|---|---|---|---|---|---|
| `BrandApplication` | solicitud / usuario solicitante | `BAP-{USERREF}-{SEQ4}` | `BAP-{YYYYMMDD}-{USERREF}-{SEQ4}` | `createdAt` | `brand-application:{userId}` |
| `BrandReport` | reporte / marca | `BRP-{BRANDREF}-{SEQ4}` | `BRP-{YYYYMMDD}-{BRANDREF}-{SEQ4}` | `createdAt` | `brand-report:{brandId}` |
| `Campaign` | campaña / marca / torneo | `CAM-{BRANDREF}-{TOURREF}-{SEQ3}` | `CAM-{YYYYMMDD}-{BRANDREF}-{TOURREF}-{SEQ3}` | `createdAt` | `campaign:{brandId}:{tournamentId}` |
| `News` | noticia / autor | `NEW-{USERREF}-{SEQ4}` | `NEW-{YYYYMMDD}-{USERREF}-{SEQ4}` | `createdAt` | `news:{createdBy}` |
| `Notification` | notificación / usuario | No visible | `NTF-{YYYYMMDD}-{USERREF}-{SEQ4}` | `createdAt` | `notification:{userId}` |
| `RoleApplication` | solicitud / usuario / rol | `RAP-{USERREF}-{ROL}-{SEQ3}` | `RAP-{YYYYMMDD}-{USERREF}-{ROL}-{SEQ3}` | `createdAt` | `role-application:{userId}:{roleId}` |
| `Ticket` | ticket / marca | `TKT-{BRANDREF}-{SEQ4}` | `TKT-{YYYYMMDD}-{BRANDREF}-{SEQ4}` | `createdAt` | `ticket:{brandId}` |
| `UniversityApplication` | solicitud / usuario / universidad | `UAP-{UNIREF}-{USERREF}-{SEQ3}` | `UAP-{YYYYMMDD}-{UNIREF}-{USERREF}-{SEQ3}` | `createdAt` | `university-application:{universityId}` |
| Registro de torneo | torneo / equipo | `REG-{TOURREF}-{TEAMREF}-{SEQ3}` | `REG-{YYYYMMDD}-{TOURREF}-{TEAMREF}-{SEQ3}` | `registeredAt` | `registration:{tournamentId}` |
| Solicitud de ingreso | equipo / usuario | `JNR-{TEAMREF}-{USERREF}-{SEQ3}` | `JNR-{YYYYMMDD}-{TEAMREF}-{USERREF}-{SEQ3}` | `createdAt` | `join-request:{teamId}` |

### Referencias abreviadas usadas en relaciones

```text
USERREF / ID público del usuario sin guiones / S00101
TEAMREF / ID público del equipo sin guiones / TEAM00101
BRANDREF / ID público de marca sin guiones / BRD001
TOURREF / ID público del torneo sin guiones / TORMLBB00101
UNIREF / siglas o ID público universitario sanitizado / ITLA06140001
CAMREF / segmento corto asignado desde Campaign.publicCode / CAM001
ROL / código aprobado del rol / ORG, COA, CAS, ANA, CRE, BRD
```

Las referencias se derivan automáticamente de entidades relacionadas. Nunca se escriben manualmente desde el formulario.

## 13. Entidades técnicas que nunca deben renderizar su identificador

```text
Session.jti / PasswordResetToken.tokenHash / MongoDB._id / tokens 2FA / tokens de correo
```

Estos valores son internos o de seguridad. No deben convertirse en IDs visuales ni incluirse dentro de otros IDs.

## 14. Patrocinador — DECISIÓN PENDIENTE

Actualmente no existe un modelo `Sponsor` separado. Las marcas patrocinadoras se representan con `Brand`.

Mientras esto no cambie:

```text
MARCA PATROCINADORA = Brand
ID DEL PATROCINADOR = Brand.code
EJEMPLO = BRD-001
```

No debe generarse `SPN-001` porque no existe una entidad persistente que lo respalde.

Si posteriormente se crea un modelo separado, el formato deberá documentarse antes de implementarse:

```text
PATROCINADOR / MARCA / SECUENCIA
SPN-{BRANDREF}-{SEQ3}
SPN-BRD001-001
```

El ID extenso correspondiente deberá ser:

```text
PATROCINADOR / FECHA DE CREACIÓN / MARCA / SECUENCIA
SPN-{YYYYMMDD}-{BRANDREF}-{SEQ3}
SPN-20260622-BRD001-001
```

Ficha requerida si se aprueba como entidad independiente:

```text
ENTIDAD          / Sponsor
RELACIÓN PADRE   / Brand
FECHA            / Sponsor.createdAt
CONTADOR         / sponsor:{brandId}
VISIBILIDAD      / Público visible; extenso para propietario
CAMPOS           / publicCode e internalCode
```

## 15. Orden obligatorio para implementar la correlación

```text
1 / Resolver publicId vs tournamentCode en Tournament
2 / Formalizar Campaign.tournamentId
3 / Crear Campaign.publicCode relacional
4 / Convertir Invoice.invoiceNumber al formato relacional aprobado
5 / Actualizar Creative.adId para referenciar la campaña
6 / Documentar y luego implementar solicitudes, tickets y publicaciones
7 / Consolidar perfiles especializados ORG, CRE y CAS al aprobar cada rol
```

Ningún formato marcado como **PENDIENTE** debe pasar a código hasta aprobar en este documento su composición, alcance del contador y reglas de visibilidad.

## 16. Perfiles especializados de usuario — PENDIENTES DE CONSOLIDACIÓN

Los perfiles especializados pertenecen al mismo `User` maestro. No reemplazan `User.playerCode`; añaden una identidad pública asociada al rol aprobado.

### Regla común de fecha

La fecha del ID extenso debe representar la aprobación o activación del rol, no la creación original de la cuenta.

```text
FUENTE ACTUAL DE APROBACIÓN / RoleApplication.reviewedAt
CAMPO FUTURO EN USER       / roleProfiles.{role}.approvedAt
FORMATO                    / YYYYMMDD
EJEMPLO                    / 20260622
```

`User.createdAt` solo podrá utilizarse como respaldo durante una migración cuando no exista una solicitud aprobada verificable. No debe describirse como fecha de aprobación porque representa el alta de la cuenta maestra.

### 16.1 Organizador

```text
ESTADO           / Pendiente de implementación en User
ENTIDAD          / User.roleProfiles.organizer
RELACIÓN PADRE   / User maestro + Country del usuario + RoleApplication aprobada
FECHA            / approvedAt; origen inicial RoleApplication.reviewedAt
CONTADOR         / organizer:{countryCode}
VISIBILIDAD      / Corto público; extenso para propietario y admin
CAMPOS           / organizerCode, organizerInternalCode, approvedAt
```

ID público:

```text
ORGANIZADOR / PREFIJO / SECUENCIA POR PAÍS / PAÍS
ORG-{SEQ3}-{PAIS}
ORG-001-01
```

ID extenso:

```text
ORGANIZADOR / PREFIJO / FECHA DE APROBACIÓN / SECUENCIA / PAÍS
ORG-{YYYYMMDD}-{SEQ3}-{PAIS}
ORG-20260622-001-01
```

Uso público previsto: perfil del organizador, directorio de organizadores y tarjetas de torneos organizados.

### 16.2 Creador de contenido

```text
ESTADO           / Pendiente de implementación en User
ENTIDAD          / User.roleProfiles.creator
RELACIÓN PADRE   / User maestro + Country del usuario + RoleApplication aprobada
FECHA            / approvedAt; origen inicial RoleApplication.reviewedAt
CONTADOR         / creator:{countryCode}
VISIBILIDAD      / Corto público; extenso para propietario y admin
CAMPOS           / creatorCode, creatorInternalCode, approvedAt
```

ID público:

```text
CREADOR / PREFIJO / SECUENCIA POR PAÍS / PAÍS
CRE-{SEQ3}-{PAIS}
CRE-001-01
```

ID extenso:

```text
CREADOR / PREFIJO / FECHA DE APROBACIÓN / SECUENCIA / PAÍS
CRE-{YYYYMMDD}-{SEQ3}-{PAIS}
CRE-20260622-001-01
```

Uso público previsto: perfil, tarjetas de contenido, directorio y panel de monetización del creador.

### 16.3 Caster o narrador

```text
ESTADO           / Pendiente de implementación en User
ENTIDAD          / User.roleProfiles.caster
RELACIÓN PADRE   / User maestro + Country del usuario + RoleApplication aprobada
FECHA            / approvedAt; origen inicial RoleApplication.reviewedAt
CONTADOR         / caster:{countryCode}
VISIBILIDAD      / Corto público; extenso para propietario y admin
CAMPOS           / casterCode, casterInternalCode, approvedAt
```

ID público:

```text
CASTER / PREFIJO / SECUENCIA POR PAÍS / PAÍS
CAS-{SEQ3}-{PAIS}
CAS-001-01
```

ID extenso:

```text
CASTER / PREFIJO / FECHA DE APROBACIÓN / SECUENCIA / PAÍS
CAS-{YYYYMMDD}-{SEQ3}-{PAIS}
CAS-20260622-001-01
```

Uso público previsto: perfil del caster, asignaciones de transmisión y tarjetas de eventos narrados.

### 16.4 Correlación con el usuario maestro

La relación se conserva mediante el mismo documento `User`; no se escribe el `playerCode` dentro del código especializado.

```text
USER MAESTRO / S001-01
ROL ORGANIZADOR / ORG-001-01
ROL CREADOR / CRE-001-01
ROL CASTER / CAS-001-01
```

Cada código especializado debe ser único, inmutable y asignarse una sola vez cuando el rol sea aprobado. Revocar el rol no libera ni reutiliza su secuencia.

### 16.5 Regla visual condicional

```text
PROPIETARIO / ID corto + slash + ID extenso
ADMIN       / ID corto + slash + ID extenso
TERCERO     / Solo ID corto
```

Ejemplos:

```text
MI PERFIL O ADMIN / ORG-001-01 / ORG-20260622-001-01
VISTA PÚBLICA     / ORG-001-01
```

Reglas obligatorias:

1. `isOwner === true` o `currentUser.role === 'admin'`: renderizar ambos IDs.
2. Cualquier otro usuario: eliminar el ID extenso de la respuesta del backend y mostrar únicamente el corto.
3. El frontend no debe generar IDs ni reconstruirlos con datos locales.
4. La etiqueta se ubicará en la esquina de la tarjeta sin modificar las reglas responsive existentes.
5. La privacidad debe aplicarse en backend; ocultar únicamente con CSS no es suficiente.
