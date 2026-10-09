// ============================================
// GlitchGang Bot - Main Entry Point
// ============================================

require('dotenv').config();

const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { assertDiscordTokenMatchesClientId } = require('./utils/envValidation');

// ── Create Client ───────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    // Necesarios para responder con IA a menciones (@bot) y DMs.
    // ⚠️ "Message Content Intent" debe estar habilitado en el Discord Developer Portal.
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    // Necesario para guildMemberAdd/guildMemberRemove (bienvenida/despedida
    // y sincronizacion de roles). ⚠️ "Server Members Intent" debe estar
    // habilitado en el Discord Developer Portal (junto a Message Content).
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel], // requerido para recibir DMs
});

// ── Load Commands ───────────────────────────
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`[Commands] Cargado: /${command.data.name}`);
  }
}

// ── Load Events ─────────────────────────────
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  console.log(`[Events] Registrado: ${event.name} (${event.once ? 'once' : 'on'})`);
}

// ── Global Error Handling ───────────────────
client.on('error', error => {
  console.error('[Client] Error:', error.message);
});

client.on('shardDisconnect', (event, shardId) => {
  if (event.code === 4014) {
    console.error(
      `[Gateway] Shard ${shardId} cerrado con 4014 (disallowed intents). ` +
        'Verifica que TOKEN pertenezca al bot correcto y que en Discord Developer Portal > Bot ' +
        'esten habilitados los intents necesarios. Este proyecto solicita Guilds y GuildVoiceStates.'
    );
    return;
  }

  console.error(`[Gateway] Shard ${shardId} desconectado con code ${event.code}.`);
});

process.on('unhandledRejection', error => {
  console.error('[Process] Unhandled rejection:', error);
});

// ── Login ───────────────────────────────────
if (!process.env.TOKEN) {
  console.error('[GlitchGang] TOKEN no encontrado en .env');
  process.exit(1);
}

try {
  const tokenAppId = assertDiscordTokenMatchesClientId({
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID,
  });
  console.log(`[GlitchGang] TOKEN validado para CLIENT_ID ${tokenAppId}`);
} catch (error) {
  console.error(`[GlitchGang] Configuracion Discord invalida: ${error.message}`);
  process.exit(1);
}

client.login(process.env.TOKEN);
