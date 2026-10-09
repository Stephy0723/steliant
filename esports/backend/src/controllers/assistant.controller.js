import { chat } from '../services/assistant.service.js'
import { availableProviders } from '../services/ai.service.js'

/** GET /api/assistant/status — ¿GG tiene un proveedor de IA configurado? */
export function status(_req, res) {
  res.json({ available: availableProviders().length > 0 })
}

/**
 * POST /api/assistant/chat — mensaje para GG.
 * body: { message, history?, page?: { path, title, tournamentForm? } }
 * La identidad sale de la sesion (req.user), nunca del body.
 */
export async function chatWithGG(req, res, next) {
  try {
    const { message, history, page } = req.body || {}
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ message: 'Escribe un mensaje.' })
    }
    if (availableProviders().length === 0) {
      return res.status(503).json({ message: 'GG no esta disponible: falta configurar la IA.' })
    }
    const result = await chat({ user: req.user, message, history, page })
    res.json(result)
  } catch (err) {
    console.error('[GG] chat error:', err.message)
    res.status(502).json({ message: 'GG no pudo responder ahora. Intenta de nuevo en unos segundos.' })
  }
}
