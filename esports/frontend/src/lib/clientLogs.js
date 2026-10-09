const KEY = 'gg-client-logs'
const LIMIT = 400

function nowIso() {
  return new Date().toISOString()
}

function readLogs() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeLogs(logs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(logs.slice(-LIMIT)))
  } catch {
    /* noop */
  }
}

function serializeArg(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack || '',
    }
  }

  if (typeof value === 'string') return value

  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return String(value)
  }
}

export function pushClientLog(level, message, extra = null) {
  const logs = readLogs()
  logs.push({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    message,
    extra,
    createdAt: nowIso(),
  })
  writeLogs(logs)
}

export function getClientLogs() {
  return readLogs()
}

export function initClientLogCapture() {
  if (window.__ggClientLogCaptureReady) return
  window.__ggClientLogCaptureReady = true

  const methods = ['log', 'warn', 'error']
  methods.forEach(method => {
    const original = console[method]
    console[method] = (...args) => {
      try {
        const message = args.map(arg => typeof arg === 'string' ? arg : serializeArg(arg)).map(part => typeof part === 'string' ? part : JSON.stringify(part)).join(' ')
        pushClientLog(method, message, args.map(serializeArg))
      } catch {
        /* noop */
      }
      original(...args)
    }
  })

  window.addEventListener('error', event => {
    pushClientLog('error', event.message || 'window.error', {
      filename: event.filename || '',
      lineno: event.lineno || 0,
      colno: event.colno || 0,
    })
  })

  window.addEventListener('unhandledrejection', event => {
    pushClientLog('error', 'unhandledrejection', serializeArg(event.reason))
  })
}

