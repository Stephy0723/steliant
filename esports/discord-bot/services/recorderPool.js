const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const { BOT_CONFIG } = require('../utils/constants');
const { assertEnvValueIsPlain, decodeDiscordTokenSubjectId, parseCsvEnv } = require('../utils/envValidation');

const tokens = parseCsvEnv(process.env.RECORDER_TOKENS);
const expectedClientIds = parseCsvEnv(process.env.RECORDER_CLIENT_IDS);
const principalClientId = String(process.env.CLIENT_ID || '').trim();

const workers = [];
let starting = false;
let started = false;

function configured() {
  return tokens.length > 0;
}

async function start() {
  if (!configured() || started || starting) return;
  starting = true;

  for (const [index, token] of tokens.entries()) {
    const workerId = `recorder-${index + 1}`;
    const expectedClientId = expectedClientIds[index] || '';

    try {
      assertEnvValueIsPlain(`RECORDER_TOKENS[${index}]`, token);
      const tokenClientId = decodeDiscordTokenSubjectId(token);

      if (!tokenClientId) {
        throw new Error('el token no parece ser un token Discord valido o esta incompleto.');
      }

      if (principalClientId && tokenClientId === principalClientId) {
        throw new Error(
          `usa el mismo token del bot principal (${principalClientId}). ` +
            'Un grabador debe ser otra aplicacion/bot de Discord.'
        );
      }

      if (expectedClientId && tokenClientId !== expectedClientId) {
        throw new Error(
          `pertenece a la aplicacion ${tokenClientId}, pero RECORDER_CLIENT_IDS[${index}] es ${expectedClientId}.`
        );
      }

      console.log(`[RecorderPool] ${workerId} token validado para aplicacion ${tokenClientId}`);
    } catch (error) {
      console.error(`[RecorderPool] ${workerId} omitido: ${error.message}`);
      continue;
    }

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
      ],
    });

    const worker = {
      id: workerId,
      client,
      token,
      busy: false,
      currentMatchId: null,
      connection: null,
      ready: false,
    };
    workers.push(worker);

    client.once('ready', () => {
      worker.ready = true;
      console.log(`[RecorderPool] ${worker.id} online como ${client.user.tag}`);
    });

    client.on('error', (error) => {
      console.error(`[RecorderPool] ${worker.id} error:`, error.message);
    });

    client.login(token).catch((error) => {
      console.error(`[RecorderPool] ${worker.id} no pudo iniciar sesion:`, error.message);
    });
  }

  started = true;
  starting = false;
}

function list() {
  return workers.map(worker => ({
    id: worker.id,
    ready: worker.ready,
    busy: worker.busy,
    currentMatchId: worker.currentMatchId,
    tag: worker.client.user?.tag || '',
  }));
}

function findAvailableWorker() {
  return workers.find(worker => worker.ready && !worker.busy);
}

async function joinWorkerVoice(worker, guildId, channelId) {
  const guild = await worker.client.guilds.fetch(guildId).catch(() => null);
  if (!guild) throw new Error(`${worker.id} no esta en el servidor ${guildId}.`);

  const connection = joinVoiceChannel({
    channelId,
    guildId,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: true,
    group: worker.client.user.id,
  });

  connection.on('stateChange', (oldState, newState) => {
    console.log(`[RecorderPool] ${worker.id} voz: ${oldState.status} -> ${newState.status}`);
    if (newState.status === 'disconnected' && newState.reason !== undefined) {
      console.log(`[RecorderPool] ${worker.id} voz razon de desconexion: ${newState.reason} closeCode=${newState.closeCode}`);
    }
  });
  connection.on('error', (error) => {
    console.error(`[RecorderPool] ${worker.id} voz error:`, error);
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, BOT_CONFIG.VOICE_CONNECT_TIMEOUT);
    return connection;
  } catch (error) {
    connection.destroy();
    throw new Error(`${worker.id} no pudo conectarse al canal de voz: ${error.message}`);
  }
}

async function acquire({ guildId, channelId, matchId }) {
  if (!configured()) return null;

  const worker = findAvailableWorker();
  if (!worker) {
    throw new Error('No hay bots grabadores libres para esta partida.');
  }

  worker.busy = true;
  worker.currentMatchId = matchId;

  try {
    worker.connection = await joinWorkerVoice(worker, guildId, channelId);
    console.log(`[RecorderPool] ${worker.id} asignado a match ${matchId}`);
    return {
      workerId: worker.id,
      client: worker.client,
      connection: worker.connection,
      release: () => release(worker.id),
    };
  } catch (error) {
    release(worker.id);
    throw error;
  }
}

function release(workerId) {
  const worker = workers.find(item => item.id === workerId);
  if (!worker) return;

  try {
    worker.connection?.destroy();
  } catch {}

  worker.connection = null;
  worker.busy = false;
  worker.currentMatchId = null;
  console.log(`[RecorderPool] ${worker.id} libre`);
}

module.exports = {
  configured,
  start,
  list,
  acquire,
  release,
};
