# Comandos desactivados

Estos comandos (`checkin-extend`, `checkin-force`, `checkin-undo`) dependían del
check-in viejo (`platformApi.js` + funciones internas de `checkin.js`/`embeds.js`
que ya no existen) reemplazado por la arquitectura de main
(`liveMatchService.js` + `tournamentMatches.controller.js`). Se sacaron de
`commands/` para que el bot no los registre en Discord y fallen en producción.

Para reactivarlos: portarlos al nuevo flujo (`services/liveMatchService.js` +
endpoints `/api/bots/matches/*`) y moverlos de vuelta a `commands/`.
