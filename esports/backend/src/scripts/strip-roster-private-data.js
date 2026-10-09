import 'dotenv/config'
import mongoose from 'mongoose'
import { config } from '../config/index.js'
import { Team } from '../models/Team.js'
import { User } from '../models/User.js'

// El asistente de crear equipo pedia la cedula y el WhatsApp de cada jugador y
// los guardaba en Team.rosterSlots, que sale en la pagina publica del equipo.
//   1. Borra cedula / whatsapp / phone / birthDate de todos los puestos.
//   2. Lista (sin tocar) los puestos de jugador/staff ocupados por alguien que
//      no es cuenta miembro (nick escrito a mano): no pueden jugar torneos y
//      el lider deberia invitarlos. Desde el 7/oct ya no se pueden crear.
//   3. Puestos con la cuenta de un miembro pero cuyo nick e ID de juego no son
//      de esa cuenta: los dejaba la vieja regla "titular-1 es siempre el lider"
//      (un nick inventado quedaba con el userId y el Discord del lider, y la
//      inscripcion a torneos lo guardaba). Con --apply se desvinculan (quedan
//      como texto, sin cuenta) para que no jueguen torneos con la cuenta ajena.
//
//   node src/scripts/strip-roster-private-data.js            (dry-run, no escribe)
//   node src/scripts/strip-roster-private-data.js --apply    (aplica)
//
// Idempotente. Antes de --apply: mongodump --uri "$MONGO_URI" --collection teams --out ./backups/pre-roster-pii-$(date +%F)

const APPLY = process.argv.includes('--apply')
const PRIVATE_FIELDS = ['cedula', 'whatsapp', 'phone', 'birthDate']
const isSponsor = key => /^(patrocinador|sponsor)/i.test(key)

async function main() {
  await mongoose.connect(config.mongoUri)
  const teams = await Team.find({ rosterSlots: { $ne: null } }).select('name leader members rosterSlots').lean()

  const linkedIds = new Set()
  for (const team of teams) for (const slot of Object.values(team.rosterSlots || {})) if (slot?.userId) linkedIds.add(String(slot.userId))
  const accounts = new Map((await User.find({ _id: { $in: [...linkedIds].filter(id => mongoose.isValidObjectId(id)) } })
    .select('nick playerCode email gamerProfile.gameId').lean()).map(u => [String(u._id), u]))
  const norm = value => String(value || '').trim().toLowerCase()

  const toClean = []
  const textOnly = []
  const mislinked = []
  for (const team of teams) {
    const slots = team.rosterSlots && typeof team.rosterSlots === 'object' ? team.rosterSlots : {}
    const members = new Set([String(team.leader || ''), ...(team.members || []).map(String)])
    const unset = {}
    for (const [key, slot] of Object.entries(slots)) {
      if (!slot || typeof slot !== 'object') continue
      for (const field of PRIVATE_FIELDS) {
        if (slot[field] !== undefined && slot[field] !== '') unset[`rosterSlots.${key}.${field}`] = ''
      }
      const occupied = slot.nick || slot.name || slot.gameId
      if (occupied && !isSponsor(key) && !members.has(String(slot.userId || ''))) textOnly.push({ team: team.name, key, nick: slot.nick || slot.name || slot.gameId })
      // Vinculado a una cuenta, pero ni el nick ni el ID de juego son de ella.
      const account = accounts.get(String(slot.userId || ''))
      if (account && slot.nick) {
        const own = [account.nick, account.playerCode, account.email, account.gamerProfile?.gameId].map(norm).filter(Boolean)
        if (!own.includes(norm(slot.nick)) && !own.includes(norm(slot.gameId))) {
          mislinked.push({ team, key, nick: slot.nick, account: account.nick })
          for (const field of ['userId', 'playerCode', 'discordId', 'discordName', 'roleVerified']) unset[`rosterSlots.${key}.${field}`] = ''
        }
      }
    }
    if (Object.keys(unset).length) toClean.push({ team, unset })
  }

  console.log(`Equipos revisados: ${teams.length}`)
  console.log(`  Con datos personales o vinculos a corregir: ${toClean.length}`)
  for (const { team, unset } of toClean) console.log(`    - ${team.name}: ${Object.keys(unset).length} campo(s)`)
  console.log(`Puestos con la cuenta de OTRA persona (se desvinculan con --apply): ${mislinked.length}`)
  for (const row of mislinked) console.log(`    - ${row.team.name} · ${row.key}: "${row.nick}" estaba con la cuenta de ${row.account}`)
  console.log(`Puestos con nick escrito a mano, sin cuenta miembro (solo informativo): ${textOnly.length}`)
  for (const row of textOnly) console.log(`    - ${row.team} · ${row.key}: ${row.nick}`)

  if (!APPLY) {
    console.log('\nDry-run: no se escribio nada. Corre con --apply para aplicar.')
    return
  }
  for (const { team, unset } of toClean) await Team.updateOne({ _id: team._id }, { $unset: unset })
  console.log(`\nListo: ${toClean.length} equipo(s) corregidos.`)
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => mongoose.disconnect())
