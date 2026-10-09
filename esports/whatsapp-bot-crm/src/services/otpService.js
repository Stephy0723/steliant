const crypto = require("crypto");
const db = require("../db/init");

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 3;

/**
 * Genera un código OTP de 6 dígitos
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash del código para almacenar de forma segura
 */
function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Crea un código de verificación OTP
 */
async function createVerificationCode(phone) {
  const code = generateOTP();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const id = `otp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    await db.run(
      `INSERT INTO whatsapp_verification_codes (id, phone, code, code_hash, expires_at, attempts, used)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, phone, code, codeHash, expiresAt.toISOString(), 0, 0]
    );

    return {
      success: true,
      code,
      expiresAt,
      id
    };
  } catch (error) {
    console.error("Error creating verification code:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verifica un código OTP
 */
async function verifyCode(phone, code) {
  try {
    const codeHash = hashCode(code);

    // Buscar el código
    const record = await db.get(
      `SELECT * FROM whatsapp_verification_codes 
       WHERE phone = ? AND code_hash = ? AND used = 0
       ORDER BY created_at DESC LIMIT 1`,
      [phone, codeHash]
    );

    if (!record) {
      return {
        success: false,
        error: "Código no encontrado o ya utilizado"
      };
    }

    // Verificar si ha expirado
    if (new Date(record.expires_at) < new Date()) {
      return {
        success: false,
        error: "Código expirado"
      };
    }

    // Incrementar intentos fallidos
    if (record.attempts >= MAX_ATTEMPTS) {
      // Marcar como usado
      await db.run(
        `UPDATE whatsapp_verification_codes SET used = 1 WHERE id = ?`,
        [record.id]
      );
      return {
        success: false,
        error: "Demasiados intentos fallidos"
      };
    }

    // Marcar como usado
    await db.run(
      `UPDATE whatsapp_verification_codes SET used = 1 WHERE id = ?`,
      [record.id]
    );

    return {
      success: true,
      phone,
      verifiedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error("Error verifying code:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Incrementa los intentos fallidos
 */
async function incrementAttempts(phone) {
  try {
    const record = await db.get(
      `SELECT * FROM whatsapp_verification_codes 
       WHERE phone = ? AND used = 0
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );

    if (record) {
      await db.run(
        `UPDATE whatsapp_verification_codes SET attempts = attempts + 1 WHERE id = ?`,
        [record.id]
      );
    }
  } catch (error) {
    console.error("Error incrementing attempts:", error);
  }
}

/**
 * Obtiene un código OTP pendiente
 */
async function getPendingCode(phone) {
  try {
    const record = await db.get(
      `SELECT * FROM whatsapp_verification_codes 
       WHERE phone = ? AND used = 0
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );

    if (!record) return null;

    const expiresAt = new Date(record.expires_at);
    if (expiresAt < new Date()) return null;

    const minutesRemaining = Math.ceil((expiresAt - new Date()) / 60000);

    return {
      id: record.id,
      phone: record.phone,
      expiresAt: record.expires_at,
      minutesRemaining,
      attempts: record.attempts
    };
  } catch (error) {
    console.error("Error getting pending code:", error);
    return null;
  }
}

module.exports = {
  generateOTP,
  hashCode,
  createVerificationCode,
  verifyCode,
  incrementAttempts,
  getPendingCode,
  OTP_EXPIRY_MINUTES,
  MAX_ATTEMPTS
};
