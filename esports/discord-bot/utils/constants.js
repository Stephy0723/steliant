// ============================================
// GlitchGang Bot - Constants & Configuration
// ============================================

const COLORS = {
  PRIMARY: 0xff4d2e,
  SUCCESS: 0x20c997,
  ERROR: 0xff4d6d,
  WARNING: 0xffb020,
  INFO: 0x5865f2,
  MATCH: 0x8b5cf6,
  DARK: 0x111827,
  NEUTRAL: 0x2f3136,
};

const EMOJI = {
  CHECK: '\u2705',
  CROSS: '\u274c',
  WARNING: '\u26a0\ufe0f',
  FIRE: '\ud83d\udd25',
  TROPHY: '\ud83c\udfc6',
  GAMEPAD: '\ud83c\udfae',
  MIC: '\ud83c\udfa4',
  CLOCK: '\u23f0',
  STAR: '\u2b50',
  SHIELD: '\ud83d\udee1\ufe0f',
  CAMERA: '\ud83d\udcf7',
  LINK: '\ud83d\udd17',
  CROWN: '\ud83d\udc51',
  PERSON: '\ud83d\udc64',
  PEOPLE: '\ud83d\udc65',
  CHART: '\ud83d\udcca',
  ROCKET: '\ud83d\ude80',
  BOLT: '\u26a1',
  GLOBE: '\ud83c\udf10',
};

const MATCH_STATUS = {
  PENDING: 'pending',
  CHECKING_IN: 'checking_in',
  READY: 'ready',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DISQUALIFIED: 'disqualified',
};

const REPORT_RESULT = {
  WIN: 'win',
  LOSE: 'lose',
  DRAW: 'draw',
};

const API_DEFAULTS = {
  PORT: 3001,
  TIMEOUT: 8000,
};

const BOT_CONFIG = {
  BRAND_NAME: 'GlitchGang',
  BRAND_FOOTER: 'GlitchGang Competitive',
  VERSION: '2.0.0',
  BRAND_ICON_URL: process.env.BRAND_ICON_URL || `${process.env.WEBSITE_URL || 'https://glitchgang.net'}/GG/exports/gg-mark-128.png`,
  BRAND_URL: process.env.WEBSITE_URL || 'https://glitchgang.net',
  VOICE_CONNECT_TIMEOUT: 15000,
  CHECKIN_WINDOW_MS: 20 * 60 * 1000,
  CRM_REFRESH_INTERVAL_MS: 15000,
};

module.exports = {
  COLORS,
  EMOJI,
  MATCH_STATUS,
  REPORT_RESULT,
  API_DEFAULTS,
  BOT_CONFIG,
};
