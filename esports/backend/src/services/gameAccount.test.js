import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMlbbIds, mlbbRankName, sendMlbbCode, verifyMlbbCode, sameProvider } from './gameAccount.service.js'

const json = (status, body) => ({ status, json: async () => body })
// Simula el servicio: responde segun la ruta y guarda lo que se pidio.
function fakeApi(routes) {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    const path = new URL(url).pathname.replace(/^\/api/, '')
    calls.push({ url, path, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null, auth: init.headers?.Authorization || '' })
    const route = routes[path]
    if (!route) throw new Error(`ruta no simulada ${path}`)
    return typeof route === 'function' ? route(calls.at(-1)) : route
  }
  return { fetchImpl, calls }
}

test('ID y servidor: solo digitos, acepta el servidor entre parentesis', () => {
  assert.deepEqual(parseMlbbIds(' 123456789 ', '(2045)'), { roleId: '123456789', zoneId: '2045' })
  assert.throws(() => parseMlbbIds('abc', '2045'), e => e.payload.code === 'INVALID_ROLE_ID')
  assert.throws(() => parseMlbbIds('123456789', ''), e => e.payload.code === 'INVALID_ZONE_ID')
})

test('nombre del rango segun rank_level', () => {
  assert.equal(mlbbRankName(3), 'Guerrero')
  assert.equal(mlbbRankName(90), 'Épico')
  assert.equal(mlbbRankName(120), 'Leyenda')
  assert.equal(mlbbRankName(8000), 'Mítico')
  assert.equal(mlbbRankName(null), '')
})

test('enviar codigo: ok, cuenta inexistente y servicio caido', async () => {
  const ok = fakeApi({ '/user/auth/send-vc': json(200, { code: 0, data: '', msg: 'ok' }) })
  assert.equal(await sendMlbbCode('123456789', '2045', { fetchImpl: ok.fetchImpl }), true)
  assert.deepEqual(ok.calls[0].body, { role_id: 123456789, zone_id: 2045 })

  // Respuesta real del servicio para un ID que no existe (probado el 6/oct/2026).
  const missing = fakeApi({ '/user/auth/send-vc': json(200, { code: -20007, msg: '', data: '' }) })
  await assert.rejects(sendMlbbCode('1', '1', { fetchImpl: missing.fetchImpl }), e => e.status === 404 && e.payload.code === 'GAME_ACCOUNT_NOT_FOUND')

  const down = { fetchImpl: async () => { throw new Error('ECONNREFUSED') } }
  await assert.rejects(sendMlbbCode('123456789', '2045', down), e => e.status === 503)
})

test('503 con host alternativo: reintenta una vez en ese host', async () => {
  const hosts = []
  const fetchImpl = async (url) => {
    hosts.push(new URL(url).host)
    return hosts.length === 1 ? json(503, { alternative_endpoint: 'https://backup.rone.dev/api' }) : json(200, { code: 0 })
  }
  assert.equal(await sendMlbbCode('123456789', '2045', { fetchImpl }), true)
  assert.deepEqual(hosts, ['arena.rone.dev', 'backup.rone.dev'])
})

test('503 con host de otro dominio: no se sigue (el ID y el codigo no salen del proveedor)', async () => {
  const hosts = []
  const fetchImpl = async (url) => {
    hosts.push(new URL(url).host)
    return json(503, { alternative_endpoint: 'https://evil.example/api' })
  }
  await assert.rejects(sendMlbbCode('123456789', '2045', { fetchImpl }))
  assert.deepEqual(hosts, ['arena.rone.dev'])
  assert.equal(sameProvider('http://x.rone.dev/api', 'https://arena.rone.dev/api'), false)
  assert.equal(sameProvider('https://notrone.dev/api', 'https://arena.rone.dev/api'), false)
  assert.equal(sameProvider('https://mirror.example/api', 'https://arena.rone.dev/api', ['mirror.example']), true)
})

test('validar codigo: devuelve el perfil, cierra la sesion y no expone el jwt', async () => {
  const api = fakeApi({
    '/user/auth/login': json(200, { code: 0, data: { jwt: 'JWT-1', roleid: 123456789, zoneid: 2045 } }),
    '/user/info': json(200, { code: 0, data: { name: 'xX_Neo_Xx', level: 87, rank_level: 120, history_rank_level: 140, reg_country: 'DO', avatar: 'https://img.example/a.jpg' } }),
    '/user/auth/logout': json(200, { code: 0 }),
  })
  const profile = await verifyMlbbCode('123456789', '2045', '4821', { fetchImpl: api.fetchImpl })
  assert.deepEqual(profile, { nickname: 'xX_Neo_Xx', avatar: 'https://img.example/a.jpg', level: 87, rankLevel: 120, historyRankLevel: 140, country: 'DO' })
  assert.deepEqual(api.calls[0].body, { role_id: 123456789, zone_id: 2045, vc: 4821 })
  assert.equal(api.calls[1].auth, 'Bearer JWT-1')
  await new Promise(r => setImmediate(r))
  assert.ok(api.calls.some(c => c.path === '/user/auth/logout'))
  assert.ok(!JSON.stringify(profile).includes('JWT'))
})

test('validar codigo: codigo malo (500 del servicio) y cuenta distinta', async () => {
  // El servicio responde 500 con un codigo incorrecto (probado el 6/oct/2026).
  const wrong = fakeApi({ '/user/auth/login': json(500, { status: 'error', code: 'INTERNAL_SERVER_ERROR' }) })
  await assert.rejects(verifyMlbbCode('123456789', '2045', '1111', { fetchImpl: wrong.fetchImpl }), e => e.payload.code === 'GAME_CODE_INVALID')

  const other = fakeApi({ '/user/auth/login': json(200, { code: 0, data: { jwt: 'J', roleid: 999, zoneid: 2045 } }) })
  await assert.rejects(verifyMlbbCode('123456789', '2045', '1111', { fetchImpl: other.fetchImpl }), e => e.payload.code === 'GAME_ACCOUNT_MISMATCH')
})

test('sin /user/info la cuenta igual queda probada, sin datos visibles', async () => {
  const api = fakeApi({
    '/user/auth/login': json(200, { code: 0, data: { jwt: 'J', roleid: 123456789, zoneid: 2045 } }),
    '/user/info': json(500, null),
    '/user/auth/logout': json(200, { code: 0 }),
  })
  const profile = await verifyMlbbCode('123456789', '2045', '4821', { fetchImpl: api.fetchImpl })
  assert.equal(profile.nickname, '')
  assert.equal(profile.level, null)
})
