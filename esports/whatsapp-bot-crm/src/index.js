require("dotenv").config();

const { startApi } = require("./server");
const { startWhatsApp } = require("./whatsapp/client");

async function bootstrap() {
  startApi();

  if (String(process.env.ENABLE_WHATSAPP).toLowerCase() === "true") {
    await startWhatsApp();
  } else {
    console.log("WhatsApp deshabilitado. ENABLE_WHATSAPP=false");
  }
}

bootstrap().catch((error) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
