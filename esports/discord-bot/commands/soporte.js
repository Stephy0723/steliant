// ============================================
// GlitchGang Bot - /soporte Command
// Línea directa de soporte prioritario desde Discord -- beneficio real del
// plan Pro/Team. Sin plan de pago, el bot explica que necesitas /ayuda o el
// centro de soporte web en su lugar (nunca finge crear un ticket que no va
// a tratarse distinto).
// ============================================

const { SlashCommandBuilder } = require('discord.js');
const backendApi = require('../services/backendApi');
const { successEmbed, warningEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('soporte')
    .setDescription('Abre un ticket de soporte prioritario (requiere plan de pago activo)')
    .addStringOption((option) =>
      option
        .setName('mensaje')
        .setDescription('Describe tu problema o pregunta')
        .setRequired(true)
        .setMaxLength(2000)
    ),

  async execute(interaction) {

    const profile = interaction.glitchgangProfile || await backendApi.getPlayerProfile(interaction.user.id);
    if (!profile.plan || profile.plan === 'Free') {
      const embed = warningEmbed(
        'Soporte prioritario — plan requerido',
        'Este canal directo de soporte por Discord es un beneficio de los planes de pago.\n\nCon el plan Free, usa `/ayuda` o abre un ticket en glitchgang.gg/ayuda -- lo revisamos igual, solo que sin prioridad.'
      );
      return interaction.editReply({ embeds: [embed] });
    }

    const mensaje = interaction.options.getString('mensaje', true);

    try {
      const { ticket } = await backendApi.createSupportTicket(interaction.user.id, mensaje);
      const embed = successEmbed(
        'Ticket prioritario creado',
        [
          `Código: \`${ticket.publicCode}\``,
          '',
          'Tu cuenta tiene soporte prioritario -- el equipo lo revisa antes que los tickets normales.',
          `Sigue la conversación en glitchgang.gg/ayuda/ticket/${ticket.publicCode}`,
        ].join('\n')
      );
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        embeds: [errorEmbed('Error', error.message || 'No se pudo crear el ticket. Intenta de nuevo.')],
      });
    }
  },
};
