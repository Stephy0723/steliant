// ============================================
// GlitchGang Bot - Deploy Slash Commands
// ============================================

require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { assertDiscordTokenMatchesClientId } = require('./utils/envValidation');

const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!TOKEN || !CLIENT_ID) {
  console.error('Faltan TOKEN o CLIENT_ID en .env');
  process.exit(1);
}

try {
  const tokenAppId = assertDiscordTokenMatchesClientId({ token: TOKEN, clientId: CLIENT_ID });
  console.log(`[Config] TOKEN validado para CLIENT_ID ${tokenAppId}`);
} catch (error) {
  console.error(`[Config] ${error.message}`);
  process.exit(1);
}

// Load all commands
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data) {
    commands.push(command.data.toJSON());
    console.log(`[Deploy] Preparado: /${command.data.name}`);
  }
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

// El bot es multi-tenant (un solo bot, varios servidores de Discord como
// clientes) — por defecto los comandos se registran GLOBALMENTE, para que
// cualquier servidor nuevo los vea apenas invite al bot, sin tener que
// desplegar nada por servidor. Pasa --dev para desplegar solo en GUILD_ID
// (mas rapido, util mientras se prueban cambios de un comando).
//
// Comandos dobles al escribir "/": Discord muestra a la vez el registro
// global y el del servidor (GUILD_ID) si alguna vez se corrieron los dos. Por
// eso el deploy global BORRA los comandos de servidor de GUILD_ID (PUT []):
// asi queda un solo registro vivo. --dev solo deberia usarse con un GUILD_ID
// de pruebas, nunca el servidor de produccion.
//   node deploy-commands.js               -> global + limpia los de GUILD_ID
//   node deploy-commands.js --dev         -> solo en GUILD_ID (pruebas)
//   node deploy-commands.js --clear-guild -> solo borra los de GUILD_ID
const useDevGuild = process.argv.includes('--dev');
const clearGuildOnly = process.argv.includes('--clear-guild');

async function clearGuildCommands() {
  if (!GUILD_ID) return;
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
  console.log(`Comandos de servidor borrados en ${GUILD_ID} (quedan solo los globales).`);
}

(async () => {
  try {
    if (clearGuildOnly) {
      if (!GUILD_ID) throw new Error('Falta GUILD_ID en .env para --clear-guild');
      await clearGuildCommands();
      console.log('Listo.\n');
      return;
    }

    console.log(`\nRegistrando ${commands.length} comandos...`);

    if (useDevGuild && GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
      console.log(`Comandos registrados en guild de desarrollo: ${GUILD_ID}`);
      console.log('Ojo: si este es el servidor de produccion, los comandos saldran dobles. Corre el deploy sin --dev para limpiarlo.');
    } else {
      // Global (tarda hasta 1 hora en propagarse la primera vez)
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
      console.log('Comandos registrados globalmente (disponibles en cualquier servidor donde este el bot)');
      await clearGuildCommands();
    }

    console.log('Deploy completado!\n');
  } catch (error) {
    console.error('Error en deploy:', error);
    process.exit(1);
  }
})();
