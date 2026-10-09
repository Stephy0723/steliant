// ============================================
// GlitchGang Bot - Internal Bot API
// ============================================
// El proceso del bot (index.js) es el unico que tiene una referencia viva
// al Client de discord.js. El CRM (api/server.js) corre como OTRO proceso
// (asi en npm run dev y asi en produccion via PM2 — "discord-bot" y
// "discord-crm" son apps separadas), asi que no puede importar
// discordGuildService directo: ese modulo solo queda inicializado dentro
// de este proceso.
//
// Este servidor expone por HTTP en localhost las pocas operaciones que el
// CRM todavia necesita disparar sobre el bot (anunciar en un canal,
// disparar el aprovisionamiento de un torneo — ver services/botBridge.js
// del lado del CRM). Nunca se expone fuera de 127.0.0.1 y exige el mismo
// secreto compartido que ya usa el bot para hablar con el backend (BOT_API_KEY).

const express = require('express');
const { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const discordGuildService = require('./discordGuildService');
const { normalizeDiscordColor } = require('../utils/colors');
const { provisionTournamentFromCrm } = require('./provisionWorker');

const PORT = Number(process.env.BOT_INTERNAL_PORT) || 3055;
const INTERNAL_KEY = process.env.BOT_API_KEY || '';

let server = null;

function isHttpUrl(value) {
  return /^https?:\/\/\S+$/i.test(String(value || ''));
}

// Embed + boton + imagen adjunta de una publicacion del Control Center.
// Lo usan /publish (crear) y PATCH /messages (editar).
function buildPublishMessage({ title, description, url, imageUrl, imageData, imageName, color, footer, ctaLabel, ctaUrl } = {}) {
  const embed = new EmbedBuilder()
    .setTitle(String(title).slice(0, 256))
    .setColor(normalizeDiscordColor(color))
    .setTimestamp();
  if (description) embed.setDescription(String(description).slice(0, 4000));
  if (isHttpUrl(url)) embed.setURL(url);
  // Imagen subida a la web: llega como archivo y va adjunta al mensaje.
  const files = [];
  if (imageData) {
    const name = String(imageName || 'imagen.png').replace(/[^\w.-]/g, '_');
    files.push(new AttachmentBuilder(Buffer.from(imageData, 'base64'), { name }));
    embed.setImage(`attachment://${name}`);
  } else if (isHttpUrl(imageUrl)) {
    embed.setImage(imageUrl);
  }
  embed.setFooter({ text: String(footer || 'GlitchGang').slice(0, 2048) });

  const components = [];
  if (ctaLabel && isHttpUrl(ctaUrl)) {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(String(ctaLabel).slice(0, 80)).setURL(ctaUrl),
    ));
  }
  return { embed, components, files };
}

function requireInternalKey(req, res, next) {
  if (!INTERNAL_KEY || req.headers['x-glitchgang-bot-key'] !== INTERNAL_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

function start() {
  if (server) return server;

  const app = express();
  // Solo escucha en 127.0.0.1; el limite alto es por imagenes adjuntas en /publish.
  app.use(express.json({ limit: '12mb' }));
  app.use(requireInternalKey);

  app.post('/announce', async (req, res) => {
    try {
      const { guildId, channelId, title, description, color, footer } = req.body || {};
      if (!channelId) return res.status(400).json({ error: 'Falta channelId.' });
      res.json(await discordGuildService.sendChannelMessage(guildId, channelId, { title, description, color, footer }));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/provision/tournaments', async (req, res) => {
    try {
      const { tournamentId } = req.body || {};
      if (!tournamentId) return res.status(400).json({ error: 'Falta tournamentId.' });
      res.json(await provisionTournamentFromCrm({ tournamentId }));
    } catch (error) {
      // Este endpoint no logueaba nada -- el organizador solo veia
      // error.message resumido, sin forma de ver la causa completa
      // (path/received del validador de discord.js) en los logs del bot.
      console.error(`[InternalBotApi] Error provisionando torneo ${req.body?.tournamentId}:`, error);
      res.status(400).json({ error: error.message });
    }
  });

  // GET /status — estado en vivo del bot y del servidor general de Discord,
  // para la pestaña "Servidor" del Control Center admin (discord-sync).
  app.get('/status', async (req, res) => {
    try {
      const guildId = String(req.query.guildId || '').trim();
      const overview = await discordGuildService.getGuildOverview(guildId);
      const client = discordGuildService.getClient();
      res.json({
        online: true,
        latencyMs: Math.round(client.ws.ping),
        uptimeMs: client.uptime,
        guild: overview,
      });
    } catch (error) {
      res.status(503).json({ online: false, error: error.message });
    }
  });

  // GET /guild/channels — inventario real de canales del servidor, para la
  // pestaña "Canales" del Control Center admin (mismo dato que ya usa
  // discordGuildService.getChannels para el CRM de torneos).
  app.get('/guild/channels', async (req, res) => {
    try {
      const guildId = String(req.query.guildId || '').trim();
      res.json({ channels: await discordGuildService.getChannels(guildId) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Edicion de canales del servidor general desde el Control Center admin.
  app.post('/guild/channels', async (req, res) => {
    try {
      const { guildId, name, type, parentId, topic } = req.body || {};
      if (!String(name || '').trim()) return res.status(400).json({ error: 'Falta el nombre del canal.' });
      res.json({ channel: await discordGuildService.createChannel(guildId, { name, type, parentId, topic }) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/guild/channels/:channelId', async (req, res) => {
    try {
      const { guildId, name, topic, rateLimitPerUser, parentId } = req.body || {};
      res.json({ channel: await discordGuildService.editChannel(guildId, req.params.channelId, { name, topic, rateLimitPerUser, parentId }) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/guild/channels/:channelId', async (req, res) => {
    try {
      const guildId = String(req.query.guildId || '').trim();
      res.json(await discordGuildService.deleteChannel(guildId, req.params.channelId));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /publish — publicacion del Control Center admin (noticia, banner,
  // marca, version, anuncio, tema de foro...) en un canal del servidor
  // general. Devuelve el id del mensaje (y del tema, si es foro) para que la
  // web lo guarde y pueda editarlo o retirarlo despues.
  app.post('/publish', async (req, res) => {
    try {
      const { guildId, channelId, title, appliedTags } = req.body || {};
      if (!channelId) return res.status(400).json({ error: 'Falta channelId.' });
      if (!title) return res.status(400).json({ error: 'Falta title.' });
      const { embed, components, files } = buildPublishMessage(req.body);
      res.json(await discordGuildService.sendEmbed(guildId, channelId, embed, {
        components,
        files,
        threadName: title,
        appliedTags: Array.isArray(appliedTags) ? appliedTags : [],
      }));
    } catch (error) {
      console.error('[InternalBotApi] Error publicando en Discord:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // PATCH /messages/:channelId/:messageId — edita una publicacion ya enviada.
  app.patch('/messages/:channelId/:messageId', async (req, res) => {
    try {
      const { guildId, title } = req.body || {};
      if (!title) return res.status(400).json({ error: 'Falta title.' });
      const { embed, components, files } = buildPublishMessage(req.body);
      res.json(await discordGuildService.editMessage(guildId, req.params.channelId, req.params.messageId, {
        embeds: [embed], components, files, threadName: title,
      }));
    } catch (error) {
      console.error('[InternalBotApi] Error editando mensaje:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // DELETE /messages/:channelId/:messageId — retira una publicacion de Discord.
  app.delete('/messages/:channelId/:messageId', async (req, res) => {
    try {
      const guildId = String(req.query.guildId || '').trim();
      res.json(await discordGuildService.deleteMessage(guildId, req.params.channelId, req.params.messageId));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Foros del servidor general: listar temas y borrar uno.
  app.get('/guild/forums/:forumId/threads', async (req, res) => {
    try {
      const guildId = String(req.query.guildId || '').trim();
      res.json(await discordGuildService.listForumThreads(guildId, req.params.forumId));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/guild/threads/:threadId', async (req, res) => {
    try {
      const guildId = String(req.query.guildId || '').trim();
      res.json(await discordGuildService.deleteThread(guildId, req.params.threadId));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`[InternalBotApi] Escuchando en 127.0.0.1:${PORT} (solo para el CRM local)`);
  });

  return server;
}

module.exports = { start };
