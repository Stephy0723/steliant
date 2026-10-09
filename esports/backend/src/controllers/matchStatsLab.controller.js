// TEMPORAL — Laboratorio de capturas (/admin/laboratorio-estadisticas).
// Usa la misma extractMatchStats que los torneos para probar la lectura de la IA
// con capturas sueltas. No guarda imagen ni resultado. Borrar junto con la página.
import { imageMime, extractMatchStats } from '../services/matchStatsVision.service.js'

export async function extractLabStats(req, res, next) {
  try {
    const found = /^data:image\/[a-z]+;base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.dataUrl || ''))
    if (!found) throw Object.assign(new Error('Envía una imagen PNG, JPEG o WebP.'), { status: 400 })
    const bytes = Buffer.from(found[1], 'base64')
    const image = { mimeType: imageMime(bytes), data: found[1] }
    const started = Date.now()
    const { raw, model } = await extractMatchStats(image, { withModel: true })
    res.json({ raw, model, ms: Date.now() - started })
  } catch (error) { next(error) }
}
