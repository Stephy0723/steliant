function normalizeDiscordColor(color, fallback = 0x00e676) {
  if (typeof color === 'number' && Number.isInteger(color) && color >= 0 && color <= 0xffffff) {
    return color;
  }

  const raw = String(color || '').trim();
  const hex = raw.match(/^#?([0-9a-f]{6})$/i)?.[1];
  if (!hex) return fallback;

  const parsed = parseInt(hex, 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = { normalizeDiscordColor };
