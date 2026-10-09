// ============================================
// GlitchGang Bot - /ayuda Command
// ============================================

const { SlashCommandBuilder } = require('discord.js');
const { commandEmbed } = require('../utils/embeds');
const { COLORS } = require('../utils/constants');

const SUPPORT_FIELD = {
  name: 'Soporte',
  value: '¿Problema en un torneo? Entra a su canal `#soporte` y elige tu categoria: se abre un ticket y le llega directo al staff del torneo. Para otros temas, contacta a un administrador del servidor.',
};

const SECTIONS = {
  general: {
    title: 'Guia rapida de GlitchGang',
    description: 'Ruta recomendada para jugar torneos desde Discord sin perderte entre comandos.',
    color: COLORS.PRIMARY,
    fields: [
      {
        name: 'Flujo competitivo',
        value: [
          '`/vincular` conecta tu Discord con GlitchGang.',
          '`/equipo crear` o `/registrar` te deja listo con tu roster.',
          '`/torneo lista` muestra eventos habilitados para Discord.',
          '`/checkin` valida asistencia en voz.',
          '`/start-match` inicia la partida oficial.',
          '`/report` cierra el match con evidencia.',
        ].join('\n'),
      },
      {
        name: 'Secciones',
        value: '`registro` | `checkin` | `partida` | `resultados` | `reglas` | `comandos`',
      },
      SUPPORT_FIELD,
    ],
  },
  registro: {
    title: 'Registro, cuenta y equipos',
    description: 'Todo jugador debe estar vinculado antes de entrar al flujo competitivo.',
    color: COLORS.INFO,
    fields: [
      {
        name: 'Cuenta',
        value: '`/vincular` abre un enlace privado. Si no tienes cuenta, puedes crearla durante el proceso.',
      },
      {
        name: 'Crear equipo',
        value: '`/equipo crear nombre:MiEquipo tag:TAG`\nEl creador queda como lider y recibe codigo de invitacion.',
      },
      {
        name: 'Unirse a equipo',
        value: '`/registrar codigo:862A4CDF`\nEl codigo lo comparte el lider desde `/equipo codigo`.',
      },
      SUPPORT_FIELD,
    ],
  },
  checkin: {
    title: 'Check-in de torneo',
    description: 'El check-in confirma que el roster esta presente en voz antes de jugar.',
    color: COLORS.INFO,
    fields: [
      {
        name: 'Como se hace',
        value: 'Todos entran al canal de voz y el lider ejecuta `/checkin`. El bot detecta presentes, faltantes y jugadores no registrados.',
      },
      {
        name: 'Ventanas disponibles',
        value: '`15 minutos` | `20 minutos` | `30 minutos` | `1 hora` | `1 dia`',
      },
      {
        name: 'Importante',
        value: 'Si el tiempo termina sin completar el check-in, el equipo puede quedar descalificado automaticamente.',
      },
      SUPPORT_FIELD,
    ],
  },
  partida: {
    title: 'Partida oficial',
    description: 'Usa este flujo cuando el check-in ya esta completo y el equipo esta listo.',
    color: COLORS.MATCH,
    fields: [
      {
        name: 'Iniciar',
        value: '`/start-match`\n`/start-match rival:NombreDelRival`',
      },
      {
        name: 'Requisitos',
        value: 'Check-in completo, roster en voz y lider del equipo ejecutando el comando.',
      },
      {
        name: 'Actividad',
        value: '`/calendario` muestra check-ins, partidas en curso y resultados recientes.',
      },
      SUPPORT_FIELD,
    ],
  },
  resultados: {
    title: 'Reporte de resultados',
    description: 'El resultado queda registrado con evidencia visual para revision de staff.',
    color: COLORS.SUCCESS,
    fields: [
      {
        name: 'Comando',
        value: '`/report resultado:Victoria imagen:captura.png`',
      },
      {
        name: 'Reglas',
        value: 'Solo reporta el lider. La captura es obligatoria. Debe existir una partida activa creada con `/start-match`.',
      },
      {
        name: 'Disputa',
        value: 'Si el resultado esta mal, contacta a staff con evidencia lo antes posible.',
      },
      SUPPORT_FIELD,
    ],
  },
  reglas: {
    title: 'Reglas del sistema',
    description: 'Estas reglas mantienen el torneo ordenado y auditable.',
    color: COLORS.WARNING,
    fields: [
      {
        name: 'Basicas',
        value: [
          'Un jugador no puede pertenecer a dos equipos a la vez.',
          'El lider gestiona check-in, partida y reporte.',
          'Todo resultado necesita captura.',
          'Los codigos de invitacion son privados del equipo.',
        ].join('\n'),
      },
      {
        name: 'Descalificacion',
        value: 'Puede ocurrir si no completan check-in a tiempo o abandonan la sala durante una operacion activa.',
      },
      SUPPORT_FIELD,
    ],
  },
  comandos: {
    title: 'Lista de comandos',
    description: 'Referencia compacta de los comandos disponibles.',
    color: COLORS.INFO,
    fields: [
      {
        name: 'Cuenta',
        value: '`/vincular` | `/perfil` | `/referir`',
      },
      {
        name: 'Equipos',
        value: '`/equipo crear` | `/equipo codigo` | `/equipo info` | `/registrar`',
      },
      {
        name: 'Torneos y partidas',
        value: '`/torneo lista` | `/torneo inscribir` | `/checkin` | `/start-match` | `/report` | `/cancelar`',
      },
      {
        name: 'Servidor',
        value: '`/rol ver` | `/rol configurar` | `/rol sincronizar` | `/calendario` | `/ping` | `/ayuda`',
      },
      SUPPORT_FIELD,
    ],
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ayuda')
    .setDescription('Muestra la guia del sistema de torneos')
    .addStringOption((option) =>
      option
        .setName('seccion')
        .setDescription('Seccion especifica de ayuda')
        .addChoices(
          { name: 'General', value: 'general' },
          { name: 'Registro de jugadores', value: 'registro' },
          { name: 'Check-in', value: 'checkin' },
          { name: 'Partida', value: 'partida' },
          { name: 'Resultados', value: 'resultados' },
          { name: 'Reglas', value: 'reglas' },
          { name: 'Comandos', value: 'comandos' },
        )
    ),

  async execute(interaction) {
    const section = interaction.options.getString('seccion') || 'general';
    const data = SECTIONS[section] || SECTIONS.general;

    await interaction.reply({
      embeds: [commandEmbed(data)],
      ephemeral: true,
    });
  },
};
