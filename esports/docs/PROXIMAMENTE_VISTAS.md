# Paginas para mostrar como "Proximamente"

Fecha de corte: 2026-09-15

Este archivo debe contener unicamente las paginas que vamos a ocultar temporalmente detras de una vista de "Proximamente".

Una pagina entra aqui si cumple al menos una de estas condiciones:

- No se ha tocado recientemente.
- No tiene backend real o depende mucho de data local/mock.
- No es vital para el flujo principal de GlitchGang ahora mismo.

## Lista final

| Ruta | Vista actual | Motivo |
| --- | --- | --- |
| `/tv` | `TV` | Pagina antigua, no vital y basada en contenido/sponsors estaticos. |
| `/amigos` | `Friends` | Social secundario; no es parte del flujo principal de torneos/equipos. |
| `/redes` | `Socials` | Pagina secundaria, vieja y no critica para operar la plataforma. |
| `/recompensas` | `Rewards` | Depende de niveles/data local; no hay flujo completo de canje prioritario. |
| `/premium` | `Premium` | Oferta comercial no esencial; mejor no mostrarla hasta cerrar reglas y checkout final. |
| `/planes` | `Premium` | Misma vista que premium; dejar en proximamente por la misma razon. |
| `/creadores` | `CreatorsDirectory` | Directorio no vital y sin flujo fuerte de backend para el producto actual. |
| `/organizador/finanzas` | `OrganizerFinances` | Panel financiero secundario; dejar fuera hasta validar pagos/reportes reales. |
| `/organizador/crm` | `OrganizerCRM` | CRM no vital y con integraciones todavia inmaduras. |
| `/organizador/integraciones` | `BotIntegrations` | Depende de bots/configuraciones externas; no bloquear el flujo core con esto. |
| `/organizador/configuracion` | `OrganizerSettings` | Configuracion secundaria del rol organizador; no es critica para lanzar. |
| `/jugador/rendimiento` | `PlayerPerformance` | Vista antigua de metricas; conviene ocultarla hasta confirmar datos reales. |
| `/jugador/historial` | `PlayerHistory` | Historial secundario; no es vital frente a dashboard/equipos/partidas. |
| `/creador` | `CreatorDashboard` | Rol secundario no prioritario para el lanzamiento actual. |
| `/creador/contenido` | `CreatorContent` | Flujo de contenido sin backend completo de publicacion/estado. |
| `/creador/analiticas` | `CreatorAnalytics` | Analiticas probablemente mock o incompletas. |
| `/creador/monetizacion` | `CreatorMonetization` | No mostrar hasta definir reglas reales de pago/monetizacion. |
| `/marca/inventario` | `BrandInventory` | Usa inventario estatico; no es vital hasta cerrar oferta comercial real. |
| `/marca/naming-rights` | `BrandInventory` | Alias del inventario; misma razon. |
| `/marca/creatividades` | `BrandCreatives` | Gestion avanzada de marca; no es esencial para el flujo minimo. |
| `/marca/reportes` | `BrandReports` | Reporteria de marca no debe mostrarse si no hay datos consolidados. |
| `/mi-comunidad/operaciones` | `CommunityOperations` | Vista vieja/secundaria; no necesaria para crear o administrar una comunidad basica. |
| `/mi-comunidad/web` | `CommunityWeb` | Configuracion web secundaria; no vital para el MVP. |
| `/moderador/eventos` | `ModeratorDashboard` | Subruta reutilizada, falta cola real de eventos. |
| `/moderador/arbitraje` | `ModeratorDashboard` | Subruta reutilizada, falta flujo real de arbitraje. |
| `/moderador/produccion` | `ModeratorDashboard` | Subruta reutilizada, falta panel real de produccion. |

## Nota de aplicacion

No usar "Proximamente" en login, registro, dashboard, perfil, torneos, equipos, mi equipo, partidas del jugador, mensajes, pagos/comprobantes, soporte, comunidad publica o admin. Esas rutas son parte del camino principal o herramientas internas.
