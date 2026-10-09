const commands = require("../commands");
const { normalizePhone } = require("../services/glitchgangApi");
const crm = require("../crm/store");

async function handleCommand({ body, senderPhone, reply, context = {} }) {
  const prefix = process.env.COMMAND_PREFIX || "!";
  const text = String(body || "").trim();

  if (!text.startsWith(prefix)) return false;

  const [rawCommand, ...args] = text.slice(prefix.length).trim().split(/\s+/);
  const commandName = String(rawCommand || "").toLowerCase();

  if (!commandName) return false;

  const command = commands[commandName];

  if (!command) {
    await reply(
      `❌ Comando desconocido.\nEscribe *${prefix}ayuda* para ver los comandos disponibles.`
    );
    return true;
  }

  const normalizedPhone = normalizePhone(senderPhone);

  try {
    crm.logCommand({
      command: commandName,
      args,
      phone: normalizedPhone,
      groupId: context.groupId || null,
      groupName: context.groupName || null,
      status: "received"
    });

    await command.execute({
      args,
      phone: normalizedPhone,
      reply: async (text) => {
        crm.addConversation({
          direction: "outbound",
          phone: normalizedPhone,
          groupId: context.groupId || null,
          groupName: context.groupName || null,
          body: text,
          command: commandName
        });
        return reply(text);
      },
      context
    });
  } catch (error) {
    console.error(`Error ejecutando ${commandName}:`, error);
    crm.logCommand({
      command: commandName,
      args,
      phone: normalizedPhone,
      groupId: context.groupId || null,
      groupName: context.groupName || null,
      status: "error",
      error: error.message
    });
    await reply("⚠️ Ocurrió un error procesando el comando.");
  }

  return true;
}

module.exports = { handleCommand };
