// ============================================
// GlitchGang Bot - Ready Event
// ============================================

const { Events, ActivityType } = require('discord.js');
const { BOT_CONFIG } = require('../utils/constants');
const { initializeCheckinMonitor } = require('../services/checkinMonitor');
const discordGuildService = require('../services/discordGuildService');
const matchRecorder = require('../services/matchRecorder');
const internalBotApi = require('../services/internalBotApi');
const { startAutoRoleSync } = require('../services/roleSyncService');
const { startProvisionWorker } = require('../services/provisionWorker');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`[${BOT_CONFIG.BRAND_NAME}] Bot online como ${client.user.tag}`);
    console.log(`[${BOT_CONFIG.BRAND_NAME}] Servidores: ${client.guilds.cache.size}`);
    console.log(`[${BOT_CONFIG.BRAND_NAME}] Version: ${BOT_CONFIG.VERSION}`);

    client.user.setActivity('torneos esports', { type: ActivityType.Watching });

    // Inicializar servicios que necesitan la referencia del client
    discordGuildService.initialize(client);
    matchRecorder.initialize(client);
    internalBotApi.start();
    startProvisionWorker();

    initializeCheckinMonitor(client).catch((error) => {
      console.error('[CheckinMonitor] Error al inicializar:', error.message);
    });

    startAutoRoleSync(client);
  },
};
