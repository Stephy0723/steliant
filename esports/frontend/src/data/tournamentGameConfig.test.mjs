import test from 'node:test'
import assert from 'node:assert/strict'
import { GAMES } from './games.js'
import { TOURNAMENT_GAME_CONFIG, defaultGameBanner, gameConfig, gameSelection, suggestedPatch, mapNames, changeMapMode } from './tournamentGameConfig.mjs'
import { initialTournamentForm, nextSeason, tournamentPayload, validateSetupStep } from '../../../shared/tournamentSetup.mjs'
import { GAME_CATALOG, gameIdFromName, modalitiesFor, isMobaGame } from '../../../shared/games.mjs'

const now = Date.parse('2026-09-08T12:00:00Z')

test('the shared catalog is the single source for games.js and every name resolves to its id', () => {
  assert.equal(GAMES.length, GAME_CATALOG.length)
  for (const [id, name] of GAME_CATALOG) {
    assert.equal(gameIdFromName(name), id, name)
    assert.ok(GAMES.some(game => game.id === id))
  }
  assert.equal(gameIdFromName('CS2'), 'counter-strike-2')
  assert.equal(gameIdFromName('desconocido'), '')
})

test('MOBA games expose a fixed modality list; other games fall back to the generic one', () => {
  for (const [id, , categoryId] of GAME_CATALOG) {
    const list = modalitiesFor(id)
    assert.ok(Array.isArray(list) && list.length)
    if (categoryId === 'moba') assert.ok(isMobaGame(id) && list.includes('5v5'))
  }
})
test('every preset uses an existing game ID and has unique maps and server values', () => {
  for (const [id, config] of Object.entries(TOURNAMENT_GAME_CONFIG)) {
    assert.ok(GAMES.some(game => game.id === id), id)
    assert.equal(new Set(config.maps).size, config.maps.length)
    assert.equal(new Set(config.servers.map(server => server.value)).size, config.servers.length)
    if (config.patch) assert.ok(config.patch.source.startsWith('https://'))
  }
})
test('changing games resets dependent selections, not the rest of the draft', () => {
  const form = { ...initialTournamentForm(), title: 'Copa', server: 'LA1', patch: 'old', mapPool: 'Old map', mapMode: 'veto', allowedCountries: ['RD'] }
  const result = gameSelection(form, GAMES.find(game => game.id === 'league-of-legends-wild-rift'), now)
  assert.equal(result.patch, '7.2d')
  assert.equal(result.platform, 'mobile')
  assert.equal(result.modality, '5v5')
  assert.equal(result.server, '')
  assert.equal(result.mapPool, '')
  assert.equal(result.mapMode, 'fixed')
  assert.equal(result.title, 'Copa')
  assert.deepEqual(result.allowedCountries, ['RD'])
  assert.equal(form.patch, 'old')
})
test('unknown games and unverified patches stay blank and editable', () => {
  assert.equal(gameSelection(initialTournamentForm(), { id: 'new-game', name: 'Nuevo' }, now).patch, '')
  assert.equal(gameSelection(initialTournamentForm(), { id: 'honor-of-kings', name: 'HoK' }, now).patch, '')
  assert.deepEqual(gameConfig('new-game').maps, [])
  const reset = gameSelection({ server: 'LA1', patch: 'old', mapPool: 'old' }, null, now)
  assert.equal(reset.game, '')
  assert.equal(reset.patch, '')
  assert.equal(reset.server, '')
})
test('dated patch references expire for new selections without rewriting saved data', () => {
  const config = gameConfig('valorant')
  assert.equal(suggestedPatch(config, now), '13.05')
  assert.equal(suggestedPatch(config, Date.parse('2027-01-01')), '')
  assert.equal(suggestedPatch(config, Date.parse('2025-01-01')), '')
})
test('declared mobile regions never map numeric Zone IDs to countries', () => {
  for (const id of ['mobile-legends-bang-bang', 'honor-of-kings']) {
    const config = gameConfig(id)
    assert.equal(config.declaredRegions, true)
    assert.ok(config.servers.every(server => server.value.endsWith('(region declarada)')))
  }
})
test('random and veto preserve named maps, fixed requires choosing one again', () => {
  const form = { mapPool: 'Ascent, Bind', mapMode: 'random' }
  assert.equal(changeMapMode(form, 'veto').mapPool, 'Ascent, Bind')
  assert.equal(changeMapMode(form, 'fixed').mapPool, '')
  assert.equal(changeMapMode({ mapPool: 'Ascent' }, 'fixed').mapPool, 'Ascent')
  assert.deepEqual(mapNames('Ascent, ascent, , Bind'), ['Ascent', 'Bind'])
})
test('technical validation applies to both the browser and API', () => {
  const form = { ...initialTournamentForm(), server: 'Sala privada', modality: '5v5', mapPool: 'Ascent' }
  assert.deepEqual(validateSetupStep(form, 1), {})
  assert.ok(validateSetupStep({ ...form, mapPool: 'Ascent, Bind' }, 1).mapPool)
  assert.ok(validateSetupStep({ ...form, mapPool: ', ,', mapMode: 'veto' }, 1).mapPool)
  assert.ok(validateSetupStep({ ...form, mapPool: 'a'.repeat(1501) }, 1).mapPool)
  assert.ok(validateSetupStep({ ...form, mapMode: 'unknown' }, 1).mapMode)
})
test('custom technical values survive publication and season reuse', () => {
  const form = { ...initialTournamentForm(), game: 'Valorant', patch: 'Version del organizador', server: 'Sala privada Caribe', mapMode: 'veto', mapPool: 'Mapa personalizado, Ascent' }
  const payload = tournamentPayload(form)
  const season = nextSeason({ ...payload, _id: 'source', title: 'Copa' })
  for (const key of ['patch', 'server', 'mapMode', 'mapPool']) {
    assert.equal(payload[key], form[key])
    assert.equal(season[key], form[key])
  }
})

test('the game image is a saved, valid default banner without uploading a file', () => {
  const game = GAMES.find(game => game.id === 'mobile-legends-bang-bang')
  const form = gameSelection({ ...initialTournamentForm(), title: 'Copa', categoryId: 'moba', description: 'Copa mobile' }, game, now)
  assert.ok(form.banner)
  assert.equal(form.banner, defaultGameBanner(game))
  assert.equal(form.bannerName, '')
  assert.equal(validateSetupStep(form, 0).banner, undefined)
  assert.equal(tournamentPayload(form).banner, form.banner)
})

test('changing game replaces its default image but preserves a custom upload', () => {
  const first = GAMES.find(game => game.id === 'valorant')
  const second = GAMES.find(game => game.id === 'mobile-legends-bang-bang')
  const form = gameSelection(initialTournamentForm(), first, now)
  assert.equal(gameSelection(form, second, now, first).banner, defaultGameBanner(second))
  const custom = { ...form, banner: '/uploads/my-banner.webp', bannerName: 'my-banner.webp' }
  assert.equal(gameSelection(custom, second, now, first).banner, custom.banner)
  assert.equal(gameSelection(form, null, now, first).banner, '')
})

