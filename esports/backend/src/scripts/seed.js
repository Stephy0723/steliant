// ════════════════════════════════════════════════════════════
//  Seed de datos de demostración (idempotente).
//  100 jugadores completos + 20 equipos (10 MLBB + otros juegos)
//  + 2 torneos finalizados (uno gratis, uno de pago).
//  Marca todo con seed:true para poder reseedear sin tocar datos reales.
//    node src/scripts/seed.js
// ════════════════════════════════════════════════════════════
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { config } from '../config/index.js'
import { User } from '../models/User.js'
import { Team } from '../models/Team.js'
import { Tournament } from '../models/Tournament.js'
import { createPlayerCodes, createTeamCode, createTournamentCode, createSpecializedRoleCodes } from '../services/codes.service.js'

const pick = (arr, i) => arr[i % arr.length]
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const chance = (p) => Math.random() < p

// Solo RD/MX/AR para códigos de país limpios (01/02/03), según la convención.
const COUNTRIES = ['RD', 'RD', 'RD', 'MX', 'MX', 'AR', 'RD', 'MX', 'AR', 'RD']
const CITY = {
  RD: ['Santo Domingo', 'Santiago', 'La Vega'], MX: ['CDMX', 'Guadalajara', 'Monterrey'],
  AR: ['Buenos Aires', 'Córdoba', 'Rosario'], CO: ['Bogotá', 'Medellín', 'Cali'],
  CL: ['Santiago', 'Valparaíso'], PE: ['Lima', 'Arequipa'], ES: ['Madrid', 'Barcelona'],
  US: ['Miami', 'New York'], VE: ['Caracas', 'Maracaibo'], EC: ['Quito', 'Guayaquil'],
}
const GAMES = ['mlbb', 'val', 'lol', 'cs2', 'apex', 'rl', 'ff']
const GAME_CODE = { mlbb: 'MLBB', val: 'VAL', lol: 'LOL', cs2: 'CS2', apex: 'APEX', rl: 'RL', ff: 'FF' }
const RANKS = ['Hierro', 'Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Mítico', 'Inmortal', 'Radiante']
const PLANS = ['Básico', 'Pro', 'Team', 'Pro Trial', 'Free']
const ROLES_GAME = ['Asalto', 'Soporte', 'Tanque', 'Tirador', 'Mid', 'Jungla', 'IGL', 'Flex']
const GENDERS = ['male', 'female', 'non_binary', 'prefer_not_to_say']
const EXP = ['rookie', 'mid', 'pro']
const PLATFORM = { mlbb: 'mobile', ff: 'mobile' }
const LAST_ACTIVE = ['En línea', 'Hace 1h', 'Hace 3h', 'Hace 1d', 'Hace 5d', 'Hace 21d']
const FIRST = ['Carlos', 'María', 'Luis', 'Ana', 'Jorge', 'Sofía', 'Pedro', 'Karina', 'Diego', 'Valentina', 'Mateo', 'Lucía', 'Andrés', 'Camila', 'Bruno', 'Paula', 'Tomás', 'Renata', 'Gael', 'Isabela', 'Thiago', 'Florencia', 'Sebastián', 'Mariana', 'Daniel', 'Antonia']
const LAST = ['García', 'Méndez', 'Pérez', 'Castillo', 'Vega', 'Ruiz', 'Soto', 'Cruz', 'Herrera', 'León', 'Aguilar', 'Ríos', 'Jiménez', 'Núñez', 'Vargas', 'Rojas', 'Castro', 'Mora', 'Peña', 'Salas']
const NICKP = ['Shadow', 'Volt', 'Nyx', 'Ghost', 'Phantom', 'Iron', 'Cyber', 'Dark', 'Zero', 'Nova', 'Krypto', 'Solaris', 'Riftcat', 'Vexon', 'Echo', 'Luna', 'Hex', 'Storm', 'Night', 'Pixel', 'Titan', 'Byte', 'Omega', 'Frost', 'Raven', 'Neon', 'Glitch']
const NICKS = ['Fox', 'Carry', 'Pro', 'Zone', 'X', 'Core', 'King', 'Ace', 'Wave', 'Strike', 'Blade', 'Byte', 'Wolf', 'Owl', 'Rogue', 'Fall', 'Queen', 'Shift', 'Viper', 'Claw']

const COMM = {
  mlbb: { id: 'COM-MLBBRD-250604-0006', name: 'MLBB Reyes' },
  val: { id: 'COM-BROOKLYN-250112-0001', name: 'Radiant LATAM' },
  lol: { id: 'COM-NYXPRO-250302-0002', name: 'Rift Kings' },
  cs2: { id: 'COM-RAVEN-250823-0003', name: 'Clutch Masters' },
  apex: { id: 'COM-IRON-250418-0004', name: 'Apex Predators' },
  rl: { id: 'COM-GLITCH-250904-0005', name: 'Aerial Demons' },
  ff: { id: 'COM-FFRD-250701-0007', name: 'Booyah RD' },
}
const UNIS = [
  { siglas: 'ITLA', name: 'Instituto Tecnológico de las Américas' },
  { siglas: 'UASD', name: 'Universidad Autónoma de Santo Domingo' },
  { siglas: 'PUCMM', name: 'Pontificia Universidad Católica Madre y Maestra' },
  { siglas: 'INTEC', name: 'Instituto Tecnológico de Santo Domingo' },
]

async function main() {
  await mongoose.connect(config.mongoUri)
  console.log('Conectado. Limpiando seeds previos…')
  await Promise.all([
    User.deleteMany({ $or: [{ seed: true }, { email: /@gg\.seed$/ }] }),
    Team.deleteMany({ $or: [{ seed: true }, { name: { $in: ['RD Gang', 'Mythic Reyes', 'Radiant Core', 'Nova Strike'] } }] }),
    Tournament.deleteMany({ $or: [{ seed: true }, { title: { $in: [
      'MLBB Caribbean Clash 2026', 'Valorant Pro Series RD', 'GG Spring Split', 
      'Challenger Series S1', 'GG Invitational', 'Apex GlitchCup', 'RL Open Season 2', 
      'GG Winter Cup', 'Ranked Rumble S0'
    ] } }] }),
  ])

  const passwordHash = await bcrypt.hash('Seed1234!', 10)

  // ── 100 jugadores ──
  const players = []
  for (let i = 1; i <= 100; i++) {
    const country = pick(COUNTRIES, i)
    const game = i <= 35 ? 'mlbb' : pick(GAMES, i + 1)
    const firstName = rand(FIRST)
    const lastName = `${rand(LAST)} ${rand(LAST)}`
    const nick = `${rand(NICKP)}${rand(NICKS)}${i}`
    const birthDate = new Date(randInt(1998, 2007), randInt(0, 11), randInt(1, 27))
    const level = randInt(1, 60)
    const plan = pick(PLANS, i + 2)
    const verified = chance(0.55)
    const status = chance(0.85) ? 'activo' : (chance(0.5) ? 'inactivo' : 'ban')
    const communities = [COMM[game]]
    if ((plan === 'Pro' || plan === 'Team') && game !== 'val') communities.push(COMM.val)
    let university = null
    if (i % 5 < 2) {
      const u = pick(UNIS, i)
      const tail = String(1000 + i).slice(-4)
      university = { siglas: u.siglas, name: u.name, matricula: `2023-${tail}`, id: `${u.siglas}-${tail}-${String(i).padStart(4, '0')}`, internalId: `${u.siglas}-${tail}-070625-${String(i).padStart(4, '0')}` }
    }
    const { publicCode, internalCode } = await createPlayerCodes(country, firstName, birthDate, lastName)
    players.push({
      seed: true,
      playerCode: publicCode, internalCode,
      nick, email: `${nick.toLowerCase()}@gg.seed`, passwordHash,
      firstName, lastName, countryCode: country === 'DO' ? 'RD' : country,
      city: rand(CITY[country] || ['Capital']), province: rand(CITY[country] || ['—']),
      phoneCountryDial: '+1', phoneNumber: `829${randInt(1000000, 9999999)}`,
      birthDate, gender: rand(GENDERS),
      games: [game], experienceLevel: rand(EXP),
      mainPlatform: PLATFORM[game] || 'pc', lookingFor: ['tournaments'],
      acceptedTermsAt: new Date(),
      role: 'player', roles: ['player'], plan,
      avatar: `https://i.pravatar.cc/120?img=${(i % 70) + 1}`,
      level, rank: RANKS[Math.min(RANKS.length - 1, Math.floor(level / 7))],
      matches: randInt(40, 820), winrate: randInt(42, 74), earnings: chance(0.5) ? randInt(0, 5200) : 0,
      verified, status, lastActive: rand(LAST_ACTIVE),
      communities, university,
      social: {
        discord: `${nick.toLowerCase()}#${randInt(1000, 9999)}`,
        instagram: `instagram.com/${nick.toLowerCase()}`,
        facebook: `facebook.com/${nick.toLowerCase()}`,
        tiktok: `tiktok.com/@${nick.toLowerCase()}`,
        twitch: chance(0.5) ? `twitch.tv/${nick.toLowerCase()}` : '',
        youtube: chance(0.4) ? `youtube.com/@${nick.toLowerCase()}` : '',
        twitter: `x.com/${nick.toLowerCase()}`,
        kick: chance(0.3) ? `kick.com/${nick.toLowerCase()}` : '',
        web: chance(0.25) ? `${nick.toLowerCase()}.gg` : '',
      },
    })
  }
  const orgCodes = await createSpecializedRoleCodes('organizer', 'RD')
  const creCodes = await createSpecializedRoleCodes('creator', 'RD')
  const casCodes = await createSpecializedRoleCodes('caster', 'RD')

  if (players.length > 2) {
    players[0].role = 'organizer'
    players[0].roles = ['player', 'organizer']
    players[0].roleProfiles = {
      organizer: {
        organizerCode: orgCodes.publicCode,
        organizerInternalCode: orgCodes.internalCode,
        approvedAt: orgCodes.approvedAt
      }
    }

    players[1].role = 'creator'
    players[1].roles = ['player', 'creator']
    players[1].roleProfiles = {
      creator: {
        creatorCode: creCodes.publicCode,
        creatorInternalCode: creCodes.internalCode,
        approvedAt: creCodes.approvedAt
      }
    }

    players[2].role = 'caster'
    players[2].roles = ['player', 'caster']
    players[2].roleProfiles = {
      caster: {
        casterCode: casCodes.publicCode,
        casterInternalCode: casCodes.internalCode,
        approvedAt: casCodes.approvedAt
      }
    }
  }

  const createdUsers = await User.insertMany(players)
  console.log(`✓ ${createdUsers.length} jugadores`)

  // ── 4 equipos COMPLETOS (rosters reales, staff, slots, datos fiscales) ──
  const TEAMS_DEF = [
    { name: 'RD Gang', tag: 'RDG', game: 'mlbb', region: 'LATAM Norte', category: 'Profesional', level: 'Élite', lang: 'Español', gender: 'Mixto', community: 'MLBB Reyes', sponsor: 'Federacion Dominicana de Videojuegos', color: '#00E676' },
    { name: 'Mythic Reyes', tag: 'MYT', game: 'mlbb', region: 'Caribe', category: 'Semi-pro', level: 'Avanzado', lang: 'Español', gender: 'Masculino', community: 'MLBB Reyes', sponsor: 'Federacion Dominicana de Videojuegos', color: '#FF4655' },
    { name: 'Radiant Core', tag: 'RDC', game: 'val', region: 'LATAM', category: 'Profesional', level: 'Élite', lang: 'Español', gender: 'Mixto', community: 'Radiant LATAM', sponsor: 'NPC Latino', color: '#C89B3C' },
    {
      name: 'Nova Strike', tag: 'NVA', game: 'val', region: 'LATAM Sur',
      category: 'Amateur', level: 'Intermedio', lang: 'Español', gender: 'Femenino',
      community: 'Radiant LATAM', sponsor: 'Monster', color: '#0082CA',
      university: {
        isUniversityTeam: true,
        universityId: 'ITLA-0614-0004',
        universityTag: 'ITLA',
        universityName: 'Instituto Tecnológico de las Américas',
        region: 'Santo Domingo'
      }
    },
  ]
  const fakeCedula = () => `${String(randInt(1, 402)).padStart(3, '0')}-${String(randInt(1000000, 9999999))}-${randInt(0, 9)}`
  const teamDocs = []
  const memberUpdates = []
  let cursor = 0
  for (let i = 0; i < TEAMS_DEF.length; i++) {
    const d = TEAMS_DEF[i]
    const squad = createdUsers.slice(cursor, cursor + 7); cursor += 7
    const { publicCode, internalCode } = await createTeamCode('RD')
    const slot = (u, k) => ({
      fullName: `${u.firstName} ${u.lastName}`, nick: u.nick, gameId: `${u.nick}#${GAME_CODE[d.game]}`,
      cedula: fakeCedula(), discordName: u.social?.discord || '', discordId: String(randInt(100000000000000000, 999999999999999999)),
      role: ROLES_GAME[k % ROLES_GAME.length], id: u.playerCode,
    })
    const rosterSlots = {}
    squad.slice(0, 5).forEach((u, k) => { rosterSlots[`titular-${k + 1}`] = slot(u, k) })
    squad.slice(5, 7).forEach((u, k) => { rosterSlots[`sub-${k + 1}`] = slot(u, k + 5) })
    const cap = squad[0]
    teamDocs.push({
      seed: true, publicCode, internalCode,
      name: d.name, tag: d.tag, color: d.color, game: d.game, logo: '',
      region: d.region, category: d.category, level: d.level, lang: d.lang, gender: d.gender, community: d.community, sponsor: d.sponsor,
      slogan: 'Por la gloria de Glitch Gang',
      leader: cap._id, members: squad.map(u => u._id),
      wins: randInt(8, 42), losses: randInt(2, 18), rankPts: randInt(900, 2400), rank: i + 1, titles: randInt(0, 5),
      captainProfile: { name: `${cap.firstName} ${cap.lastName}`, nick: cap.nick },
      rosterSlots,
      roster: squad.map((u, k) => ({ nick: u.nick, id: u.playerCode, role: ROLES_GAME[k % ROLES_GAME.length] })),
      social: { instagram: `instagram.com/${d.tag.toLowerCase()}`, x: `x.com/${d.tag.toLowerCase()}`, web: `${d.tag.toLowerCase()}.gg` },
      teamInviteCode: `SEED-${d.tag}-${i + 1}`,
      university: d.university || { isUniversityTeam: false, universityId: '', universityTag: '', universityName: '', region: '' },
      status: 'Activo',
    })
  }
  const createdTeams = await Team.insertMany(teamDocs)
  console.log(`✓ ${createdTeams.length} equipos completos`)

  createdTeams.forEach((t, i) => {
    teamDocs[i].members.forEach(mid => memberUpdates.push({ updateOne: { filter: { _id: mid }, update: { $set: { team: t._id } } } }))
  })
  if (memberUpdates.length) await User.bulkWrite(memberUpdates)

  // ── 2 torneos finalizados COMPLETOS (8 equipos, bracket, reportes…) ──
  const org = createdUsers[0]?._id
  const OPP = ['Lunar Wolves', 'Solar Flare', 'Iron Phoenix', 'Shadow Pact', 'Volt Dynasty', 'Storm Riders', 'Cyber Legion', 'Apex Vipers']
  const tagOf = (n) => n.split(' ').map(w => w[0]).join('').toUpperCase()
  // Construye un detalle completo de torneo con 8 equipos y bracket de eliminación.
  function makeDetail(realTeams) {
    const base = realTeams.map(t => ({ name: t.name, tag: t.tag, id: t.publicCode }))
    const extra = OPP.slice(0, 8 - base.length).map((n, i) => ({ name: n, tag: tagOf(n), id: `TEAM-${String(101 + i)}-01` }))
    const parts = [...base, ...extra].slice(0, 8).map((p, i) => ({ ...p, seed: i + 1, record: `${randInt(2, 6)}-${randInt(0, 3)}` }))
    const match = (a, b, bo) => { const win = bo, lose = randInt(0, bo - 1); const aWins = chance(0.5); return { teamA: a, teamB: b, scoreA: aWins ? win : lose, scoreB: aWins ? lose : win, winner: aWins ? a : b } }
    const q = [[0, 7], [3, 4], [2, 5], [1, 6]].map(([a, b]) => match(parts[a].name, parts[b].name, 2))
    const sf = [match(q[0].winner, q[1].winner, 3), match(q[2].winner, q[3].winner, 3)]
    const fin = (() => { const m = match(sf[0].winner, sf[1].winner, 3); return m })()
    const bracket = [{ name: 'Cuartos de final', matches: q }, { name: 'Semifinales', matches: sf }, { name: 'Final', matches: [fin] }]
    const champion = fin.winner, runner = fin.winner === fin.teamA ? fin.teamB : fin.teamA
    parts.forEach(p => { p.placement = p.name === champion ? '1º (Campeón)' : p.name === runner ? '2º' : sf.some(m => m.teamA === p.name || m.teamB === p.name) ? '3º-4º' : '5º-8º' })
    const reports = [
      { type: 'Protesta', team: parts[3].name, detail: 'Reclamo por jugador no registrado en roster', status: 'Resuelto' },
      { type: 'Sancion', team: parts[5].name, detail: 'Retraso de 12 min en check-in de cuartos', status: 'Advertencia' },
      { type: 'No-show', team: parts[7].name, detail: 'No se presentó a la ronda de consolación', status: 'Descalificado' },
    ]
    return { participants: parts, bracket, reports, champion, checkin: { aTiempo: 6, tarde: 1, noShow: 1 } }
  }
  const DEF_TOURNAMENTS = [
    {
      title: 'GG Spring Split',
      game: 'val',
      gameCode: 'VAL',
      status: 'live',
      prizePool: 5000,
      date: new Date('2026-06-10T18:00:00Z'),
      maxSlots: 16,
      currentSlots: 14,
      entryFee: 0,
      description: 'El torneo de primavera de Valorant más importante de la comunidad.',
      platform: 'pc',
      modality: '5v5',
    },
    {
      title: 'Challenger Series S1',
      game: 'lol',
      gameCode: 'LOL',
      status: 'live',
      prizePool: 2500,
      date: new Date('2026-06-10T20:00:00Z'),
      maxSlots: 8,
      currentSlots: 8,
      entryFee: 0,
      description: 'Competencia oficial de League of Legends para equipos de la grieta.',
      platform: 'pc',
      modality: '5v5',
    },
    {
      title: 'GG Invitational',
      game: 'cs2',
      gameCode: 'CS2',
      status: 'upcoming',
      prizePool: 10000,
      date: new Date('2026-06-05T18:00:00Z'),
      maxSlots: 32,
      currentSlots: 24,
      entryFee: 10,
      description: 'Gran torneo invitacional de Counter-Strike 2 con $10,000 en premios.',
      platform: 'pc',
      modality: '5v5',
    },
    {
      title: 'Apex GlitchCup',
      game: 'apex',
      gameCode: 'APEX',
      status: 'upcoming',
      prizePool: 1200,
      date: new Date('2026-06-07T20:00:00Z'),
      maxSlots: 20,
      currentSlots: 11,
      entryFee: 5,
      description: 'Torneo abierto de Apex Legends. Dúos y tríos compitiendo en Fin del Mundo.',
      platform: 'pc',
      modality: '3v3',
    },
    {
      title: 'RL Open Season 2',
      game: 'rl',
      gameCode: 'RL',
      status: 'upcoming',
      prizePool: 800,
      date: new Date('2026-06-10T17:00:00Z'),
      maxSlots: 16,
      currentSlots: 3,
      entryFee: 0,
      description: 'Torneo de Rocket League 3v3 abierto para toda la región LATAM.',
      platform: 'pc',
      modality: '3v3',
    },
    {
      title: 'GG Winter Cup',
      game: 'val',
      gameCode: 'VAL',
      status: 'finished',
      prizePool: 3000,
      date: new Date('2026-05-12T18:00:00Z'),
      maxSlots: 16,
      currentSlots: 16,
      entryFee: 0,
      description: 'El torneo de invierno para cerrar la temporada anterior con broche de oro.',
      platform: 'pc',
      modality: '5v5',
    },
    {
      title: 'Ranked Rumble S0',
      game: 'lol',
      gameCode: 'LOL',
      status: 'finished',
      prizePool: 1500,
      date: new Date('2026-04-03T19:00:00Z'),
      maxSlots: 8,
      currentSlots: 8,
      entryFee: 0,
      description: 'Temporada cero del torneo relámpago de League of Legends.',
      platform: 'pc',
      modality: '5v5',
    },
    {
      title: 'MLBB Caribbean Clash 2026',
      game: 'mlbb',
      gameCode: 'MLBB',
      status: 'upcoming',
      prizePool: 250000,
      date: new Date('2026-06-05T19:00:00Z'),
      maxSlots: 32,
      currentSlots: 8,
      entryFee: 15,
      description: 'Torneo de Mobile Legends: Bang Bang con la participación de los mejores equipos del Caribe.',
      platform: 'mobile',
      modality: '5v5',
    }
  ]

  const docs = []
  for (let i = 0; i < DEF_TOURNAMENTS.length; i++) {
    const dt = DEF_TOURNAMENTS[i]
    const gameTeams = createdTeams.filter(t => t.game === dt.game)
    const detail = makeDetail(gameTeams)
    const code = await createTournamentCode('RD', dt.gameCode, orgCodes.publicCode, org)
    
    docs.push({
      seed: true,
      title: dt.title,
      publicId: code.publicId,
      tournamentCode: code.tournamentCode,
      gameCode: dt.gameCode,
      organizerCode: orgCodes.publicCode,
      countryCode: 'DO',
      game: dt.game,
      format: dt.status === 'finished' ? 'single_elimination' : 'double_elimination',
      status: dt.status === 'live' ? 'ongoing' : dt.status === 'upcoming' ? 'open' : dt.status,
      region: 'LATAM',
      date: dt.date,
      registrationWindow: {
        start: new Date(dt.date.getTime() - 15 * 24 * 60 * 60 * 1000),
        end:   new Date(dt.date.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      maxSlots: dt.maxSlots,
      currentSlots: dt.currentSlots,
      entryFee: dt.entryFee,
      prizePool: dt.prizePool,
      description: dt.description,
      platform: dt.platform,
      modality: dt.modality,
      winner: dt.status === 'finished' ? detail.champion : '',
      organizer: org,
      participants: detail.participants.slice(0, dt.currentSlots),
      bracket: dt.status === 'finished' ? detail.bracket : [],
      reports: dt.status === 'finished' ? detail.reports : [],
      checkin: detail.checkin,
      staff: {
        director: 'Stephanie López',
        admin: dt.game === 'val' ? 'DarkAce' : 'Brooklyn',
        arbitros: ['Diego Soto', 'Ana Castro', 'Luis Pérez']
      },
      collaborators: ['Comunidad Esports RD', 'Caribe Esports'],
      sponsors: ['Federacion Dominicana de Videojuegos', 'NPC Latino'],
      evidences: dt.status === 'finished' ? ['acta-final.pdf', 'bracket.png'] : [],
      rules: 'Check-in obligatorio 30 minutos antes del inicio en Discord.\nProhibido el uso de software de terceros o asistencia externa.\nReporte de resultados en la plataforma en un máximo de 10 min.'
    })
  }

  await Tournament.insertMany(docs)
  console.log(`✓ ${docs.length} torneos completos sembrados en base de datos`)

  const totalUsers = await User.countDocuments()
  console.log(`\nListo. Total usuarios en DB: ${totalUsers} (100 seed + reales).`)
  await mongoose.disconnect()
}

main().catch(async (e) => { console.error('Seed error:', e); try { await mongoose.disconnect() } catch { /* noop */ } process.exit(1) })
