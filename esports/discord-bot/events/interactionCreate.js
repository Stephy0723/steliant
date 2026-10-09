// ============================================
// GlitchGang Bot - Interaction Create Event
// ============================================

const { Events } = require('discord.js');
const { errorEmbed, warningEmbed } = require('../utils/embeds');
const backendApi = require('../services/backendApi');
const { syncMemberRoles } = require('../services/roleSyncService');
const { handleSupportInteraction } = require('../services/supportTicketService');

// Los torneos ahora se organizan por Discord: estar vinculado a una cuenta
// de GlitchGang es obligatorio para ver o participar en ellos. Estos son
// los comandos que tocan datos reales de perfil/equipo/torneo.
const REQUIRES_LINK = new Set([
  'perfil', 'referir', 'registrar', 'equipo', 'torneo',
  'checkin', 'cancelar', 'report', 'start-match', 'calendario', 'soporte',
]);

// Mismo valor de `ephemeral` que cada comando le pasaba a su propio
// deferReply() -- ahora se defiere aca, antes de la consulta al backend,
// para no perder la ventana de 3s de Discord mientras se resuelve el link.
//
// checkin/cancelar/report/start-match eran `false`: el bot publicaba esas
// operaciones a la vista de todo el que pudiera ver el canal, sin que nadie
// lo hubiera pedido. Ahora son efimeras (solo las ve quien corrio el
// comando); el staff sigue viendo todo -- checkin/cancelar/start-match
// mandan ademas una copia al canal "staffLog" (eventChannels.js) y report
// sigue publicando el resultado oficial en el canal "results" -- eso queda
// publico a proposito.
const DEFER_EPHEMERAL = {
  perfil: true,
  referir: true,
  registrar: true,
  equipo: true,
  torneo: true,
  checkin: true,
  cancelar: true,
  report: true,
  'start-match': true,
  calendario: true,
  soporte: true,
};

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (await handleSupportInteraction(interaction)) return;

    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      console.warn(`[Command] Comando desconocido: ${interaction.commandName}`);
      return;
    }

    try {
      if (REQUIRES_LINK.has(interaction.commandName)) {
        // Se acusa recibo ANTES de consultar el backend: esa consulta viaja
        // bot -> CRM -> backend y si tarda mas de 3s Discord ya muestra "La
        // aplicacion no ha respondido" aunque el comando responda bien un
        // instante despues (no queda ningun error que loguear, por eso
        // costaba tanto detectarlo).
        await interaction.deferReply({ ephemeral: DEFER_EPHEMERAL[interaction.commandName] ?? false });

        try {
          // Se cachea en la interaccion para que el comando (p.ej. /perfil)
          // no tenga que volver a pedirlo.
          interaction.glitchgangProfile = await backendApi.getPlayerProfile(interaction.user.id);

          // Mantiene los roles de Discord al dia en cada interaccion, sin
          // bloquear la respuesta del comando.
          if (interaction.member) {
            void syncMemberRoles(interaction.member, interaction.glitchgangProfile).catch(() => {});
          }
        } catch (error) {
          if (error instanceof backendApi.NotLinkedError) {
            const embed = warningEmbed(
              'Cuenta no vinculada',
              'Debes vincular tu cuenta de Discord con tu cuenta de GlitchGang antes de ver o participar en torneos.\n\nUsa `/vincular` para conectarlas.'
            );
            return interaction.editReply({ embeds: [embed] });
          }
          throw error;
        }
      }

      await command.execute(interaction);
    } catch (error) {
      console.error(`[Command] Error en /${interaction.commandName}:`, error);

      const embed = errorEmbed(
        'Error del Sistema',
        'Ocurrio un error al ejecutar el comando. Intenta de nuevo.'
      );

      const method = interaction.replied || interaction.deferred ? 'followUp' : 'reply';
      await interaction[method]({ embeds: [embed], ephemeral: true }).catch(() => {});
    }
  },
};
