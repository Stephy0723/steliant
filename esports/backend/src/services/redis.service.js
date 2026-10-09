import { config } from '../config/index.js'

let client = null
let attempted = false

export function getRedisClient() {
  if (attempted) return client
  attempted = true

  if (!config.redis.url) {
    console.info('[redis] No REDIS_URL configured — using memory fallback')
    return null
  }

  import('ioredis').then(({ default: Redis }) => {
    client = new Redis(config.redis.url, {
      lazyConnect: true,
      retryStrategy: () => 60_000,
      maxRetriesPerRequest: 1,
    })

    client.on('connect', () => console.log('[redis] Connected'))
    client.on('error', (err) => {
      console.warn('[redis] Error — falling back to memory:', err.message)
      client = null
    })

    client.connect().catch(() => { client = null })
  }).catch(() => {
    console.warn('[redis] ioredis not available — using memory fallback')
  })

  return client
}
