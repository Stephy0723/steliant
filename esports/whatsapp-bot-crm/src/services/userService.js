const db = require("../db/init");
const crypto = require("crypto");

/**
 * Crea un ID único para usuarios
 */
function generateUserId() {
  return `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Crea una cuenta de usuario
 */
async function createUser(userData) {
  try {
    const userId = generateUserId();
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO users (id, username, email, game, region, status, verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        userData.username,
        userData.email || null,
        userData.game || null,
        userData.region || null,
        "active",
        0,
        now,
        now
      ]
    );

    return {
      success: true,
      userId,
      user: userData
    };
  } catch (error) {
    console.error("Error creating user:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Obtiene un usuario por ID
 */
async function getUserById(userId) {
  try {
    const user = await db.get(
      `SELECT * FROM users WHERE id = ?`,
      [userId]
    );
    return user;
  } catch (error) {
    console.error("Error getting user:", error);
    return null;
  }
}

/**
 * Obtiene un usuario por nombre de usuario
 */
async function getUserByUsername(username) {
  try {
    const user = await db.get(
      `SELECT * FROM users WHERE username = ?`,
      [username]
    );
    return user;
  } catch (error) {
    console.error("Error getting user by username:", error);
    return null;
  }
}

/**
 * Vincula una cuenta de WhatsApp a un usuario
 */
async function linkWhatsAppAccount(userId, phone, verified = false) {
  try {
    const accountId = `wa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const verifiedAt = verified ? now : null;

    await db.run(
      `INSERT INTO whatsapp_accounts (id, user_id, phone, verified, verified_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [accountId, userId, phone, verified ? 1 : 0, verifiedAt, now, now]
    );

    return {
      success: true,
      accountId,
      userId,
      phone,
      verified
    };
  } catch (error) {
    console.error("Error linking WhatsApp account:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Obtiene la cuenta de WhatsApp por teléfono
 */
async function getWhatsAppAccountByPhone(phone) {
  try {
    const account = await db.get(
      `SELECT * FROM whatsapp_accounts WHERE phone = ?`,
      [phone]
    );
    return account;
  } catch (error) {
    console.error("Error getting WhatsApp account:", error);
    return null;
  }
}

/**
 * Verifica una cuenta de WhatsApp
 */
async function verifyWhatsAppAccount(phone) {
  try {
    const now = new Date().toISOString();

    const result = await db.run(
      `UPDATE whatsapp_accounts SET verified = 1, verified_at = ?, updated_at = ? WHERE phone = ?`,
      [now, now, phone]
    );

    if (result.changes === 0) {
      return {
        success: false,
        error: "Cuenta de WhatsApp no encontrada"
      };
    }

    const account = await getWhatsAppAccountByPhone(phone);

    return {
      success: true,
      account
    };
  } catch (error) {
    console.error("Error verifying WhatsApp account:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Obtiene el usuario por número de WhatsApp
 */
async function getUserByPhone(phone) {
  try {
    const account = await db.get(
      `SELECT u.* FROM users u
       JOIN whatsapp_accounts wa ON u.id = wa.user_id
       WHERE wa.phone = ? AND wa.verified = 1`,
      [phone]
    );
    return account;
  } catch (error) {
    console.error("Error getting user by phone:", error);
    return null;
  }
}

/**
 * Obtiene todas las cuentas de WhatsApp de un usuario
 */
async function getUserWhatsAppAccounts(userId) {
  try {
    const accounts = await db.all(
      `SELECT * FROM whatsapp_accounts WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    return accounts;
  } catch (error) {
    console.error("Error getting WhatsApp accounts:", error);
    return [];
  }
}

/**
 * Actualiza la última actividad de una cuenta de WhatsApp
 */
async function updateLastActivity(phone) {
  try {
    const now = new Date().toISOString();
    await db.run(
      `UPDATE whatsapp_accounts SET last_activity = ?, updated_at = ? WHERE phone = ?`,
      [now, now, phone]
    );
  } catch (error) {
    console.error("Error updating last activity:", error);
  }
}

/**
 * Obtiene el equipo de un usuario
 */
async function getUserTeam(userId) {
  try {
    const user = await getUserById(userId);
    if (!user) return null;

    // Aquí puedes implementar la lógica para obtener el equipo
    // Por ahora, retornamos null
    return null;
  } catch (error) {
    console.error("Error getting user team:", error);
    return null;
  }
}

module.exports = {
  generateUserId,
  createUser,
  getUserById,
  getUserByUsername,
  linkWhatsAppAccount,
  getWhatsAppAccountByPhone,
  verifyWhatsAppAccount,
  getUserByPhone,
  getUserWhatsAppAccounts,
  updateLastActivity,
  getUserTeam
};
