# Estadísticas desde capturas de Mobile Legends

## Uso

En el modal de resultados del bracket del organizador, o en **Mi equipo →
Enfrentamiento → Capturas y estadísticas**, selecciona la partida de la serie.
Cada ficha guarda una partida, no el resultado agregado de un BO3/BO5.

1. Sube hasta cuatro capturas PNG/JPEG/WebP de máximo 5 MB cada una. También
   puedes importar evidencia ya enviada por `/report`; se copia al almacenamiento
   local para evitar depender de la caducidad del enlace de Discord. Comprueba
   la fecha: puede haber varias partidas anteriores contra el mismo rival.
2. Para leer con Gemini, selecciona la captura y el equipo que aparece arriba o
   a la izquierda, y acepta el aviso de envío a Google. La lectura sustituye los
   datos del editor; no guarda, publica ni confirma nada. Puedes reintentar o
   introducir los datos manualmente. Subir evidencia por sí solo no llama a Google.
3. Resuelve los nombres amarillos usando el desplegable de los diez titulares.
   Los nicks se normalizan con NFKC, pero solo se asignan coincidencias exactas
   únicas del equipo correspondiente. No hay búsqueda global de usuarios.
4. Revisa cifras, ganador y marcador de kills. Vacío significa desconocido;
   cero solo significa cero. Daño porcentual no se convierte en daño absoluto.
5. Guarda el borrador. El rival u organizador abre el reporte, revisa todos los
   datos y marca la casilla de revisión antes de confirmar. Para corregir el
   reporte ajeno, lo copia a su propio borrador. Si las versiones discrepan,
   solo el organizador puede resolverlas y debe explicar el motivo.

La confirmación registra las estadísticas en `MatchStatsDraft` y en el historial
de los diez jugadores (`PlayerMatch`).

## Lectura automática de /report (desde el 6/oct/2026)

Antes la regla era "la IA nunca avanza rondas", porque solo se leía una captura.
Ahora cada equipo manda sus propias capturas con `/report` y la IA las lee en
segundo plano (`services/matchResults.service.js`, una ficha `ResultCase` por
partida de la serie). El bracket avanza solo (🟢, `source: 'ai-validated'`, la
ficha queda confirmada con `confirmation.role: 'system'`) únicamente si:

1. reportaron los dos equipos con las capturas obligatorias;
2. la IA leyó el mismo ganador en las capturas de ambos;
3. coincide con lo que declaró cada equipo;
4. los diez jugadores leídos están en el roster congelado;
5. la confianza general y la del ganador superan `MATCH_RESULTS_CONFIDENCE`
   (0.85 por defecto);
6. no hay señales de manipulación (misma imagen en otra partida, K/D/A
   distintos entre las dos capturas).

Si falta algo queda ⚪ (por confirmar) y si algo se contradice queda 🟠 (en
arbitraje): decide el árbitro. Si Gemini falla, la partida queda ⚪ y el torneo
no se bloquea. En juegos sin lectura, dos declaraciones que coinciden validan la
partida. La serie se escribe en el bracket cuando un equipo llega a la meta
(BO3: 2). Variables: `MATCH_RESULTS_AUTO_READ=false` apaga la lectura,
`MATCH_RESULTS_READS_PER_MINUTE` es la cuota del sistema (10).

## Configuración

- Usa `GEMINI_API_KEY` y `GEMINI_MODEL` existentes del backend. Opcionalmente
  `GEMINI_STATS_MODEL` permite elegir un modelo de visión distinto del de GG.
  No se utilizan otros proveedores ni claves en el frontend.
- Requiere MongoDB y los diez titulares con cuentas vinculadas en
  `registrations[].rosterSnapshot`. El primer check-in crea ese snapshot.
  Un roster incompleto o ambiguo bloquea el guardado; no se buscan sustitutos
  entre todos los miembros del equipo.
- Cuota de extracción/importación: cuatro peticiones por usuario por minuto
  por proceso API. En un despliegue con varias instancias, sustituir el store
  de memoria del limitador por uno compartido si se necesita cuota global.
- No se llamó al servicio real durante la implementación. Verificar el modelo
  disponible para la cuenta, su cuota y calidad con capturas reales antes del uso
  en un torneo. Las condiciones del plan se determinan en la cuenta de Google;
  el código no garantiza gratuidad ni cambia su configuración de facturación.

## API autenticada

Base: `/api/tournaments/:id/matches/:matchId/stats/:gameNumber`.

| Método | Sufijo | Acción |
|---|---|---|
| GET | — | Ficha, roster, permisos y evidencias de Discord |
| PUT | — | Guardar reporte propio con `revision`, `source`, `data`, `evidenceUrls` |
| POST | `/extract` | Leer una imagen; exige `consent`, `evidenceUrl`, `firstSideTeamId` |
| POST | `/evidence` | Copiar evidencia autorizada de Discord al almacenamiento local |
| POST | `/confirm` | Confirmar versión guardada; exige `reviewed`, `revision`, `source`; `reason` si hay conflicto |

`source` es el ID de uno de los equipos o `organizer`. Los permisos se resuelven
contra el organizador/admin y los líderes reales de los dos equipos. Ser staff
con acceso genérico al bracket no autoriza confirmar estas estadísticas.

Las revisiones anteriores se conservan (máximo 100 por ficha). Las confirmaciones
son inmutables y usan comparación atómica de versión. Un error al escribir el
historial se puede reparar con el botón de reintento del confirmante original.
Los índices únicos de `MatchStatsDraft` (torneo/match/juego) y `PlayerMatch`
(ficha/jugador) evitan duplicados. Con `autoIndex` deshabilitado en producción,
crear esos índices antes de habilitar las rutas.

Los registros históricos antiguos no se reescriben: no tienen identificador de
partida suficiente para deduplicarlos de forma segura. No rellenar estadísticas
retroactivas de esas series sin una migración que identifique sus filas originales.
Para nuevas series MLBB se elimina la creación automática de filas con ceros;
el historial individual nace al confirmar esta ficha. El W/L de equipos, podios
y avance del bracket conservan su flujo existente.

## Comprobación

Desde `backend`:

```powershell
$env:MATCH_STATS_TEST_MONGO='1'
node --test src/services/matchStats.test.js src/controllers/matchStats.integration.test.js
```

La prueba de integración solo usa `127.0.0.1:27017`, crea una base temporal
`gg_stats_test_*` y la elimina al terminar. Nunca usa el URI de la aplicación.
Sin esa variable, solo se ejecutan las pruebas sin MongoDB.

Desde `frontend`: `npm run build`.

También se verificó el editor en Chromium (entrada manual, confirmación humana,
aislamiento por partida, móvil y continuidad manual después de un 503 simulado).
Al ejecutar además la suite anterior de `tournamentSetup`, falla su caso de
activación de Discord: el mock de `Tournament.create` devuelve un objeto sin
`save()`. Ese caso no pertenece a esta función y queda pendiente de reparar.

Referencias de integración: [imágenes de Gemini](https://ai.google.dev/gemini-api/docs/image-understanding),
[salida estructurada](https://ai.google.dev/gemini-api/docs/structured-output),
[condiciones y tratamiento de datos](https://ai.google.dev/gemini-api/terms).
