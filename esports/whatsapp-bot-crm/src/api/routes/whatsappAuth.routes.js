const express = require("express");
const router = express.Router();
const otpService = require("../../services/otpService");
const userService = require("../../services/userService");

/**
 * POST /api/whatsapp/request-code
 * Solicita un código OTP para vinculación por WhatsApp
 */
router.post("/request-code", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "Teléfono requerido"
      });
    }

    // Validar formato de teléfono (básico)
    if (!/^\+?[0-9]{10,15}$/.test(phone.replace(/\s/g, ""))) {
      return res.status(400).json({
        success: false,
        error: "Formato de teléfono inválido"
      });
    }

    // Generar código OTP
    const otpResult = await otpService.createVerificationCode(phone);

    if (!otpResult.success) {
      return res.status(500).json({
        success: false,
        error: "Error al generar código"
      });
    }

    // TODO: Enviar código por WhatsApp Cloud API
    // Aquí irá la integración con Meta WhatsApp API
    // whatsappCloudApi.sendOTP(phone, otpResult.code);

    res.json({
      success: true,
      message: "Código enviado por WhatsApp",
      phone,
      expiresIn: `${otpService.OTP_EXPIRY_MINUTES} minutos`,
      // En desarrollo, mostrar el código (QUITAR EN PRODUCCIÓN)
      code: process.env.NODE_ENV === "development" ? otpResult.code : undefined
    });
  } catch (error) {
    console.error("Error requesting OTP code:", error);
    res.status(500).json({
      success: false,
      error: "Error al procesar solicitud"
    });
  }
});

/**
 * POST /api/whatsapp/verify-code
 * Verifica un código OTP y vincula la cuenta
 */
router.post("/verify-code", async (req, res) => {
  try {
    const { phone, code, userId, username } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        error: "Teléfono y código requeridos"
      });
    }

    // Verificar el código
    const verifyResult = await otpService.verifyCode(phone, code);

    if (!verifyResult.success) {
      await otpService.incrementAttempts(phone);
      return res.status(400).json({
        success: false,
        error: verifyResult.error
      });
    }

    let finalUserId = userId;

    // Si no hay userId, crear nuevo usuario
    if (!finalUserId) {
      if (!username) {
        return res.status(400).json({
          success: false,
          error: "Username requerido para nuevo usuario"
        });
      }

      const userResult = await userService.createUser({
        username,
        email: null,
        game: null,
        region: null
      });

      if (!userResult.success) {
        return res.status(500).json({
          success: false,
          error: userResult.error
        });
      }

      finalUserId = userResult.userId;
    }

    // Vincular cuenta de WhatsApp
    const linkResult = await userService.linkWhatsAppAccount(
      finalUserId,
      phone,
      true
    );

    if (!linkResult.success) {
      return res.status(500).json({
        success: false,
        error: linkResult.error
      });
    }

    // Actualizar última actividad
    await userService.updateLastActivity(phone);

    res.json({
      success: true,
      message: "Cuenta vinculada correctamente",
      userId: finalUserId,
      phone,
      verified: true
    });
  } catch (error) {
    console.error("Error verifying code:", error);
    res.status(500).json({
      success: false,
      error: "Error al verificar código"
    });
  }
});

/**
 * GET /api/whatsapp/account/:phone
 * Obtiene información de la cuenta vinculada
 */
router.get("/account/:phone", async (req, res) => {
  try {
    const { phone } = req.params;

    const account = await userService.getWhatsAppAccountByPhone(phone);

    if (!account) {
      return res.status(404).json({
        success: false,
        error: "Cuenta no encontrada"
      });
    }

    if (!account.verified) {
      return res.json({
        success: true,
        verified: false,
        message: "Cuenta pendiente de verificación"
      });
    }

    const user = await userService.getUserById(account.user_id);

    res.json({
      success: true,
      verified: true,
      account,
      user
    });
  } catch (error) {
    console.error("Error getting account:", error);
    res.status(500).json({
      success: false,
      error: "Error al obtener cuenta"
    });
  }
});

/**
 * POST /api/whatsapp/request-new-code
 * Solicita un nuevo código si el anterior expiró
 */
router.post("/request-new-code", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "Teléfono requerido"
      });
    }

    const otpResult = await otpService.createVerificationCode(phone);

    if (!otpResult.success) {
      return res.status(500).json({
        success: false,
        error: "Error al generar código"
      });
    }

    res.json({
      success: true,
      message: "Nuevo código enviado",
      phone,
      expiresIn: `${otpService.OTP_EXPIRY_MINUTES} minutos`,
      code: process.env.NODE_ENV === "development" ? otpResult.code : undefined
    });
  } catch (error) {
    console.error("Error requesting new OTP code:", error);
    res.status(500).json({
      success: false,
      error: "Error al procesar solicitud"
    });
  }
});

module.exports = router;
