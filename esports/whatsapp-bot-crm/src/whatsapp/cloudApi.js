const { handleCommand } = require("../handlers/commandHandler");
const crm = require("../crm/store");

function graphVersion() {
  return process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
}

async function sendText(to, body) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) throw new Error("Faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN");

  const response = await fetch(`https://graph.facebook.com/${graphVersion()}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: String(body) }
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Meta Cloud API ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && expected && token === expected) return res.status(200).send(challenge);
  return res.sendStatus(403);
}

async function receiveWebhook(req, res) {
  // Responder a Meta inmediatamente y procesar después.
  res.sendStatus(200);

  try {
    const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const message of value.messages || []) {
          if (message.type !== "text") continue;
          const from = message.from;
          const body = message.text?.body || "";
          if (!from || !body) continue;

          crm.addConversation({ direction: "inbound", phone: from, body, command: null });

          await handleCommand({
            body,
            senderPhone: from,
            context: { source: "whatsapp_cloud_api", messageId: message.id },
            reply: (text) => sendText(from, text)
          });
        }
      }
    }
  } catch (error) {
    console.error("Error procesando webhook de WhatsApp:", error);
  }
}

module.exports = { sendText, verifyWebhook, receiveWebhook };
