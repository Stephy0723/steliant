const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { handleCommand } = require("../handlers/commandHandler");
const crm = require("../crm/store");

function getAllowedGroups() {
  return String(process.env.ALLOWED_GROUP_IDS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

async function startWhatsApp() {
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: "glitchgang-bot"
    }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
  });

  client.on("qr", (qr) => {
    console.log("Escanea este QR desde WhatsApp:");
    qrcode.generate(qr, { small: true });
  });

  client.on("authenticated", () => {
    console.log("WhatsApp autenticado.");
  });

  client.on("ready", () => {
    console.log("GlitchGang WhatsApp Bot listo.");
  });

  client.on("message", async (message) => {
    try {
      const chat = await message.getChat();

      // Este bot está diseñado para comandos de grupos.
      if (!chat.isGroup) return;

      const allowedGroups = getAllowedGroups();

      if (allowedGroups.length && !allowedGroups.includes(chat.id._serialized)) {
        return;
      }

      const groupId = chat.id._serialized;
      const knownGroup = crm.list("groups").find((g) => g.whatsappGroupId === groupId);
      if (!knownGroup) {
        crm.create("groups", {
          whatsappGroupId: groupId,
          name: chat.name,
          status: "active",
          botEnabled: true
        });
      }

      const contact = await message.getContact();
      const senderPhone =
        contact.number ||
        String(message.author || message.from || "").split("@")[0];

      crm.addConversation({
        direction: "inbound",
        phone: senderPhone,
        groupId,
        groupName: chat.name,
        body: message.body
      });

      await handleCommand({
        body: message.body,
        senderPhone,
        reply: (text) => message.reply(text),
        context: {
          groupId: chat.id._serialized,
          groupName: chat.name,
          rawMessage: message
        }
      });
    } catch (error) {
      console.error("Error procesando mensaje de WhatsApp:", error);
    }
  });

  await client.initialize();
  return client;
}

module.exports = { startWhatsApp };
