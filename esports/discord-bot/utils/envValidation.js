function normalizeBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  return normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
}

function decodeDiscordTokenSubjectId(token) {
  const firstPart = String(token || '').trim().split('.')[0];
  if (!firstPart) return '';

  try {
    const decoded = Buffer.from(normalizeBase64Url(firstPart), 'base64').toString('utf8');
    return /^\d{15,25}$/.test(decoded) ? decoded : '';
  } catch {
    return '';
  }
}

function assertEnvValueIsPlain(name, value) {
  const raw = String(value || '').trim();
  if (!raw) return;

  if (/[<>\[\]\(\)]/.test(raw)) {
    throw new Error(
      `${name} parece tener formato pegado desde Markdown o caracteres extra. ` +
        'Usa solo el valor real, sin corchetes, parentesis, < > ni enlaces formateados.'
    );
  }
}

function assertDiscordTokenMatchesClientId({ token, clientId, tokenName = 'TOKEN', clientIdName = 'CLIENT_ID' }) {
  assertEnvValueIsPlain(tokenName, token);
  assertEnvValueIsPlain(clientIdName, clientId);

  const decodedId = decodeDiscordTokenSubjectId(token);
  const expectedId = String(clientId || '').trim();

  if (!decodedId) {
    throw new Error(`${tokenName} no parece ser un token de bot Discord valido o esta incompleto.`);
  }

  if (expectedId && decodedId !== expectedId) {
    throw new Error(
      `${tokenName} pertenece a la aplicacion ${decodedId}, pero ${clientIdName} es ${expectedId}. ` +
        'Regenera o copia el token del mismo bot configurado en CLIENT_ID.'
    );
  }

  return decodedId;
}

function parseCsvEnv(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

module.exports = {
  assertDiscordTokenMatchesClientId,
  assertEnvValueIsPlain,
  decodeDiscordTokenSubjectId,
  parseCsvEnv,
};
