// Flags de features temporalmente desactivadas. Un flag en false oculta la
// UI y las entradas del feature sin borrar datos ni logica de backend, para
// poder reactivarlo mas adelante cambiando un solo valor.

// La integracion de WhatsApp (verificacion de cuenta, bot, roster) no se usa
// por ahora -- el equipo ya tiene Discord. El backend (auth.controller.js,
// whatsapp.service.js, bots.controller.js) y los datos existentes de
// usuarios que ya vincularon su WhatsApp se dejan intactos.
export const WHATSAPP_ENABLED = false

