// ════════════════════════════════════════════════════════════
//  MOLDE oficial de las comunidades GlitchGang.
//  Sigue el mismo formato del formulario "Crear comunidad" para
//  que un tercero vea un ejemplo congruente de dónde va cada cosa.
//  Admin = GlitchGang. Datos de desarrolladora = reales.
// ════════════════════════════════════════════════════════════

// Política y equipo compartidos (las reglas de la casa son las mismas en todas)
const HOUSE = {
  region: 'LATAM · Caribe · Global',
  lang: 'Bilingüe (ES / EN)',
  audience: 'Mixto',
  whoPublishes: 'Solo staff',
  allowed: 'Clips y highlights, guías y estrategias, búsqueda de equipo (LFT), scrims, anuncios oficiales y resultados de torneos.',
  notAllowed: 'Spam o autopromoción sin permiso, links sospechosos, drama personal, reventa de cuentas y discusiones fuera de tema.',
  banned: 'Piratería, cheats/hacks, contenido NSFW explícito, acoso, lenguaje de odio y filtración de datos personales.',
  rules: [
    'Respeta a todos los miembros y al staff. Cero tolerancia al acoso.',
    'Nada de cheats, hacks, piratería ni venta/reventa de cuentas.',
    'Publica cada cosa en su categoría correcta (clip, guía, LFT, torneo…).',
    'Prohibido el spam, la autopromoción sin permiso y los links sospechosos.',
    'El idioma principal es español; el inglés es bienvenido.',
    'Las decisiones del staff son finales. Apela por privado, no en público.',
  ],
  team: [
    { role: 'Admin', username: 'GlitchGang_Admin' },
    { role: 'Admin', username: 'Steliant_Admin' },
    { role: 'Moderador', username: 'Brooklyn' },
    { role: 'Community Manager', username: 'Vexon' },
  ],
}

// Datos REALES de cada desarrolladora/publisher + ID oficial de la comunidad GG
const DEVS = {
  valorant: {
    officialId: 'COM-STELIANT ESPORTS-240101-0001',
    developer: { name: 'Riot Games', founded: '2020', country: 'EE. UU.',
      socials: { website: 'https://playvalorant.com', twitter: 'https://x.com/PlayVALORANT', instagram: 'https://instagram.com/valorant', youtube: 'https://youtube.com/@VALORANT', twitch: 'https://twitch.tv/valorant' } },
  },
  lol: {
    officialId: 'COM-STELIANT ESPORTS-240101-0002',
    developer: { name: 'Riot Games', founded: '2009', country: 'EE. UU.',
      socials: { website: 'https://leagueoflegends.com', twitter: 'https://x.com/LeagueOfLegends', instagram: 'https://instagram.com/leagueoflegends', youtube: 'https://youtube.com/@leagueoflegends' } },
  },
  cs2: {
    officialId: 'COM-STELIANT ESPORTS-240101-0003',
    developer: { name: 'Valve', founded: '2023', country: 'EE. UU.',
      socials: { website: 'https://counter-strike.net', twitter: 'https://x.com/CounterStrike', youtube: 'https://youtube.com/@CounterStrike' } },
  },
  mlbb: {
    officialId: 'COM-STELIANT ESPORTS-240101-0004',
    developer: { name: 'Moonton', founded: '2016', country: 'China',
      socials: { website: 'https://mobilelegends.com', twitter: 'https://x.com/MobileLegendsOL', instagram: 'https://instagram.com/mobilelegendsgame', youtube: 'https://youtube.com/@MobileLegendsBangBangOfficial' } },
  },
  freefire: {
    officialId: 'COM-STELIANT ESPORTS-240101-0005',
    developer: { name: 'Garena', founded: '2017', country: 'Singapur',
      socials: { website: 'https://ff.garena.com', instagram: 'https://instagram.com/freefire', youtube: 'https://youtube.com/@garenafreefire' } },
  },
  apex: {
    officialId: 'COM-STELIANT ESPORTS-240101-0006',
    developer: { name: 'Respawn / Electronic Arts', founded: '2019', country: 'EE. UU.',
      socials: { website: 'https://ea.com/games/apex-legends', twitter: 'https://x.com/PlayApex', instagram: 'https://instagram.com/playapex', youtube: 'https://youtube.com/@PlayApex' } },
  },
  rocketleague: {
    officialId: 'COM-STELIANT ESPORTS-240101-0007',
    developer: { name: 'Psyonix / Epic Games', founded: '2015', country: 'EE. UU.',
      socials: { website: 'https://rocketleague.com', twitter: 'https://x.com/RocketLeague', instagram: 'https://instagram.com/rocketleague', youtube: 'https://youtube.com/@RocketLeague' } },
  },
  dota2: {
    officialId: 'COM-STELIANT ESPORTS-240101-0008',
    developer: { name: 'Valve', founded: '2013', country: 'EE. UU.',
      socials: { website: 'https://dota2.com', twitter: 'https://x.com/DOTA2', youtube: 'https://youtube.com/@dota2' } },
  },
}

export function getCommunityMold(slug) {
  const dev = DEVS[slug]
  if (!dev) return null
  return { ...HOUSE, ...dev }
}

export const SOCIAL_META = {
  website:   { label: 'Sitio web',  icon: 'globe' },
  twitter:   { label: 'X / Twitter',icon: 'globe' },
  instagram: { label: 'Instagram',  icon: 'instagram' },
  youtube:   { label: 'YouTube',    icon: 'youtube' },
  twitch:    { label: 'Twitch',     icon: 'twitch' },
  discord:   { label: 'Discord',    icon: 'discord' },
  tiktok:    { label: 'TikTok',     icon: 'tiktok' },
}

